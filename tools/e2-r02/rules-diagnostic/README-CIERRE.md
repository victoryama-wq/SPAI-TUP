# Cierre del gate sobre la candidata aceptada 819e80b3bbcef27279c69608b89f5de8f685ccd0

Usar checkout independiente `SPAI-TUP-R02-CIERRE-20261030`, Node22.23.2 y locks del repositorio. No ejecutar en carpetas `.local/review-*`, instancias congeladas ni demo compartida. Las pruebas preparan únicamente documentos/cuentas ficticios en 48080/49099. No se necesita ni se importa respaldo privado.

## Verificación offline, sin levantar servicios

```powershell
node --test tools/e2-r02/rules-diagnostic/close-gate.test.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs --user-deletion
```

El primer gate devuelve el estado de 23 R02; el segundo el de 2 baja. Ambos registran el inventario completo sin duplicación. No ejecutan la aplicación ni reutilizan la aceptación humana como prueba técnica. Fallan si la política o aplicación difieren de la candidata, falta un ID, la cobertura corresponde a otra política o el control es insuficiente. La comprobación Git normaliza sólo CRLF/LF; las coberturas se comparan por SHA-256 exacto del archivo cargado.

## Reproducción con emuladores nuevos

Dependencias disponibles en este checkout mediante junctions de sólo uso hacia instalaciones existentes; no se cambiaron locks ni paquetes. Para una copia nueva sin dependencias, instalar los tres locks con `npm ci --ignore-scripts`, `npm ci --prefix functions --ignore-scripts` y `npm ci --prefix tools/e2-r02/rules-diagnostic --ignore-scripts`. No usar credenciales reales.

```powershell
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='rules-diagnostic'
$env:RULES_EVIDENCE_DIR='docs/evidence/r02-rules-close-20261030'
node tools/e2-r02/rules-diagnostic/start-isolated.mjs
```

Esperar `RULES DIAGNOSTIC READY`. El supervisor rechaza puertos ocupados y no importa ni siembra escenarios de aceptación. En otra terminal del mismo checkout y con las mismas variables:

```powershell
node tools/e2-r02/rules-diagnostic/reproduce-minimal.mjs
foreach ($case in 'AUTH-REVOKED-BEFORE-COMMIT','SPECIAL-DISABLED-UPDATE','D1-BATCH','DELETION-OLD-TOKEN-READ','DELETION-REENTRY-BOOTSTRAP') {
  $env:RULES_CASE=$case
  node tools/e2-r02/rules-diagnostic/full-cases.mjs
  if ($LASTEXITCODE -ne 0) { throw "Caso no aprobado: $case" }
}
Remove-Item Env:RULES_CASE
node --test tools/e2-r02/rules-diagnostic/close-gate.test.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs --user-deletion
node tools/e2-r02/rules-diagnostic/stop-isolated.mjs
```

Estos son los cinco casos repetidos el 30/10 para vincular el arnés nuevo con la ejecución actual, junto a los 14 controles mínimos. Los otros veinte casos conservan evidencia suficiente con hash de política idéntico. Para reproducir cualquiera individualmente, fijar `RULES_CASE` al ID de la matriz. Sin esa variable se ejecutan los 25; no es necesario hacerlo para reutilizar evidencia válida.

`RULES_EVIDENCE_DIR` guarda la nueva ejecución dentro de `docs/evidence` de este checkout. No cambiarlo para sobrescribir la evidencia histórica del 28/10. El comando de gate registra el resultado en `r02-rules-close-20261030`; usa las cinco trazas nuevas presentes y las restantes históricas. El clasificador no cambió. Los controles deliberadamente inválidos deben permanecer FAIL, y el lote mínimo sin pruebas constituyentes debe permanecer INCONCLUSIVE_EVALUATOR bajo el clasificador individual. El lote contractual D1-BATCH se resuelve con pruebas exactas constituyentes y control positivo, no ignorando esos diagnósticos.

Autenticación sintética efímera, fixtures y Rules mínimas: `minimal-fixture.json`, `minimal.rules`, `full-fixture.mjs`, `full-cases.mjs`. Cada ejecución recarga Rules antes de la petición para ligar la cobertura y restaura las completas al terminar. Las peticiones/claims sanitizados están en los JSON y gzip. Versiones y hashes: `docs/evidence/r02-rules-close-20261030/versions.json`.

El gate histórico `gate.mjs` permanece sin cambios para 86caef/aa532c. No es el comando de cierre sobre la aplicación actual. No hay modificación de Rules, permisos, Functions ni interfaces; no se necesita una nueva candidata HTTPS o repetir A/B por este ajuste del arnés.
