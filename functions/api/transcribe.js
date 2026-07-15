/**
 * Cloudflare Pages Function — /api/transcribe
 *
 * Recebe um blob de áudio (audio/webm ou audio/mp4) via POST,
 * envia ao modelo Whisper-large-v3-turbo via Workers AI e
 * retorna a transcrição em JSON.
 *
 * O binding "AI" é configurado uma única vez no dashboard do
 * Cloudflare Pages (Settings → Functions → AI Bindings).
 * Nenhuma chave de API é exposta no código.
 */
export async function onRequestPost({ request, env }) {
  // Verifica se o binding de AI está disponível
  if (!env.AI) {
    return Response.json(
      { error: 'AI binding não configurado. Adicione o binding "AI" nas configurações do Cloudflare Pages.' },
      { status: 503 }
    );
  }

  // Verifica o Content-Type (deve ser áudio)
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.startsWith('audio/')) {
    return Response.json(
      { error: 'Content-Type inválido. Envie um arquivo de áudio.' },
      { status: 400 }
    );
  }

  try {
    // Lê o blob de áudio enviado pelo frontend
    const audioBuffer = await request.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return Response.json({ error: 'Áudio vazio.' }, { status: 400 });
    }

    // Converte ArrayBuffer para base64 (Web API nativa, sem Buffer)
    const bytes = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const audioBase64 = btoa(binary);

    let result;
    try {
      // Tenta rodar o modelo turbo primeiro
      result = await env.AI.run(
        '@cf/openai/whisper-large-v3-turbo',
        {
          audio: audioBase64,
        }
      );
    } catch (turboErr) {
      console.warn('[transcribe] Whisper-large-v3-turbo falhou, tentando fallback para whisper standard:', turboErr);
      // Fallback para o modelo whisper padrão
      result = await env.AI.run(
        '@cf/openai/whisper',
        {
          audio: audioBase64,
        }
      );
    }

    // Retorna a transcrição
    return Response.json({
      text: result.text ?? '',
    });
  } catch (err) {
    console.error('[transcribe] Erro ao chamar Workers AI:', err);
    return Response.json(
      { error: `Falha na transcrição: ${err.message || err.toString()}` },
      { status: 500 }
    );
  }
}

// Rejeita qualquer método que não seja POST
export async function onRequest({ request }) {
  if (request.method !== 'POST') {
    return new Response('Método não permitido', { status: 405 });
  }
}
