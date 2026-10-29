# E2-R02 — Aceptación A/B y observaciones finales

29 de octubre de 2026, America/Cancun. Implementación y comprobación técnica: Codex. Aceptación funcional A/B: declaración expresa del propietario en [el encargo conservado](ACEPTACION-FUNCIONAL-E2-R02-2026-10-29.txt). **El cierre formal de R02 y la preparación para producción continúan pendientes.**

## Versiones y alcance de la aceptación

| Entorno | Versión efectivamente servida por HTTPS | Estado |
| --- | --- | --- |
| A · 4208 | `aa532cbef655c9decf7ee0865b82db9f665de5cf`, `r02-rules-aa532cbef655-a` | Aceptación funcional APROBADA por el propietario, con las observaciones de este encargo |
| B · 4209 | `aa532cbef655c9decf7ee0865b82db9f665de5cf`, `r02-rules-aa532cbef655-b` | Aceptación funcional APROBADA por el propietario, con las observaciones de este encargo |
| C · 4210, nueva candidata | `d2f139dbd56d997815496036b1b95685bf9c05d2`, `r02-observations-d2f139dbd56d-c` | Correcciones comprobadas técnicamente; comprobación del propietario PENDIENTE |

La declaración cubre transiciones, modal de Captura, bloqueo ordinario, Especiales, dos ciclos, rechazo por dependencias, eliminación elegible, renovación y consulta histórica. No acredita que el propietario haya ejecutado las pruebas técnicas de Rules, atomicidad o concurrencia.

Se consultó `demo-version.json` a través de los tres túneles, no se dedujo la versión a partir del checkout. Evidencia: [inventario A/B](evidence/r02-observations-20261029/accepted-version-and-history.json) y [comprobación HTTPS final](evidence/r02-observations-20261029/final-https.json). Los manifiestos y banners originales A/B no se reescribieron: su texto histórico de aceptación pendiente queda actualizado por este registro documental.

Rama de la candidata: `codex/e2-r02-actualizacion-bitacora`. Checkout: `SPAI-TUP-R02-RULES-20261028`. Se partió de `8ff17862d2ed71758c6c008823e1c87cccf68c3f` con árbol limpio. El commit posterior de documentación no cambia la versión de código servida.

## Causas comprobadas y correcciones

**Actualización:** el antiguo `CyclesRepository.confirm` esperaba la callable, pero no solicitaba una lectura después de su confirmación. Todos los consumidores dependían de la llegada posterior del listener. La reproducción controlada con listener demorado confirma servidor actualizado y vista anterior; en el recorrido normal de la copia aislada el listener sí actualizó la pantalla. No se atribuye un fallo permanente a todas las operaciones. Los flags ordinarios de guardado/error también dependían del siguiente turno de renderizado.

Ahora se relee desde servidor la misma consulta autorizada después de confirmar. Tabla, métricas, acciones, selector y restricciones derivan del repositorio común. Guardado/error/procesamiento usan signals; la operación queda bloqueada mientras está pendiente. Un rechazo conserva su error y consulta el estado vigente; una mutación confirmada seguida de fallo de lectura muestra ambos resultados y permite **Reintentar consulta**, sin repetir `cycleCommand`. No hay recarga completa ni éxito optimista.

**Modal que reaparecía:** se reprodujo al abrir otra vista con la misma cuenta. La actualización del perfil recrea el outlet de la aplicación y el componente de Ciclos; sus variables locales olvidaban el descarte aunque seguía siendo la misma visita. `CycleVisitService` conserva únicamente el estado de presentación por UID y navegación. Entrar de nuevo o cambiar de persona lo reinicia. Las comprobaciones de autorización se mantienen en cada renderizado. Las versiones semánticamente idénticas de ciclos/perfil tampoco vuelven a sincronizar el contexto innecesariamente.

**Motivo:** ya se persistía en `bitacora.reason`, junto al actor, fecha, estado anterior/nuevo y versión, dentro de la operación atómica de `functions/cycles/service.js`. El listado no lo representaba. Se muestra directamente del registro autorizado, con **Motivo de reapertura**, resumen y **Ver detalle** para textos largos. El diálogo conserva actor, fecha/hora, ciclo y transición, Escape, foco inicial y devolución del foco. Su selección apunta al registro vigente; desaparece si éste deja de estar disponible. No se añadieron lecturas ni se modificó el servidor para guardar el motivo. Si falta: **Motivo no disponible en el registro histórico**.

## Comprobaciones dirigidas

| Requisito | Evidencia y resultado | Límite |
| --- | --- | --- |
| Actualización confirmada sin depender del listener | `observations.test.mjs`: versión anterior frente a candidata; PASS | Demora del listener modelada; el camino normal anterior también funcionaba |
| Estado, métricas, acciones y una única confirmación | `ui.json`, caso 1; PASS por HTTPS C | Datos ficticios C |
| Asignaciones y Especiales actualizados en otra vista | `ui.json`, caso 2; PASS | Selector conservado dentro del panel azul a la derecha de Estado |
| Alta/retiro actualizan lista y selección válida | Prueba unitaria adicional: comandos create/purge, lista sin listener y cálculo real del selector; PASS | No se repitió el recorrido completo aceptado B; evidencia anterior de renovación conservada |
| Confirmación seguida de fallo de lectura | `ui.json`, caso 3 y prueba unitaria; PASS | Timeout inyectado en el límite de lectura del repositorio; callable y persistencia reales. No se afirma una caída real del servidor |
| Reintento sin duplicación | Mismos registros de operación, bitácora y evento antes/después del reintento; PASS | Reintento exclusivamente de consulta |
| Versión obsoleta, estado vigente y no reapertura indebida | `ui.json`, caso 4; segunda página confirma antes; primera rechazada, sin auditoría parcial; PASS | Dos páginas de la candidata aislada |
| Motivo íntegro y actor histórico | `ui.json`, caso 5; persistencia real y modal, Escape/foco, 390 px; PASS | Capturas inspeccionadas por el agente; no aceptación visual del propietario |
| Regresión e aislamiento | 17 pruebas Node PASS / 0 FAIL; incluye hallazgos, preproducción y tupla C exacta | No ejecución completa de A/B |
| Compilación / sintaxis | Angular tunnel PASS; comprobación sintáctica Functions y pasarelas PASS; `git diff --check` PASS | Sin despliegue |

[Resultados UI](evidence/r02-observations-20261029/ui.json), [unitarias](evidence/r02-observations-20261029/unit.log), [compilación](evidence/r02-observations-20261029/build.log), [galería](evidence/r02-observations-20261029/index.html). Los ensayos UI iniciales se conservan como diagnóstico: el primero detectó la reapertura corregida; el segundo no produjo el fallo pretendido al abortar un transporte Firestore multiplexado. La ejecución final usa una inyección de timeout explícita y obtiene cinco grupos PASS.

Los ensayos UI se ejecutaron antes del commit con metadatos `WORKTREE_UNCOMMITTED`. [candidate-build.json](evidence/r02-observations-20261029/candidate-build.json) vincula sus 32 archivos JS/CSS sin cambios a `d2f139dbd56d997815496036b1b95685bf9c05d2`. Después sólo se fijaron SHA, identificador y banner; el smoke HTTPS final no envió comandos de ciclo.

Comandos principales (Node 22):

```powershell
node --test tools/e2-r02/observations.test.mjs tools/e2-r02/hallazgos.test.mjs tools/e2-r02/preproduction.test.mjs tools/e2-r02/rules-diagnostic/isolation.test.mjs
node node_modules/@angular/cli/bin/ng.js build --configuration tunnel --output-path dist/spai-tup-observations
node tools/e2-r02/observations-ui.mjs
```

El último comando contiene escrituras sobre C y se bloquea si existe `.local/review-c/.local/FROZEN.json`. **No ejecutarlo durante la revisión del propietario.** No se reiniciaron ni sembraron A/B, la demo 4206 ni el respaldo privado.

## Gate Rules y ocho incumplimientos históricos

Se reutiliza [el gate del 28/10](evidence/r02-rules-20261028/r02-gate.json): **PASS_LOCAL, 23 casos R02 y 2 Rules de baja, cero FAIL y cero INCONCLUSIVE_EVALUATOR**. No se obtiene este resultado únicamente de un HTTP 403: conserva controles positivos, raíz allow, clasificación estricta y comprobación de datos sin cambios. Rules, Storage, políticas y transacciones Functions, consultas autorizadas y Asignaciones son idénticas al SHA aceptado. La única modificación Functions es la tupla completa de puertos locales sintéticos C, probada también contra combinaciones mixtas y producción.

| ID histórico | Resultado vigente reutilizado |
| --- | --- |
| CYCLE-MULTIPLE-OPERATIVE | PASS |
| CYCLE-SELECTION-ORDER | PASS |
| CYCLE-WRITE-Preparacion | PASS; inconcluso resuelto el 28/10 |
| CYCLE-CREATE-Preparacion | PASS; inconcluso resuelto el 28/10 |
| CYCLE-WRITE-Captura cerrada | PASS; inconcluso resuelto el 28/10 |
| CYCLE-CREATE-Captura cerrada | PASS; inconcluso resuelto el 28/10 |
| CYCLE-WRITE-Cerrado | PASS; inconcluso resuelto el 28/10 |
| CYCLE-CREATE-Cerrado | PASS; inconcluso resuelto el 28/10 |

No se reinterpretó el antiguo gate general de 72 casos como ejecución nueva ni se modificaron expectativas de R03. Los **10 incumplimientos R03** siguen abiertos. Complemento **Eliminar usuario**: conserva 10 comprobaciones Functions concluyentes y 2 Rules resueltas; separado de esta aceptación A/B y sin nueva baja ejecutada en este ajuste.

## Archivos de implementación

- `src/app/features/cycles/data/cycles.repository.ts`, `cycle-visit.service.ts` y `pages/cycles-page.component.{ts,html,css}`: refresco autorizado, procesamiento, reintento y visita del modal.
- `src/app/core/data/audit-display.ts`, `audit-log.repository.ts` y `src/app/features/audit/pages/audit-log-page.component.{ts,html,css}`: motivo persistido, transición y detalle accesible.
- `tools/local/config.mjs`, `acceptance-supervisor.mjs`, `acceptance-gateway.mjs` y `functions/local-runtime.js`: instancia sintética C, tupla de puertos completa y tiempo de arranque en frío. No cambia la política funcional.
- `tools/e2-r02/observations.test.mjs`, `observations-ui.mjs`, `rules-diagnostic/isolation.test.mjs`: comprobaciones dirigidas y protección de la candidata entregada.
- Ficha, matriz, resultados, este informe, declaración del propietario y evidencia: documentación de los estados separados y sus fechas.

## Inventario de limitaciones históricas

Lectura administrativa local y verificada de emuladores A/B, sin modificación: `bitacora`, `eventos_ciclo`, `operaciones_ciclo`, `operaciones_baja_usuario`, `operaciones_seguridad`, `eventos_seguridad`, `usuarios`. Se contrastaron IDs, `operationId`, actor y referencias relacionadas.

El inventario actual encuentra **tres registros de preparación de seguridad por instancia (seis en total)** sin campo narrativo `description`: `saveRole`, `saveUser`, `assignRole`. IDs exactos, fechas y correlaciones constan en `accepted-version-and-history.json`. A: sufijos `1fec892b…`, `5642933a…`, `7e61d39a…`; B: `03c0bb3d…`, `3b36fb20…`, `ed58fe58…`, todos con prefijo `demo-sistemas_` y fecha 28/10/2026.

La causa verificable es el esquema de preparación de seguridad de `functions/security/service.js`: guarda actor, motivo, acción, cambios y destinatario, pero no una descripción narrativa. Los eventos y operaciones relacionados permiten identificar la acción y su origen, pero tampoco contienen una descripción original recuperable. Se conserva la presentación respaldada por esos campos; no se inventa un relato ni se reescriben los seis documentos.

En este inventario no se encontraron reaperturas sin motivo ni actor desconocido. La reapertura original A `ciclo_demo-sistemas_0b92451b-f0d0-44f2-8b18-0eb17dbd9535` conserva “Prueba de aceptación R02: reapertura controlada”, actor Sistemas DEMO y transición. Esta observación no acredita todos los respaldos históricos existentes fuera de las dos instancias revisadas. Los registros anteriores que carezcan de información recuperable mantienen la limitación explícita y nunca reciben la identidad del lector.

## Acceso y recorrido limitado para el propietario

**Nueva candidata C:** [abrir revisión HTTPS](https://q16qrh63-4210.usw3.devtunnels.ms/). Funciona desde otro equipo con Internet mientras esta laptop, los servicios C y el reenvío de VS Code estén activos. Se verificó por HTTPS desde el equipo anfitrión; no se presenta como una prueba física desde otro equipo. [Versión verificable](https://q16qrh63-4210.usw3.devtunnels.ms/demo-version.json).

Elegir **Sistemas DEMO** en el acceso de pruebas. Identidad ficticia: `demo.sistemas@tecplayacar.edu.mx`, con administración del escenario; no usar credenciales reales. A/B siguen en 4208/4209 sin sustitución. C tiene almacenamiento y servicios propios y sólo se pobló desde la exportación sintética inicial, sin copiar cambios posteriores de las pruebas del propietario. Estado entregado: **27-1 Captura cerrada, Especiales deshabilitado; 26-3 Cerrado con dependencias**. Los eventos ficticios de las pruebas dirigidas se conservan.

1. En C → Ciclos, reabrir 27-1 con un motivo reconocible y confirmar. Sin recargar, comprobar Captura, métricas, acciones y Nuevo ciclo deshabilitado. El modal informativo no debe reaparecer dentro de la misma visita; al salir y volver a entrar en Captura sí corresponde.
2. Cerrar captura con su confirmación. Verificar estado y acciones actualizados, Nuevo ciclo bloqueado y restricciones en Asignaciones. Si se comprueba Especiales, habilitar/deshabilitar desde Captura cerrada y observar la actualización sin recarga.
3. En Bitácora, localizar la reapertura, comprobar actor, fecha/hora, transición y motivo. Con el motivo largo ya disponible, abrir **Ver detalle**, leerlo completo y cerrar con Escape o Cerrar; comprobar retorno del foco.
4. Registrar fecha, dispositivo, URL, SHA, resultado esperado/observado y evidencia de cualquier fallo. Confirmar expresamente si estas observaciones quedan **APROBADAS** o **PENDIENTES**. No es necesario repetir A/B completos ni provocar artificialmente los errores ya cubiertos técnicamente.

C queda estable durante la revisión: sin suites, cambios de versión, restauraciones ni reinicios automáticos del agente. El autoguardado periódico preserva los datos; las operaciones que el propietario realice desde la aplicación continúan disponibles.

## Pendientes que no cierra esta entrega

- Comprobación humana de las observaciones y cierre formal de E2-R02.
- Impedimento administrativo de **200 documentos**; no se amplió ni se declara capacidad productiva.
- **R04:** respaldo externo verificado, restauración/reversión y depuración de históricos con dependencias. Renovar cuando hay que retirar un histórico con referencias académicas reales sigue bloqueado; no se implementaron borrados en cascada ni se quitaron dependencias.
- Validaciones remotas Firebase, migración, reversión y preparación para producción pendientes.
- Diez incumplimientos de R03 sin implementación ni cambio de expectativas.

Sin push, merge, despliegue remoto o conexiones reales. Se conserva D1: captura cerrada bloquea correcciones académicas ordinarias hasta reapertura; Especiales sólo según su excepción contractual vigente.
