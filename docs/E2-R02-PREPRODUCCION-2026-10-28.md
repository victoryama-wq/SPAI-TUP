# E2-R02 — Revisión de preproducción, 28 de octubre de 2026

**Resultado: correcciones comprobadas localmente; validación integral de R02 NO completada. Gate R02 BLOCKED (salida 1). Aceptación humana PENDIENTE. Producción BLOQUEADA.** Responsable de implementación y comprobación técnica: Codex. El informe del propietario se incorpora [sin convertirlo en aceptación](INFORME-PREPRODUCCION-E2-R02-2026-10-28.md). No se implementó R03 ni se revocaron aprobaciones visuales anteriores.

## Versión, alcance y conservación

- Base informada y comprobada: `5ef70c31a44fdc9a11a3ca02b8925f7677b46c91`, rama original `codex/usuarios-baja-complemento`, carpeta `SPAI-TUP-BAJA-20261021`. Se conservaron sus cambios locales posteriores, documentos y evidencias sin reset ni clean.
- Código evaluado: **`86caef3a966db5ab5c26931ebddffa909289c2a6`**, rama **`codex/e2-r02-preproduccion`**, checkout separado `SPAI-TUP-R02-PREPROD-20261028`. El commit documental posterior no cambia ese código.
- [Manifiesto de fuentes y evidencia](evidence/r02-preproduction-20261028/evaluated-version.json). Las ejecuciones anteriores al commit usan las mismas fuentes; el último ajuste de resolución del nombre del solicitante se comprobó nuevamente con la suite de baja a las 17:30 UTC. No se presenta evidencia de versiones anteriores como ejecución nueva.
- Túnel local 4206 actualizado a `tunnel-acceptance-86caef3a966d-20261028175058`. [Verificación HTTPS](evidence/r02-preproduction-20261028/tunnel-verification.json): inicio DEMO y consultas de Usuarios, Bitácora y Ciclos, sin errores JavaScript, desde esta laptop a través del enlace público. Esto NO acredita un segundo equipo físico, aceptación humana ni producción.
- Se copiaron únicamente fuentes de aplicación y el servidor de baja al stage persistente de aceptación; se compiló el frontend tunnel y se cambiaron sus archivos servidos. Sin recargar fixtures, migrar roles ni reiniciar los emuladores compartidos. El cambio de Functions se cargó por su observador local.
- Exportación del supervisor de aceptación: `exported: true, stopped: false` antes de actualizar. [Comparación de preservación](evidence/r02-preproduction-20261028/preservation.json): documentos de nivel superior, sus updateTime y cuentas Auth idénticos antes/después de actualizar, antes del login de comprobación. No se enumeraron subcolecciones; no se afirma una auditoría recursiva de estas. La verificación de inicio posterior puede actualizar metadatos normales de sesión.
- Instancia original: Firestore 18080, Auth 19099, 20 colecciones superiores / 5 cuentas. Aceptación remota: Firestore 28080, Auth 29099, 26 colecciones / 4 cuentas. Ambas conservadas; la segunda sigue con 27-1 en Captura cerrada y Especiales habilitado por el propietario. La banda «PREPARACIÓN (escenario base)» identifica la preparación original, no reemplaza el estado real mostrado en Ciclos.
- Pruebas de escritura únicamente en la tercera instancia ficticia: Firestore 39080, Auth 40099, Functions 36001, Storage 40199, hub 35400, control 35310. Proyecto `demo-spai-tup`. No se tocó respaldo privado, selección importada, producción, Moodle ni SAEKO.

## Causas y correcciones comprobadas

### U-01 — Finalización de baja

La [lectura persistida de la base](evidence/r02-preproduction-20261028/baseline-readonly.json) acredita que el inicio guardaba `actorId`, `user`, `reason` y `operationId`; el final solo conservaba el UID y la operación, sin nombre legible ni descripción. El job conservaba destinatario y motivo. No fue un nombre omitido por el usuario ni un error de consulta.

`functions/security/user-deletion.js` registra al comenzar un snapshot del solicitante obtenido de la autenticación y del perfil leído en servidor. No usa identidad enviada libremente por el cliente. Job, referencia de baja, evento y auditoría conservan actor, destinatario y motivo. El final usa el mismo operationId y distingue `SERVER` de `ADMIN_RETRY` como ejecutor técnico, conservando al solicitante original aunque ya no exista su perfil/Auth. Solo confirma COMPLETED después de eliminar y comprobar la ausencia de Authentication. La persistencia del final es atómica; el resultado estable evita duplicados.

Un job antiguo aún pendiente puede recuperar al solicitante solo de su auditoría inicial inequívocamente vinculada. Un evento histórico ya completado NO se reescribe: `audit-display.ts` puede presentar el actor/motivo de su inicio cuando ambos ya forman parte de la consulta autorizada y coinciden operación, actor y destinatario. Sin esa evidencia conserva la limitación explícita; no consulta otros ámbitos ni usa al observador actual. La captura antigua del túnel no contiene el nombre del destinatario en el propio evento final: la interfaz lo advierte y conserva su referencia; no inventa ese nombre.

Prueba nueva: fallo Auth → ningún evento final → eliminación del perfil/Auth del solicitante → reintento por otro administrador → ausencia Auth confirmada, solicitante original, ejecutor distinto, destinatario, motivo y fecha de servidor → repetición sin duplicados. También se verifica recuperación de job legado desde su inicio auténtico. [Baja: 10 PASS / 2 inconclusos de Rules](evidence/r02-preproduction-20261028/server-results.json). Los inconclusos son lectura con token anterior y bootstrap directo; no se consideran aprobados por 403.

### UI-01 — Roles disponibles

La métrica cuenta **definiciones con estado contractual `ACTIVE` devueltas por el directorio autorizado**, no personas, asignaciones ni perfiles base. En la demo existía `demo-consulta` con estado legado `Activo` y permisos con formato legado. La etiqueta genérica lo presentaba como activo pese a que no era una definición `ACTIVE` utilizable: la discrepancia estaba en la presentación y el fixture, no se resolvió aumentando permisos.

La definición heredada ahora se identifica como «Formato heredado: requiere revisión» y se explica su exclusión del conteo. Los fixtures futuros usan el formato canónico `ACTIVE`/VIEW/NONE y no conceden automáticamente ese rol a nadie. Los datos compartidos permanecen sin migrar: allí **0 disponibles + 1 definición heredada** es correcto; el fixture nuevo aislado muestra **1 disponible**. Prueba distingue ACTIVE, RETIRED y Activo sin ampliar consultas. [Presentación](evidence/r02-preproduction-20261028/presentation.json).

### UI-02 — Carga inequívoca

Dashboard y Ciclos calculaban métricas sobre arreglos iniciales vacíos; Grupos, Nomenclaturas y Asignaturas podían renderizar su contenido vacío antes de confirmar la consulta. Se usa disponibilidad confirmada de las mismas fuentes autorizadas: `—`/«Cargando datos autorizados…» mientras no están listas; cero solo tras lectura exitosa vacía. Error, denegación y ausencia de ámbito tienen mensajes propios. No se alteran las consultas de autorización, el selector CICLO DE CONSULTA ni la identidad visual.

[5 comprobaciones de presentación](evidence/r02-preproduction-20261028/presentation.json) y [3 módulos de catálogo](evidence/r02-preproduction-20261028/catalog-loading.json), además de unitarias. Los estados de fallo/carga se inyectan deliberadamente en la señal del repositorio durante la prueba UI: acreditan presentación y no reemplazan una prueba de Rules. Las capturas móviles conservan la navegación global existente; esta revisión no rediseña esa navegación.

## Matriz de requisitos y evidencia de esta ejecución

Todas las filas evalúan el código `86caef3a966db5ab5c26931ebddffa909289c2a6`. Las cantidades corresponden a suites con cobertura solapada; NO deben sumarse como un total de requisitos independientes.

| Requisito | Evidencia | Resultado / límite |
|---|---|---|
| P0-01: concurrencia, versión, unicidad, máximo dos, reintentos | `r02.json`, `server.json`, `transactions.json` | Functions: comprobado; integración 11 grupos PASS y 8 inconclusos Rules, no fallos de aserción funcional |
| P0-01: transiciones válidas/prohibidas; revocación antes de confirmar | `r02.json`, `server.json`, `confirmations.json` | Servidor transaccional y UI: PASS; denegaciones directas requieren cierre del evaluador |
| P0-01: cambio + operación + bitácora + evento, sin cambios parciales | `transactions.json`, `r02.json` | 10 comandos confirmados, sus tres registros asociados, replays inmutables; pruebas de colisión/rechazo sin efecto parcial |
| P0-01: captura ordinaria fuera de Captura | `rules-traces.json`, `ui.json`, `confirmations.json` | UI bloqueada; seis pruebas históricas de escritura directa INCONCLUSIVE_EVALUATOR |
| P0-01: Especiales positivo/negativo y deshabilitación previa | `rules-traces.json`, `ui.json` | Positivo autorizado PASS y bloqueo de formulario PASS; denegación directa tras deshabilitar/revocar sigue inconclusa |
| P0-02: cerrar definitivamente, dos históricos, cancelación, eliminar elegible, crear siguiente | `renewal-ui.json`, `renewal-completed-1280.png`, `transactions.json` | 3 grupos UI PASS con confirmaciones reales del producto; 27-2 queda Preparacion y solo un operativo |
| P0-03: histórico con dependencias | `server.json`, `confirmations.json` | PASS: rechazo y conservación; todas las colecciones actuales de dependencias y agenda privada probadas |
| P0-03: elegible sin dependencias, motivo, auditoría y creación posterior | `server.json`, `renewal-ui.json` | PASS: borrado explícito, auditoría completa, retry único y creación concurrente limitada |
| Modal automático solo al entrar en Captura; Entendido/×/Escape; sin tarjeta fija | `ui.json` | 6 grupos UI PASS; no reapertura por actualización ni creación habilitada al descartar |
| H-01/H-02 ya observados | `transactions.json`, `confirmations.json`, `server-results.json`, `units.log` | Evidencia reutilizada/afectada cubierta; no se reabren como hallazgos nuevos |
| U-01 final, actor histórico, fallo Auth/retry | `server-results.json`, `presentation.json` | Corrección comprobada; complemento separado, 10 PASS / 2 inconclusos |
| UI-01/UI-02 | `presentation.json`, `catalog-loading.json`, `units.log` | PASS local; aceptación visual pendiente |
| Compilación / unitarias afectadas | `build-final.log`, `units.log` | ng build PASS; 18 unitarias PASS. Advertencia previa de bundle 785.56 kB frente a 750 kB |
| Gate específico R02 | `r02-gate.json`, `r02-gate.log` | **BLOCKED, salida 1. No satisface el requisito de cero inconclusos** |

Pruebas de servidor y UI reutilizadas en sus mismos scripts, con nueva configuración de puerto para no tocar la revisión compartida. No se repitió una aceptación visual completa de módulos no afectados. El montaje nuevo exigió comprobar nuevamente el recorrido que usa esos puertos y las correcciones de UI/servidor.

## Ocho históricos R02: resultado individual

| ID | Estado de esta ejecución |
|---|---|
| CYCLE-MULTIPLE-OPERATIVE | PASS |
| CYCLE-SELECTION-ORDER | PASS |
| CYCLE-WRITE-Preparacion | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Preparacion | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Captura cerrada | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Captura cerrada | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Cerrado | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Cerrado | INCONCLUSIVE_EVALUATOR |

Los seis últimos devolvieron 403 y no alteraron los documentos observados, pero incluyeron `evaluation error`. Se conservan **seis inconclusos**, sin reducirlos a cero. La cobertura adicional tras revocación y apagado de Especiales también conserva dos inconclusos. [Trazas resumidas](evidence/r02-preproduction-20261028/rules-traces.json), [traza completa comprimida](evidence/r02-preproduction-20261028/rules-traces.raw.json.gz), [diagnóstico mínimo](evidence/r02-preproduction-20261028/minimal-diagnostic.json).

Se aislaron ocho predicados mínimos: incluso negaciones de `exists` y comparaciones falsas sobre campos existentes presentan el diagnóstico genérico, mientras un literal false se deniega limpiamente y un caso verdadero devuelve 200. No se cambió Rules para esconderlo; el script repone las Rules al terminar. Firestore Emulator 1.22.0 / Firebase CLI 15.30.0. La incidencia pública [firebase-tools #11283](https://github.com/firebase/firebase-tools/issues/11283) sirve de contexto, no de prueba de cumplimiento. El catálogo oficial consultado seguía publicando [Firestore 1.22.0](https://raw.githubusercontent.com/firebase/firebase-tools/master/src/emulator/downloadableEmulatorInfo.json).

**Criterio de cierre pendiente:** ejecutar los mismos positivos y negativos con evaluación verificable que distinga denegación contractual de error de ejecución; conservar trazas sin errores y gate R02 salida 0. No basta HTTP 403, ausencia de escritura, una incidencia externa ni cambiar expectativas. No se declara aquí resuelto el bloqueo ni completada la validación local integral.

## R03, R04 y producción

R03 conserva diez incumplimientos, sin implementación ni cambio de expectativas: REQUEST-TERMINAL-REWRITE, MOODLE-STATUS-RESET-ALLOWED, REQUEST-CREATE-AWAITS, REQUEST-RESOLVE-AWAITS, REQUEST-DUPLICATE-CREATE, UI-PREMATURE-SUCCESS, SHARE-PRESERVES-MOODLE, SHARE-PARTIAL-AND-SUCCESS, REQUEST-DOUBLE-ACCEPT, SHARE-CONCURRENT-LOST-GROUP. Los ocho de lógica siguen apareciendo en `stage1-logic.json`; los dos de Rules mantienen su evidencia previa en `../r02-hallazgos-20261026/contract-gate-final.log`, con fuentes relevantes idénticas según el manifiesto. No se presentan como diez ejecuciones nuevas.

La renovación vacía está acreditada. **La renovación con dos históricos que conservan dependencias académicas reales permanece bloqueada**: el anterior no es elegible para eliminación y no puede confirmarse un tercero. R04 debe resolver respaldo externo verificable, restauración/reversión probada y depuración contractual de esas dependencias. No se añadió cascada ni se eliminaron referencias para aparentar elegibilidad. Se preserva D1: captura cerrada bloquea correcciones ordinarias hasta reapertura; Especiales mantiene su excepción delimitada.

Continúan abiertos el **límite administrativo combinado de 200 documentos** y su impacto en operaciones críticas, validación remota/productiva, migración, reversión y recuperación. Este ensayo no acredita escala productiva. El complemento Eliminar usuario tiene su estado separado y no está certificado para producción por haber corregido U-01.

## Acceso y guion pendiente del propietario

- [Túnel 4206](https://q16qrh63-4206.usw3.devtunnels.ms/): código nuevo, datos de revisión preservados. Perfil ficticio Sistemas ACEPTACIÓN R02. Comprobar U-01 histórico y la explicación del rol legado; las pruebas destructivas siguen reservadas al entorno aislado nuevo.
- [Entorno de prueba 4207](http://127.0.0.1:4207/): solo esta laptop; no se publicó otro túnel ni se redirigió 4206. Sistemas DEMO, Coordinación A DEMO (ADM), Coordinación B DEMO (DER), Auxiliar DEMO según su delegación y Usuario inactivo DEMO, seleccionables en el login ficticio. La cuenta inactiva no habilita acceso. Los nombres de rol no sustituyen las facultades efectivas.
- Estado dejado en 4207: exactamente 26-3 Cerrado con referencias y 27-1 Preparacion como único operativo; [preparación comprobada](evidence/r02-preproduction-20261028/scenario-preparation.json). No quedan suites automáticas actuando sobre esta instancia.

Recorrido humano breve (aceptación aún no registrada):
1. En 4207, entrar como Sistemas DEMO; iniciar captura de 27-1, salir/reingresar, descartar modal y comprobar que Nuevo ciclo sigue bloqueado.
2. Cerrar captura, reabrir con motivo, volver a cerrar; habilitar/deshabilitar Especiales y contrastar ficha Especiales con captura ordinaria. Revisar actor, motivo y operación en Bitácora.
3. Cerrar definitivamente; con dos históricos comprobar el bloqueo de guardar un tercero. En este escenario, 26-3 debe rechazar eliminación por dependencias.
4. Cargar **renovación únicamente en 39080** con los comandos siguientes. Cancelar una eliminación, luego confirmar la del anterior vacío con motivo y crear 27-2 en Preparacion. Verificar un histórico + un operativo y Nuevo ciclo bloqueado.
5. Para U-01, usar solo Usuario inactivo DEMO de esta instancia. Revisar/cancelar y luego confirmar si se desea la baja ficticia; contrastar inicio/final y Auth. El fallo parcial/retry ya está automatizado y no se exige reproducirlo manualmente ni tocar cuentas compartidas.

La preparación de escenarios y estos ensayos no constituyen aceptación del propietario ni resuelven los inconclusos.

## Comandos reproducibles y límites

Ejecutar desde `SPAI-TUP-R02-PREPROD-20261028`. **No usar estos comandos en el stage del túnel.** Cada preparación reemplaza exclusivamente los datos ficticios del slot `preproduction` (39080). Detener el recorrido manual antes de cambiar escenario. Los scripts de pruebas de integración también escriben fixtures; no ejecutarlos mientras el propietario revisa.

```powershell
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-R02-PREPROD-20261028
$demoNode = 'C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='preproduction'
& $demoNode tools/e2-r02/final-prepare.mjs preparation
# Alternativa separada, reemplaza SOLO el fixture 39080:
& $demoNode tools/e2-r02/final-prepare.mjs renewal
```

Comandos utilizados (en el mismo slot salvo compilación y unitarias), con preparación entre suites cuando corresponde:

```powershell
& $demoNode --test tools/e2-r02/preproduction.test.mjs tools/e2-r02/hallazgos.test.mjs tools/e2-r02/requests-cycle.test.mjs tools/e2-r02/review-fixtures.test.mjs tools/local/tests/config.test.mjs
& $demoNode node_modules/@angular/cli/bin/ng.js build
& $demoNode tools/e2-r02/integration.mjs
& $demoNode tools/e2-r02/final-transaction-proof.mjs
& $demoNode tools/e2-r02/complement-server.mjs
& $demoNode tools/e2-r02/final-prepare.mjs capture
& $demoNode tools/e2-r02/functional-confirmations.mjs
& $demoNode tools/e2-r02/complement-ui.mjs
& $demoNode tools/e2-r02/preproduction-ui.mjs
& $demoNode tools/e2-r02/catalog-loading-ui.mjs
& $demoNode tools/e2-r02/final-prepare.mjs renewal
& $demoNode tools/e2-r02/preproduction-renewal.mjs
& $demoNode tools/users-deletion/integration.mjs
& $demoNode tools/e2-r02/final-prepare.mjs capture
& $demoNode tools/e2-r02/rules-trace.mjs
& $demoNode tools/e2-r02/evaluator-diagnostic.mjs
& $demoNode tools/stage1/logic.mjs
& $demoNode tools/e2-r02/preproduction-gate.mjs # salida 1 esperada mientras siga BLOCKED
```

La integración R02 y la suite de baja no tienen cierre verde por sus inconclusos; sus JSON distinguen los grupos que sí pasan. La comprobación HTTPS y publicación de archivos locales se documentan aparte; no son despliegues remotos. [Capturas y límites de cada toma](evidence/r02-preproduction-20261028/index.html).
