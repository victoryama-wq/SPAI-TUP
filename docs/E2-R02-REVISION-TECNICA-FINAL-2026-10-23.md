# E2-R02 — Revalidación técnica y preparación de aceptación

23 de octubre de 2026, America/Cancun. Responsable técnico: Codex. Los registros de ejecución usan UTC (algunos ya muestran 24/10). **NO VALIDADA LOCALMENTE como entrega completa; aceptación humana pendiente; producción bloqueada.**

Rama: `codex/usuarios-baja-complemento`. Código de aplicación evaluado: **`6b67bd9fb6edd7982f24d40f48863a17b441a092`**. Este commit conserva la implementación y los cambios locales posteriores a `16671e2b5b9021fa2069e2b0587e595338f7fb29`; no sustituye la versión observada por el propietario. Los ajustes finales del generador de escenarios y la evidencia quedan en el commit documental que incorpora este informe. Fuentes y hashes: [manifiesto](evidence/r02-final-review/evaluated-source.json). No hubo cambios nuevos de aplicación durante esta revalidación: se compararon byte a byte `src/`, Functions y Rules con la captura inicial.

La [revisión manual corregida](E2-R02-REVISION-MANUAL-2026-10-23.md) está incorporada como evidencia del propietario, sin transformarla en aceptación. La versión humana fue `tunnel-r02-consulta-inline-20261023-02`, compilada sobre la base anterior más cambios locales. El selector **CICLO DE CONSULTA permanece dentro del panel azul, a la derecha de ESTADO**.

## Resultado consolidado

| Ejecución | Resultado | Evidencia |
|---|---|---|
| Gate contractual histórico | 72 casos: 56 acreditados, 10 incumplimientos R03, 6 inconclusos R02; salida 1 | [Rules](evidence/r02-final-review/stage1-rules.json), [lógica](evidence/r02-final-review/stage1-logic.json), [gate](evidence/r02-final-review/final-contract-gate.log) |
| Integración R02 autenticada | 19 grupos: 11 PASS, 8 inconclusos, 0 FAIL; salida 1 | [resultado](evidence/r02-final-review/r02-integration.json) |
| Retención, eliminación y concurrencia | 7 grupos PASS | [resultado](evidence/r02-final-review/cycle-deletion.json) |
| Registro conjunto e idempotencia | 10 operaciones PASS, cada una con operación, bitácora y evento coherentes | [resultado](evidence/r02-final-review/transactions.json) |
| UI Ciclos / Especiales / eliminación | 6 grupos PASS | [resultado](evidence/r02-final-review/cycle-ui.json) |
| UI selección de ciclo / sesión / respuestas tardías | 7 grupos PASS | [resultado](evidence/r02-final-review/selector-ui.json) |
| Unitarias de permisos, sesión, reapertura y fixtures | 21 PASS | [registro](evidence/r02-final-review/unit.log) |
| Complemento Eliminar usuario | 8 PASS, 2 inconclusos; no se cierra funcionalmente | [resultado](evidence/r02-final-review/user-deletion.json) |

Los ocho grupos inconclusos de integración y las ocho observaciones de la muestra complementaria de Rules **no son ocho nuevos IDs del gate**. No deben sumarse a los ocho históricos R02. [Resumen procesable](evidence/r02-final-review/summary.json).

## Matriz final de requisitos

Todas las filas de implementación remiten al commit de aplicación indicado arriba. Los nombres de casos exactos, fechas UTC y resultados están en los JSON vinculados; el manifiesto identifica también los scripts empleados. PASS local no implica aceptación humana ni producción.

| Requisito | Implementación / prueba vigente | Estado y límite |
|---|---|---|
| Máximo un operativo; máximo dos ciclos | `functions/cycles/service.js`; integración `No operative cycle / concurrent creation / unique code`; complemento `Concurrent creations after explicit deletion` | PASS: una creación simultánea confirma; exceso bloqueado, sin seleccionar arbitrariamente |
| PREPARACIÓN → CAPTURA; saltos prohibidos | `TRANSITIONS`, `execute`; integración `No create in preparation / forbidden jumps`, `Start capture`; transacciones `create/start` | PASS de servidor |
| CAPTURA → CAPTURA_CERRADA; D1 | `closeCapture`, `assignmentCapture`; integración `D1`, `Two commands on same version` | Transición y conflicto PASS; negativos académicos inconclusos por evaluador |
| Reapertura con motivo y cierre definitivo | `reopen/close`; integración de reapertura, transición final y solicitud; prueba de transacciones | PASS de comandos; campo de motivo, cancelar y bloqueo de UI comprobados |
| Especiales solo habilitados, grupo C.A. admitido, ámbito y permisos | Rules `admittedSpecialGroup/assignmentCapture/assignmentUpdate`; integración y UI Especiales | Altas/ediciones legítimas y UI PASS; negativos con diagnóstico del evaluador no acreditados |
| Matrícula ajena académica y auxiliar limitado | integración `Specials actors: academic foreign enrollment, CUSTOM and delegated scope` | Positivos comprobados; rechazos de ámbito inconclusos, sin otorgar excepción al CUSTOM/auxiliar |
| Escrituras directas a ciclos/control/marcas | Rules `allow write: false`; integración y complemento Rules | Rechazos limpios PASS; no se modifican metadatos desde el cliente |
| Versión obsoleta, concurrencia de cierre | revisión en `execute`; integración `Two commands on same version`, UI eliminación obsoleta | PASS: solo una confirma; destino conserva estado ante rechazo |
| Revocación, caducidad y ámbito entre apertura y confirmación | `readActor/effective/authorize`; integración delegación y complemento eliminación | PASS de comandos; reloj determinista antes/después de vencer y snapshots sin cambios |
| Doble envío, repetición y clave reutilizada | `operaciones_ciclo`; integración start y complemento purge | PASS; resultado estable sin nuevas escrituras; petición distinta con misma clave rechazada |
| Atomicidad ciclo/operación/bitácora/evento | transacciones en `execute`; colisiones audit/event e `final-transaction-proof.mjs` | PASS: 10 operaciones verifican actor, fecha servidor, motivo, antes/después, conteos y repetición; colisiones revierten todo |
| Rechazar histórico con dependencias | `functions/cycles/dependencies.js`; complemento recorre cada colección mutable, agenda privada y subcolecciones | PASS; snapshot completo conservado ante rechazo. Sin cascadas |
| Eliminar anterior vacío y conservar inmediato | `purge`; complemento, UI y [renovación autenticada](evidence/r02-final-review/renewal-callable.json) | PASS: 26-3 eliminado solo en fixture elegible; 27-1 íntegro; se crea 27-2 en Preparación |
| Modal solo al entrar con Captura, descartable | `cycles-page.component`; `complement-ui.mjs` | PASS: Entendido/×/Escape sin cambios, sin reapertura por actualizaciones; ausente en los demás estados |
| Nuevo ciclo, filtros, consulta histórica | repositorios/páginas actuales; UI Ciclos y selector | PASS: operativo bloquea alta, carga/estado mantienen restricciones, historia de solo lectura, filtros/datos/listeners coherentes |

## Revalidación individual de los ocho históricos

| ID | Objetivo sin cambios | Resultado de esta ejecución |
|---|---|---|
| CYCLE-WRITE-Preparacion | Denegar edición académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Preparacion | Denegar creación académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Captura cerrada | Denegar edición ordinaria | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Captura cerrada | Denegar creación ordinaria | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Cerrado | Denegar edición académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Cerrado | Denegar creación académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-MULTIPLE-OPERATIVE | Una sola creación operativa concurrente | PASS: callable real, una confirmación |
| CYCLE-SELECTION-ORDER | Inconsistencia explícita, no elegir por orden | PASS: miembros reales del repositorio, orden invertido |

Los seis casos devuelven `permission-denied` acompañado de `evaluation error`; no se acredita una denegación limpia de política ni se transforma el resultado en false/PASS. El diagnóstico aislado reprodujo el mismo problema en expresiones dependientes de lecturas de metadatos ([sondeo](evidence/r02-final-review/evaluator-diagnostic.json)); no demuestra su causa definitiva. Un cambio equivalente de evaluación condicional no lo resolvió y fue descartado, restaurando Rules byte a byte. **No hay una corrección de Rules acreditada en esta revisión.**

Los diez R03 mantienen expectativas y resultado: REQUEST-TERMINAL-REWRITE, MOODLE-STATUS-RESET-ALLOWED, REQUEST-CREATE-AWAITS, REQUEST-RESOLVE-AWAITS, REQUEST-DUPLICATE-CREATE, UI-PREMATURE-SUCCESS, SHARE-PRESERVES-MOODLE, SHARE-PARTIAL-AND-SUCCESS, REQUEST-DOUBLE-ACCEPT y SHARE-CONCURRENT-LOST-GROUP. Se ejecutaron sus caracterizaciones como parte del gate vigente; no se implementó R03.

## Complemento separado: Eliminar usuario

Se reutilizó `tools/users-deletion/integration.mjs` en 28080/29099. Ocho casos PASS: confirmación real y eliminación en Authentication; perfil histórico y referencias preservados; autorización/firma/versiones/caducidad/revocación; identidad ambigua bloqueada; doble envío; fallo simulado de Authentication con bloqueo inmediato, recuperación por otro administrador y respuesta perdida; atomicidad; protección del último ADMIN_GENERAL concurrente. La misma suite comprueba el umbral 200 y recuperación de una baja ya iniciada. Los casos agrupados se detallan en su JSON.

El token anterior fue rechazado por Functions. Los rechazos de lectura Firestore con token anterior y de bootstrap tras reingreso simulado devolvieron error del evaluador: **dos casos inconclusos**, sin acceso exitoso observado pero sin acreditarlos como denegaciones limpias. Estado del complemento: **validación técnica parcial, aceptación funcional pendiente**. La baja Firestore/Auth es una operación recuperable por fases, no una transacción atómica entre productos; se comprobó la compensación mediante reintento. No se eliminó una cuenta real ni se contactó Google institucional.

## Correcciones de pruebas y evidencia reutilizada

- `tools/e2-r02/integration.mjs`: preparación compatible con dos ciclos; elimina explícitamente un histórico ficticio vacío antes de crear el siguiente. Conserva el rechazo por capacidad y la verificación independiente de código duplicado. Limpia únicamente fixtures del ensayo aislado.
- `tools/e2-r02/complement-rules.mjs`: crea expresamente el grupo C.A. que antes dependía de otra ejecución. No modifica expectativas de autorización.
- `tools/stage1/logic.mjs`: incorpora miembros reales nuevos (`multipleOperative`, `overLimit`, ciclo operativo y guardas de alta) al arnés; ninguna expectativa R03 cambió.
- `final-prepare.mjs`, `final-renewal-proof.mjs` y `final-transaction-proof.mjs`: escenarios con referencias comprobadas, renovación autenticada y registro conjunto. Se corrigieron una referencia de notificación del fixture de renovación y marcas temporales heredadas inaplicables a Preparación. Son datos sintéticos nuevos, no una depuración de datos compartidos.

Las compilaciones de producción y túnel de la revisión inmediatamente anterior se reutilizan porque todas las fuentes de aplicación permanecen idénticas; el servidor Angular aislado recompiló la fuente actual. Permanece la advertencia de bundle inicial 785,56 kB frente a 750 kB. La evidencia visual y aceptación previa R01 no se reabren. Las pruebas UI repetidas cubren la ubicación vigente del selector y el recorrido de selección completo, afectados desde la evidencia antigua.

## Escenarios y acceso para aceptación humana

Acceso **solo en el anfitrión**: **http://127.0.0.1:4204/ciclos**. Seleccionar **Sistemas DEMO** e **Ingresar a DEMO**. Se deja **27-1 en Preparación + 26-3 Cerrado**, máximo un operativo. [Comprobación de acceso](evidence/r02-final-review/access.json). El túnel compartido 4206 y sus dos históricos permanecen intactos; no apunta a esta revisión destructiva.

Preparación reproducible (reinicia exclusivamente el slot ficticio 28080; termina cualquier recorrido aislado que esté en curso):

```powershell
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021\.local\r02-complement-20261023
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='complement'
$reviewNode='C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
& $reviewNode tools/e2-r02/final-prepare.mjs preparation
```

Cambiar el último argumento por `capture`, `closed-capture`, `specials`, `closed` o `renewal`. Los seis escenarios están comprobados, contienen exactamente dos ciclos y como máximo un operativo. Todos validan las referencias. `renewal` materializa desde fixtures un anterior vacío, omitiendo también sus notificaciones; no aplica una cascada a información existente. Ningún comando admite el puerto compartido 18080. Las fechas del escenario son ficticias; la fecha prevista se deja vacía, mostrando Sin fecha definida, sin automatismos de cierre.

Guion breve, únicamente en 4204:

1. En Preparación, iniciar captura. Comprobar estado Captura, acción de cierre y Nuevo ciclo bloqueado. Salir y volver a Ciclos para ver el modal; descartarlo y confirmar que conserva acciones y estado.
2. Cerrar captura y comprobar el aviso contractual. En Asignaciones, verificar bloqueo ordinario. Habilitar Especiales y revisar su ficha con un grupo C.A.; deshabilitar y comprobar que un formulario abierto no conserva facultades.
3. Reabrir con motivo; cerrar captura otra vez y cerrar definitivamente. No debe habilitarse captura ni modificarse el histórico por consultar otro ciclo.
4. Con `closed`, intentar eliminar 26-3: tiene dependencias y debe permanecer intacto. Con `renewal`, eliminar 26-3 con motivo y crear 27-2: 27-1 se conserva. Son escenarios distintos.
5. En Usuarios del entorno aislado, elegir una cuenta ficticia que no sea el último administrador; revisar identidad/motivo y confirmar la baja si se desea aceptación del complemento. Comparar con la evidencia técnica; no repetir pruebas físicas R01 ya aceptadas.

Registrar fecha, perfil, escenario, resultados y decisión del propietario. Las pruebas automáticas no sustituyen esa decisión.

## Renovación real y R04

**Sí: el bloqueo de históricos con dependencias deja pendiente el flujo completo de renovación con datos académicos reales.** Con dos históricos poblados, no puede eliminarse el anterior y el límite de dos impide crear un tercero. No se flexibilizó ninguno de esos controles. La eliminación vacía demostrada aquí no resuelve ese caso.

R04/E2-C05 debe implementar inventario de dependencias, respaldo externo verificable, prueba de restauración, política de retención, depuración controlada/reanudable del histórico anterior y reversión, conservando el histórico inmediato. La copia del documento del ciclo en bitácora no reemplaza ese respaldo. Se mantiene D1: captura cerrada bloquea correcciones académicas ordinarias hasta reapertura, salvo la excepción Especiales expresamente habilitada y autorizada.

Antes de producción siguen obligatorios: resolver/acreditar los seis negativos R02 y demás diagnósticos de Rules; los diez R03; el impedimento de **200 documentos administrativos**; validación remota e índices; migración, respaldo, restauración y reversión; R04 y aceptación humana. Sin push, merge, despliegues ni conexiones reales a Moodle/SAEKO. Los servicios, datos y respaldo privados se conservaron.
