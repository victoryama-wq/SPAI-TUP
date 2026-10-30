# R02 — Trazabilidad de las comprobaciones

**Estado vigente 30/10/2026:** [aceptación funcional confirmada y cierre local de Rules](E2-R02-CIERRE-RULES-2026-10-30.md). El propietario acepta las observaciones de refresco, restricciones de Asignaciones y Bitácora en `819e80b3bbcef27279c69608b89f5de8f685ccd0` / `r02-refresh-819e80b3bbce`; A/B aceptados se conservan. Gate Rules: **23 R02 PASS, 0 FAIL, 0 inconclusos, salida 0**. Complemento baja separado: **2 Rules PASS, salida 0**; aceptación de baja no incluida. Aplicación, políticas y túneles sin modificación. Producción, 200 documentos, R04 y diez R03 pendientes. Las secciones anteriores por fecha se conservan como historial.


**Actualización 30/10/2026 — refresco dirigido:** [informe y evidencia](E2-R02-REFRESCO-2026-10-30.md). SHA `819e80b3bbcef27279c69608b89f5de8f685ccd0`, candidata independiente HTTPS 4211, build `r02-refresh-819e80b3bbce`. 22 pruebas Node y 2 grupos UI PASS; compilación y verificación HTTPS PASS. A/B aceptados conservados; aceptación de esta corrección, observaciones de Bitácora y cierre formal R02 pendientes. Gate Rules previo conservado con su evidencia específica, no repetido ni acreditado por estos ensayos. 200 documentos, R04 y diez R03 abiertos.


**Estado vigente 29/10/2026:** [aceptación A/B y observaciones finales](E2-R02-OBSERVACIONES-2026-10-29.md). El propietario aprobó funcionalmente A/B servidos en `aa532cbef655c9decf7ee0865b82db9f665de5cf`, con observaciones. Candidata separada `d2f139dbd56d997815496036b1b95685bf9c05d2`: 17 pruebas dirigidas y 5 grupos UI PASS, compilación PASS; comprobación del propietario pendiente. Gate Rules vigente del 28/10: PASS_LOCAL, 23 R02 + 2 baja, cero inconclusos; ocho históricos R02 PASS. Diez R03 abiertos, 200 documentos y R04 pendientes. **Cierre formal y producción pendientes.** Las secciones siguientes conservan el historial; sus estados no sustituyen esta actualización.


**Revalidación histórica (23/10/2026):** [matriz final, escenarios y limitaciones](E2-R02-REVISION-TECNICA-FINAL-2026-10-23.md). Código evaluado `6b67bd9fb6edd7982f24d40f48863a17b441a092`. Gate 72 = 56 acreditados / 10 R03 abiertos / 6 R02 inconclusos, salida 1. Los ocho históricos R02 se contrastaron individualmente: dos PASS y seis INCONCLUSIVE_EVALUATOR. Complemento Eliminar usuario: 8 PASS y 2 inconclusos, separado. [Informe manual](E2-R02-REVISION-MANUAL-2026-10-23.md) incorporado sin aceptación funcional. **NO VALIDADA LOCALMENTE como entrega completa; aceptación humana pendiente; producción bloqueada.** Se preserva el historial de evidencia debajo.

Complemento del 23/10/2026: [matriz y evidencia nuevas](E2-R02-COMPLEMENTO-2026-10-23.md). Siete grupos servidor, seis grupos UI y 14 unitarias PASS; ocho observaciones de denegación Rules inconclusas en una muestra separada. El contrato ahora limita a dos ciclos y permite eliminar explícitamente el histórico anterior sin dependencias; estos requisitos no forman parte del conteo histórico de 72 casos que se conserva debajo. No se ha reejecutado ni convertido en verde ese gate para esta entrega.

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


## Revisión vigente — 26/10/2026

Código evaluado `7c475f7892cdeb50d21743b6c8b5426b93dd810b`. [Matriz, causas, evidencia y guion actualizado](E2-R02-HALLAZGOS-2026-10-26.md). H-01 y H-02 corregidos y verificados localmente con los límites descritos. **Entrega R02 no validada como completa; aceptación humana pendiente; producción bloqueada.** Gate: 56 PASS, 10 R03 pendientes, 6 R02 inconclusos de 72. Eliminar usuario: 9 PASS, 2 inconclusos, complemento separado. Revisión actual en 4204; las direcciones y estados anteriores se conservan como historia. Continúan el límite de 200 documentos y R04 para renovación con dependencias.


## Continuación funcional del 26/10/2026

[Informe, matriz y guion vigente](E2-R02-VERIFICACION-FUNCIONAL-2026-10-26.md), código `344ebc7e31689a4645359a46501d518f21da03a5`. H-01/H-02 siguen corregidos y confirmados en interfaz por el informe recibido. Nueva evidencia: 11 comprobaciones con confirmaciones reales/actor histórico, 4 unitarias, trazas Rules (2 positivos y 8 negativos estrictamente inconclusos). Los ocho históricos R02 siguen 2 PASS + 6 inconclusos; R03 conserva diez incumplimientos. Eliminar usuario permanece separado (9 PASS/2 inconclusos de servidor, nueva baja real por UI). No se declara aceptación ni producción.
