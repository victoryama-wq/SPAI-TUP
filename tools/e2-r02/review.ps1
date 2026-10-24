param([ValidateSet('emulators','prepare','frontend','stop')][string]$Action = 'frontend', [string]$NodePath = $env:SPAI_NODE22)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
$env:SPAI_LOCAL_TEST_ISOLATED = 'true'
$env:SPAI_LOCAL_SYNTHETIC = 'true'
$env:SPAI_LOCAL_TEST_SLOT = 'isolated'
$reviewNode = if ($NodePath) { $NodePath } else { (Get-Command node).Source }
if (!(Test-Path -LiteralPath $reviewNode) -or (& $reviewNode --version) -notmatch '^v22\.') { throw 'Indica Node 22 con -NodePath o SPAI_NODE22. No cambies los puertos ni el proyecto.' }
switch ($Action) {
  'emulators' {
    if (Test-Path -LiteralPath '.local/r02-review/latest.json') { & $reviewNode tools/local/recover.mjs --r02 }
    else { & $reviewNode tools/local/run.mjs --review --r02-review }
  }
  'prepare' { & $reviewNode tools/e2-r02/prepare-review.mjs }
  'frontend' { & $reviewNode node_modules/@angular/cli/bin/ng.js serve --configuration isolated --host 127.0.0.1 --port 4202 }
  'stop' { & $reviewNode tools/local/control.mjs stop }
}
exit $LASTEXITCODE
