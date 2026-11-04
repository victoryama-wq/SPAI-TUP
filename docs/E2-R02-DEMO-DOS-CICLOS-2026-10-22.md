# E2-R02 — Corrección del escenario ficticio de Ciclos

22/10/2026, America/Cancun. Implementación y validación técnica: Codex. Aceptación humana pendiente.

Base verificada: `16671e2b5b9021fa2069e2b0587e595338f7fb29`, rama `codex/usuarios-baja-complemento`, checkout `SPAI-TUP-BAJA-20261021`. Se conservaron los cambios locales anteriores de túnel. Esta corrección permanece como cambios locales adicionales, sin push, merge ni despliegue.

## Causa y procedencia comprobadas

`tools/local/fixtures.mjs` es un conjunto sintético general para pruebas de estados: genera 27-2/Preparacion, 27-1/Captura, 26-3/Captura cerrada y 26-2/Cerrado. Tres son operativos; la alerta es correcta. El antiguo `prepare-review.mjs` cerraba los demás, pero dejaba cuatro ciclos, sobreescribía indiscriminadamente estados y añadía otra fecha de cierre. Se sustituyó esa preparación, no la detección de inconsistencia.

La sesión histórica del túnel también contiene esos cuatro ciclos. Inspección exclusivamente de lectura en `127.0.0.1:48080`: 40 documentos y dos delegaciones. Procede de la recuperación histórica autorizada, por lo que se conservó como copia importada. Huella SHA256 antes y después de la comprobación: `a5e1c7b69f4e332de5c160a577e92d9695e922766152ccd75607fb96fecce7f8`. No se leyó ni modificó el respaldo privado ni su selección.

## Escenario independiente `r02-two-cycles-v1`

| Ciclo | Estado | Función |
|---|---|---|
| 27-1 | Captura | Único operativo |
| 26-3 | Cerrado | Histórico |

El código nuevo construye los documentos antes de insertarlos en una base vacía; no migra ni borra la copia histórica. Se conservan los fixtures generales para los casos negativos existentes.

Referencias revisadas y resolución únicamente en los nuevos fixtures:

- 27-2 no tiene referencias académicas y no se incluye en este escenario.
- Los grupos ADM/DER de 27-1 y 26-3 se conservan (cuatro grupos).
- Los dos grupos de 26-2 no se generan. `demo-asignacion-historica` conserva su identidad y demás datos, y pasa a 26-3 / `26-3 DER 11 01`, un grupo existente. No se elimina ninguna de las cuatro asignaciones ficticias.
- Las otras asignaciones, las dos solicitudes compartidas de 27-1 y sus grupos conservan sus referencias.
- La solicitud ficticia `demo-reapertura` conserva 26-3 y la notificación sigue apuntando a ella. Al ser ahora histórico, la solicitud NO autoriza reabrir un Cerrado: ese flujo pendiente pertenece a R03; no se implementa ni se cambia aquí.
- La fecha orientativa `2026-09-30` se conserva del fixture original. No es un cierre automático. La prueba de ausencia de fecha usa `schedule` en el emulador aislado y restituye ese valor mediante el mismo comando autorizado.

La preparación verifica ciclos, grupos, asignaciones de origen/destino y referencias de notificaciones. Rechaza una base no vacía ajena al escenario y Auth preexistente; no resetea. Repetir `prepare` en el escenario verifica su estado sin resembrar ni revertir cambios. Si las pruebas humanas cambian los estados esperados, la verificación falla explícitamente sin corregirlos silenciosamente. El modo R02 desactiva los endpoints de reset/seed del supervisor.

## Archivos de esta corrección

- `tools/e2-r02/review-fixtures.mjs`: escenario de dos ciclos y validación de referencias.
- `tools/e2-r02/prepare-review.mjs`: preparación segura en sesión aislada vacía; verificación posterior sin escrituras.
- `tools/e2-r02/review.ps1`, `tools/local/run.mjs`: arranque explícito `--review --r02-review`, sin ejecutar preparación genérica R01/T10.
- `tools/e2-r02/review-fixtures.test.mjs`, `review-scenario.mjs`, `review-readonly.mjs`: pruebas dirigidas y capturas.
- Este informe, ficha/resultados R02 y `docs/evidence/r02-two-cycles/`.

No se modificaron el componente de Ciclos, Rules, permisos, consultas de autorización, concurrencia ni auditoría. El módulo existente ya ofrece el modal y las acciones correctas cuando recibe un escenario válido.

## Comprobaciones y sus límites

| Comprobación | Resultado y evidencia |
|---|---|
| Fixtures deterministas, dos ciclos, referencias válidas, rechazo de referencias rotas y preservación de negativos | 3/3 pruebas `review-fixtures.test.mjs` |
| Configuración local, rechazo de entornos reales, fixtures generales y correo simulado | 7/7 pruebas existentes `tools/local/tests/config.test.mjs` |
| Preparación repetida sin cambios; autorización HTTP; estados, concurrencia, modal, confirmación obsoleta y fecha ausente | 9/9 casos de `review-scenario.mjs`; [resultados](evidence/r02-two-cycles/results.json) |
| Teclado, un solo diálogo, transición del modal a confirmación y cancelación, acciones de fila después de descartar | `review-readonly.mjs`, cero comandos de ciclo enviados por Sistemas; [resultado](evidence/r02-two-cycles/readonly.json) |
| Compilación frontend aislado | Angular completó la compilación y sirve en 4202; no se cambió código Angular |
| Escritorio/tableta/móvil | Capturas inspeccionadas a 1280, 768, 390 y 320 px; [galería](evidence/r02-two-cycles/index.html) |

Las pruebas de integración usan Auth/Firestore/Functions reales **emulados**. El rechazo sin capacidad se comprobó por HTTP callable. El cierre/cancelación/reapertura y la versión obsoleta se comprobaron desde navegador y callable; no hubo éxito falso ni efectos parciales en ciclos, bitácora, eventos o idempotencia tras rechazo.

El cierre definitivo, creación concurrente y los múltiples operativos reales se probaron con el servicio servidor y transacciones Firestore en una base nombrada aislada (`namedDatabase` en resultados), sin alterar el escenario de revisión. Los estados adicionales de la interfaz (Preparación, solo históricos, múltiples, carga/error) se inyectaron **en memoria del navegador** y se distinguen de las operaciones reales del servidor. No se presentan como un recorrido humano completo de cierre definitivo.

La primera ejecución del caso sin fecha intentó cambiar la colección en memoria después de abrir el modal: la revalidación del contexto cerró el modal y falló la aserción. Se corrigió el ensayo para establecer ausencia de fecha con el callable antes de entrar, comprobar el texto y restaurar la fecha. La segunda ejecución completa pasó; no se cambió la expectativa ni el código del modal.

La tabla mantiene su desplazamiento horizontal institucional en pantallas estrechas; las capturas `acciones-*` muestran la columna de operación después de desplazarla. El encabezado global conserva su diseño existente. No se hizo un rediseño visual.

## Disponibilidad y reproducción

**Disponible en este equipo:** http://127.0.0.1:4202/ciclos — seleccionar **Sistemas DEMO**. Versión de escenario `r02-two-cycles-v1`, frontend del árbol vigente sobre `16671e2b`. Emuladores: Auth 19099, Firestore 18080, Functions 15001, Storage 19199; proyecto `demo-spai-tup`. Todos en loopback.

El túnel 4206 y la recuperación 48080 siguen funcionando con su sesión histórica intacta. **El enlace público anterior no sirve este nuevo escenario.** No se ha cambiado su destino ni se atribuye una prueba desde otro equipo. La separación evita modificar la copia importada que el encargo exige conservar.

Si ya está activo, abrir la URL; no ejecutar otra preparación. Para iniciar el escenario desde cero cuando sus propios servicios estén detenidos, usar dos terminales en este checkout:

```powershell
$env:SPAI_NODE22 = 'C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021
.\tools\e2-r02\review.ps1 emulators
```

En la segunda terminal, mismo directorio y variable: `.\tools\e2-r02\review.ps1 frontend`. `prepare` es opcional y solo verifica el escenario ya preparado. No utilizar `local:reset` ni las tareas de recuperación del túnel para este ensayo. Esta sesión aislada es desechable; no es una copia persistida del trabajo compartido.

Recorrido breve: entrar a Ciclos, comprobar 27-1/Captura y su fecha, descartar con Entendido/×/Escape, comprobar dos filas y el candado de cierre de 27-1; abrir su confirmación y cancelar. Nuevo ciclo debe seguir deshabilitado. Cerrar captura de verdad cambia únicamente esta sesión aislada; no habilita crear hasta el cierre definitivo.

## Pendientes conservados

Esta corrección del escenario **no valida completamente R02**. Se conserva `NO_VALIDADA_LOCAL` por los seis casos inconclusos del evaluador de Rules ya documentados, la aceptación humana pendiente y los gates de producción. El histórico de 18 incumplimientos R02/R03 y su evolución anterior (56 cumplidos, 10 de R03 pendientes y seis inconclusos de R02) no se recalcula ni se debilita con estas pruebas dirigidas. Permanecen el impedimento administrativo de 200 documentos, validaciones remotas, migración y reversión. D1 sigue bloqueando correcciones académicas con captura cerrada hasta reabrir. Sin R03, push, merge, despliegue ni conexiones reales.

Nota de prueba adicional: el ensayo de consulta de Auxiliar inicialmente supuso que los fixtures generales le concedían lectura de Ciclos. El navegador mostró «Acceso restringido» porque este auxiliar sintético no tiene delegación. Se ajustó el caso a esa autorización efectiva comprobada: ruta directa restringida, sin modal ni acciones. No se le concedieron permisos ni se copió la delegación del propietario desde la recuperación histórica. La ejecución posterior de `review-readonly.mjs` pasó.

## Actualización del túnel existente — 22/10/2026, 16:45 Cancún

Por instrucción posterior del propietario se actualizó **el mismo puerto 4206**. Esta sección sustituye la disponibilidad inicial descrita arriba: ahora https://q16qrh63-4206.usw3.devtunnels.ms/ sirve `tunnel-r02-two-cycles-20261022-01`, conectado al escenario sintético `r02-two-cycles-v1` en 18080. La sesión local 4202 utiliza esos mismos datos; las pruebas realizadas por ambos accesos se reflejan entre sí.

Solo se reinició la pasarela Node de 4206 (PID anterior verificado 30924). No se reiniciaron ni modificaron los emuladores históricos de 48080, sus 40 documentos ni sus dos delegaciones. Las huellas anteriores/posteriores permanecen iguales. El respaldo privado y su selección no se tocaron.

Archivos adicionales: `tools/local/tunnel.mjs` admite `--r02` únicamente con sesión sintética aislada 10000, hub/sesión válidos y marca `demo_escenario/r02 = r02-two-cycles-v1`; conserva las restricciones de rutas y origen. `build-tunnel.mjs --r02` compila en `dist/spai-tup-r02-tunnel`, sin sobrescribir la compilación histórica, y etiqueta la versión y procedencia. Las tareas locales VS Code 2/3/4 quedaron preparadas para este escenario; se agregó «SPAI: Iniciar escenario R02 de dos ciclos». No ejecutar esa tarea de inicio si los emuladores ya están activos.

Verificación: compilación Angular correcta; 4/4 pruebas existentes de política de túnel; login Sistemas y consulta de Ciclos a través de la **URL HTTPS pública real** desde un navegador del anfitrión. Dos filas, modal 27-1/Captura, botón Nuevo ciclo bloqueado y acción Cerrar captura disponible después de Entendido. Cero comandos de cambio de ciclo. Rutas administrativas y token owner bloqueados por la pasarela. [Resultado](evidence/r02-two-cycles/tunnel.json), [modal](evidence/r02-two-cycles/tunnel-modal.png), [tabla](evidence/r02-two-cycles/tunnel-tabla.png).

El navegador nuevo mostró primero el aviso de Microsoft Dev Tunnels «Continue». El ensayo se ajustó para atravesar ese aviso y medir el tráfico de la aplicación después de cargar su login, separado del tráfico del aviso de Microsoft. El recorrido final pasó sin errores JavaScript. No equivale a una prueba física desde otra computadora ni a aceptación humana.

Para ver los cambios: abrir el mismo enlace, continuar si aparece el aviso del túnel, recargar con Ctrl+F5 e iniciar sesión con Sistemas DEMO. La banda debe indicar «DEMO R02 · TÚNEL — Escenario de dos ciclos». No es necesario crear otro túnel. Se conservan todos los pendientes de R02 y producción.
