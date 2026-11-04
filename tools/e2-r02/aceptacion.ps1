param([Parameter(Mandatory=$true)][ValidateSet('Preparacion','Renovacion')][string]$Escenario)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$stage = Join-Path $repo '.local/r02-complement-20261023'
$node = (Get-Content (Join-Path $repo '.vscode/tasks.json') -Raw | ConvertFrom-Json).tasks[0].command
$mode = if ($Escenario -eq 'Preparacion') { 'preparation' } else { 'renewal' }
Write-Host 'Reemplaza exclusivamente los fixtures de ACEPTACION 28080. Cierra tu recorrido de 4204 antes de continuar. No modifica 4206/18080.'
$oldIsolated=$env:SPAI_LOCAL_TEST_ISOLATED; $oldSynthetic=$env:SPAI_LOCAL_SYNTHETIC; $oldSlot=$env:SPAI_LOCAL_TEST_SLOT
Push-Location -LiteralPath $stage
try {
  $env:SPAI_LOCAL_TEST_ISOLATED='true'; $env:SPAI_LOCAL_SYNTHETIC='true'; $env:SPAI_LOCAL_TEST_SLOT='complement'
  & $node tools/local/control.mjs health
  if ($LASTEXITCODE -ne 0) { throw 'Inicia primero la tarea SPAI: Restaurar revision R02 aislada guardada.' }
  & $node tools/e2-r02/prepare-acceptance.mjs $mode
  if ($LASTEXITCODE -ne 0) { throw 'No se completó la preparación; revisa el error antes de probar.' }
  $session = Get-Content .local/session-complement.json -Raw | ConvertFrom-Json
  if ($session.projectId -ne 'demo-spai-tup' -or $session.synthetic -ne $true) { throw 'Sesión no ficticia; guardado rechazado.' }
  for ($attempt=0; $attempt -lt 3; $attempt++) {
    try {
      $saved=Invoke-RestMethod -Uri 'http://127.0.0.1:24310/save' -Method Post -Headers @{Authorization=('Bearer '+$session.token)} -TimeoutSec 60
      if (-not $saved.exported) { throw 'El supervisor no confirmó la exportación.' }
      break
    } catch { if ($attempt -eq 2) { throw }; Start-Sleep -Seconds 2 }
  }
  Write-Host ('ESCENARIO LISTO Y GUARDADO: '+$Escenario+' — recarga http://127.0.0.1:4204/')
} finally {
  Pop-Location
  $env:SPAI_LOCAL_TEST_ISOLATED=$oldIsolated; $env:SPAI_LOCAL_SYNTHETIC=$oldSynthetic; $env:SPAI_LOCAL_TEST_SLOT=$oldSlot
}
