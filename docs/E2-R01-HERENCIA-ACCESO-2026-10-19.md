# E2-R01 — Usuarios y herencia de acceso institucional

Fecha de ejecución: 19 de octubre de 2026, America/Cancun. Responsable técnico: Codex.
Base: cdf1621d21ecbdbc58a897db323e7791aa166292, rama codex/e2-r01-seguridad-permisos.
Aceptación visual/humana: **PENDIENTE**. No es aprobación para producción ni inicio de R02.

## Encargo y conservación

Implementación de los dos bloques de la solicitud adjunta del propietario: presentación y herencia con operación de servidor. La nueva instrucción sustituye las pestañas técnicas y el panel heredado fijo de la entrega anterior. El cambio pendiente de etiqueta «Asignaciones de rol activas» se conserva con ese significado en la ficha de cada persona; no se transforma en un contador de usuarios.

La rama y HEAD coincidían con la base; se preservó ese cambio no confirmado. Main permanece en 6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2. No se modifican contratos académicos de R02/R03, selección del respaldo privado, datos compartidos ni delegación del propietario.

## Bloque A: presentación y ubicación de las operaciones

| Función anterior | Ubicación actual y garantías |
|---|---|
| Resumen de acceso | Directorio operativo; búsqueda por nombre/correo/perfil y filtro Activo/Inactivo; tabla Usuario, Rol, Accesos, Programas, Estado y Acciones |
| Nuevo perfil institucional | Nuevo usuario; mismo editor, permisos/ámbitos vacíos y perfil personalizado inicial sin concesiones |
| Editar perfil | Editar en la fila o Editar perfil en la ficha; datos, saludo, estado, ámbitos, módulos y facultades plegables |
| Roles asignados globales | Ver acceso → ficha de la persona; asignar rol preaprobado y consultar/retirar asignaciones autorizadas |
| Delegaciones globales | Ficha de la persona; historial, nueva delegación, suspensión y revocación; acceso reservado a Administración General |
| Revisiones pendientes globales | Aviso con contador y bandeja modal de Administración General; conservar/retirar/sustituir |
| Perfiles heredados fijo | Ficha con alerta y Regularizar acceso → correspondencia verificada/preview/aplicación existente |
| Directorio/editor de definiciones | Roles personalizados; dos pasos en el mismo diálogo; zona sensible y bloqueo de definiciones en uso |
| Motivo anterior al resumen | Motivo obligatorio de 4–1000 caracteres en la confirmación; se limpia al cancelar/cambiar de operación |
| Actualizar desde servidor | Carga inicial, actualización tras cambios/sesión y al recuperar foco fuera del modal; reintento ante error |

Un único diálogo nativo, con título, foco inicial, Tab contenido, Escape/cancelación, retorno al disparador y scroll interno. No se duplica lógica de formularios. Los campos de facultades delegadas son informativos en Editar usuario: se administran mediante la delegación. Las nueve facultades permanecen separadas del nivel Editar; no se implementan flujos académicos posteriores.

Se corrigió además la edición de datos personales para no borrar capacidades legítimas ni convertir permisos/capacidades derivados de un rol en concesiones base permanentes. Una prueba retira el rol después de editar el saludo y verifica que sus facultades desaparecen.

### Métricas y alcance

Las cifras provienen exclusivamente del directorio autorizado del callable, sin lecturas nuevas desde el navegador ni recortes. Usuarios registrados excluye alias; Usuarios activos filtra Activo; Coordinadores cuenta perfiles de Coordinación Académica (incluidos inactivos, explicado); Roles disponibles cuenta definiciones personalizadas ACTIVE, no perfiles base. Para un auxiliar las cifras son de su directorio limitado y se indica que no son totales institucionales. En carga/error se muestra —, no cero.

El resumen de módulos usa una proyección efectiva calculada por el servidor. Muestra hasta tres módulos y la cantidad adicional, con detalle completo en la ficha; esto no recorta la lectura administrativa. Estados de persona, asignación, delegación y revisión se presentan separadamente. Las claves almacenadas no se traducen.

## Bloque B: contrato de herencia y reemplazo

### Preparación y autoridad

Solo un ADMIN_GENERAL activo puede invocar previewInheritance o applyInheritance; se reutilizan securityCommand, su transacción, cerrojo, auditoría e idempotencia. El navegador envía identidades y una elección explícita de reemplazo, nunca un conjunto de permisos autorizado por el cliente.

La selección excluye alias; el servidor recorre y verifica las identidades canónicas, rechaza origen/destino equivalentes (también mismo correo), referencias alias y al propio operador como destino. El origen debe estar activo, regularizado y coherente con sus fuentes. No se hereda una autorización heredada temporal de siete días. Una configuración inconsistente, revisiones pendientes, definición retirada/no aprobada o contribuciones de ámbito incompatible bloquean la operación completa.

La vista previa devuelve el origen, configuración actual del destino, resultado, roles y revisiones utilizadas, asignaciones/delegaciones que se retirarán, historial conservado y vigencias. No existe selector de correspondencia en este flujo. Regularizar acceso sigue disponible separadamente.

### Destino

Un destino sin configurar exige perfil canónico CUSTOM/PENDING, esquema 2, estado Activo y ausencia de permisos, capacidades, ámbitos e historial de autorización. Un perfil inactivo, heredado, con roles/grants retirados, denegaciones, mapeos o revisiones no se considera nuevo.

Cualquier configuración/historial exige **Reemplazar acceso existente**. Reemplazar retira asignaciones activas y revoca delegaciones activas del destino; no borra documentos anteriores ni revisiones. Las asignaciones que el destino había concedido mediante su delegación a terceros siguen activas y pasan a revisión administrativa, conforme al contrato. No se suman las facultades previas a las copiadas.

No se cambia nombre, correo, saludo, authUid, Authentication, estado personal ni sesiones. Una cuenta inactiva permanece inactiva. La protección del propio operador y del último administrador se conserva.

### Qué se copia y qué se conserva

- Rol base, permisos explícitos válidos, denegaciones de migración, ámbitos de programas/ciclos/docentes/campos y capacidades permitidas.
- Referencias a definiciones de roles aprobadas y compatibles, en asignaciones nuevas con identificadores propios.
- Una delegación nueva cuando el origen es auxiliar, con módulos/ámbitos/capacidades efectivos y exactamente su fecha límite, si existe.
- Trazabilidad del operador, persona origen, revisión de perfil, huella de fuentes, IDs/revisiones de asignación y delegación de origen.

El origen no se escribe. No se copian proyecciones base obsoletas de auxiliares ni historial, identidad, sesiones o credenciales. No existe sincronización posterior entre personas. Las referencias a definiciones de roles siguen compartidas según el modelo existente: una definición en uso no puede editarse/retirarse sin revisar/sustituir sus asignaciones.

### Tiempo, concurrencia y efectos

Preview válida durante **cinco minutos de servidor**, o hasta el vencimiento anterior de la delegación origen. Confirmar vuelve a comprobar al operador, identidad, fuentes y vigencia. La huella incluye perfiles, definiciones, asignaciones, grants, revisiones, mapeos y asignaciones de terceros afectadas por el reemplazo. Cambios relevantes producen HERENCIA_PREVIEW_OBSOLETA/aborted o un rechazo de precondición explicativo sin cambios parciales.

expiresAtMillis en delegaciones se comprueba en policy.effective, Rules (request.time) y la sesión del navegador (temporizador que retira datos/permisos). Ausencia de fecha conserva la política previa sin fecha; no añade una nueva duración. Los formatos de vigencia no representados por el modelo y los plazos en perfiles/asignaciones/definiciones se bloquean explícitamente, sin convertirlos a permanentes ni copiar un subconjunto. Una extensión general de esos modelos queda fuera de esta entrega.

La confirmación persiste conjuntamente perfiles/asignaciones/delegación, auditoría con antes/después, evento de notificación, idempotencia y marca de aplicación de preview. El consumidor de notificaciones permanece fuera de la transacción y simulado en DEMO. La vista previa también es auditable, pero cancelar no aplica acceso. Reintentos con el mismo ID y cuerpo devuelven el mismo resultado, incluso con confirmaciones concurrentes; reutilizar el ID con otro cuerpo se rechaza.

### Límite administrativo

Se conserva el máximo combinado de **200 documentos**, leídos antes de cada comando en usuarios, roles_personalizados, delegaciones, asignaciones_roles, revisiones_roles y mapeos_permisos. Auditoría/eventos/previews/idempotencia no integran ese conteo. No se aumenta el límite ni se truncan resultados.

La herencia verifica además que sus nuevas asignaciones/delegaciones/revisiones no lleven el estado resultante por encima de 200. Al exceder: resource-exhausted, «La herencia excedería el límite administrativo de 200 documentos». La prueba al umbral acredita que una preview sin nuevas filas de seguridad puede prepararse, pero una copia que añadiría una asignación se rechaza íntegramente. Por encima de 200 sigue bloqueada la lectura administrativa combinada, incluidas las operaciones críticas ya documentadas. Sigue siendo impedimento productivo; requiere un diseño administrativo escalable con atomicidad/revocación acreditadas antes de desplegar.

## Validación y evidencia

Resultados de esta ejecución: ver [manifiesto](evidence/r01-inheritance/results.json).
Estado técnico: **VALIDADA_LOCAL**. 28/28 unitarias; 37/37 servidor R01, 9/9 Auxiliar, 8/8 Control de accesos (una caracterización del defecto anterior), **21/21 herencia**; **42/42 Chromium**, sin omitidas ni reintentos inestables; 72/72 caracterizaciones. Gate contractual: salida 1, mismos 18 IDs pendientes. Builds local/LAN/production correctos; advertencia de presupuesto inicial 779,79/750 kB. Ensayo offline: siete intentos exclusivamente loopback, sin fallback a producción.

La suite completa incluyó inicialmente 20 casos de herencia. Después se reforzó la lectura del reloj tras recuperar la preview y se normalizaron los datos de las nuevas asignaciones; se repitieron los 21 casos de servidor, incluyendo vencimiento durante esa lectura. El frontend no cambió después de las 42 pruebas de navegador.

Capturas comparables, tomadas con datos ficticios aislados:

| Ancho | Directorio | Edición | Herencia | Confirmación |
|---|---|---|---|---|
| 1280 | [Ver](evidence/r01-inheritance/summary-1280.png) | [Ver](evidence/r01-inheritance/profile-1280.png) | [Ver](evidence/r01-inheritance/inherit-1280.png) | [Ver](evidence/r01-inheritance/confirm-1280.png) |
| 768 | [Ver](evidence/r01-inheritance/summary-768.png) | [Ver](evidence/r01-inheritance/profile-768.png) | [Ver](evidence/r01-inheritance/inherit-768.png) | [Ver](evidence/r01-inheritance/confirm-768.png) |
| 390 | [Ver](evidence/r01-inheritance/summary-390.png) | [Ver](evidence/r01-inheritance/profile-390.png) | [Ver](evidence/r01-inheritance/inherit-390.png) | [Ver](evidence/r01-inheritance/confirm-390.png) |
| 320 | [Ver](evidence/r01-inheritance/summary-320.png) | [Ver](evidence/r01-inheritance/profile-320.png) | [Ver](evidence/r01-inheritance/inherit-320.png) | [Ver](evidence/r01-inheritance/confirm-320.png) |

Se comprobaron foco, teclado, cancelación, geometría y desplazamiento interno con automatización; Codex inspeccionó capturas de escritorio y móvil. Esta evidencia no equivale a aprobación visual del propietario.

### Conservación y demo

Las lecturas completas de la demo compartida antes y después de las pruebas produjeron el mismo SHA-256: `cfd37e58a04ac36d585440cfb76e4bf50313ac34e287fcbc489b1f7591e7a6c3`. Se preservaron sus siete perfiles, dos delegaciones y restantes colecciones. La delegación del propietario `333bbac4-82c6-4dec-a116-53ae8d31bfd1` continúa ACTIVE, revisión 1. Respaldo privado y selección conservan sus hashes, registrados en el manifiesto. Los emuladores aislados se detuvieron al terminar; los compartidos se conservaron.

La pasarela existente utiliza Wi-Fi `192.168.42.1/22`, puerto 4201. También existe Ethernet `192.168.0.49/24`; no se cambia la interfaz compartida. La comprobación de esta ejecución es desde el anfitrión, no desde otra computadora. La entrega actualiza únicamente los archivos compilados que sirve esa pasarela, sin recarga de fixtures ni reinicio de emuladores. El identificador del commit servido se publica localmente en `/demo-version.json`.

Pruebas añadidas: tools/e2-r01/inheritance-server.mjs, inheritance.spec.mjs y caducidad en auxiliary.spec.mjs.
Pruebas adaptadas solo a la nueva navegación: access.spec.mjs, users-layout.spec.mjs, ui.spec.mjs y acceptance.spec.mjs.
La suite de contratos de R02/R03 conserva sus expectativas y sus 18 incumplimientos abiertos.

Las comparaciones de atomicidad drenan los eventos **ya confirmados** antes de tomar la instantánea completa; incluyen auditoría, eventos, avisos, previews, idempotencia y cerrojo. Un ensayo inicial detectó el consumidor asincrónico pendiente, por lo que se sincronizó la prueba (no se excluyeron colecciones ni se aceptaron cambios parciales).

Las capturas y comprobaciones de foco/geometría son evidencia técnica del agente, no aceptación manual del propietario. Se mantienen T01 físico, T07 funcional y T11 físico ya confirmados. T10 humano sigue pendiente.

## Recorrido manual limitado

1. Entrar con Sistemas → Usuarios. Revisar directorio, búsqueda, estados y métricas; repetir a 320/390/768/1280 px.
2. Editar una persona; comprobar saludo, ámbitos, permisos y facultades vigentes. Cancelar y reabrir: no debe guardarse nada.
3. Ver acceso: comprobar roles y delegaciones de esa persona. Abrir otra operación tras cancelar: motivo y destinatario deben corresponder al nuevo caso. Roles personalizados conserva directorio/editor y retiro en uso bloqueado.
4. Heredar acceso: elegir origen y destino ficticios distintos. Revisar preview (origen/actual/resultado/plazos), confirmar con motivo. Verificar acceso limitado e identidad/estado del destino intactos.
5. Repetir con destino configurado: debe exigir Reemplazar acceso existente. Revisar retiradas y conservación del historial antes de confirmar.
6. Cancelar, volver y usar teclado. Regularizar acceso debe abrirse desde la ficha heredada, separado de Heredar acceso.

Los escenarios de revocación/tiempo/concurrencia se verificaron aisladamente; no deben repetirse sobre la delegación compartida del propietario.

## Límites conservados

Aceptación humana/visual y validación remota/productiva pendientes; límite 200 y 18 contratos R02/R03 abiertos. Sin push, merge, despliegue remoto, producción, correo real ni conexiones reales Moodle/SAEKO. Google institucional permanece en la configuración definitiva; DEMO/LAN, exclusivamente sintética.
