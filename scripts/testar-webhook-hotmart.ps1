<#
.SYNOPSIS
  Testa o webhook da Hotmart (Edge Function hotmart-webhook) com os eventos de
  compra suportados. Valida Hottok, mapeamento de produto e o fluxo
  (criacao/bloqueio de acesso).

.DESCRIPTION
  Monta o payload no formato da Hotmart (data.buyer para PURCHASE_*, data.subscriber
  para SUBSCRIPTION_CANCELLATION) e envia para a Edge Function. Sem -DryRun, o
  evento grava compras.status de verdade (recarregue o app para ver o efeito).
  Use e-mail que ja tem conta no app para nao disparar convites desnecessarios.

.EXAMPLE
  .\scripts\testar-webhook-hotmart.ps1 -Hottok "SEU_HOTTOK" -Email "teste@exemplo.com" -DryRun

.EXAMPLE
  .\scripts\testar-webhook-hotmart.ps1 -Hottok "SEU_HOTTOK" -Email "teste@exemplo.com" -Evento PURCHASE_PROTEST
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Hottok,

  [Parameter(Mandatory = $true)]
  [string]$Email,

  [ValidateSet('PURCHASE_APPROVED','PURCHASE_CANCELED','PURCHASE_REFUNDED','PURCHASE_PROTEST','PURCHASE_BILLET_PRINTED','PURCHASE_CHARGEBACK','SUBSCRIPTION_CANCELLATION')]
  [string]$Evento,

  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$url = 'https://gllfuqiowddxzqicvdbo.supabase.co/functions/v1/hotmart-webhook'

$todosEventos = @(
  'PURCHASE_APPROVED',
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_PROTEST',
  'PURCHASE_BILLET_PRINTED',
  'PURCHASE_CHARGEBACK',
  'SUBSCRIPTION_CANCELLATION'
)
$eventos = if ($Evento) { @($Evento) } else { $todosEventos }

$headers = @{ 'X-Hotmart-Hottok' = $Hottok }
if ($DryRun) { $headers['X-Dry-Run'] = '1' }

function Novo-Payload([string]$evento) {
  if ($evento -eq 'SUBSCRIPTION_CANCELLATION') {
    return @{
      event = $evento
      data = @{
        product    = @{ name = 'TinoBem' }
        subscriber = @{
          email = $Email
          name  = 'William Silva'
          phone = @{ dddCell = '11'; cell = '999999999' }
        }
      }
    }
  }
  return @{
    event = $evento
    data = @{
      product = @{ name = 'TinoBem' }
      buyer = @{
        email               = $Email
        first_name          = 'William'
        last_name           = 'Silva'
        checkout_phone_code = '55'
        checkout_phone      = '11999999999'
      }
    }
  }
}

foreach ($ev in $eventos) {
  $body = Novo-Payload $ev | ConvertTo-Json -Depth 8
  $modo = if ($DryRun) { 'DRY-RUN' } else { 'REAL' }
  Write-Host "`n==> [$modo] $ev ($Email)" -ForegroundColor Cyan
  try {
    $resp = Invoke-RestMethod -Uri $url -Method POST -ContentType 'application/json' -Headers $headers -Body $body
    $resp | ConvertTo-Json -Depth 6
  } catch {
    $msg = $_.Exception.Message
    try {
      if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $msg = $reader.ReadToEnd()
      }
    } catch {}
    Write-Host "ERRO: $msg" -ForegroundColor Red
  }
}