# Etapa 1 — Evidencia, hallazgos e integración continua

## Estado de entrega

Etapa 1 completada en su alcance de documentación, pruebas base y configuración
de CI, con decisiones y verificaciones pendientes expresas. **No certifica la
seguridad ni corrige las etapas 2–8.** Base local: `3a93ea6`, posterior a y
descendiente de `146cf9f`; árbol limpio antes de iniciar. Rama de entrega:
`codex/etapa-1-contratos-pruebas`. Sin push, merge, migración ni despliegue.

Lecturas iniciales: seguimiento, entorno, copia y SPEC en `docs/`; no se
encontraron AGENTS.md aplicables. La Etapa 0 y la importación privada no se
rehicieron. Se conservaron y ejecutaron sus pruebas como regresión necesaria.

## Resultados locales del 2026-09-12

| Verificación | Resultado observado | Límite |
|---|---|---|
| Instalación `npm ci --ignore-scripts --no-audit --no-fund`, raíz y Functions | **Aprobadas**: 1047 y 257 paquetes; lockfiles conservados | No actualización funcional general ni auditoría de vulnerabilidades |
| Configuración y transformación de snapshot con objetos ficticios | **8/8 aprobadas** | No lee la copia privada |
| Suite integrada original | Aprobada: SDK Firestore y comprobación independiente REST, callable autenticada, Storage cerrado, correo simulado, cinco cuentas y seeding repetido | Aislamiento, no permisos completos |
| Reset y desconexión de emuladores | Aprobados; restablece fixtures y elimina usuario/documento extra; cuatro SDK fallan/no confirman, **7 intentos solo loopback** | Sin fallback a producción |
| Reglas directas de Etapa 1 | **52/52 caracterizaciones coinciden**; 22 contratos pasan, 28 incumplen, 2 decisiones pendientes | Auth/Firestore/Functions reales del emulador; no reglas desplegadas |
| Lógica TypeScript de Etapa 1 | **20/20 caracterizaciones coinciden**; 9 contratos pasan, 11 incumplen | Métodos reales con colaboradores sustituidos; no DOM/TestBed ni navegador completo |
| Total nuevo | **72 caracterizaciones**, **31 contratos aprobados**, **39 incumplimientos**, **2 sondas sin contrato resuelto** | Los fallos son casos, no 39 hallazgos distintos |
| `npm run test:contracts` | **Salida 1 deliberada** y 39 `CONTRACT_FAIL` individualizados | No se ignoran fallos ni se cambian reglas para aprobar |
| Angular local / producción | Ambas compilaciones aprobadas | Producción mantiene aviso de **762.42 kB / 750 kB**; no se alteró presupuesto |
| Functions | `node --check` de `index.js` y `local-runtime.js` aprobados | Verificación sintáctica más callable/trigger anteriores, no lint semántico completo |
| Workflow | `actionlint 1.7.12` sin errores; comandos equivalentes probados en Windows con Node 22.23.2 / Microsoft Java 25.0.2 | Ejecución en runner remoto pendiente |
| Copia y selección privadas | SHA-256 antes/después idénticos; archivos siguen ignorados | No se volvió a consultar ni importar datos online |

La corrida final, después de reinstalar ambos lockfiles, ejecutó las comprobaciones
de Functions, ambos builds y la suite integrada completa con **52 casos de reglas
y 20 de lógica**, además de las pruebas originales, reset y offline; terminó con
código 0. Los reportes finales son de las 18:00–18:01 America/Cancun. El comando
de contratos se verificó aparte con salida 1, 39 incumplimientos y 2 pendientes.
Los builds verifican también TypeScript y plantillas Angular existentes, sin
modificar la aplicación.

En la primera corrida, `ACADEMIC-FOREIGN-ENROLLMENTS` rompió una hipótesis de
lectura estática: el helper parece permitir matrículas globales, pero el emulador
rechazó por superar **1000 expresiones**. Se investigó el diagnóstico y se agregó
un control positivo de matrículas propias. La caracterización quedó en false y
el contrato esperado sigue en true (F11); no se cambió la regla ni se ocultó el
incumplimiento. Algunas denegaciones correctas también emiten ese límite: pasar
una prueba negativa no demuestra que la autorización falle por el motivo debido.

Hashes preservados (sin datos personales):

- Selección: `9550d3a37a5b783eb274daf3289dd3c9d94ea7f3ed1ba343e4119bb33f2bdc09`.
- Snapshot: `b3ddfc0d73a8b6c2e0415cb171456843c0d76bb84009b8562da66744321492ed`.

## Hallazgo → contrato → prueba → etapa

| ID | Hallazgo actual / estado | Contrato | Pruebas o evidencia | Etapa responsable |
|---|---|---|---|---|
| AUTH | Anónimo/inactivo restringidos en sondas, propio perfil permitido; callable no activa | C01 | `AUTH-*`, `INACTIVE-OWN-PROFILE`, `FUNCTION-*` pasan | 2 ampliar variantes; 4 sincronización |
| F01 | Nombre Sistemas supera bits y plantilla view; catálogos abiertos a cualquier activo | C01 + matriz por módulo | `OFF-READ-*`, `OFF-WRITE-*`, `UI-AUX-OFF` fallan contrato; `UI-CUSTOM-VIEW` pasa; `CUSTOM-EDIT-GROUP`/`ACADEMIC-LEGACY-FLAGS` D3 | 2 |
| F02 | Edición de docente pendiente ajeno y por perfil sin módulo | C01; propuesta de ámbito propio | `TEACHER-EDIT-other`, `TEACHER-OFF-EDIT` fallan; propio/validado y borrado propio/ajeno caracterizados; `UI-TEACHER-OWNERSHIP` pasa | 2, campos académicos por acordar |
| F03 | Tercera coordinación lee/resuelve; destino resuelve origen; solicitante falsificable; bit permite borrar solicitud ajena | C01/C05 | `REQUEST-READ/RESOLVE-*`, `REQUEST-FORGED-OWNER`, `SYSTEM-REQUEST-FOREIGN-DELETE` fallan; `UI-REQUEST-*` y lectura privada de sistemas pasan | 2 |
| F04 | Escrituras académicas sin estado de ciclo en servidor | C03/D1 | `CYCLE-WRITE-*`, `CYCLE-CREATE-*`: permite 4 estados, solo Captura esperada; `UI-CAPTURE-CLOSED` y `SYSTEMS-CLOSED-OPERATIONS` pasan | 3 |
| F05 | Más de un operativo y selección por orden | C02 | `CYCLE-MULTIPLE-OPERATIVE`, `CYCLE-SELECTION-ORDER` fallan; Captura cerrada operativa pasa | 3 |
| F06 | Promesas descartadas, éxito antes de confirmación | C06 | `REQUEST-CREATE-AWAITS`, `REQUEST-RESOLVE-AWAITS`, `UI-PREMATURE-SUCCESS` fallan; `SHARE-FIRST-WRITE-FAILS`, `UI-CYCLE-SAVE-ERROR` pasan | 3 |
| F07 | Resoluciones no atómicas/terminales mutables, doble aceptación, pérdida de grupo concurrente, creación duplicada | C05/C06 | `SHARE-PARTIAL-AND-SUCCESS`, `REQUEST-DOUBLE-ACCEPT`, `SHARE-CONCURRENT-LOST-GROUP`, `REQUEST-TERMINAL-REWRITE`, `REQUEST-DUPLICATE-CREATE` fallan | 3; deduplicación de avisos 5 |
| F08 | Compartir cambia CARGADO_MOODLE a EN_CAPTURA | C04 | `SHARE-PRESERVES-MOODLE`, `MOODLE-STATUS-RESET-ALLOWED` fallan; `MOODLE-IDENTITY-PROTECTED` pasa | 3; exportaciones 6 |
| F09 | Alta propia no inglesa en programa no asignado; ámbito derivado de campos confiados al cliente | C01/C03 | `ACADEMIC-FOREIGN-CREATE` falla; `ACADEMIC-FOREIGN-TEACHER` denegado, con salvedad F11 | 2 |
| F10 | Auxiliar con Usuarios se eleva; vínculo legacy permite agregar campos privilegiados y luego operar | C01 (propuesta de no autoescalamiento) | `PROFILE-AUX-SELF-ESCALATION`, `PROFILE-ESCALATED-CAPABILITY`, `PROFILE-LEGACY-ADDED-FIELDS/CAPABILITY` fallan; perfil A completo no se eleva | 2; referencias legacy 4 |
| F11 | Complejidad de reglas impide excepción académica de matrículas permitida por SPEC | C03, SPEC §25.4 | `ACADEMIC-FOREIGN-ENROLLMENTS` falla por límite; `ACADEMIC-OWN-ENROLLMENTS` pasa | 2 |
| F12 | Referencias/migración por correo, usageCount, actor cliente, borrado sin actor, avisos sin orden previo, CSV multilínea | Matriz; seguimiento histórico | Lectura de código conservada, **sin nuevas reproducciones completas** | 4/5/6, según seguimiento |
| F13 | Primer ingreso puede cerrar sesión | Sesión estable, sin reingresos espurios | Observado en smoke histórico de Etapa 0; no reproducido en navegador en esta entrega | 8 (diagnóstico y smoke), sin corrección ahora |
| F14 | Bundle supera advertencia 750 kB | Presupuesto existente | Reproducido build producción, 762.42 kB; aviso no error de compilación | 7 |

## Metodología: qué ejecuta realmente cada prueba

`tools/stage1/rules.mjs` crea perfiles, plantillas y documentos **ficticios**
mediante Admin solamente como preparación. Cada autorización medida usa el SDK
cliente autenticado contra emuladores y `getDocFromServer/getDocsFromServer`,
`setDoc/updateDoc/deleteDoc`, o callable real. Admin también restablece documentos
entre casos para que el resultado anterior no contamine el siguiente. El guard
de red rechaza sockets no loopback y exige `SPAI_LOCAL_SYNTHETIC=true` y hub válido.
Solo se clasifica `permission-denied` como denegación; otros errores abortan.

`tools/stage1/logic.mjs` ejecuta miembros TypeScript extraídos del código actual
mediante AST (`source-harness.mjs`). No copia la lógica de permisos ni el
algoritmo de aceptación. Sustituye dependencias y `computed` para probar métodos
de manera determinista; no verifica inyección Angular, suscripciones, templates,
reactividad de signals ni interacción visual completa. Promesas diferidas
producen fallos específicos observados; no se emplea catch genérico para aprobar.
Las carreras intercalan explícitamente dos llamadas y comprueban las escrituras
resultantes. No se atribuyen garantías transaccionales a estas sustituciones.

Cada caso registra `actual`, `baseline`, `expected`, `baselineMatches`,
`contractMatches`, `finding`, `stage` y evidencia. El reporter exige que todos
los resultados coincidan con la caracterización conocida. `expected: null`
significa decisión pendiente, no aprobación ni test omitido. El verificador de
contratos devuelve error por cualquier incumplimiento, contrato pendiente o cambio de baseline.
No reescribir baseline automáticamente cuando falle: investigar y documentar.

## CI preparada; ejecución remota pendiente

Workflow: [stage1.yml](../.github/workflows/stage1.yml).

1. Job **Windows - aislamiento y caracterización**: checkout sin persistir
   credenciales, Node de `.nvmrc`, Microsoft Java 25.0.2, ambos `npm ci` con
   lockfiles, comprobación Functions, builds local/producción, `test:stage1`.
2. Publica solo `.local/test-results/stage1-*.json` ficticios como artifact.
   No sube `.local` completa, logs, copia, manifiestos, datos de sesión ni dist.
3. Job **Contratos esperados - fallos conocidos abiertos**: descarga esos JSON
   y ejecuta `test:contracts` equivalente. **Debe quedar rojo** mientras existan
   incumplimientos; no tiene `continue-on-error`, tests saltados ni catch que
   los convierta en aprobación. Un baseline verde no es aprobación del conjunto.

Se eligió `windows-2025`, con PowerShell y `taskkill /T` del supervisor ya probado
en Windows. No se anuncia compatibilidad Linux/macOS ni se utiliza la rama POSIX
sin evidencia. Node 22.23.2 y Java Microsoft 25.0.2 coinciden con el entorno local;
descarga de dependencias/emuladores requiere red, no credenciales de producción.
Actions solo tiene `contents: read`; no despliega, no corre exportador ni consume
secretos institucionales. El build production es compilación, no publicación.

Validación: actionlint 1.7.12 para Windows, ZIP verificado con checksum publicado,
YAML y expresiones sin errores. La documentación oficial de
[Windows 2025](https://github.com/actions/runner-images/blob/main/images/windows/Windows2025-Readme.md),
[setup-node](https://github.com/actions/setup-node) y
[setup-java](https://github.com/actions/setup-java) respalda la configuración.
Esto **no es una ejecución en GitHub Actions**. La rama no se ha publicado y no
se hizo push para activarla. La primera corrida remota, descarga de herramientas,
publicación/descarga del artifact y resultado de ambos jobs siguen pendientes.

## Reproducir y revisar

Desde la raíz del repo, Node 22 y Java configurados, con emuladores propios
detenidos y puertos libres:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
npm run check:functions
npm run build:local
npm run build
npm run test:stage1
npm run test:contracts
```

El último comando retorna 1 por los fallos conocidos; ejecutar separadamente de
los anteriores para distinguir instalación/build/infraestructura de contratos.
Los reportes describen **la última ejecución**, no son resultados en vivo: volver
a ejecutar `test:stage1` antes de evaluarlos tras cambiar fuentes o expectativas.

```powershell
Get-Content .local/test-results/stage1-rules.json
Get-Content .local/test-results/stage1-logic.json
git diff 3a93ea6 -- docs tools/stage1 tools/local/run.mjs package.json .github
# Para regresar a la demo con la copia seleccionada:
npm run local:emulators
# Otra terminal:
npm start
```

No cambiar selección para ejecutar tests. La suite termina con emuladores
apagados; no modifica archivo privado ni `.local/data-source.json`. La clave y
los comandos DEMO permanecen en [ENTORNO-LOCAL.md](ENTORNO-LOCAL.md).

## Pendientes y propuesta de Etapa 2

- D1 queda resuelta: correcciones académicas bloqueadas hasta reabrir captura.
- D2: confirmar si toda vinculación entre coordinaciones requiere aceptación.
- D3: acordar compatibilidad de flags heredados versus revocación explícita y
  alcance de `edit` personalizado en módulos reservados a Sistemas.
- Validar lista de campos editables del docente pendiente propio y techo de
  delegación de auxiliares antes de implementar esas propuestas de C01.
- Pendientes técnicos: ejecución remota CI, smoke completo de navegador, todas
  las combinaciones de permisos/campos y carreras integradas indicadas en matriz.

Propuesta concreta siguiente, solo tras indicación: Etapa 2 de permisos con
perfiles compatibles, empezando por F10 y F01; luego F02/F03/F09/F11. Mantener
tests negativos de escalamiento y positivos de funciones legítimas, incluidos
matrículas globales, consulta de catálogos y sincronización inactiva. Convertir
esos contratos en gates aprobados sin ampliar privilegios ni migrar la copia.
Dejar F04–F08 a Etapa 3, y documentar cualquier dependencia antes de extender
alcance. **Esta entrega se detiene aquí.**
