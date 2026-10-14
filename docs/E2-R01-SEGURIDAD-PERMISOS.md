# E2-R01 — Seguridad y permisos

Fecha inicial: 2026-10-12. Revisión complementaria: 2026-10-13. Entrega local sobre `894be730cd96c94b15b8077c53ed55ccc9610550`, rama `codex/e2-r01-seguridad-permisos`.

Fuente: [contrato completo v0.4](ETAPA-2-CONTRATOS-ESTABILIZACION.md). Incluye C01, C01.1, C01.2, C09 administrativo y C11 aplicable. El estado y los resultados finales se registran en [la evidencia de ejecución](E2-R01-VALIDACION.md).

## Autoridad y modelo

`permissionSchemaVersion: 2`; roles base con claves estables; `role` es únicamente una etiqueta. Los módulos tienen `NONE`, `VIEW` o `EDIT`. Solo `EDIT` permite escritura; incluye consulta. `access` es una proyección compatible, no la fuente de autoridad. Perfil inactivo, alias histórico o autorización heredada no verificada no opera datos. El perfil propio puede consultarse para informar su estado.

Administración General tiene facultades institucionales y puede existir en varias cuentas. Un auxiliar requiere delegación `ACTIVE`, referida por su perfil y vinculada a su identidad. Las delegaciones especifican módulos, capacidades y listas de programas, ciclos, docentes y campos. Lista vacía no concede ámbito y `*` es explícito. Reglas, callables y UI usan estas claves, no coincidencias con “Sistemas” en el nombre.

Los comandos administrativos pasan por `securityCommand`. Los clientes no escriben directamente usuarios, definiciones, delegaciones, asignaciones de roles, revisiones, eventos ni auditoría verificada. `securityDirectory` devuelve al auxiliar únicamente destinatarios y definiciones dentro de su techo. La consulta propia del perfil y el alta técnica de un perfil inactivo son excepciones acotadas.

## Matriz implementable

En todas las filas se exige perfil activo y autoridad vigente al confirmar, excepto la consulta/vinculación del propio perfil inactivo. AG = ADMIN_GENERAL; AUX = ADMIN_OPERATIVO con delegación activa; CA = COORDINACION_ACADEMICA.

| Operación existente | Actor y módulo | Capacidad sensible | Ámbito / campos | Servidor y prueba |
|---|---|---|---|---|
| Crear/editar/inactivar usuario y rol base | Solo AG | MANAGE_USERS | Identidad institucional; revisión observada; no alterar el propio acceso ni retirar el último AG | Transacción con cerrojo compartido; carreras entre administradores y autoescalamiento |
| Definir/retirar rol personalizado | Solo AG | MANAGE_CUSTOM_ROLE_DEFINITIONS | Sin módulos administrativos ni capacidades reservadas; definición asignada requiere sustitución | `customDefinition`; rechazo por contenido, no nombre |
| Otorgar/revocar/suspender delegación | Solo AG | MANAGE_SYSTEM_DELEGATIONS | Destinatario AUX; nueva identidad; capacidades delegables y alcance explícito | Revisión + transacción; colisión de ID, revocación concurrente |
| Asignar/retirar rol preaprobado | AG o AUX | MANAGE_CUSTOM_ROLES | No autoservicio ni destinatarios administrativos; todo contenido/ámbito bajo techo; combinaciones con ámbitos distintos se rechazan para evitar ampliación cruzada | `canAssign` + revisión perfil/rol; prueba positiva y negativas |
| Conservar/retirar/sustituir asignación revisable | Solo AG | RESOLVE_AUX_ROLE_REVIEWS | Motivo; revisión vigente; no revivir retirados; sustitución con techo y ámbito compatible | Resolución concurrente: un ganador; KEEP conserva REMOVED |
| Preview/aplicar transición heredada | Solo AG | MANAGE_USERS | Hash y revisión de perfil, permisos, delegación y correspondencia | Preview obsoleta aborta sin cambios, auditoría ni evento |
| Vincular identidad técnica | Titular Auth con correo institucional verificado | Ninguna elevación | Solo vínculo canónico; conserva estado/privilegios, alias y referencias de seguridad; no elige duplicados por privilegio | Callable transaccional y allowlist estricta de campos técnicos; inactivo y duplicado |
| Consultar módulos ordinarios | CA, ALTA_DOCENTES o CUSTOM con VIEW/EDIT; AUX según delegación | Ninguna por el nombre | CA: asignaciones globales para matrícula; CUSTOM: solo programa/ciclo concedido; AUX: solo delegación; otros catálogos según colección | Reglas + consultas filtradas; VIEW propio/ajeno y UI académica |
| Crear/editar catálogo de grupos/nomenclaturas/asignaturas | AG o AUX con EDIT | Sin facultad implícita por rol personalizado | Programa; grupos también ciclo; asignaturas sin programa requieren ámbito global | Reglas; catálogos personalizados solo VIEW |
| Administrar ciclos | AG o AUX con EDIT | MANAGE_CYCLES | Ciclo y campos delegados | EDIT sin capacidad denegado; ciclo/campo ajenos denegados; positivo autorizado |
| Editar ficha docente | EDIT docentes | Ninguna para ficha ordinaria | Propio/coordinador asignado; ALTA solo propio; AUX docente y campos delegados; allowlist de ficha | Reglas; no modificar identidad, procedencia ni validación mediante edición ordinaria |
| Validar/inactivar/asignar coordinadores docente | AG o AUX con EDIT | VALIDATE_TEACHERS | Docente y campos delegados; allowlist administrativa | Validación sin capacidad denegada; autorizada aceptada |
| Corregir identidad Moodle docente | Reservado a AG | CORRECT_TEACHER_MOODLE_IDENTITY | Flujo C15 posterior; no se habilita escritura libre de identidad | Mutación directa denegada incluso con EDIT |
| Crear/editar asignación | EDIT asignaciones | Cambios sensibles AUX requieren capacidad correspondiente | Programas; AUX ciclo/campos; CA matrícula global con allowlist; identidad cargada protegida | Positivos ordinarios y matrícula global; creación ajena denegada |
| Eliminar asignación | AG o AUX | OPERATE_EXCEPTIONAL_CHANGE | Programa/ciclo; esta capacidad no implementa recuperación ni depuración | Regla restrictiva; nuevos flujos quedan en R04 |
| Consultar/responder solicitudes | VIEW/EDIT solicitudes según acción | Sin elevación por texto de rol | Origen/destino/solicitante; actor autenticado al responder; solicitudes Sistemas propias o Sistemas institucional | Direct SDK y regresión E1; FSM/atomicidad académica siguen R03 |
| Plantillas/categorías Moodle | AG o AUX, VIEW consulta / EDIT escritura | MANAGE_MOODLE_TEMPLATES para escribir | Programa y campos; conserva validación de forma | Reglas; conciliación/importación posteriores |
| Ligas Meet | VIEW consulta; AG/AUX EDIT | Sin nuevos conectores | Ciclo autorizado; creador y fechas inmutables | Reglas; funcionalidad R05 no implementada (R08 es SAEKO) |
| Agenda operativa | Sistemas VIEW/EDIT dashboard | Sin acceso por etiqueta | Equipo o propietario privado; identidad del creador inmutable | Reglas y controles de UI/servicio |
| Bitácora y notificaciones administrativas | AG; bitácora AUX con VIEW y ámbito institucional | Sin escritura verificada desde cliente | Actor/área leídos del perfil en servidor; avisos al destinatario; solo marca de lectura cliente | Cambio + bitácora + evento en una transacción; fallo de escritura revierte todos |

## Delegaciones y concurrencia

`seguridad/control` serializa los escritores administrativos y la vinculación de identidad. Cada comando compara revisiones y vuelve a leer la autoridad dentro de la transacción. El identificador de operación y hash del cuerpo deduplican reintentos. Un identificador de delegación/asignación ocupado no se reutiliza aunque otro administrador envíe el comando.

Al revocar/suspender, los roles asignados que siguen ACTIVE conservan acceso y reciben `REQUIERE_REVISION_ADMIN_GENERAL`. Cada revisión tiene identidad determinista delegación/asignación. Los retirados no se marcan ni reviven. La nueva delegación no resuelve revisiones anteriores. Todos los AG consultan el directorio completo y reciben el aviso con referencias de revisión. La decisión conserva motivo, actor, fecha y antes/después.

Las notificaciones administrativas usan eventos persistidos junto al cambio. El consumidor crea avisos deterministas y marca el correo `SIMULADO_LOCAL`; reintentos no duplican avisos ni restablecen su lectura. No hay conexión SMTP nueva. El código no local deja entrega externa sin configurar.

## Mapeo heredado versionado

Implementación: `functions/security/policy.js`, versión `E2-R01-v0.4-1`. No hay correspondencia automática por nombre visible. AG registra una correspondencia individual con motivo, identidad aprobadora, versión y hash del perfil. Solo claves verificadas CA y ALTA_DOCENTES tienen tabla:

| Correspondencia verificada | Valores heredados `true` reconocidos |
|---|---|
| COORDINACION_ACADEMICA | dashboard/nomenclaturas/grupos/asignaturas/ligasMeet → VIEW; docentes/asignaciones/solicitudes → EDIT |
| ALTA_DOCENTES | dashboard → VIEW; docentes → EDIT |

Un nivel explícito válido prevalece. `NONE` y `access:false` sin nivel explícito conservan denegación. Un `true` sin correspondencia verificable o módulo reconocido no concede acceso. Ausentes/ambiguos quedan NONE y se listan `LEGACY_UNRESOLVED`. Los ámbitos se conservan, no se inventan. No se migra automáticamente a AG ni AUX.

La correspondencia puede dar una proyección temporal comprobable durante siete días, vinculada a la revisión del perfil. La UI, Rules y los consumidores de autorización en Functions verifican su caducidad y la revisión vigente del mapeo. La aplicación de una preview preparada antes del vencimiento se rechaza después del plazo. [Eventos, mensajes, pruebas y límites exactos](E2-R01-REVISION-COMPLEMENTARIA.md). La vista previa expone estado previo/propuesto y diferencias; aplicar comprueba nuevamente perfil, delegación y mapeo, autoridad y versión. Las denegaciones explícitas migradas permanecen fijadas al recomponer roles.

## Trazabilidad de Etapa 1

La evidencia de E1 en `894be73` y sus documentos se conserva como histórica. C01/C01.1/C01.2 v0.4 sustituyen las expectativas de autorización (casos E1 `stage:2`), manteniendo `historicalBaseline` en los reportes. D3 queda resuelta: faltante no concede, revocación explícita prevalece, catálogo reservado no se edita con rol personalizado. D2 queda definida documentalmente por C08 (vinculación directa); su implementación corresponde a R03. D1 conserva el bloqueo académico con captura cerrada; nuevas excepciones corresponden a R02/R03.

Los casos E1 de lógica y ciclos/solicitudes/estado Moodle de etapas posteriores mantienen sus expectativas y fallos visibles. El gate estricto `test:contracts` no se vuelve verde por esta entrega. No se implementan nuevos flujos académicos ni se ocultan incumplimientos para cerrar R01.

## Límites de esta entrega

- Comandos administrativos: máximo combinado de 200 documentos **antes** de ejecutar la operación. El directorio aplica un límite diferente: 200 por cada una de cinco colecciones. El exceso bloquea incluso operaciones críticas y es un **impedimento para producción**; [detalle, errores y criterio de resolución](E2-R01-REVISION-COMPLEMENTARIA.md). No se aumentó el límite ni se declara escala productiva.
- Las consultas Firestore con ámbitos mayores que sus límites fallan con explicación; no se recortan silenciosamente. La paginación general pertenece a R05.
- No se migra el respaldo privado ni se cambia `.local/data-source.json`. Las validaciones usan exclusivamente `demo-spai-tup` y fixtures ficticios.
- La activación inicial de un AG productivo requerirá verificar una identidad institucional mediante un procedimiento autorizado antes de un futuro despliegue. No se deduce un AG de perfiles históricos ni se ofrece un bootstrap público privilegiado.
- Cierres de captura, unicidad de ciclo, transacciones académicas, cambios especiales, identidad docente, recuperación, depuración, importadores y Meet conservan pendientes de R02–R08. No hay SAEKO ni servicios reales.

## Trazabilidad operativa complementaria

[Inventario CO-01–CO-12 y cobertura CO-02/CO-11](CO-INVENTARIO-R01.md). Conserva existentes y registra pendientes sin implementar las entregas futuras. Ligas Meet corresponde a R05; R08 corresponde a SAEKO.

## Ajuste de aceptación del 14 de octubre

[Seguimiento del reporte manual](HALLAZGOS-PRUEBA-MANUAL-E2-R01.md): presentación institucional de Usuarios/Roles, identidad CUSTOM explícita en Authentication Emulator, aislamiento de ensayos respecto a la demo LAN, y evidencia T09/T10/T11. Rules y la política de autorización no se modifican en este ajuste. [Uso de la demo LAN](DEMO-LAN.md). El acceso institucional Google permanece separado; `signInWithLocalAccount` exige también conexión efectiva al emulador. La aceptación del propietario y el recorrido T01 desde una segunda computadora física siguen pendientes.
