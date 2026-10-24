# E2-R02 — Complemento de Ciclos y Asignaciones

Fecha: 23 de octubre de 2026, America/Cancun. Responsable técnico: Codex. Rama de trabajo: `codex/usuarios-baja-complemento`; base `16671e2b5b9021fa2069e2b0587e595338f7fb29`, conservando los cambios locales posteriores. Autorización: encargo `4e1f52bf-e7f6-475a-8439-c718634e8a2b/Texto pegado.txt` y aclaración del propietario en este chat.

## Complemento contractual autorizado

Este complemento prevalece sobre la interpretación anterior de «dos ciclos únicamente en fixtures» y acota E2-C02/E2-D05. No implementa R03 ni la depuración integral R04.

- Máximo **dos ciclos registrados** y **uno operativo** (Preparación, Captura o Captura cerrada). Dos históricos son válidos temporalmente. Con dos históricos puede abrirse el formulario de alta, pero no confirmar un tercero.
- El histórico inmediato se conserva completo para consulta: para abrir 27-2, 27-1 debe estar Cerrado y conservarse. Si existe otro anterior, su eliminación es una acción explícita; no se reemplaza ni borra automáticamente.
- La facultad de eliminar es **PURGE_CYCLE**, junto con acceso EDIT a Ciclos y ámbito de ciclo vigente. MANAGE_CYCLES por sí sola no la concede. No se amplían delegaciones.
- En este complemento solo se elimina un histórico **anterior y sin dependencias**. La bitácora conserva el documento íntegro, identificador, código, actor, fecha del servidor, estado anterior y motivo de 4–1000 caracteres. No constituye un respaldo externo verificado de E2-C05.
- Si el histórico tiene datos asociados, permanece intacto y se rechaza la eliminación. Su depuración, respaldo externo, retención, restauración y reversión siguen en R04. No se inventan cascadas ni reasignaciones. Una base preexistente con más de dos ciclos queda señalada y bloquea nuevas altas; no se migra ni borra para forzar el límite.
- El histórico más reciente se determina por el código contractual de dos dígitos y periodo (`AA-P`); códigos históricos inválidos o duplicados bloquean la eliminación en servidor. No se selecciona por orden de consulta.
- D1 permanece: captura cerrada bloquea correcciones académicas ordinarias hasta reapertura. Solo la excepción ESPECIAL habilitada y autorizada conserva su operación.

## Implementación

| Requisito | Archivos principales | Resultado técnico |
|---|---|---|
| Modal solo al entrar con Captura; no reapertura por actualizaciones | `cycles-page.component.ts/html` | PASS en recorrido real; entrada en Preparación, Captura cerrada y Cerrado sin modal |
| Acciones horizontales de 44 px, motivo de reapertura, tooltips por foco/cursor | `cycles-page.component.html/css` | PASS a 1280, 768, 390 y 320 px; ayuda del botón deshabilitado en envoltorio enfocable |
| Alta bloqueada por operativo, carga, error o inconsistencia; dos históricos permiten explicación pero no guardado | página y repositorio de Ciclos, `functions/cycles/service.js` | PASS UI y transacciones concurrentes |
| Purga explícita de histórico vacío anterior | `functions/cycles/service.js`, `functions/cycles/dependencies.js` | PASS autorización, ámbito, revocación, caducidad, versión, motivo, reintento y atomicidad |
| Protección de referencias posteriores | `firestore.rules`, colección privada `ciclos_retirados` | Rechazo observado sin escritura; diagnóstico del evaluador pendiente, no acreditado como denegación limpia |
| Asignaciones ordinarias bloqueadas; Especiales solo en su ficha | página de Asignaciones | PASS UI; altas desde Especiales producen ESPECIAL; guardado reevalúa sesión, ciclo y permisos; cambio de ficha cierra el borrador |
| Positivos y negativos directos de Asignaciones | `complement-rules.mjs` | Positivos ejecutados; negativos con `evaluation error` siguen inconclusos |

La eliminación lee dentro de la transacción las colecciones mutables actuales: grupos, asignaciones, solicitudes compartidas y a Sistemas, ligas Meet, notificaciones, agenda de equipo, docentes, asignaturas, programas, nomenclaturas, categorías y plantillas Moodle y configuración; también actividades privadas mediante collection group. Busca referencias al código o identificador incluso en estructuras anidadas y textos. La comprobación es conservadora: una coincidencia requiere revisión, no se elimina para omitirla. Subcolecciones del propio ciclo bloquean la operación. Los ámbitos de seguridad y registros de auditoría/eventos/idempotencia se conservan; los códigos retirados quedan reservados y no se reutilizan. No se modifica ninguna entidad dependiente.

La transacción confirma juntos eliminación, marcas de retiro por código/ID, control de ciclos, bitácora, evento e idempotencia. El reintento de la misma operación no repite efectos; la autorización se vuelve a comprobar incluso en reintentos. El evento mantiene `PENDIENTE / SIMULATED_ONLY`: no se enviaron correos.

Las Rules nuevas impiden referencias tardías a códigos/ID retirados desde las operaciones existentes de Solicitudes a Sistemas, Meet, notificaciones y agenda. La política académica de Asignaciones se conserva exactamente; no se modificaron sus expectativas para cerrar los diagnósticos pendientes.

## Evidencia y límites

- `tools/e2-r02/complement-server.mjs`: siete grupos PASS en una base nombrada nueva del emulador 28080. Incluye cada colección dependiente, agenda privada, subcolecciones, dos creaciones concurrentes, dos envíos de purga, hash de petición, snapshot sin cambios ante rechazo y conservación íntegra del último histórico.
- `tools/e2-r02/complement-ui.mjs`: seis grupos PASS, navegador real y callable real en 4204/28080. Incluye eliminación positiva de un histórico ficticio vacío, versión cambiada antes de confirmar, cancelación y limpieza del motivo. No son aceptación humana.
- `tools/e2-r02/complement-rules.mjs`: suite estricta con salida 1. Siete rechazos de Asignaciones y uno de referencia tardía devolvieron diagnóstico `evaluation error`; se registran **ocho observaciones inconclusas**, no ocho nuevos IDs del gate histórico. La consulta VIEW no ejecutó purga por callable y la escritura directa de ciclos/marcas fue rechazada limpiamente. Las altas académicas permitidas y la solicitud sobre ciclo no retirado funcionaron. Ningún negativo creó datos.
- Unitarias de política R01, solicitud de reapertura y fixtures reproducibles: **14/14**.
- Compilación local y producción correctas; producción mantiene advertencia de presupuesto inicial (784,55 kB frente a 750 kB).
- Capturas y resultados: [galería](evidence/r02-complement/index.html), `server.json`, `ui.json`, `rules.json`. Capturas inspeccionadas por Codex; no sustituyen aceptación del propietario.

El estado global R02 sigue **IMPLEMENTACIÓN LOCAL CON PENDIENTES / NO VALIDADA LOCALMENTE**. Se conserva la línea histórica de 18 incumplimientos R02/R03: dos acreditados anteriormente, seis R02 inconclusos y diez R03 abiertos; este complemento no vuelve a contabilizar ni cambia ese gate. Permanecen el impedimento administrativo de 200 documentos, las validaciones remotas, migración, reversión, respaldo externo y preparación para producción. La lectura de dependencias requiere además evaluar costes y escala antes de producción y ampliar el registro de dependencias si cambia el esquema.

## Revisión breve

1. En Captura cerrada, entrar en Ciclos: no aparece modal automático. Motivo vacío o espacios mantiene Reabrir deshabilitado; la ayuda se consulta con teclado o cursor.
2. En Asignaciones, recorrer las fichas ordinarias: + Asignación deshabilitado con la explicación. Especiales requiere habilitación, ámbito y permiso; Cerrado no permite capturar.
3. En la sesión **aislada** de pruebas, entrar con Captura: modal con estado y fecha reales, descartable por Entendido, × o Escape; no reaparece durante la visita.
4. Con dos históricos aislados: alta explica el límite y bloquea guardar; solo el anterior muestra papelera al actor autorizado. Cancelar no cambia datos. Un histórico con dependencias se rechaza conservándolo.

No ejecutar las pruebas destructivas contra 18080/4206 ni eliminar históricos compartidos para revisar la interfaz. La demo y su respaldo privado se preservan; cualquier actualización del frontend no constituye validación completa de R02 ni aceptación visual.

## Versión servida y comprobación del túnel

Frontend `tunnel-r02-complement-20261023-01`, compilado el 23/10/2026 a las 17:22:19 UTC desde la base indicada y cambios locales. Disponible en https://q16qrh63-4206.usw3.devtunnels.ms/ mediante la pasarela 4206 existente. Compilación temporal separada, copia de recursos antes del índice y conservación de recursos anteriores; no se reiniciaron emuladores ni se recargaron fixtures.

`tools/local/tests/r02-complement-tunnel-browser.mjs` PASS: acceso por HTTPS real desde un navegador del equipo anfitrión, inicio de sesión, dos ciclos, ausencia de modal en Captura cerrada, acciones de fila, Nuevo ciclo deshabilitado y Asignación ordinaria deshabilitada. Cero llamadas cycleCommand; snapshot anterior/posterior de ciclos, usuarios, delegaciones, grupos, asignaciones, operaciones y retiros idéntico. Endpoints administrativos no publicados y sin errores JavaScript. No equivale a una prueba desde otra computadora ni a validación remota de producción. El selector del primer intento del smoke usó una tilde distinta del nombre accesible existente; se corrigió el selector y la ejecución posterior pasó.

La demo conserva **27-1 en Captura cerrada** y **26-3 en Cerrado**. No se reabrió el ciclo para forzar el modal. Las capturas de Captura y los ensayos de eliminación proceden exclusivamente de 4204/28080. El respaldo privado no se leyó ni modificó.

Para reproducir esta evidencia técnica se emplea la copia aislada `.local/r02-complement-20261023`, con `SPAI_LOCAL_TEST_ISOLATED=true`, `SPAI_LOCAL_SYNTHETIC=true` y `SPAI_LOCAL_TEST_SLOT=complement`; las pruebas nuevas comprueban explícitamente Firestore 28080. `complement-server.mjs` crea una base nombrada nueva por ejecución; `complement-ui.mjs` modifica únicamente sus fixtures en ese entorno. No ejecutar estas pruebas contra la demo compartida. La configuración principal separa archivos de sesión y CLI del slot complement para evitar colisión con la revisión compartida.

Las ejecuciones antiguas conservan su evidencia histórica. Los scripts `integration.mjs`, `review-scenario.mjs` e `interface-states.mjs` anteriores al complemento contienen presupuestos de alta con varios históricos o modal en estados que ahora se excluyen; requieren adaptación antes de reutilizarse como gate integral. No se ejecutaron ni se cambiaron sus expectativas en esta entrega para presentar un gate verde. Los requisitos modificados se comprueban en las suites nuevas enlazadas, sin retirar los casos pendientes del gate contractual.
