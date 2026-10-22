# Ejecutar solo si otra computadora de la red no puede acceder a la demo 4205.
# Requiere PowerShell como administrador. No inicia ni reinicia servicios.
$ErrorActionPreference = 'Stop'
$demoAddress = '192.168.42.1'
$demoNode = 'C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
$demoInterface = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $demoAddress
if ($demoInterface.PrefixLength -ne 22) { throw 'La red cambió. Revisa la IPv4 y subred antes de crear la regla.' }
if (-not (Test-Path -LiteralPath $demoNode)) { throw 'No se encuentra el ejecutable Node utilizado por esta demo.' }
if (-not (Get-NetFirewallRule -DisplayName 'SPAI demo complement LAN 4205' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'SPAI demo complement LAN 4205' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4205 -LocalAddress $demoAddress -RemoteAddress 192.168.40.0/22 -Profile Public,Private -Program $demoNode
}
