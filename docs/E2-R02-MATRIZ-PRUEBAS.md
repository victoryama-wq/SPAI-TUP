# R02 — Trazabilidad de las comprobaciones

21/10/2026. Responsable técnico: Codex. Datos ficticios y emuladores aislados. Esta matriz **no** acredita aceptación humana ni producción. Resultados completos y fechas UTC: [resumen](E2-R02-RESULTADOS.json) y `evidence/e2-r02/results/`.

Los nombres de pruebas de servidor remiten a `tools/e2-r02/integration.mjs`; UI a `tools/e2-r02/ui.spec.mjs`. Un grupo que contiene una denegación con error del evaluador queda INCONCLUSIVE_EVALUATOR, aunque sus pasos positivos posteriores sí hayan terminado. No se contabiliza como PASS global.

| Mínimo solicitado | Archivo / comprobación | Resultado y límite |
|---|---|---|
| 1. Crear sin operativo | `No operative cycle / concurrent creation / unique code` | PASS: NONE y creación en Preparacion |
| 2. Rechazar otro en Preparacion/Captura/Captura cerrada | Integración: `No create in preparation`, `Start capture`, `D1` | Callables rechazados; grupo D1 sigue inconcluso por sus escrituras directas |
| 3. Creaciones simultáneas | `No operative cycle / concurrent creation / unique code` | PASS: exactamente una confirma |
| 4. Multiplicidad preexistente | `Multiple existing operative cycles`; UI inconsistencia | PASS: no elección ni cambio de ciclos; barrera INCONSISTENT |
| 5. Transiciones y saltos | Integración start/closeCapture/reopen/close y saltos; UI | Comandos comprobados; grupo final mixto por Rules inconclusas |
| 6. Misma versión, distintas operaciones | `Two commands on same version: exactly one commits` | PASS: un resultado y un conflicto sin segundo efecto |
| 7. Captura ordinaria, también cargada en Moodle | `D1`; seis IDs CYCLE-WRITE/CREATE | INCONCLUSIVE_EVALUATOR. Se observó rechazo, no se acredita denegación de política |
| 8. Preparada antes del cierre, confirmada después | `D1`; bloqueo reactivo en formularios | Servidor inconcluso por evaluador; controles UI bloqueados |
| 9. Cierre/escritura concurrentes | `Reopen requires reason; reopening and concurrent close/write` | Ejecutada y registrada; rechazo posterior inconcluso. No certifica todos los órdenes de confirmación |
| 10. Especiales/grupos/modalidades | `Specials: disabled...`, `Specials does not permit...`; alta UI real | Positivos y alta UI confirmados. Negativos Escolarizado/Ejecutivo/ordinaria siguen inconclusos |
| 11. Reclasificación manipulada | `Specials does not permit ordinary/reclassification/...` | Rechazo observado, INCONCLUSIVE_EVALUATOR |
| 12. Cerrado con marca residual | `Final close / residual Specials...` | Comandos desde histórico rechazados limpiamente; escritura académica inconclusa |
| 13. Formulario antes de deshabilitar y carrera | `Disable Specials...`; UI modal obsoleto | UI deshabilita Guardar y explica bloqueo. Carrera ejecutada; rechazo directo posterior inconcluso |
| 14. Escritura directa de ciclo/control | `No direct cycle write or forged control...` | PASS, literal false de Rules; sin cambio de negocio |
| 15. Revocación/vencimiento previo a confirmar | `Delegated cycle management...` | PASS; incluye reloj inyectado antes/después de vencer durante la operación, ámbito y capacidad |
| 16. Históricos dentro del ámbito | UI histórico, servidor `Specials actors...` | Consulta UI y retiro de acciones comprobados; rechazos directos fuera del ciclo/ámbito no se acreditan si el evaluador falla |
| 17. Cambio rápido y respuestas tardías | UI CO-01; nueva prueba en `session-lifecycle.test.mjs` | PASS: datos retirados antes del efecto, callbacks tardíos anteriores descartados, listeners cancelados, sesión distinta no hereda datos |
| 18. Atomicidad con bitácora/evento | `Atomic rejection on audit and event collision`; snapshots antes/después | PASS: colisión en cualquiera de ambos revierte ciclo, auditoría, evento e idempotencia |
| 19. Doble envío/reintento | `Start capture; idempotent replay and version conflict` | PASS: envío simultáneo del mismo comando y repetición devuelven el mismo resultado, sin duplicados |

## Actores y operaciones adicionales

| Actor/caso | Evidencia | Estado |
|---|---|---|
| ADMIN_GENERAL | Comandos de creación/transición, idempotencia y atomicidad | PASS local de callables |
| Auxiliar con MANAGE_CYCLES, módulo EDIT y ciclo explícito | Comando legítimo; luego ámbito distinto, sin capacidad, revocado y vencido | PASS local de callables |
| Coordinación Académica | No administra ciclos; matrícula ajena ESPECIAL dentro del ciclo | Callable denegado limpiamente; escritura positiva comprobada; grupo mixto por otros negativos |
| CUSTOM con EDIT | Escribe solo el propio ADM, no recibe MANAGE_CYCLES ni excepción DER | Positivo comprobado; callable rechazado; escritura/lectura negativa con diagnóstico sigue inconclusa |
| Auxiliar de Asignaciones | Campos de matrícula ADM delegados; no DER | Positivo comprobado; negativo inconcluso |
| Código/fecha | Código repetido, fecha imposible o anterior | Sin efectos confirmados; evidencia de integración |
| Lote académico fuera de periodo | Docente + grupo + matrícula | Rechazado y documentos sin cambios; diagnóstico inconcluso, no aprobación de política |
| Petición de reapertura/cancelación | No cambia el ciclo al pedir/cancelar; callable sigue exclusivo | PASS de integración |
| Reapertura desde Solicitudes | `requests-cycle.test.mjs` | Espera respuesta, envía motivo, no anuncia éxito ni resuelve petición si el comando falla |

## Ocho contratos objetivo de R02

Las expectativas contractuales permanecen iguales. Solo estos ocho IDs pasan de caracterización histórica a contraste estricto con su objetivo; se conserva `historicalBaseline`. Los seis errores no se convierten en false/policy PASS.

| ID | Objetivo | Resultado actual |
|---|---|---|
| CYCLE-WRITE-Preparacion | Rechazar edición académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Preparacion | Rechazar alta académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Captura cerrada | Rechazar edición ordinaria | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Captura cerrada | Rechazar alta ordinaria | INCONCLUSIVE_EVALUATOR |
| CYCLE-WRITE-Cerrado | Rechazar edición académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-CREATE-Cerrado | Rechazar alta académica | INCONCLUSIVE_EVALUATOR |
| CYCLE-MULTIPLE-OPERATIVE | Máximo uno ante concurrencia | PASS, resultado de callable real de integración |
| CYCLE-SELECTION-ORDER | Error explícito ante multiplicidad | PASS, miembros reales del repositorio y recorrido UI |

## Diez incumplimientos R03 conservados

Sin cambios en sus expectativas ni caracterizaciones: REQUEST-TERMINAL-REWRITE, MOODLE-STATUS-RESET-ALLOWED, REQUEST-CREATE-AWAITS, REQUEST-RESOLVE-AWAITS, REQUEST-DUPLICATE-CREATE, UI-PREMATURE-SUCCESS, SHARE-PRESERVES-MOODLE, SHARE-PARTIAL-AND-SUCCESS, REQUEST-DOUBLE-ACCEPT y SHARE-CONCURRENT-LOST-GROUP.

El reporte combinado contiene 72 casos: 56 contratos acreditados, 10 incumplimientos reproducidos y 6 inconclusos. Comparado con los 18 incumplimientos anteriores, **solo dos objetivos R02 están acreditados**; los otros seis siguen abiertos con diagnóstico inconcluso, no resueltos. El gate global conserva salida **1**.

La suite R01 mantiene su propio criterio y diagnósticos históricos: un PASS de esa suite no convierte los errores de Rules de R02 en denegaciones válidas. La aceptación humana R01 se conserva sobre su SHA original, no se reasigna al código R02.
