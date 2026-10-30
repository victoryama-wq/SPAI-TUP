# E2-R02 — Aceptación funcional y cierre local del gate de Rules

**30 de octubre de 2026, America/Cancun.** Aceptación funcional: propietario. Implementación del arnés y comprobación técnica: Codex.

- **Aceptación funcional: APROBADA**, según [declaración expresa conservada](ACEPTACION-FUNCIONAL-E2-R02-2026-10-30.txt): actualización de Especiales sin recarga, restricciones de Asignaciones y Bitácora con motivo de reapertura, actor, fecha/hora y transición.
- **Gate técnico de Rules R02: CERRADO LOCALMENTE / PASS**, 23 casos requeridos, cero FAIL, cero INCONCLUSIVE_EVALUATOR, **salida 0**.
- **Complemento Eliminar usuario: separado**, 2 casos Rules PASS, salida 0; diez comprobaciones Functions previas conservadas. Esta declaración funcional no añade aceptación del complemento de baja.
- **Producción: PENDIENTE/BLOQUEADA.** Ni aceptación funcional ni gate local equivalen a producción. No se declara un cierre administrativo general de entregas o pendientes ajenos al gate.

## Versión evaluada y aceptada

La declaración se vincula a la última candidata entregada para este recorrido: **`819e80b3bbcef27279c69608b89f5de8f685ccd0`**, compilación **`r02-refresh-819e80b3bbce`**, rama de aplicación `codex/e2-r02-refresco-autorizado`, túnel 4211. La vinculación se apoya en los metadatos congelados de la instancia y [verificación HTTPS y hashes de entrega](evidence/r02-refresh-20261030/release.json); no se deduce del HEAD documental. En esta ejecución los servicios 4210/4211 estaban detenidos: no se afirma una nueva comprobación en vivo ni se reinician.

La aceptación previa A/B del 29/10 sigue vigente para **`aa532cbef655c9decf7ee0865b82db9f665de5cf`**, con [declaración original](ACEPTACION-FUNCIONAL-E2-R02-2026-10-29.txt). Las observaciones de refresco y presentación de Bitácora enumeradas por el propietario quedan aceptadas el 30/10. Las limitaciones de registros históricos sin descripción narrativa no se repararon ni reescribieron por esta aceptación.

Trabajo técnico independiente en `SPAI-TUP-R02-CIERRE-20261030`, rama **`codex/e2-r02-cierre-rules-20261030`**, creada desde `d7bdaf3f325da713a7bbac62a33965d49977ea02` con árbol limpio. La aplicación es idéntica a la candidata aceptada; sólo se añaden arnés/evidencia/documentación. La referencia **`86caef3a966db5ab5c26931ebddffa909289c2a6`** permanece intacta y reproducible; no hubo retroceso ni cambio de checkout en instancias aceptadas.

**Rules completas realmente cargadas y presentes en las trazas, SHA-256:**

`81fe03609738b95902fb54d906d63b408f9017acbab6ba804b2cafb878e045a9`

El blob Git usa LF (`bbb6f3f2b1d2215f7f3c0c22baf5a575996bb58ce98d805c372e7ac548833a91`); el archivo cargado en Windows conserva CRLF. El gate compara texto Git normalizando exclusivamente finales de línea y exige igualdad **byte a byte del hash** entre archivo completo cargado y cada cobertura. No se normalizan ni omiten expresiones de autorización.

## Inventario completo y evidencia vigente

[Matriz de los 25 casos](evidence/r02-rules-close-20261030/MATRIZ.md) y [resultado estructurado](evidence/r02-rules-close-20261030/gate.json) contienen requisito, suite/archivo, operación, UID/claims ficticios, condiciones, resultado esperado, resultado histórico y anterior, causa, resultado final, hash/traza y comando por caso.

**30 observaciones originales → 25 casos únicos = 23 R02 + 2 baja.** Cinco duplicados se conservan mediante correspondencias explícitas; los ocho grupos de integración no se cuentan otra vez. Los seis históricos inconclusos, revocación y deshabilitación de Especiales están incluidos, sin exclusiones.

Se recuperó primero la evidencia del 28/10. Ya contenía diagnósticos mínimos, controles, peticiones y cobertura concluyente de los 25 casos; no se los volvió a tratar como defectos de aplicación abiertos. Su política completa coincide con la candidata. El problema de reutilización era el gate antiguo: exigía igualdad de **todo** `src` con 86caef y sólo admitía dos tuplas locales nuevas. Esa condición dejó de corresponder a las correcciones funcionales posteriores, aunque las Rules y políticas no cambiaron.

Se conserva el gate antiguo como reproducción histórica. El nuevo `close-gate.mjs` vincula la candidata actual a cada traza completa, comprueba hash de política, petición/operación, identidad, control positivo, antes/después y cobertura. Fija el inventario de 25 IDs y separa el código de salida de los 23 R02 del de los dos de baja. No redefine denegaciones ni convierte los pendientes R03 en PASS.

## Causas comprobadas

| Grupo | Causa y contraste | Resolución |
|---|---|---|
| Denegaciones individuales, incluidos seis históricos, ámbitos, revocación y Especiales | Firestore Emulator 1.22.0 emite `evaluation error` junto a una raíz dinámica `allow=false`. El control autorizado de la misma operación/identidad funciona; las expresiones inválidas deliberadas producen causa explícita. Una entrada `undefined: {}` también aparece en el control autorizado: no prueba un defecto por sí sola. | Clasificador específico existente conservado. Se exige raíz false de la operación exacta y ausencia de causas sin explicar; 403 solo no aprueba. |
| D1-BATCH | El rechazo de una escritura deja raíces posteriores diferidas. La denegación mínima reproduce ese diagnóstico; el clasificador individual **sigue inconcluso para el lote mínimo**, deliberadamente. | El caso real se resuelve con control positivo de lote y cada escritura constituyente idéntica ejecutada por separado contra las Rules completas, con cobertura false. No se ignora genéricamente el error. |
| Baja: token anterior y recreación | Perfil dado de baja bloquea el acceso aun con token anterior; bloqueo por correo impide recreación. Controles positivos anteriores a cada bloqueo funcionan. | Dos casos independientes PASS; no se atribuye el resultado al HTTP403 ni se mezcla con R02. |
| Vinculación de evidencia a candidata actual | El antiguo gate ataba toda la interfaz a 86caef y por eso no era un comando vigente para 819e80, pese a conservarse las políticas. | Nuevo gate de integridad y correspondencia. No cambia `classifier.mjs`, Rules, Functions, permisos, auditoría ni la aplicación. |

En SPECIAL-NOT-RECLASSIFY la escritura está prohibida a todos los clientes. Su positivo es una lectura legítima de la misma asignación, documentada expresamente; no se abren permisos para fabricar un control.

## Comprobaciones realizadas

| Evidencia | Resultado |
|---|---|
| 20 casos completos anteriores | Reutilizados, reclasificados y vinculados al hash exacto actual; PASS. Archivos gzip originales conservados. |
| 5 casos completos en emuladores nuevos | AUTH-REVOKED-BEFORE-COMMIT, SPECIAL-DISABLED-UPDATE, D1-BATCH, DELETION-OLD-TOKEN-READ y DELETION-REENTRY-BOOTSTRAP: PASS con controles positivos, sin cambios tras denegación. Refuerzan la integración del nuevo arnés con la versión actual sin repetir A/B. |
| 14 controles mínimos nuevos, 7 por REST Auth y 7 por rules-unit-testing | Comportamiento esperado. Los errores deliberados siguen FAIL; el lote mínimo con raíces diferidas sigue inconcluso bajo el clasificador individual. Son controles de diagnóstico, **no casos pendientes del gate contractual**. |
| 8 pruebas del nuevo gate | PASS / 0 FAIL / 0 omitidas: inventario, cobertura de otra política, identidad/petición distinta, cambios indebidos, control fallido, componentes de lote ausentes y defectos de ejecución. |
| 74 aserciones anteriores del clasificador | Evidencia vigente reutilizada: `classifier.mjs` no cambió. Las nuevas pruebas añaden integridad de vinculación, sin sustituir los controles anteriores. |
| Gate R02 | **23 PASS / 0 FAIL / 0 INCONCLUSIVE_EVALUATOR; exit 0**. |
| Gate separado Eliminar usuario | **2 PASS / 0 FAIL / 0 INCONCLUSIVE_EVALUATOR; exit 0**. |
| Regresión funcional | No repetida: aplicación y políticas idénticas a 819e80. Se conservan aceptación A/B, aceptación 30/10 y evidencia previa de Functions. No se requiere nueva revisión humana por estos cambios de arnés/documentación. |

[Códigos de salida](evidence/r02-rules-close-20261030/exit-codes.json), [pruebas del gate](evidence/r02-rules-close-20261030/gate-tests.log), [gate R02](evidence/r02-rules-close-20261030/gate-r02.log), [baja](evidence/r02-rules-close-20261030/gate-user-deletion.log), [controles mínimos](evidence/r02-rules-close-20261030/minimal-48080.json), [versiones exactas](evidence/r02-rules-close-20261030/versions.json).

Versiones: Node **22.23.2**, Firebase Tools **15.30.0**, Firestore Emulator **1.22.0**, Storage Rules runtime **1.1.3**, rules-unit-testing **5.0.0**, Firebase SDK de diagnóstico **12.13.0**, Microsoft OpenJDK **25.0.2**. Jars, locks y hashes constan en versions.json. JWT/contraseñas efímeros no se guardan en la evidencia. Las trazas incluyen claims ficticios no secretos y peticiones/respuestas sanitizadas.

### Ocho incumplimientos históricos R02

| ID | Resultado final / evidencia |
|---|---|
| CYCLE-MULTIPLE-OPERATIVE | PASS previo conservado, lógica de selección sin modificación; gate histórico 28/10 / stage1-logic.json |
| CYCLE-SELECTION-ORDER | PASS previo conservado, rechazo de ambigüedad; misma evidencia |
| CYCLE-WRITE-Preparacion | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |
| CYCLE-CREATE-Preparacion | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |
| CYCLE-WRITE-Captura cerrada | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |
| CYCLE-CREATE-Captura cerrada | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |
| CYCLE-WRITE-Cerrado | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |
| CYCLE-CREATE-Cerrado | PASS; antes INCONCLUSIVE_EVALUATOR, traza exacta en matriz |

Los dos casos de lógica no se suman a los 23 casos únicos de Rules. [Evidencia histórica](evidence/r02-rules-20261028/r02-gate.json).

## Reproducción y conservación

[Comandos ejecutables](../tools/e2-r02/rules-diagnostic/README-CIERRE.md). Gate offline sobre evidencia conservada:

```powershell
node --test tools/e2-r02/rules-diagnostic/close-gate.test.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs --user-deletion
```

Los nuevos emuladores estaban en loopback exclusivo: Auth49099, Firestore48080, Functions45001, Storage49199, hub44400. Se iniciaron vacíos, sin importar exportaciones de aceptación ni copia privada. Cada caso creó sus fixtures. Al terminar se detuvo exclusivamente ese árbol de procesos verificado. No se publicó un túnel ni se alteraron túneles existentes.

[Preservación A/B/C/refresco](evidence/r02-rules-close-20261030/preservation.json): hashes de assets congelados sin cambios. No se ejecutaron solicitudes de prueba contra esas instancias, ni reset, seed, reinicio o reemplazo de servicios. Sin push, merge, despliegues ni conexiones a producción/Moodle/SAEKO.

## Limitaciones que permanecen abiertas

- Impedimento administrativo de **200 documentos**, sin ampliación ni afirmación de escala productiva.
- R04: depuración del histórico con dependencias, respaldo externo verificado, restauración y reversión. Renovar cuando hay que retirar un histórico con referencias académicas reales sigue bloqueado. No hay cascadas ni eliminación de dependencias.
- Diez incumplimientos de R03 sin cambios ni implementación.
- Validaciones remotas Firebase, migración, reversión y preparación productiva pendientes. No se ejecutó validación remota en proyecto real.
- Complemento Eliminar usuario mantiene su aceptación humana separada; los dos PASS de Rules y diez previos de Functions no la sustituyen.
- Registros históricos sin información recuperable conservan esa limitación; no se inventan descripciones o actores.

La aceptación funcional confirmada se registra como declaración humana, independiente de esta verificación técnica local. D1 permanece vigente: captura cerrada bloquea correcciones académicas ordinarias hasta reapertura, con la excepción de Especiales ya contratada.
