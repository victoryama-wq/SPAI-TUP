# E2-R01 — Revisión complementaria local

Fecha: 2026-10-13. Base revisada: `7b22264d06c1d2925bf7c3c97058ad06112d9b39`, rama `codex/e2-r01-seguridad-permisos`. Contrato rector v0.4 sin modificaciones. [Inventario operativo y tabla CO-02/CO-11](CO-INVENTARIO-R01.md). Resultados finales: [ficha](E2-R01-VALIDACION.md) y [JSON](E2-R01-RESULTADOS.json).

## Límite administrativo: comportamiento exacto

`functions/security/service.js`, `COLLECTIONS`, `execute` y `list` son la fuente. No se cambió el límite ni se añadió truncamiento.

| Colección | Documentos que cuentan en `securityCommand` |
|---|---|
| `usuarios` | Todos: activos, inactivos, pendientes y alias históricos |
| `roles_personalizados` | Todas las definiciones, incluidas retiradas/heredadas |
| `delegaciones` | Activas, suspendidas y revocadas |
| `asignaciones_roles` | Activas y retiradas |
| `revisiones_roles` | Pendientes y resueltas |
| `mapeos_permisos` | Todas las correspondencias |

En **cada intento de transacción**, después de leer `seguridad/control`, se consultan las seis colecciones con `limit(201)` cada una. Si la suma observada supera 200 se aborta **antes** de resolver actor, validar la acción, consultar el registro de idempotencia o programar escrituras. El 201 es un centinela para detectar exceso: nunca se devuelve una muestra como éxito.

No cuentan `seguridad/control`, `previews_permisos`, `operaciones_seguridad`, `bitacora`, `eventos_seguridad`, `avisos_seguridad` ni colecciones académicas. Su crecimiento también requiere evaluación futura; estos ensayos no acreditan escala.

Dependen de esta lectura **todas** las acciones del callable: `saveUser`, `deleteUser` (inactivación), `saveRole`, `deleteRole`, `grantDelegation`, `revokeDelegation`, `suspendDelegation`, `assignRole`, `removeRole`, `resolveReview`, `approveMapping`, `previewMigration`, `applyMigration`. También un reintento con `operationId` ya confirmado se rechaza por exceso antes de recuperar su resultado.

| Estado observado al comenzar | Resultado |
|---|---|
| 199 o 200 combinados | No bloquea por tamaño; siguen las comprobaciones de autoridad, revisión y contenido |
| Operación empieza con 200 y crea una revisión | Puede confirmar 201 o más: **no hay validación del tamaño posterior** |
| 201 o más combinados | Rechaza incluso revocar una delegación activa, inactivar un usuario o resolver una revisión. No modifica permisos ni registros relacionados |

Error del callable: `resource-exhausted` (SDK `functions/resource-exhausted`), texto **«Requiere migración administrativa por lotes: límite local de 200 documentos de seguridad.»** La consola muestra el mensaje recibido, sin aviso de éxito.

El **directorio tiene otro límite**, que la descripción anterior no diferenciaba: `securityDirectory` autentica y resuelve `MANAGE_CUSTOM_ROLES`, luego lee las **primeras cinco** colecciones de la tabla, con centinela 201 y máximo **200 por colección**, sin sumar y sin leer todos los mapeos. Para un perfil heredado puede leer su mapeo individual al resolver autoridad. Un AG puede consultar el directorio con más de 200 combinados si ninguna de esas cinco colecciones supera 200; si cualquiera supera 200, recibe `functions/resource-exhausted`, **«Directorio excede el límite local.»** El auxiliar recibe el subconjunto autorizado solo después de esta comprobación, por lo que también puede bloquearse por documentos ajenos a su ámbito. No hay paginación ni recorte para simular éxito.

La vinculación técnica `syncUserProfileByEmail` no usa este límite; su límite independiente es de 100 referencias al trasladar una identidad. Las lecturas académicas sujetas a Rules tampoco dependen del límite administrativo. La imposibilidad de revocar puede dejar accesos existentes vigentes: es un problema de disponibilidad del control de seguridad, aunque el comando fallido sea atómico.

**Impedimento obligatorio para producción:** no desplegar este diseño con revocación/inactivación/revisión dependientes de un barrido global acotado. Antes de autorizar producción debe existir una implementación revisada con lecturas dirigidas o procesamiento acotado seguro que permita ejecutar esas operaciones con un volumen superior al máximo institucional previsto, incluyendo historial y concurrencia. Criterio verificable: ensayos sobre ese volumen, revocación inmediata en Rules/callables, cero efectos parciales, directorio paginado completo, idempotencia y revisiones conservadas; sin aumentar arbitrariamente 200 ni borrar historia. Esa ampliación general de escala es trabajo posterior; esta revisión documenta y prueba el impedimento, no declara capacidad productiva.

Evidencia: `tools/e2-r01/review.mjs`, caso **Límite 199/200/201**. Comprueba éxito a 199, inactivación a 200, revocación a 200 que crea la revisión 201, bloqueo de otra revocación activa/inactivación/resolución, directorio a 200 por colección y rechazo a 201. Compara documentos completos de las seis colecciones, cerrojo, previews, bitácora, eventos, avisos e idempotencia antes/después del rechazo. Los eventos previamente confirmados se drenan antes de comparar para no confundir su entrega asíncrona con efectos del rechazo.

## Transición heredada de siete días

El evento de inicio es el comando **`approveMapping` confirmado por un ADMIN_GENERAL** sobre un perfil sin esquema 2. En el intento de transacción que confirma, el servidor obtiene un único `serverMillis`; guarda `legacyAuthorization.issuedAtMillis = serverMillis`, `expiresAtMillis = serverMillis + 604800000`, `updatedAt` ISO de ese mismo instante, revisión de perfil y revisión de mapeo. El evento y bitácora atómicos conservan actor, motivo y antes/después. El cliente no envía el reloj. Un intento abortado no inicia ningún periodo persistido; aprobar otra correspondencia es otra acción explícita y auditada, nunca renovación automática.

La duración sigue siendo siete días. Desde `now >= expiresAtMillis`, la proyección temporal deja de autorizar. No se elimina el perfil, el mapeo ni sus permisos explícitos guardados; el perfil heredado pendiente deja de operar hasta la revisión administrativa. Un perfil ya migrado al esquema 2 conserva sus permisos efectivos y no depende del plazo heredado.

La UI muestra **«La autorización temporal de siete días venció. Solicita a Administración General una nueva vista previa y la migración de tus permisos. Tus permisos explícitos se conservan.»** Retira la navegación operativa. Al cambiar/revocar el mapeo muestra que la autorización temporal requiere revisión. ADMIN_GENERAL puede consultar al titular, revisar una nueva preview y confirmar la migración con motivo o corregir/inactivar expresamente el perfil.

Una llamada directa a Firestore recibe `permission-denied`; Rules no emite un texto de negocio personalizado. Un perfil temporal vencido que intente `securityCommand` recibe `functions/permission-denied` con «Perfil no autorizado.»; `securityDirectory`, «Permiso insuficiente.». Los perfiles temporales reconocidos son exclusivamente CA/Alta: tampoco tienen esas facultades administrativas durante la vigencia. No se promete un error específico de caducidad donde el protocolo solo comunica denegación.

Una preview creada antes de vencer ya no puede confirmarse después: responde `failed-precondition` / `functions/failed-precondition`, **`LEGACY_AUTHORIZATION_EXPIRED: solicita una nueva vista previa a Administración General.`** No se modifica el perfil, la preview, la bitácora, eventos ni idempotencia. Una preview nueva posterior al vencimiento constituye una nueva revisión explícita del AG; no renueva por sí sola la autorización temporal. Solo la aplicación administrativa posterior puede migrar el perfil. Si cambió cualquier hash/revisión de perfil, permisos, delegación o mapeo, se conserva el rechazo **`MIGRATION_PREVIEW_OBSOLETE`**.

Los niveles explícitos válidos prevalecen sobre flags heredados. `NONE`, y `access:false` sin nivel explícito, niegan. `VIEW`/`EDIT` explícitos no se sustituyen por `true`/`false` heredados. Ausentes siguen `LEGACY_UNRESOLVED`; recomponer roles respeta `migrationDenials`. El vencimiento no escribe ni recompone permisos; no resucita asignaciones ni revocaciones.

Ahora se exige también mapeo vigente: `ACTIVE`, versión, aprobador, rol, revisión del mapeo y revisión de perfil coincidentes con la proyección. Inactivar o cambiar la revisión de perfil, convertirlo en alias, retirar/revisar el mapeo o vencer invalida la autorización temporal. La UI observa el mapeo propio y el perfil; las Rules verifican el documento vigente en servidor. Los clientes no pueden escribir ninguno de estos campos.

| Superficie de servidor | Comprobación de caducidad y evidencia |
|---|---|
| Todas las Rules operativas mediante `user()` | `expiresAtMillis > request.time.toMillis()` y mapeo/revisión vigente. SDK: lectura/escritura válida, negativa vencida, `NONE`, cambio/revocación y batch preparado antes pero confirmado con fecha vencida |
| `securityCommand` | `P.effective` con reloj de servidor en cada intento; CA/Alta temporales no obtienen capacidades administrativas ni siquiera vigentes. `applyMigration` añade la comprobación de preview que atraviesa vencimiento |
| `securityDirectory` | Misma resolución vigente antes de exigir capacidad; perfiles temporales CA/Alta rechazados vigentes y vencidos |
| `syncUserProfileByEmail` | **No consume autorización temporal**; usa identidad Auth verificada y vínculo canónico. Caso vencido demuestra que vincular no activa, renueva ni cambia permisos |
| Triggers de asignación, avisos y correo | No son entradas de autorización del cliente: procesan eventos ya persistidos; no convierten permisos heredados en facultades. Notificación administrativa no migra perfiles |

Pruebas deterministas: política con tiempo inyectado un milisegundo antes, exactamente al vencer y después; servicio transaccional real sobre emulador con reloj inyectado solo en la fábrica de pruebas (no vía payload); Rules con fixtures de vencimiento inequívoco y batch SDK preparado antes del cambio. No se espera siete días ni se altera el reloj del emulador. Chromium comprueba mensaje y retirada de navegación ante perfil vencido y mapeo revocado. Esta evidencia no sustituye validación remota ni aceptación del propietario.

## Límites y siguiente entrega

R01 se limita a controles de acceso y su interfaz. Los 18 incumplimientos funcionales E1 de R02/R03 deben permanecer visibles en el gate estricto; el detalle y el conteo se actualizan a partir de la ejecución, no se reclasifican como éxitos. R02 parte de C02 y autorización de ciclo C03, incluida D1: captura cerrada bloquea correcciones académicas hasta reapertura. No se implementa R02 aquí.

Antes de producción: resolver el impedimento administrativo, validar escala/consultas, revisar migración institucional e identidad inicial de AG mediante autorización separada, contar con CI y ambiente de pruebas remotos, entrega externa de avisos configurada y verificada, respaldo/reversión y aceptación manual del propietario. No hubo push, merge, deploy, acceso a producción, Moodle ni SAEKO.
