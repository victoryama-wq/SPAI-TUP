# Inventario único de evaluación R02 — 28 octubre 2026

23 casos R02 y 2 de Eliminar usuario. 30 observaciones de suites se reducen a 25 casos únicos; los 8 grupos de integración no son casos adicionales. Los 6 históricos son parte de los 23. Todos los controles positivos pasan.

| ID | Alcance | Suite origen | Antes | Ahora | Traza íntegra |
|---|---|---|---|---|---|
| CYCLE-WRITE-Preparacion | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-WRITE-Preparacion.json.gz](CYCLE-WRITE-Preparacion.json.gz) |
| CYCLE-CREATE-Preparacion | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-CREATE-Preparacion.json.gz](CYCLE-CREATE-Preparacion.json.gz) |
| CYCLE-WRITE-Captura cerrada | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-WRITE-Captura_cerrada.json.gz](CYCLE-WRITE-Captura_cerrada.json.gz) |
| CYCLE-CREATE-Captura cerrada | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-CREATE-Captura_cerrada.json.gz](CYCLE-CREATE-Captura_cerrada.json.gz) |
| CYCLE-WRITE-Cerrado | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-WRITE-Cerrado.json.gz](CYCLE-WRITE-Cerrado.json.gz) |
| CYCLE-CREATE-Cerrado | R02 | tools/stage1/rules.mjs; tools/e2-r02/rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [CYCLE-CREATE-Cerrado.json.gz](CYCLE-CREATE-Cerrado.json.gz) |
| SPECIAL-DISABLED-BEFORE-COMMIT | R02 | rules-trace.mjs; integration.mjs Specials disabled/create | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-DISABLED-BEFORE-COMMIT.json.gz](SPECIAL-DISABLED-BEFORE-COMMIT.json.gz) |
| AUTH-REVOKED-BEFORE-COMMIT | R02 | rules-trace.mjs | INCONCLUSIVE_EVALUATOR | PASS | [AUTH-REVOKED-BEFORE-COMMIT.json.gz](AUTH-REVOKED-BEFORE-COMMIT.json.gz) |
| D1-LOADED-ENROLLMENT | R02 | integration.mjs D1 loaded; Reopen then close | INCONCLUSIVE_EVALUATOR | PASS | [D1-LOADED-ENROLLMENT.json.gz](D1-LOADED-ENROLLMENT.json.gz) |
| D1-GROUP-WRITE | R02 | integration.mjs D1 | INCONCLUSIVE_EVALUATOR | PASS | [D1-GROUP-WRITE.json.gz](D1-GROUP-WRITE.json.gz) |
| D1-TEACHER-WRITE | R02 | integration.mjs D1 | INCONCLUSIVE_EVALUATOR | PASS | [D1-TEACHER-WRITE.json.gz](D1-TEACHER-WRITE.json.gz) |
| D1-BATCH | R02 | integration.mjs D1 atomic batch | INCONCLUSIVE_EVALUATOR | PASS | [D1-BATCH.json.gz](D1-BATCH.json.gz) |
| SPECIAL-NOT-ORDINARY | R02 | integration.mjs Specials ordinary | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-NOT-ORDINARY.json.gz](SPECIAL-NOT-ORDINARY.json.gz) |
| SPECIAL-NOT-RECLASSIFY | R02 | integration.mjs Specials reclassification | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-NOT-RECLASSIFY.json.gz](SPECIAL-NOT-RECLASSIFY.json.gz) |
| SPECIAL-MODALITY-Escolarizado | R02 | integration.mjs Specials modality | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-MODALITY-Escolarizado.json.gz](SPECIAL-MODALITY-Escolarizado.json.gz) |
| SPECIAL-MODALITY-Ejecutivo | R02 | integration.mjs Specials modality | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-MODALITY-Ejecutivo.json.gz](SPECIAL-MODALITY-Ejecutivo.json.gz) |
| CUSTOM-FOREIGN-ENROLLMENT | R02 | integration.mjs CUSTOM scope | INCONCLUSIVE_EVALUATOR | PASS | [CUSTOM-FOREIGN-ENROLLMENT.json.gz](CUSTOM-FOREIGN-ENROLLMENT.json.gz) |
| CUSTOM-OUTSIDE-CYCLE | R02 | integration.mjs cycle scope | INCONCLUSIVE_EVALUATOR | PASS | [CUSTOM-OUTSIDE-CYCLE.json.gz](CUSTOM-OUTSIDE-CYCLE.json.gz) |
| ACADEMIC-OUTSIDE-CYCLE | R02 | integration.mjs cycle scope | INCONCLUSIVE_EVALUATOR | PASS | [ACADEMIC-OUTSIDE-CYCLE.json.gz](ACADEMIC-OUTSIDE-CYCLE.json.gz) |
| AUX-FOREIGN-ENROLLMENT | R02 | integration.mjs auxiliary scope | INCONCLUSIVE_EVALUATOR | PASS | [AUX-FOREIGN-ENROLLMENT.json.gz](AUX-FOREIGN-ENROLLMENT.json.gz) |
| SPECIAL-FOREIGN-DELETE | R02 | integration.mjs Specials deletion | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-FOREIGN-DELETE.json.gz](SPECIAL-FOREIGN-DELETE.json.gz) |
| SPECIAL-DISABLED-UPDATE | R02 | integration.mjs Disable Specials | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-DISABLED-UPDATE.json.gz](SPECIAL-DISABLED-UPDATE.json.gz) |
| SPECIAL-FINAL-CLOSE | R02 | integration.mjs Final close residual Specials | INCONCLUSIVE_EVALUATOR | PASS | [SPECIAL-FINAL-CLOSE.json.gz](SPECIAL-FINAL-CLOSE.json.gz) |
| DELETION-OLD-TOKEN-READ | USER_DELETION | tools/users-deletion/integration.mjs token anterior | INCONCLUSIVE_EVALUATOR | PASS | [DELETION-OLD-TOKEN-READ.json.gz](DELETION-OLD-TOKEN-READ.json.gz) |
| DELETION-REENTRY-BOOTSTRAP | USER_DELETION | tools/users-deletion/integration.mjs reingreso | INCONCLUSIVE_EVALUATOR | PASS | [DELETION-REENTRY-BOOTSTRAP.json.gz](DELETION-REENTRY-BOOTSTRAP.json.gz) |

## Requisito, operación y causa
Los seis CYCLE-WRITE/CREATE prueban editar/crear asignaciones ordinarias fuera de Captura (Preparación, Captura cerrada, Cerrado), D1. D1-LOADED-ENROLLMENT, GROUP-WRITE, TEACHER-WRITE y BATCH prueban matrícula cargada, grupos, docentes y su lote atómico tras cierre. SPECIAL-* aplica la excepción exclusivamente a Especiales habilitado, grupo/modalidad admitidos y ámbito concedido; no reclasifica ordinarias. CUSTOM/ACADEMIC-OUTSIDE-CYCLE prueba lectura fuera del ciclo concedido. CUSTOM/AUX-FOREIGN-ENROLLMENT prueba escritura ajena sin excepción académica. AUTH-REVOKED comprueba escritura con perfil inactivo. DELETION-OLD-TOKEN-READ rechaza lectura con token obtenido antes de eliminar Auth y bloquear el perfil; REENTRY-BOOTSTRAP rechaza recreación tras la baja.

Cada archivo .json.gz incluye fixture, identidad/claims ficticios, solicitud exacta, control positivo, respuesta y cobertura completa; el campo operation distingue get/create/update/delete y el cuerpo desglosa el lote. Los tokens efímeros se omiten.

Causa común: el diagnóstico genérico del emulador incluye “evaluation error” junto a una raíz allow=false; el clasificador anterior lo trataba como indeterminado sin consultar la cobertura. No se reprodujo un defecto de política ni de identidad. D1-BATCH agrega cortocircuito: tres escrituras prohibidas, primera raíz false y raíces diferidas; se contrasta cada escritura idéntica por separado y un lote mínimo equivalente. Los errores reales conservan causeMessage y se clasifican FAIL. No se alteraron Rules.

## Duplicados explícitos
- Integración D1 escritura ordinaria = CYCLE-WRITE-Captura cerrada.
- Integración D1 alta = CYCLE-CREATE-Captura cerrada.
- Reapertura y cierre posterior/matrícula = D1-LOADED-ENROLLMENT.
- Especiales deshabilitados/alta = SPECIAL-DISABLED-BEFORE-COMMIT.
- Nueva Preparación tras cierre definitivo/alta = CYCLE-CREATE-Preparacion.
El mapa completo de los 20 registros Strict Rules denial a sus 8 grupos está en rules-diagnostic/gate.mjs y r02-gate.json. Las suites fuente son tools/stage1/rules.mjs, tools/e2-r02/rules-trace.mjs, tools/e2-r02/integration.mjs y tools/users-deletion/integration.mjs.
