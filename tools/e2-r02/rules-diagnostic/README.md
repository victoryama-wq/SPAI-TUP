# Reproductor de Rules E2-R02

Referencia: 86caef3a966db5ab5c26931ebddffa909289c2a6. Node 22; Java y jars exactos en docs/evidence/r02-rules-20261028/versions.json. Firebase Tools proviene del lock principal. rules-unit-testing 5.0.0 + Firebase 12.13.0 tienen su propio lock, sin cambiar las dependencias de la aplicación.

Ejecutar exclusivamente en una copia nueva, sin selección de BD ni servicios de aceptación. Los puertos 48080/49099/45001/49199/44400/44310 deben estar libres. Nunca usar los slots acceptance-a/b para el diagnóstico.

```powershell
# Node 22 debe estar en PATH. Instalar con los locks del checkout.
npm ci --ignore-scripts
npm ci --prefix functions --ignore-scripts
npm ci --prefix tools/e2-r02/rules-diagnostic --ignore-scripts
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='rules-diagnostic'
node tools/local/run.mjs --review
# Segunda terminal, mismas tres variables:
node tools/e2-r02/rules-diagnostic/reproduce-minimal.mjs
node tools/e2-r02/rules-diagnostic/full-cases.mjs
$env:RULES_CASE='D1-BATCH'
node tools/e2-r02/rules-diagnostic/full-cases.mjs
Remove-Item Env:RULES_CASE
node tools/e2-r02/rules-diagnostic/classifier.test.mjs
node tools/e2-r02/rules-diagnostic/gate.mjs
```

El arnés mínimo genera una contraseña y JWT efímeros en Auth local; no imprime ni guarda credenciales. Usa el UID y claims ficticios declarados en minimal-fixture.json. Ejecuta la misma política por REST con token real del emulador y por rules-unit-testing. Recarga Rules antes de cada solicitud para vincular exactamente su traza, y restaura las Rules completas al terminar. No modificar ni ejecutar mientras alguien revise ese mismo entorno.

Las respuestas HTTP completas y cobertura están en minimal-48080.json (14 controles) y los 25 archivos .json.gz. El código para descomprimir es estándar gzip; contienen fixture, petición, claims sanitizados, respuesta y ruleCoverage. El ZIP de entrega incluye estos archivos y el código ejecutable.

## Diagnóstico y criterio

La raíz de cobertura de una expresión dinámica válida puede contener `undefined: {}` aun en el control autorizado 200. Cuando su predicado es false, el emulador 1.22.0 produce simultáneamente texto genérico `evaluation error` y evaluaciones false. Una propiedad deliberadamente inexistente, en cambio, produce una causa explícita en la traza: se mantiene como FAIL.

El clasificador exige operación exacta, expectativa de denegación, HTTP403, control positivo satisfactorio, traza vinculada y raíz false, sin causas ni diagnósticos desconocidos. Un 403 sin esa evidencia sigue INCONCLUSIVE. El lote requiere además la equivalencia exacta de cada escritura y su traza individual, además del control positivo de lote; no basta su ausencia de cambios. El control mínimo reproduce la interrupción de raíces posteriores. 74 aserciones incluyen errores reales, falta de control/traza, operación distinta, respuesta permitida indebida y lote adulterado.

No se modifican permisos ni firestore.rules. El nuevo gate compone evidencia previa comprobada por igualdad del código de aplicación/políticas con las nuevas trazas; no altera los informes antiguos ni oculta sus estados originales. full-results.json conserva la primera ejecución del lote inconclusa; targeted-D1-BATCH.json documenta la comprobación adicional. conclusive-results.json enlaza ambas ejecuciones.

La ampliación de local-runtime solo admite dos tuplas completas nuevas de loopback para aceptación; mezcla de puertos y proyectos reales siguen rechazadas. Requiere prueba de ruta HTTPS de esas instancias, no repetir la suite funcional sin cambios.
