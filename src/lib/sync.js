// ─── Camada de sincronização Supabase ────────────────────────────────────────
// Os módulos de persistência (profile.js, reports.js, consulta.js) continuam
// escrevendo em localStorage (cache + modo apresentação). Esta camada espelha
// essas mudanças no Supabase quando o usuário está autenticado.
//
// Estratégia:
// - Entries: incremental (insert/update/delete), pois podem ser muitas.
// - Reports e consultas: replace-all (arrays pequenos ≤ 10/≤ 5), evitando
//   mapeamento de ids entre o formato local e o uuid do banco.
//
// Todas as funções são fire-and-forget seguras: quando não há sessão ou o
// cliente não está configurado, retornam noop (modo apresentação preservado).

import { supabase } from './supabaseClient.js';

const pad2 = (n) => String(n).padStart(2, '0');

// ── Conversão dia relativo ↔ absoluto ────────────────────────────────────────
// O timeline agrupa por 'hoje'/'ontem'/'anteontem' (textos relativos). Para
// persistência estável no banco, convertemos para 'DD/MM' absoluto no save e
// de volta para relativo no load, usando o ts de cada entrada.

function dataDDMM(ts) {
  const d = new Date(ts);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

// Timestamp local do evento a partir do rótulo de dia relativo + hora.
// 'hoje'/'agora' → hoje na hora informada; 'ontem' → dia anterior;
// 'anteontem' → dois dias antes. Usa aritmética de calendário (à prova de DST).
export function tsParaDia(day, time) {
  const now = new Date();
  const offset = day === 'ontem' ? 1 : day === 'anteontem' ? 2 : 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const [h, m] = String(time || '').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

export function dayToAbsolute(entry) {
  const d = entry?.day;
  if (d === 'hoje' || d === 'ontem' || d === 'anteontem') {
    const ts = entry?.ts || Date.now();
    return dataDDMM(ts);
  }
  return d || dataDDMM(entry?.ts || Date.now());
}

export function dayToRelative(day, _ts) {
  if (day && /^\d{2}\/\d{2}$/.test(day)) {
    const [dd, mm] = day.split('/').map(Number);
    const now = new Date();
    const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const ref = new Date(now.getFullYear(), mm - 1, dd);
    const diff = Math.round((hoje.getTime() - ref.getTime()) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'ontem';
    if (diff === 2) return 'anteontem';
  }
  return day;
}

// ── Guards ───────────────────────────────────────────────────────────────────

async function isAuthed() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ── Entries ──────────────────────────────────────────────────────────────────

export async function syncEntryInsert(entry) {
  const uid = await isAuthed();
  if (!uid) return;
  const { data, error } = await supabase
    .from('entries')
    .insert({
      user_id: uid,
      type: entry.type,
      ts: new Date(entry.ts || Date.now()).toISOString(),
      day: dayToAbsolute(entry),
      time: entry.time || null,
      title: entry.title || null,
      description: entry.description || null,
      meta: entry.meta || {},
    })
    .select('id')
    .single();
  if (error || !data) throw error || new Error('insert failed');
  return data.id;
}

export async function syncEntryUpdate(entry) {
  const uid = await isAuthed();
  if (!uid) return;
  const { error } = await supabase
    .from('entries')
    .update({
      type: entry.type,
      ts: new Date(entry.ts || Date.now()).toISOString(),
      day: dayToAbsolute(entry),
      time: entry.time || null,
      title: entry.title || null,
      description: entry.description || null,
      meta: entry.meta || {},
    })
    .eq('id', entry.id)
    .eq('user_id', uid);
  if (error) throw error;
}

export async function syncEntryDelete(id) {
  const uid = await isAuthed();
  if (!uid) return;
  const { error } = await supabase.from('entries').delete().eq('id', id).eq('user_id', uid);
  if (error) throw error;
}

export async function syncEntriesPull() {
  const uid = await isAuthed();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('entries')
    .select('id, type, ts, day, time, title, description, meta')
    .eq('user_id', uid)
    .order('ts', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    type: r.type,
    ts: new Date(r.ts).getTime(),
    day: dayToRelative(r.day, r.ts),
    time: r.time,
    title: r.title,
    description: r.description,
    meta: r.meta || {},
  }));
}

// ── Profile ──────────────────────────────────────────────────────────────────

export async function syncProfileUpsert(p) {
  const uid = await isAuthed();
  if (!uid) return;
  const { error } = await supabase.from('profiles').upsert(
    {
      id: uid,
      nome: p?.nome ?? null,
      idade: Number.isFinite(p?.idade) ? p.idade : null,
      peso: Number.isFinite(p?.peso) ? p.peso : null,
      altura: Number.isFinite(p?.altura) ? p.altura : null,
      condicoes: Array.isArray(p?.condicoes) ? p.condicoes : [],
      outros: p?.outros ?? null,
      historico_familiar: Array.isArray(p?.historico_familiar) ? p.historico_familiar : [],
      acoes_alivio_custom: Array.isArray(p?.acoes_alivio_custom) ? p.acoes_alivio_custom : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function syncProfilePull() {
  const uid = await isAuthed();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('nome, idade, peso, altura, condicoes, outros, historico_familiar, acoes_alivio_custom')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Preferências ─────────────────────────────────────────────────────────────

export async function syncPrefsUpsert(prefs) {
  const uid = await isAuthed();
  if (!uid) return;
  const { error } = await supabase.from('user_prefs').upsert(
    {
      id: uid,
      cursiva: Boolean(prefs?.cursiva),
      ink_level: Number.isFinite(prefs?.ink_level) ? prefs.ink_level : 55,
      font_scale: Number.isFinite(prefs?.font_scale) ? prefs.font_scale : 100,
      suavizar_janela: Number.isFinite(prefs?.suavizar_janela) ? prefs.suavizar_janela : 7,
      anonimo: Boolean(prefs?.anonimo),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw error;
}

export async function syncPrefsPull() {
  const uid = await isAuthed();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('user_prefs')
    .select('cursiva, ink_level, font_scale, suavizar_janela, anonimo')
    .eq('id', uid)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Leitura do snapshot local de preferências (tlgut_prefs + chaves legadas).
// Usada pelo syncPrefsMerge para que qualquer caller (telas, App) possa
// sincronizar o objeto completo de preferências sem conhecer todos os valores.
export function readPrefsSnapshot() {
  let p = {};
  try {
    const raw = localStorage.getItem('tlgut_prefs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') p = { ...parsed };
    }
  } catch {}
  try {
    const v = Number(localStorage.getItem('tlgut_suavizar_janela'));
    p.suavizar_janela = Number.isFinite(v) ? v : 7;
  } catch {}
  try { p.anonimo = localStorage.getItem('tlgut_anonimo') === '1'; } catch {}
  return p;
}

export async function syncPrefsMerge(partial = {}) {
  return syncPrefsUpsert({ ...readPrefsSnapshot(), ...partial });
}

// ── Reports (replace-all por usuário) ────────────────────────────────────────

export async function syncReportsReplace(type, list) {
  const uid = await isAuthed();
  if (!uid) return;
  await supabase.from('reports').delete().eq('user_id', uid).eq('type', type);
  if (!Array.isArray(list) || list.length === 0) return;
  const rows = list.map((r) => ({
    user_id: uid,
    type,
    report: r.report,
    modelo: r.modelo || null,
    period_start: r.period_start || null,
    period_end: r.period_end || null,
    resumo_preview:
      r.resumo_preview ||
      (typeof r.report?.resumo_executivo === 'string'
        ? r.report.resumo_executivo.replace(/\n+/g, ' ').slice(0, 120)
        : ''),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  }));
  const { error } = await supabase.from('reports').insert(rows);
  if (error) throw error;
}

export async function syncReportsPull(type) {
  const uid = await isAuthed();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('reports')
    .select('id, type, report, modelo, period_start, period_end, resumo_preview, created_at')
    .eq('user_id', uid)
    .eq('type', type)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    type: r.type,
    report: r.report,
    modelo: r.modelo,
    period_start: r.period_start,
    period_end: r.period_end,
    resumo_preview: r.resumo_preview,
    created_at: new Date(r.created_at).getTime(),
  }));
}

// ── Consultas (replace-all por usuário) ──────────────────────────────────────

export async function syncConsultasReplace(list) {
  const uid = await isAuthed();
  if (!uid) return;
  await supabase.from('consultas').delete().eq('user_id', uid);
  if (!Array.isArray(list) || list.length === 0) return;
  const rows = list.map((c) => ({
    user_id: uid,
    data: c.data || null,
    especialidade: c.especialidade || null,
    status: c.status || 'agendada',
  }));
  const { error } = await supabase.from('consultas').insert(rows);
  if (error) throw error;
}

export async function syncConsultasPull() {
  const uid = await isAuthed();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('consultas')
    .select('id, data, especialidade, status, created_at')
    .eq('user_id', uid)
    .order('data', { ascending: true });
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    data: c.data,
    especialidade: c.especialidade,
    status: c.status,
    created_at: c.created_at ? new Date(c.created_at).getTime() : 0,
  }));
}

// ── Tracking (dashboard futuro) ──────────────────────────────────────────────

export async function syncLogEvent(tipo, payload = {}) {
  const uid = await isAuthed();
  if (!uid) return;
  await supabase.from('eventos').insert({ user_id: uid, tipo, payload });
}

export async function syncLogRequest({ tipo, modelo, status, tokens_in = 0, tokens_out = 0 }) {
  const uid = await isAuthed();
  if (!uid) return;
  await supabase.from('requests').insert({
    user_id: uid,
    tipo,
    modelo: modelo || null,
    status: status || null,
    tokens_in,
    tokens_out,
  });
}

// ── Exclusão da conta (edge function) ───────────────────────────────────────
// A edge function 'delete-account' (verify_jwt) apaga os dados nas 7 tabelas e
// o usuário do auth. O JWT da sessão é anexado automaticamente pelo invoke.

export async function syncDeleteAccount() {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('delete-account', { body: {} });
  if (error) throw error;
}

// ── Pull completo (usado no login e no retorno da sessão) ───────────────────

export async function syncPullAll() {
  const uid = await isAuthed();
  if (!uid) return null;
  const [entries, profile, prefs, consultas, reportsIA, reportsExpress] = await Promise.all([
    syncEntriesPull(),
    syncProfilePull(),
    syncPrefsPull(),
    syncConsultasPull(),
    syncReportsPull('ia'),
    syncReportsPull('express'),
  ]);
  return { entries, profile, prefs, consultas, reportsIA, reportsExpress };
}
