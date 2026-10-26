# E2-R02 — Continuación de validación técnica y funcional, 26/10/2026

Responsable técnico: Codex. **Validación local parcial; aceptación humana pendiente; producción bloqueada.**

## Base, informe y alcance

Repositorio: `C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021`. Rama `codex/usuarios-baja-complemento`. Base de esta revisión: `54162eb1f564deb5c10ae18d1067d55fa47a4475`. **Código evaluado: `344ebc7e31689a4645359a46501d518f21da03a5`**. `.gitignore` y documentos locales anteriores se conservaron sin incluirlos en el commit. [Manifiesto y comparación de fuentes](evidence/r02-functional-20261026/evaluated-source.json).

El [informe adjunto del propietario](INFORME-PRUEBAS-DISPONIBLES-E2-R02-2026-10-26.txt) queda conservado íntegramente. Sus PT-01 a PT-08 acreditan la interfaz y tráfico observados, sin confirmar mutaciones ni acreditar el servidor. **H-01 y H-02 permanecen corregidos; no se reabren.** La instrucción actual autoriza las confirmaciones automatizadas sobre cuentas/fixtures aislados, sustituyendo para estas pruebas la sugerencia del informe de pedir autorización individual antes de cada borrado. No implica aceptación de R02.

Versión del túnel comprobada por HTTPS: `tunnel-r02-139bf707a6e8-20261026190724`, base `139bf707a6e86629664781602c5e92eeddf377ad`. La corrección adicional de duplicación está en **4204**, no se recompiló el túnel en esta continuación. Se conservan sus emuladores 18080/19099/15001 y pasarela 4206. No se usaron registros compartidos para ensayos destructivos ni se accedió al respaldo privado.

## Ajuste realizado y prueba del actor

Único cambio de aplicación: `src/app/core/data/audit-display.ts` omite la segunda etiqueta cuando el perfil/área presentado es idéntico al nombre (comparación de espacios y mayúsculas). Conserva un perfil distinto, el UID, los snapshots y los registros persistidos; no traduce ni inventa autoridades.

Se creó una cuenta administrativa ficticia distinta del consultante y se ejecutó `schedule` mediante callable autenticada, enviando además un actor falso desde el cliente. El evento conservó el UID/nombre del actor autenticado. Después de inactivar su perfil y eliminar su cuenta de Authentication y perfil de prueba, el registro permaneció igual; Sistemas DEMO pudo ver el nombre histórico correcto. También se comprobó un registro sintético explícito con nombre/área repetidos: la UI muestra una sola etiqueta y la base conserva ambos valores. Esto acredita tanto la procedencia de identidad como su independencia del usuario observador.

[Confirmaciones y actor](evidence/r02-functional-20261026/confirmations.json), [captura de actor distinto](evidence/r02-functional-20261026/actor-historico.png), [presentación simplificada](evidence/r02-functional-20261026/actor-sin-duplicacion.png), [móvil 390 px](evidence/r02-functional-20261026/actor-mobile-390.png). Inspección técnica de Codex, no aceptación visual del propietario.

## Matriz de requisitos y evidencia

N = nueva ejecución de esta continuación. R = evidencia reutilizada del 26/10 o 23/10; el manifiesto acredita fuentes de servidor, Rules, ciclos, asignaciones, usuarios y scripts pertinentes idénticas al código previamente evaluado. No se repitieron recorridos visuales ya acreditados que no fueron afectados.

| Requisito | Evidencia / método | Resultado |
|---|---|---|
| PREPARACIÓN → CAPTURA, cierre, reapertura, cierre definitivo | N: [11 comprobaciones funcionales](evidence/r02-functional-20261026/confirmations.json); siete transiciones confirmadas mediante modales del producto | PASS; cada operación compara versión, anterior/nuevo, actor y operación/bitácora/evento persistidos |
| Saltos prohibidos | R: [integración autenticada](evidence/r02-hallazgos-20261026/cycle-integration.json), grupos `No create in preparation / forbidden jumps` y `Final close` | Comandos prohibidos rechazados; el segundo grupo contiene además negativos académicos inconclusos, no se etiqueta todo el grupo PASS |
| Modal exclusivamente al entrar en CAPTURA, descartable y sin reapertura automática | R: [6 grupos UI](evidence/r02-hallazgos-20261026/cycle-ui.json); N: recorrido de entrada Captura y confirmaciones | PASS; no se restaura tarjeta fija ni se mueve CICLO DE CONSULTA |
| Captura ordinaria fuera de CAPTURA | N: [trazas individuales](evidence/r02-functional-20261026/rules-traces.json) | 6 intentos HTTP 403, documentos íntegros, predicado final false; estrictamente INCONCLUSIVE_EVALUATOR por diagnóstico ambiguo |
| Captura ordinaria positiva y Especiales positivo | N: trazas con Rules reales, perfil académico y grupo C.A. autorizado | 2 PASS HTTP 200; no se sustituye Rules por una política permisiva |
| Especiales habilitar/deshabilitar y guardar después de deshabilitar | N: dos confirmaciones de producto y escritura preparada rechazada tras deshabilitar; R: `Disable Specials: open-form confirmation denied` y formulario UI bloqueado | Comandos/UI PASS; negativo Rules HTTP 403 sin cambios, inconcluso estricto |
| Especiales fuera de grupo/ámbito, reclasificación y cierre definitivo | R: integración grupos `Specials does not permit...`, `Specials actors...` | Positivos autorizados acreditados; negativos con evaluación ambigua siguen abiertos |
| Revocación entre apertura/preparación y confirmación | R: integración `Delegated cycle management` y baja `Operadores sin autoridad...`; N: escritura directa tras inactivar actor | Functions rechaza; escritura HTTP 403 sin cambios, inconclusa estricta |
| Creación concurrente, unicidad y máximo dos | R: [integración](evidence/r02-hallazgos-20261026/cycle-integration.json), [7 grupos de dependencias](evidence/r02-hallazgos-20261026/cycle-dependencies.json) | PASS de comandos, una creación confirma; N: formulario de tercero bloqueado después de cerrar definitivamente |
| Conflicto de versión y reintento sin duplicados | R: integración start/cierre concurrente; [atomicidad e identidad](evidence/r02-hallazgos-20261026/cycle-atomic-identity.json) | PASS de comandos, sin efectos parciales ni nueva auditoría al repetir |
| Escrituras directas a ciclos/control/marcas | R: `No direct cycle write or forged control` | Denegación limpia PASS; distinta de los negativos académicos inconclusos |
| Cambio, bitácora y evento conjunto; fallo intermedio | N: siete transiciones UI verifican persistencia; R: colisión de evento/auditoría y 11 comprobaciones de atomicidad | PASS; sin cambio parcial al fallar la transacción |
| Histórico con dependencias | N: confirmación de eliminación en producto rechazada; snapshot de ciclos, operación, bitácora, evento y marcas idéntico; R: inventario completo de dependencias | PASS; no se eliminan referencias |
| Histórico anterior ficticio sin dependencias y creación siguiente | R: [UI de eliminación real](evidence/r02-hallazgos-20261026/cycle-ui.json), [renovación autenticada](evidence/r02-final-review/renewal-callable.json), 7 grupos dependencias | PASS; histórico inmediato conservado, siguiente en Preparación |
| H-01 servidor y actor histórico | N: callable con actor diferente + lectura desde otra identidad después de retirar Auth/perfil; R: 11 comprobaciones | PASS; no es un valor fijo ni sustitución por el consultante |
| H-02 prevalidación, cancelación, timeout y respuesta tardía | R: [6 grupos UI](evidence/r02-hallazgos-20261026/ui.json), 4 unitarias reejecutadas con ajuste del presentador | PASS; no se reabre el hallazgo |
| Baja real SPAI/Auth y referencias | N: modal confirmado sobre cuenta creada por este ensayo; R: [9 PASS / 2 inconclusos](evidence/r02-hallazgos-20261026/user-deletion.json) | Auth ausente tras baja y perfil histórico preservado; negativos Rules posteriores todavía inconclusos |
| Último ADMIN_GENERAL y recuperación de fallo Auth | R: grupos concurrentes/recuperación de esa suite; [UI recuperación vigente](evidence/users-deletion/ui-results.json) | PASS de servidor y recuperación; no se simula una transacción atómica entre Firestore y Auth |

## Diagnóstico de Rules y ocho históricos

La sonda mínima se ejecutó solo en 28080 y restauró las Rules reales en `finally`. La regla literal `false` devuelve denegación limpia; un `get` con campo booleano existente false o `!exists` de un documento existente devuelve HTTP 403 con `evaluation error`, aunque su cobertura contiene false. El control con propiedad realmente inexistente añade una causa explícita y no llega a booleano. [Reproducción mínima completa](evidence/r02-functional-20261026/minimal-diagnostic.json).

En las Rules reales, cada uno de los ocho negativos trazados registra false en la expresión aplicable, sin `causeMessage`, y conserva el snapshot de datos; sus controles positivos registran true y HTTP 200. Esto amplía la evidencia y apunta a un diagnóstico ambiguo del emulador 1.22.0; **no se modifica el verificador estricto ni se convierte `evaluation error` en PASS**. `rules-trace.mjs` sale con código 1 si quedan inconclusos.

Firebase documenta la inspección de valores mediante [cobertura del emulador](https://firebase.google.com/docs/rules/emulator-reports). Existe un [reporte abierto de diagnóstico ambiguo en v1.22.0](https://github.com/firebase/firebase-tools/issues/11283) y un [reporte de evaluaciones múltiples](https://github.com/firebase/firebase-tools/issues/6252). Son contexto técnico, no una certificación del contrato SPAI ni una solución oficial aplicada aquí. No se cambió de emulador, política o expectativas para obtener verde.

| ID histórico R02 | Resultado individual vigente | Evidencia |
|---|---|---|
| CYCLE-WRITE-Preparacion | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-CREATE-Preparacion | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-WRITE-Captura cerrada | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-CREATE-Captura cerrada | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-WRITE-Cerrado | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-CREATE-Cerrado | INCONCLUSIVE_EVALUATOR; HTTP 403, sin cambios | N: rules-traces |
| CYCLE-MULTIPLE-OPERATIVE | PASS reutilizado | Callable concurrente del 26/10, código idéntico |
| CYCLE-SELECTION-ORDER | PASS reutilizado | Lógica real del repositorio, orden invertido |

Gate contractual vigente reutilizado: **72 casos = 56 PASS + 10 incumplimientos R03 + 6 inconclusos R02, salida 1**. No hubo cambio de conteo ni se implementó R03. Los dos negativos nuevos de trazas (Especiales/revocación) y los ocho grupos de integración son otras vistas de cobertura, no nuevos IDs del gate. [Gate vigente](evidence/r02-hallazgos-20261026/contract-gate-final.log).

## Complemento Eliminar usuario

Se mantiene separado de R02: **validación parcial; aceptación pendiente**. La nueva confirmación real UI comprobó SPAI/Auth sobre `functional-delete-2375631c`, creada en este ensayo aislado. La suite de servidor vigente conserva 9 PASS y 2 inconclusos: cuenta Auth ausente con vínculo canónico, firma/versiones/caducidad/revocación, identidad ambigua, doble confirmación, recuperación PENDING_AUTH, protección del último administrador, colisión atómica y límite de 200. Se verificó que sus fuentes no cambiaron; no se volvió a ejecutar sin necesidad. No se infiere éxito completo a partir del mensaje visual.

## Comandos y entorno de aceptación

Preparación y ejecución utilizadas dentro de `.local/r02-complement-20261023`, con Node 22 local:

```powershell
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='complement'
$reviewNode='C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
& $reviewNode tools/e2-r02/final-prepare.mjs preparation
& $reviewNode tools/e2-r02/functional-confirmations.mjs
& $reviewNode tools/e2-r02/final-prepare.mjs capture
& $reviewNode tools/e2-r02/rules-trace.mjs # salida 1: inconclusos explícitos
& $reviewNode tools/e2-r02/rules-minimal-diagnostic.mjs
```

La primera sonda se ejecutó como `.local/rules-diagnostic-26.mjs`; se conserva ahora con ruta reproducible en tools. La primera ejecución funcional encontró una diferencia del arnés: el snapshot auditado añade el ID real del documento. Se corrigió la comparación a incluir ese ID y se repitió el recorrido completo; 11 comprobaciones PASS. No se cambió aplicación para resolver esa discrepancia. La captura `functional-failure.png` corresponde a ese ensayo preliminar, no al resultado final.

En el repositorio principal: `node --test tools/e2-r02/hallazgos.test.mjs` (4 PASS); `node node_modules/@angular/cli/bin/ng.js build` (PASS, advertencia existente 785,56 kB / 750 kB); `node --check` para los tres nuevos scripts y `git diff --check` de código. [Logs](evidence/r02-functional-20261026/), [resumen](evidence/r02-functional-20261026/summary.json).

**Revisión disponible en el anfitrión: http://127.0.0.1:4204/ciclos**, Sistemas DEMO. Se deja escenario Preparación: 27-1 Preparacion y 26-3 Cerrado, con referencias verificadas. No se publica este slot destructivo por el túnel. No ejecutar `final-prepare` mientras alguien esté revisando: restablece exclusivamente los fixtures del slot 28080.

Guion breve de aceptación pendiente:

1. Iniciar captura mediante confirmación; salir y volver a Ciclos para el modal; descartarlo y comprobar que no habilita Nuevo ciclo.
2. Cerrar captura, habilitar/deshabilitar Especiales y reabrir con motivo. Revisar las restricciones académicas y que CICLO DE CONSULTA permanezca dentro del panel azul, a la derecha de ESTADO. Registrar la decisión humana sin equipararla a las pruebas automatizadas.
3. Consultar Bitácora después de una operación y comprobar actor, fecha y ausencia de etiqueta duplicada. Las capturas anexas acreditan además el actor histórico distinto ya retirado.
4. Cierre definitivo; con el escenario normal, confirmar intento de eliminar 26-3 debe rechazar sus dependencias. Para una eliminación elegible, preparar por separado `final-prepare.mjs renewal`; nunca depurar datos compartidos ni crear varios operativos. El complemento de baja tiene su aceptación independiente y solo debe ejercerse sobre cuentas ficticias del slot aislado.

## Pendientes de cierre y producción

**La depuración de históricos con dependencias y el flujo de renovación con datos académicos reales siguen pendientes.** Dos históricos poblados bloquean eliminar el anterior y crear un tercero. R04/E2-C05 debe implementar inventario, respaldo externo verificable, restauración probada, depuración/retención reanudable y reversión preservando el histórico inmediato; eliminar un histórico ficticio vacío no resuelve ese flujo.

Persisten las seis denegaciones R02 estrictamente inconclusas, los diez incumplimientos R03, los dos negativos de baja, el impedimento administrativo combinado de **200 documentos**, validaciones remotas, escala/índices, migración, restauración/reversión y aceptación humana. D1 se conserva: fuera de Captura no hay corrección académica ordinaria hasta reapertura; Especiales solo bajo habilitación y autorización expresa.

Sin push, merge, despliegues ni conexiones reales. Servicios y datos compartidos preservados.

Evidencia de cierre: [acceso y exportación aislada](evidence/r02-functional-20261026/access-final.json), [escenario final](evidence/r02-functional-20261026/acceptance-scenario.json). La exportación incluye Auth/Firestore/Storage y no detiene servicios. [Cobertura completa comprimida](evidence/r02-functional-20261026/rules-traces.raw.json.gz), con hash SHA-256 del original en rules-traces.json. La captura móvil muestra la zona superior; la comprobación de una única etiqueta se acredita por el resultado automatizado, no por esa captura recortada.

Criterio pendiente para cerrar los negativos estrictos: repetir los mismos casos y controles positivos con una evaluación inequívoca bajo una versión soportada del emulador, o mediante una validación remota separadamente autorizada. No basta con omitir el texto ambiguo del diagnóstico ni cambiar las expectativas.
