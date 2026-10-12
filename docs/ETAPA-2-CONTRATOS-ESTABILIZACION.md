# Etapa 2 — Estabilización, recuperación y operación controlada

Versión: **v0.4**

Fecha: 2026-10-09.
Proyecto: **SPAI TUP — Sistema de Planeación Académica Institucional**.

Esta etapa complementa **ETAPA-1-CONTRATOS.md**. Define el comportamiento esperado para estabilizar la operación institucional sin alterar por accidente los cursos ya creados en Moodle ni ampliar permisos por el solo hecho de ocultar o mostrar controles en pantalla. Esta versión sustituye los borradores previos de Etapa 2 cuando exista contradicción; no sustituye Etapa 1 salvo donde un contrato `E2-Cxx` lo indique de forma expresa.

> **Trazabilidad documental:** antes de que una entrega deje el estado `BORRADOR`, la fuente vigente de **ETAPA-1-CONTRATOS.md** debe estar localizada y versionada junto con este contrato o referenciada mediante una ubicación institucional verificable. Así se puede comprobar qué disposición `E1-xxx` conserva vigencia y cuál queda sustituida.

Cada contrato usa un identificador único `E2-Cxx`; las referencias sin prefijo dentro de versiones anteriores de este mismo documento se consideran reemplazadas por su equivalente `E2-Cxx`. La palabra **Sistemas** se refiere exclusivamente a los actores y capacidades de la matriz de `E2-C01`; no es un permiso implícito. Las decisiones de este documento describen el resultado funcional esperado; su implementación debe comprobarse con reglas Firestore, Cloud Functions, pruebas y despliegue controlado antes de darse por terminada.

## Decisiones y límites del contrato

| ID | Definición | Estado y efecto |
|---|---|---|
| E2-D04 | Una eliminación operativa no destruye inmediatamente una asignación. Se mueve a una recuperación privada de Sistemas. | Confirmada. Coordinación Académica no ve Papelera, Restaurar ni recibe aviso de recuperabilidad. |
| E2-D05 | Firestore operativo conserva como objetivo normal un ciclo actual y el último ciclo cerrado para consulta. Los ciclos anteriores se respaldan fuera de la base operativa antes de depurarse. | Confirmada. Si el respaldo de `E2-C05` falla o no puede verificarse, los datos se conservan temporalmente aunque se exceda ese objetivo; no se borra información sin recuperación comprobada. |
| E2-D06 | Las plantillas Moodle son un catálogo operativo vigente, no un histórico de ciclos. Sistemas puede reemplazarlas masivamente. | Confirmada. Reemplazar el catálogo no modifica cursos ya existentes en Moodle. |
| E2-D07 | La autoridad se define por capacidades y ámbito en servidor, no por coincidencias de texto en el nombre de un rol ni por controles ocultos en la interfaz. | Confirmada. La delegación de auxiliares se concede y revoca desde Sistemas. |
| E2-D08 | Una corrección posterior a una carga Moodle conserva el estado principal CARGADO_MOODLE; su seguimiento se maneja con una marca secundaria de conciliación. | Confirmada. El ID Moodle y la materia permanecen protegidos. |
| E2-D09 | Las notificaciones internas y por correo deben identificar al actor real y su área real. | Confirmada. No deben presentar a una coordinación académica como autora de una acción ejecutada por Sistemas. |
| E2-D10 | La integración futura con SAEKO se implementará como integración de servidor, con contratos, trazabilidad e idempotencia propios. | Propuesta obligatoria antes de conectar producción. |
| E2-D11 | Los accesos personalizados se configuran mediante capacidades explícitas de **Consultar** y **Editar** por módulo; las acciones sensibles se delegan por separado. | Confirmada. Editar implica Consultar, pero ninguna acción sensible se concede por inferencia. |
| E2-D12 | Puede haber varios `ADMIN_GENERAL` activos. Cualquiera puede controlar las delegaciones de los Auxiliares de Sistemas. | Confirmada. Revocar surte efecto inmediato; volver a otorgar crea una delegación nueva y auditada. Los roles personalizados ya asignados por el auxiliar se mantienen activos, pero quedan marcados como `REQUIERE_REVISION_ADMIN_GENERAL`. |
| E2-D13 | Los perfiles heredados migran a permisos explícitos sin interpretar un campo ausente como acceso concedido. | Confirmada. La transición conserva solo las facultades verificadas y no amplía privilegios. |

## E2-C01 — Identidad, roles, capacidades y alcance

Una sesión de Google/Firebase autenticada no concede por sí misma permisos operativos. El servidor debe resolver el perfil activo, la capacidad concreta, el ámbito de programas y los campos permitidos para cada operación.

| Perfil | Facultades efectivas | Límites obligatorios |
|---|---|---|
| Administración de Sistemas — ADMIN_GENERAL | Puede haber uno o más perfiles activos, incluidos Coordinación de Sistemas y la jefatura institucional que sea designada. Administra usuarios, delegaciones, ciclos, catálogos, Moodle, recuperaciones, bitácora y operaciones de emergencia. | No puede alterar el ID Moodle ni la materia de una asignación ya cargada mediante la operación ordinaria; el servidor impide dejar SPAI sin un `ADMIN_GENERAL` activo. |
| Auxiliar de Sistemas — ADMIN_OPERATIVO delegado | Opera únicamente los módulos, capacidades y ámbitos de una delegación activa otorgada por cualquier `ADMIN_GENERAL`. Puede participar en correcciones Moodle y recuperación si la delegación lo permite. | No puede otorgar, editar, suspender, revocar ni reotorgar delegaciones propias o ajenas; tampoco puede cambiar perfiles `ADMIN_GENERAL`. |
| Coordinación Académica | Consulta catálogos permitidos, registra y edita docentes conforme `E2-C16`, y captura/edita asignaciones de sus programas en el periodo autorizado. | No administra usuarios, ciclos, plantillas Moodle, bitácora ni recuperación. No cambia materia, ID Moodle o estado operativo por sí misma. |
| Alta de Docentes | Consulta el catálogo, registra docentes nuevos y edita la ficha de los docentes cuya alta le pertenece, conforme `E2-C16`. | No edita docentes ajenos; no valida, inactiva ni reactiva docentes; no modifica ámbitos, procedencia ni auditoría. El usuario Moodle y el correo institucional solo los corrige `ADMIN_GENERAL` conforme `E2-C15`. |
| Acceso personalizado | Consulta y, únicamente cuando Sistemas lo asigne expresamente, edición por módulo dentro del ámbito definido. Puede solicitar una acción sensible concreta si esa facultad también fue otorgada. | No administra usuarios, roles, delegaciones, ciclos ni permisos; no amplía su propio alcance, ni ejecuta directamente acciones sensibles o administrativas. |

### Matriz única de autoridad operativa

| Operación | Capacidad requerida | Actor permitido | Ámbito efectivo |
|---|---|---|---|
| Crear, suspender, revocar o reotorgar delegaciones | `MANAGE_SYSTEM_DELEGATIONS` | Solo `ADMIN_GENERAL` | Global. Nunca delegable a Auxiliares ni accesos personalizados. |
| Administrar usuarios institucionales y roles base | `MANAGE_USERS` | Solo `ADMIN_GENERAL` | Global. Incluye alta, baja, activación y cambio de roles base, sin poder dejar cero `ADMIN_GENERAL` activos. |
| Crear o modificar definiciones de roles personalizados | `MANAGE_CUSTOM_ROLE_DEFINITIONS` | Solo `ADMIN_GENERAL` | Global. |
| Asignar o retirar un rol personalizado preaprobado | `MANAGE_CUSTOM_ROLES` | `ADMIN_GENERAL`, o Auxiliar con delegación activa que incluya esa capacidad | El Auxiliar solo opera usuarios no administrativos y el ámbito expresamente incluido en su delegación; no puede autoasignarse ni asignar a Sistemas. |
| Resolver una revisión `REQUIERE_REVISION_ADMIN_GENERAL` | `RESOLVE_AUX_ROLE_REVIEWS` | Solo `ADMIN_GENERAL` | Global. Puede conservar, ajustar o retirar la asignación de rol, con motivo y bitácora; no reactiva ni modifica la delegación revocada. |
| Validar o devolver el estado de un docente | `VALIDATE_TEACHERS` | `ADMIN_GENERAL`, o Auxiliar con delegación explícita | Catálogo global o subconjunto de docentes expresamente delimitado por la delegación. |
| Corregir usuario Moodle o correo institucional de docente | `CORRECT_TEACHER_MOODLE_IDENTITY` | Solo `ADMIN_GENERAL` | Global y únicamente mediante `E2-C15`. |
| Administrar ciclo, cerrar/reabrir captura o habilitar Especiales | `MANAGE_CYCLES` | `ADMIN_GENERAL`, o Auxiliar con delegación explícita | Solo el ciclo o ciclos incluidos en la delegación. |
| Confirmar conciliación Moodle o administrar plantillas | `CONFIRM_MOODLE_UPDATE` / `MANAGE_MOODLE_TEMPLATES` | `ADMIN_GENERAL`, o Auxiliar con la capacidad explícita correspondiente | Solo asignaciones, lotes o ciclos incluidos en la delegación. |
| Consultar recuperación, restaurar registros o depurar ciclos | `RECOVER_DELETED_RECORDS` / `PURGE_CYCLE` | `ADMIN_GENERAL`, o Auxiliar con la capacidad explícita correspondiente | Solo los registros, ciclos o lotes expresamente delegados. |
| Corrección operativa extraordinaria | `OPERATE_EXCEPTIONAL_CHANGE` | `ADMIN_GENERAL`, o Auxiliar con delegación explícita | Campos y ciclo indicados por la delegación; nunca incluye por inferencia identidad Moodle de docente ni materia/ID Moodle de una asignación cargada. |

Las operaciones administrativas y sensibles se autorizan únicamente mediante esta matriz. Las operaciones ordinarias de módulos —consultar, registrar o editar información académica permitida— requieren conjuntamente el nivel `VIEW` o `EDIT` de `E2-C01.1`, el ámbito asignado y la regla expresa de su contrato específico. Toda operación que no tenga autorización expresa en una de esas dos fuentes, o cuyo actor, capacidad, ámbito, ciclo o campos no coincidan, se rechaza. Cada uso de la palabra **Sistemas** en los contratos siguientes debe resolverse contra esta tabla.

### Garantías

- role, status, access, assignedPrograms, delegaciones y vínculos de identidad no son campos editables por autoservicio.
- Un acceso personalizado con nivel `VIEW` no se convierte en `EDIT` porque su documento indique acceso a un módulo; las reglas de servidor evalúan el nivel efectivo de forma explícita.
- Las reglas no usan expresiones como “contiene Sistemas” o “contiene Acad” como fuente final de autoridad.
- El perfil inactivo puede completar una vinculación técnica de identidad, pero no puede leer ni operar información institucional.
- Solo una operación de servidor autorizada por un `ADMIN_GENERAL` activo puede modificar delegaciones de Auxiliares de Sistemas.
- Puede haber varios `ADMIN_GENERAL` activos. El servidor rechaza dentro de la misma transacción cualquier cambio de rol, inactivación o eliminación que deje cero administradores generales activos.
- Todo otorgamiento, suspensión, revocación o reotorgamiento de una delegación queda en bitácora con actor, fecha, motivo, capacidades, ámbito, delegación anterior/nueva y resultado. Reotorgar nunca reactiva una delegación anterior: crea una delegación nueva con identificador propio.
- Una revocación invalida la delegación en el momento de confirmar cada operación de servidor: una sesión abierta o una operación preparada antes de la revocación no conserva autorización. El servidor vuelve a resolver capacidades y ámbito justo antes de escribir.
- En la siguiente lectura o escritura protegida, una sesión que dependa de una delegación revocada recibe `PERMISO_REVOCADO`. Los datos que el cliente conserve localmente no constituyen autorización ni pueden exportarse u operarse después de esa comprobación.
- Revocar una delegación no elimina ni suspende automáticamente los roles personalizados que el Auxiliar hubiera asignado mientras estaba autorizado. Cada una de esas asignaciones conserva `assignedByDelegationId`, permanece activa y recibe el estado `REQUIERE_REVISION_ADMIN_GENERAL`; la tarea se muestra a todos los `ADMIN_GENERAL` hasta que uno decida conservar, retirar o sustituir el rol y deje motivo en bitácora. Una delegación nueva no borra ni resuelve las revisiones ligadas a la delegación revocada.

### E2-C01.1 — Configuración de accesos personalizados

El editor de un acceso personalizado presenta una sola lista de módulos. Cada fila muestra dos controles visibles: **Consultar** y **Editar**; no utiliza un menú desplegable por módulo.

| Regla de configuración | Efecto obligatorio |
|---|---|
| Consultar | Permite ver únicamente la información del módulo y del ámbito otorgados. |
| Editar | Permite las operaciones delegables del módulo y ámbito otorgados. Al activarlo, **Consultar** se activa automáticamente. |
| Desactivar Consultar | También desactiva Editar para el mismo módulo. |
| Desactivar Editar | Conserva Consultar si sigue marcada. |
| Marcar todos para consulta / Quitar todos | Son acciones rápidas de interfaz; no eluden las validaciones de servidor al guardar. |
| Acción sensible | Se muestra fuera de la lista de módulos, con nombre y efecto explícitos. No equivale a Editar y requiere una capacidad independiente. |

Cada módulo se persiste en servidor con un nivel efectivo `NONE`, `VIEW` o `EDIT`. La interfaz representa ese nivel mediante los dos controles, pero el servidor define qué módulos y niveles son delegables. Un permiso de edición nunca evita las reglas de ámbito, ciclo, campos protegidos ni las validaciones del módulo.

La acción **Solicitar corrección de ID Moodle docente** se configura separadamente. Solo permite crear una solicitud conforme `E2-C15`; no permite editar directamente el ID Moodle, el correo derivado ni las referencias globales del docente.

Los módulos no concedidos pueden ocultarse del menú, pero las reglas Firestore y Cloud Functions deben rechazar igualmente cualquier lectura o escritura no autorizada.

### Acciones sensibles separadas

| Capacidad sensible | Regla |
|---|---|
| Administrar usuarios, definiciones de rol y delegaciones de auxiliares | Exclusiva de ADMIN_GENERAL; nunca se concede desde un acceso personalizado ni permite a un auxiliar administrar delegaciones. |
| Asignar o retirar un rol personalizado preaprobado | Un Auxiliar con `MANAGE_CUSTOM_ROLES` puede hacerlo únicamente a usuarios no administrativos, dentro de su ámbito delegado y sin modificar la definición, capacidades o ámbitos del rol. |
| Cambiar estado de ciclo, habilitar especiales o cerrar/reabrir captura | Exclusiva de Sistemas o de un Auxiliar con delegación explícita. |
| Administrar plantillas Moodle, confirmar CARGADO_MOODLE, recuperación y depuración | Exclusiva de Sistemas o de un Auxiliar delegado. |
| Eliminar asignaciones | Solo conforme `E2-C03` y recuperación privada `E2-C04`; no se obtiene por activar Editar. |
| Corregir ID Moodle de docente | Solo se puede solicitar si Sistemas lo habilita; confirmar y aplicar corresponde exclusivamente a `ADMIN_GENERAL` conforme `E2-C15`. |

Solo ADMIN_GENERAL puede crear, editar o eliminar definiciones de acceso personalizado. Un Auxiliar con `MANAGE_CUSTOM_ROLES` únicamente puede asignar o retirar roles personalizados ya preaprobados; no puede asignarse uno a sí mismo, asignarlo a otro auxiliar o administrador, ni conceder un alcance, capacidad o acción sensible que no esté incluida en la delegación recibida. Cada asignación realizada por un Auxiliar conserva el identificador de la delegación que la autorizó, para aplicar la revisión definida en `E2-C01` cuando esta sea revocada. Todo cambio de rol, ámbito o capacidad sensible deja bitácora con valores anteriores/nuevos y entra en vigor de inmediato.

### E2-C01.2 — Transición de permisos heredados

Los perfiles existentes se migran a capacidades explícitas sin interrumpir facultades legítimas ni ampliar privilegios por defecto.

| Estado del permiso | Tratamiento durante la transición |
|---|---|
| `NONE` explícito | Niega el acceso; prevalece sobre cualquier valor heredado. |
| `VIEW` o `EDIT` explícito | Se aplica conforme a `E2-C01.1` y a su ámbito guardado. |
| Campo ausente o incompleto | Se marca como `LEGACY_UNRESOLVED`; no equivale automáticamente a consulta ni edición. |
| Perfil heredado reconocido | El servidor resuelve temporalmente sus facultades desde un mapeo versionado de rol y ámbito aprobado antes de publicar la migración. |
| Perfil sin mapeo verificable | No recibe acceso operativo adicional hasta que un `ADMIN_GENERAL` lo revise y lo migre explícitamente. |

La migración genera una vista previa con usuario, rol anterior, ámbito anterior, capacidades propuestas y diferencias. Al confirmarse, guarda `permissionSchemaVersion`, permisos efectivos, fecha, actor y resultado en bitácora. El servidor nunca infiere permisos por texto del nombre del rol ni conserva indefinidamente la compatibilidad heredada.

La vista previa conserva `previewId`, `profileRevision`, `delegationRevision` y fecha de generación, además de la versión de cada permiso explícito observada. Antes de aplicar cada fila, el servidor vuelve a comprobar esas versiones y cualquier suspensión o revocación posterior. Si hubo un cambio, responde `MIGRATION_PREVIEW_OBSOLETE`, no escribe nada y exige una vista previa nueva. En particular, una migración nunca puede restaurar una capacidad revocada ni reemplazar un `NONE` explícito.

## E2-C02 — Ciclo operativo, captura especial y depuración

| Origen | Acción y destino | Actor y condiciones |
|---|---|---|
| Sin ciclo actual | Crear → Preparacion | Sistemas autorizado; código único y fechas coherentes. |
| Preparacion | Iniciar → Captura | Sistemas autorizado; no puede coexistir otro ciclo actual. |
| Captura | Cerrar captura → Captura cerrada | Sistemas autorizado; bloquea la captura académica ordinaria. |
| Captura cerrada | Habilitar especiales | Para Coordinación Académica, habilita únicamente el apartado Especiales y la creación, edición, eliminación y gestión de matrículas de sus asignaciones ESPECIAL. Las demás pestañas y asignaciones permanecen solo de consulta; no reabre la captura académica ordinaria ni habilita asignaciones ordinarias. |
| Captura cerrada | Reabrir → Captura | Sistemas autorizado; restaura captura general y registra motivo. |
| Captura cerrada | Cierre final → Cerrado | Sistemas autorizado; el ciclo queda como último histórico consultable. |
| Cerrado | Marca de especiales heredada o activa | No habilita ninguna captura académica; el servidor ignora la marca para Coordinación Académica. |
| Cerrado | Corrección extraordinaria | Solo Sistemas o auxiliar delegado; debe registrar motivo, campos modificados y conciliación Moodle cuando aplique. |

### Selección y retención

- Solo puede haber un ciclo actual: Preparacion, Captura o Captura cerrada.
- Firestore operativo conserva como objetivo normal el ciclo actual y el último ciclo con estado Cerrado. Si `E2-C05` bloquea una depuración por respaldo no verificado, puede conservarse temporalmente un ciclo adicional hasta resolver la incidencia.
- Si no existe ciclo actual, se conserva solamente el último histórico hasta crear el siguiente.
- Más de un candidato actual es una inconsistencia: SPAI debe informarla y no elegir uno por orden de llegada.
- La Coordinación Académica no puede modificar asignaciones ordinarias fuera de Captura. Con especiales habilitados solo puede operar asignaciones marcadas como ESPECIAL; la marca nunca habilita ciclos Cerrado.
- El apartado Especiales solo admite grupos clasificados como Especiales. Debe excluir de su selector los grupos de Escolarizado y Ejecutivo; por tanto, no puede crear ni operar desde ese apartado una asignación ordinaria de dichas modalidades.
- Durante Captura cerrada con especiales habilitados, la interfaz de Coordinación Académica muestra como editable únicamente el apartado Especiales. El servidor debe rechazar una escritura dirigida a Escolarizado, Ejecutivo u otra asignación fuera de dicho apartado, aunque alguien intente enviarla desde una URL, cliente antiguo o solicitud manipulada.

## E2-C03 — Asignaciones, alcance académico y estados Moodle

| Operación | Coordinación Académica | Sistemas / auxiliar delegado |
|---|---|---|
| Crear asignación ordinaria | Solo programa propio y ciclo en Captura. | Permitida con trazabilidad. |
| Crear asignación especial | Solo si el ciclo está en Captura o tiene especiales habilitados, usando un grupo admitido por el apartado Especiales. El selector excluye Escolarizado y Ejecutivo. | Permitida según operación institucional. |
| Editar o eliminar asignación especial | Solo si pertenece a su ámbito, está marcada como ESPECIAL y el ciclo está en Captura o, si está en Captura cerrada, tiene especiales habilitados de forma activa. La marca ESPECIAL por sí sola no autoriza la operación. | Permitida con recuperación privada y trazabilidad. |
| Editar docente, grupo base, programas o grupos compartidos en asignación propia | Solo asignación propia ordinaria durante Captura; durante Captura cerrada con especiales habilitados, solo si la asignación está marcada como ESPECIAL. | Permitida con bitácora. |
| Vincular o retirar el grupo propio de una asignación ajena para clase compartida | Permitida como excepción directa de `E2-C08` durante Captura; en Captura cerrada con especiales habilitados, solo si la asignación está marcada como ESPECIAL y el grupo está admitido por dicho apartado. Únicamente opera el grupo propio, activo y del mismo ciclo. | Permitida con trazabilidad y validación de compatibilidad. |
| Editar matrículas adicionales | En Captura, permitida en cualquier asignación activa del ciclo, incluso fuera de su programa. En Captura cerrada, solo en una asignación ESPECIAL admitida por el apartado Especiales. La excepción no otorga ningún otro campo de la asignación ni habilita asignaciones ordinarias. | Permitida. |
| Reclasificar una asignación ordinaria como ESPECIAL | No permitida para Coordinación Académica ni por un acceso personalizado. | Solo Sistemas, mediante operación excepcional con motivo y bitácora, puede evaluar una reclasificación si el grupo corresponde realmente al apartado Especiales y la facultad institucional lo autoriza. Nunca se usa para eludir un cierre de captura. |
| Cambiar materia o ID Moodle | No permitido. | No permitido mediante la edición ordinaria de una asignación cargada; requiere proceso excepcional documentado. |
| Cambiar estado a EN_REVISION o CARGADO_MOODLE | No permitido. | Solo desde el flujo Moodle autorizado. |
| Eliminar asignación | Solo si pertenece a su ámbito y la política de captura lo permite. | Permitida con recuperación privada y trazabilidad. |

Un acceso personalizado con `EDIT` en Docentes o Asignaciones respeta el ámbito concedido, el estado del ciclo y todos los campos protegidos de esta tabla. No adquiere facultades de Sistemas ni puede modificar materia, ID Moodle o estados Moodle por activar Editar.

Las matrículas adicionales se normalizan y deduplican en servidor. En **Captura** pueden registrarse en cualquier asignación activa del ciclo bajo la excepción global de matrículas; en **Captura cerrada** solo pueden modificarse dentro de una asignación ESPECIAL y de un grupo admitido por el apartado Especiales, sin convertir ni operar una asignación ordinaria; en **Cerrado** Coordinación Académica no puede agregarlas, modificarlas ni retirarlas. Cuando afecten una asignación `CARGADO_MOODLE`, la escritura, bitácora y evento de notificación se confirman juntos y se activa `PENDIENTE_ACTUALIZACION_MOODLE`.

### Estados principales

~~~
EN_CAPTURA → EN_REVISION → CARGADO_MOODLE
~~~

- Una modificación no devuelve automáticamente una asignación de CARGADO_MOODLE a EN_CAPTURA.
- Si una asignación cargada cambia docente, grupo base, grupos/programas compartidos o matrículas, conserva CARGADO_MOODLE y recibe la marca PENDIENTE_ACTUALIZACION_MOODLE.
- La interfaz muestra **En actualización Moodle** mientras exista esa marca.
- Cuando un actor con `CONFIRM_MOODLE_UPDATE` confirma el ajuste en Moodle, la marca cambia a ACTUALIZACION_MOODLE_REALIZADA y la interfaz muestra **Actualización Moodle realizada**.
- Un cambio posterior relevante vuelve a marcar la asignación como pendiente de actualización.
- Cada cambio que afecte la conciliación Moodle incrementa en servidor `versionConciliacionMoodle`. Incluye docente, grupo base, grupos o programas compartidos, matrículas adicionales y una migración de identidad docente que afecte la asignación.
- La confirmación de actualización Moodle debe recibir la versión revisada y solo confirma si coincide con `versionConciliacionMoodle` vigente y la asignación continúa pendiente. Si no coincide, el servidor rechaza la confirmación, informa conflicto y conserva o reactiva `PENDIENTE_ACTUALIZACION_MOODLE`.
- Una confirmación válida registra versión conciliada, fecha, actor y observación. Un cambio posterior genera una versión nueva; no puede quedar conciliado por una revisión realizada sobre una versión anterior.

### Contenido Moodle

SPAI no marca una asignación como cargada por el solo hecho de exportar un CSV. El cambio a CARGADO_MOODLE requiere confirmación expresa de un actor con `CONFIRM_MOODLE_UPDATE`. Una auditoría Moodle debe poder comparar, como mínimo, materia, curso, grupo, docentes, cohortes/matrículas, plantilla usada y contenido acorde al plan.

## E2-C04 — Recuperación privada de registros eliminados

La recuperación evita pérdida accidental sin convertir la restauración en una facultad de Coordinación Académica.

| Origen / acción | Resultado esperado | Restricciones |
|---|---|---|
| Coordinación elimina una asignación permitida | La asignación deja de aparecer en vistas, reportes y CSV Moodle, pero se conserva como eliminada. | La coordinación solo recibe confirmación neutral de eliminación. No ve Papelera ni Restaurar. |
| Lectura directa de un registro eliminado | No revela el documento ni sus datos de recuperación a Coordinación Académica ni a un acceso personalizado. | Firestore, APIs, reportes, cachés y búsquedas aplican la misma restricción; ocultar Papelera no la sustituye. |
| Sistemas elimina una asignación | Mismo resultado; se registra actor, motivo y valores previos. | La operación no borra físicamente de inmediato. |
| Se elimina una asignación `CARGADO_MOODLE` | No elimina ni modifica automáticamente el curso existente en Moodle. | La misma operación atómica crea una incidencia privada `PENDIENTE_DECISION_MOODLE` con curso/ID Moodle, motivo y referencias. Solo Sistemas puede consultarla o resolverla. |
| Sistemas consulta Recuperación | Puede buscar por ciclo, materia, grupo, fecha y responsable. | Módulo exclusivo de ADMIN_GENERAL y auxiliares con delegación explícita. |
| Sistemas restaura | El registro regresa activo únicamente si el servidor revalida permiso, retención, ciclo, referencias, unicidad de grupo, materia, ID Moodle y conflictos vigentes. | Debe ocurrir junto con bitácora y evento. No altera Moodle automáticamente; una incidencia externa pasa a `REQUIERE_CONCILIACION_TRAS_RESTAURACION` hasta resolverse. |
| Expira la retención o se depura un ciclo | El registro se conserva en respaldo externo y sale de Firestore operativo. | No se realiza sin respaldo verificado. |

Cada eliminación conserva deletedAt, deletedByUid, deletedByName, deletedByRole, deletedReason y el contenido necesario para restaurar. Las vistas, reportes, auditorías operativas Moodle y CSV excluyen registros eliminados. Las incidencias privadas de conciliación Moodle permanecen visibles para Sistemas hasta resolverse y no se confunden con la auditoría operativa normal.

## E2-C05 — Depuración de ciclos y respaldos externos

Al completar el cierre de un ciclo nuevo, el histórico más antiguo se procesa como un lote controlado y reanudable:

1. Se calcula el alcance: asignaciones, grupos, solicitudes, ligas Meet, notificaciones y bitácora exclusivas del ciclo.
2. Se crea un manifiesto de respaldo `PREPARANDO` con ciclo, alcance, corte de versión, conteos esperados, hashes, versión de esquema y procedimiento compatible de restauración.
3. Antes de depurar, el respaldo debe quedar `VERIFICADO`: accesible, íntegro, con conteos y hashes coincidentes y compatible con una restauración probada fuera de producción. Que el archivo exista o pueda localizarse no basta.
4. Antes del primer borrado, el ciclo objetivo queda protegido por una cerca de versión. Una corrección extraordinaria de Sistemas invalida el manifiesto y obliga a crear y verificar uno nuevo antes de iniciar la depuración; nunca se depura una fotografía desactualizada.
5. Al iniciar el primer borrado, el ciclo entra en bloqueo de depuración: se conserva inmutable el manifiesto original y el servidor rechaza modificaciones ordinarias y extraordinarias sobre ese ciclo hasta completar, reanudar o recuperar el trabajo de forma controlada.
6. La depuración usa un `purgeJobId` idempotente con lotes, cursor, entidades procesadas y estados `PENDIENTE`, `EN_PROCESO`, `INTERRUMPIDA`, `COMPLETADA` o `FALLIDA`. Antes del primer borrado puede cancelarse y comenzar un respaldo nuevo si cambió la cerca de versión. Desde el primer borrado solo se reanuda con el manifiesto original verificado o se ejecuta una recuperación controlada; nunca se sustituye por un respaldo incompleto de la base restante.
7. Si el respaldo falla, es ilegible o no pasa la prueba de restauración, no se depura nada. El ciclo se conserva temporalmente aunque se exceda el máximo operativo, con alerta visible para Sistemas.
8. Se registra el lote de depuración, sin eliminar el ciclo actual ni el último histórico que sí pueda conservarse conforme a este contrato.

No se depuran como parte del ciclo:

- Docentes globales vigentes.
- Asignaturas globales vigentes.
- Nomenclaturas, programas y categorías vigentes.
- Usuarios, roles y delegaciones vigentes.
- Plantillas Moodle vigentes.

El respaldo no se muestra como histórico ordinario de SPAI. Su recuperación es un procedimiento exclusivo de Sistemas y se prueba fuera de producción antes de depender de él en una emergencia. Cada respaldo conserva una fecha de retención mínima de cinco años desde el cierre del ciclo, o el plazo institucional mayor que se establezca posteriormente. Solo `ADMIN_GENERAL` puede autorizar su eliminación después de cumplida la retención, mediante motivo, confirmación reforzada, bitácora y destrucción segura verificable.

## E2-C06 — Catálogo y sustitución de plantillas Moodle

moodle_plantillas representa el catálogo actual para futuras replicaciones. No es una copia de los cursos de Moodle ni un histórico por ciclo.

| Acción | Resultado esperado | Restricciones |
|---|---|---|
| Cargar catálogo nuevo | Se importa a una versión/lote `PREPARANDO`, aislada del catálogo activo; se validan CSV, nombres cortos, programa, modalidad y duplicados y se conserva resultado por fila. | No se usa para replicaciones ni reemplaza nada durante la vista previa. |
| Verificar catálogo | Solo un lote sin errores bloqueantes pasa a `VERIFICADO`. | Los resultados por fila sirven para diagnóstico; un lote parcial nunca puede ser vigente. |
| Reemplazar catálogo | Sistemas confirma la versión activa esperada; una transacción cambia el puntero único `catalogoActivoVersionId` hacia el lote verificado y deja el anterior inactivo y auditado. | Solo afecta la referencia de SPAI para futuras cargas. El catálogo anterior permanece vigente hasta el instante del cambio atómico. |
| Curso ya creado en Moodle | Permanece intacto. | El reemplazo no borra, edita ni replica de nuevo el curso. |
| Asignación ya exportada o cargada | Conserva referencia mínima de la plantilla usada: nombre corto, nombre y versión/lote. | La referencia sirve para auditoría, aunque el catálogo anterior ya no exista. |
| Error o concurrencia durante reemplazo | Un lote fallido o parcial queda solo como diagnóstico y nunca activo. Si otro reemplazo cambió el puntero esperado, se rechaza por conflicto. | No se combinan lotes ni se expone un catálogo parcial. |

La acción visible para Sistemas será **Reemplazar catálogo de plantillas**:

~~~
Cargar CSV → Validar lote aislado → Vista previa y resultados → Verificar completo → Confirmar versión activa esperada → Activar puntero atómico → Bitácora
~~~

No se eliminan cursos Moodle desde SPAI mediante esta operación.

## E2-C07 — Integridad entre catálogos y referencias

Un grupo, materia, docente o plantilla no se elimina a ciegas si tiene referencias operativas.

- Antes de borrar o inactivar un grupo, SPAI identifica asignaciones activas y compartidas que lo usan.
- Antes de borrar una materia, verifica asignaciones y cursos relacionados.
- Antes de inactivar un docente, muestra asignaciones donde figura como responsable y exige reemplazo o confirmación institucional cuando proceda.
- Los grupos compartidos se actualizan como una relación consistente: no se pierde el grupo origen ni se sobrescriben destinos concurrentes.
- Los datos de importación se validan contra el ciclo, el programa y el catálogo vigente antes de crear referencias.

Cuando un catálogo solo deba dejar de usarse, se prefiere INACTIVO sobre borrado físico. La eliminación definitiva queda reservada a datos sin referencias o a ciclos que ya completaron `E2-C05`.

## E2-C08 — Solicitudes, atomicidad e idempotencia

La resolución de una solicitud no puede depender de una secuencia de escrituras independientes desde el navegador.

Toda operación crítica persiste conjuntamente el cambio institucional, la entrada inmutable de bitácora y el evento pendiente de notificación. El correo se procesa después, desde ese evento persistente, con reintentos y sin revertir la operación ya confirmada.

### E1-D02 — Vinculación directa de clases compartidas

Una clase compartida no requiere aceptación de la coordinación responsable de la asignación base. La vinculación se aplica directamente cuando el servidor valida ciclo, grupo, ámbito y compatibilidad; no existe estado `PENDIENTE_ACEPTACION` para este caso.

- La coordinación con edición sobre una asignación puede vincular a ella un grupo activo y compatible del mismo ciclo.
- La coordinación responsable de un grupo puede vincular o retirar **su propio grupo** de una asignación compatible, sin modificar la materia, ID Moodle, docente, grupo base ni otros grupos compartidos.
- La relación conserva siempre el grupo base y registra cada grupo compartido como vínculo independiente; ninguna coordinación puede retirar o alterar un grupo ajeno.
- La coordinación responsable de la asignación base y la responsable de cada grupo involucrado reciben aviso posterior por campanita y correo institucional, sin requerirles realizar una acción.
- Sistemas puede vincular o retirar cualquier grupo por excepción operativa, con motivo obligatorio, bitácora y aviso a las coordinaciones involucradas.

| Situación | Contrato esperado |
|---|---|
| Crear solicitud | El servidor valida actor, ciclo, ámbito, tipo y ausencia de duplicado pendiente antes de confirmarla. |
| Vincular o retirar un grupo compartido | Relación de grupos, estado, bitácora y evento de notificación se confirman en una operación atómica; no se solicita aceptación posterior. |
| Aceptar alta de grupo, reapertura, especial o docente | El efecto institucional y la resolución de solicitud se confirman juntos o no cambia ninguno. |
| Repetir la misma operación | Devuelve el resultado ya confirmado; no duplica grupo, asignación, notificación ni correo. |
| Dos operaciones simultáneas | Una confirma según precondiciones y la otra recibe conflicto claro; no se pierde un grupo compartido ya agregado. |
| Falla de red o permiso | La interfaz conserva datos, muestra error real y no anuncia éxito antes de la confirmación del servidor. |

Las solicitudes terminales no se reabren mediante una nueva escritura. Una nueva necesidad genera una nueva solicitud con motivo y relación a la anterior si aplica.

## E2-C09 — Bitácora, notificaciones y correo

### Bitácora

- Toda modificación crítica, su bitácora y su evento pendiente de notificación se escriben en la misma transacción o lote atómico de servidor; no se crea la bitácora como una escritura posterior independiente.
- El actor se obtiene de la identidad autenticada y del perfil efectivo en servidor, no de campos enviados por el navegador.
- Se registra módulo, entidad, ciclo, acción, fecha de servidor, valores anteriores/nuevos, motivo cuando aplique y nivel de integridad.
- La bitácora verificada no se edita ni elimina desde el cliente.

### Notificaciones

- La campanita y el correo parten del mismo evento persistente.
- El envío de correo inicia después de confirmar el evento persistente; sus reintentos no modifican ni revierten el cambio académico ni la bitácora.
- Cada evento conserva destinatario, actor real, área del actor, estado de envío, intentos, error y clave de deduplicación.
- Si un Auxiliar de Sistemas realiza una acción, el aviso dice que el Auxiliar de Sistemas correspondiente realizó la acción; no atribuye la acción a la coordinación académica responsable del curso.
- Los avisos de actualización Moodle se dirigen a la coordinación base y a las coordinaciones de grupos compartidos involucradas.
- Cuando una asignación especial cambia a CARGADO_MOODLE, se notifica a la coordinación responsable.
- Al revocar una delegación que haya originado roles personalizados, la misma operación atómica crea un aviso para todos los `ADMIN_GENERAL` con la cantidad e identidad de las asignaciones marcadas `REQUIERE_REVISION_ADMIN_GENERAL`; el aviso no altera ni desactiva esos roles.
- Un error de correo no revierte una operación académica ya confirmada; queda pendiente de reintento y visible para Sistemas.

## E2-C10 — Importaciones, exportaciones y CSV

- Todo CSV se valida completo antes de ejecutar una carga masiva: columnas, tipos, comillas, saltos de línea, duplicados, claves y referencias.
- El parser admite campos entrecomillados con saltos de línea; no parte una fila válida antes de interpretar comillas.
- Las cargas se ejecutan en lotes controlados, con límite de escrituras, resultado por fila e identificador de lote.
- Un error parcial no se presenta como importación completa; SPAI muestra qué filas se aplicaron y cuáles requieren corrección.
- Antes de exportar CSV Moodle, SPAI consulta al servidor las asignaciones vigentes y no eliminadas del ciclo seleccionado.
- La exportación individual incluye matrículas adicionales normalizadas y docente válido; la exportación por grupo genera una fila por grupo base o compartido.
- El reporte de docentes, asignaciones y Moodle transforma valores nulos, numéricos o heredados a texto seguro antes de escapar CSV.

## E2-C11 — Pruebas, ambientes y despliegue

| Área | Requisito mínimo |
|---|---|
| Firebase de pruebas | Proyecto separado o emuladores; pruebas locales no escriben en spai-6ef68 productivo. |
| Reglas Firestore | Pruebas por rol, ámbito, ciclo, campo protegido, eliminación, recuperación, capacidades explícitas de consultar/editar, migración de permisos heredados y ciclo completo de delegación de auxiliares, incluida la revocación inmediata con roles previamente asignados que permanecen activos y requieren revisión. |
| Revocación y migración | Se prueba que una sesión revocada recibe `PERMISO_REVOCADO`, que una operación preparada se rechaza al confirmar, que los roles asignados antes de la revocación siguen activos con `REQUIERE_REVISION_ADMIN_GENERAL` y que una vista previa obsoleta responde `MIGRATION_PREVIEW_OBSOLETE` sin escribir nada. |
| Flujos críticos | Pruebas de asignación, captura especial, matrículas, docentes, solicitudes, concurrencia, CSV, Moodle, plantillas y notificaciones. La conciliación Moodle debe rechazar una versión revisada que ya no coincida con `versionConciliacionMoodle`. |
| Recuperación y catálogos | Se comprueba que un eliminado no puede leerse directamente fuera de Sistemas, que una restauración revalida conflictos, que un respaldo debe restaurarse en prueba antes de depurar y que un catálogo parcial nunca llega a ser activo. |
| Build | Compilación Angular y verificación de Functions antes de publicar. |
| CI | Flujo automático que ejecuta build, reglas y pruebas antes de aceptar cambios. |
| Publicación | Despliegue a prueba, validación operativa y después Hosting productivo. |
| Recuperación | Prueba periódica de localizar y restaurar una copia de respaldo fuera de producción. |

No se considera terminado un cambio porque la interfaz se vea correcta. Debe cumplir sus reglas de servidor, conservar datos, dejar evidencia y pasar la prueba de aceptación asociada.

## E2-C12 — Arquitectura y rendimiento

- Asignaciones, Moodle, Docentes y Solicitudes deben dividirse en componentes y servicios por responsabilidad; los componentes de pantalla no concentran reglas de negocio, exportación, permisos y persistencia a la vez.
- Los catálogos y la bitácora se consultan con filtros de servidor, paginación e índices por ciclo, programa, estado y fecha; no se cargan colecciones completas para filtrarlas solo en el navegador.
- Los cambios visuales se validan junto con pruebas de permisos y flujos operativos para evitar que un ajuste de diseño altere la operación.
- La especificación, reglas Firestore, modelos TypeScript y Cloud Functions se cambian como una misma unidad cuando un contrato evoluciona.

## E2-C13 — Integración futura con SAEKO

La integración con SAEKO no se realiza desde Angular ni expone secretos en el navegador. Se implementa como conector de servidor con estos contratos:

- Credenciales almacenadas como secretos de Cloud Functions o infraestructura equivalente, nunca en Firebase Hosting ni en el repositorio.
- Mapeo versionado entre identificadores SPAI y SAEKO; ningún campo se infiere únicamente por nombre visible.
- Cada sincronización tiene identificador de operación, fecha, origen, destino, resumen de cambios y estado PENDIENTE, APLICADA, ERROR o REQUIERE_REVISION.
- Reintentos idempotentes: una respuesta duplicada no crea grupos, docentes ni asignaciones duplicadas.
- Modo de vista previa antes de la primera aplicación masiva y conciliación de diferencias antes de sobrescribir datos institucionales.
- Una falla de SAEKO no borra ni altera datos ya confirmados en SPAI.

## E2-C14 — Ligas Meet y alcance de Posgrados

La clasificación del módulo Ligas Meet debe usar el nivel académico real del programa y no solamente el área académica visible. La vista o filtro de **Posgrados** incluye:

- Maestrías de todas las áreas académicas.
- En particular, las **maestrías del área de Salud**, aunque sus grupos o nomenclaturas también aparezcan clasificados como Salud en otros módulos.

Una asignación de maestría en Salud no debe quedar fuera de Posgrados en ligas meet por estar asociada a la categoría Salud. El listado debe tomar su pertenencia desde una clasificación institucional del programa, reutilizable por Ligas Meet, en lugar de inferirla exclusivamente del texto del grupo.


## E2-C15 — Corrección de identidad Moodle de docentes

El ID Moodle de un docente guardado puede corregirse si contiene un error, pero se trata como una **corrección de identidad**, no como una edición ordinaria de perfil.

| Acción | Resultado esperado | Restricciones |
|---|---|---|
| Solicitar corrección de ID Moodle | Se registra el ID actual, el ID propuesto y el motivo. | Coordinación Académica, o un acceso personalizado con esta capacidad explícita, puede solicitarla para docentes de su ámbito; no modifica directamente una identidad global. |
| Confirmar corrección | Solo `ADMIN_GENERAL` valida y aplica el cambio. | El nuevo ID debe ser válido, único y no pertenecer a otro docente. Un Auxiliar de Sistemas no puede confirmar ni aplicar esta corrección. |
| Actualizar correo institucional | Solo `ADMIN_GENERAL` puede corregir el correo institucional dentro del procedimiento protegido de `E2-C15`. Si cambia el usuario Moodle, el servidor recalcula obligatoriamente el correo derivado con el nuevo ID y el dominio institucional configurado. | Ningún otro rol puede editarlo. Si se requiere un correo de contacto distinto, debe existir en un campo separado y no sustituir el institucional. |
| Migrar registro de docente | Se conserva la información del docente y sus relaciones bajo la nueva identidad canónica. | Si el ID Moodle forma parte del ID de documento Firestore, el servidor crea un `identityMigrationId` y realiza el cambio canónico de forma atómica; la actualización materializada de muchas referencias puede continuar por lotes reanudables sin exponer una identidad parcial. |
| Actualizar asignaciones y referencias | Las asignaciones activas del docente pasan al nuevo ID Moodle y aumentan su `versionConciliacionMoodle`. | Las asignaciones CARGADO_MOODLE se marcan PENDIENTE_ACTUALIZACION_MOODLE. Registros históricos, bitácora y eliminados recuperables conservan su instantánea anterior y una referencia al identificador canónico y al `identityMigrationId`; no se reescriben para ocultar la historia. |
| Confirmar Moodle | El actor con `CONFIRM_MOODLE_UPDATE` confirma que el usuario correcto quedó inscrito o corregido en Moodle. | SPAI no renombra automáticamente una cuenta Moodle externa. Esta confirmación no aplica por sí misma una corrección de identidad. |
| Auditar | Bitácora conserva ID anterior, ID nuevo, correo anterior, correo nuevo, actor, motivo y referencias afectadas. | La corrección es trazable e inmutable. |

La transacción inicial confirma conjuntamente la validación, el cambio de identidad canónica, el `identityMigrationId` y la bitácora. Las referencias materializadas se actualizan por lotes reanudables; durante esa transición, operaciones, conciliaciones y exportaciones resuelven siempre la identidad canónica vigente y no pueden usar el usuario Moodle anterior. La migración solo se declara completada al verificar todas las referencias requeridas. Al restaurar un registro eliminado, el servidor resuelve su referencia hacia la identidad canónica vigente; si la referencia anterior es inválida, marca conflicto y nunca reactiva un usuario Moodle obsoleto.

`E2-C15` solo corrige la identidad del docente. No autoriza cambiar el ID Moodle del curso ni la materia de una asignación, incluida una que ya esté cargada en Moodle.

## E2-C16 — Gestión ordinaria de docentes

El catálogo de docentes es global: existe un único registro canónico por `moodleUser` normalizado. La edición ordinaria no modifica la identidad Moodle ni crea una copia distinta del docente por coordinación.

| Grupo de información | Campos y tratamiento |
|---|---|
| Identidad protegida | `id`, `moodleUser`, `normalizedMoodleUser` y correo institucional derivado. Solo `ADMIN_GENERAL` puede corregir el usuario Moodle y, como consecuencia, el correo institucional conforme `E2-C15`; el servidor recalcula `id`, normalizados y correo. Si se requiere un correo de contacto distinto, debe existir en un campo separado y no sustituir el institucional. |
| Datos de ficha editables | `teacherCode`, `fullName`, teléfono, tipo de pago, categoría, ubicación y observaciones. `ADMIN_GENERAL` puede editarlos en docentes `PENDIENTE` o `VALIDADO`; Coordinación Académica puede hacerlo dentro de su ámbito y Alta de Docentes únicamente en sus propias altas, conforme a las reglas siguientes. Los docentes `INACTIVO` son de solo consulta salvo una operación de Sistemas autorizada. Estos son todos los campos ordinarios de la ficha; estado, procedencia, ámbito y auditoría son controles operativos, no campos libres del formulario. |
| Procedencia y ámbito | `createdBy*`, `origin`, `importId`, `createdAt` y `createdByPrograms` son evidencia de procedencia y no se sobrescriben al reasignar una coordinación. `assignedCoordinatorIds` determina el ámbito; los nombres relacionados son solo una proyección de lectura. Solo Sistemas o un auxiliar delegado modifica vínculos de coordinación. |
| Estado y trazabilidad | `status` (`PENDIENTE`, `VALIDADO` o `INACTIVO`), `lifecycleStatus`, `validatedBy/At`, `inactivatedBy/At`, `updatedBy*`, `updatedAt` y eliminación lógica cambian solo por operaciones de servidor autorizadas. El estado inicial `PENDIENTE` lo asigna el servidor al registrar un docente; Alta de Docentes y Coordinación Académica no pueden elegir ni cambiar el estado. |

Una Coordinación Académica tiene ámbito sobre un docente cuando lo creó como alta manual o figura en `assignedCoordinatorIds`. Puede editar los datos de ficha mientras el docente esté `PENDIENTE` o `VALIDADO`, pero no identidad, estado, procedencia, vínculos de coordinación ni información fuera de su ámbito. Un usuario de Alta de Docentes tiene a su cargo exclusivamente cada docente que registró: el servidor verifica que `createdBy` coincida con su identidad activa y le permite editar los mismos datos de ficha en `PENDIENTE` o `VALIDADO`, aunque el docente después sea usado por otra coordinación. `createdBy` es inmutable y asignar el docente a una coordinación no transfiere esa responsabilidad. En un docente compartido, la actualización conserva un único registro global, exige precondición de versión para evitar sobrescrituras y deja bitácora con aviso a Sistemas y a las coordinaciones involucradas.

| Transición u operación | Actor y resultado |
|---|---|
| Alta manual | Alta de Docentes o Coordinación Académica registra un docente, origen `MANUAL` y vínculo con quien lo registra. El servidor asigna siempre el estado inicial `PENDIENTE`; el usuario que realiza el alta no puede elegirlo. Durante esta alta inicial captura el usuario Moodle y el servidor deriva el correo institucional; después de guardarlo, ambos quedan sujetos a `E2-C15`. La escritura, bitácora y aviso a Sistemas se confirman juntos. |
| Edición ordinaria de `PENDIENTE` | `ADMIN_GENERAL` puede editar cualquier ficha; Alta de Docentes puede editar la ficha propia cuando `createdBy` coincide con su identidad; Coordinación Académica puede editarla dentro de su ámbito. Ninguno cambia usuario Moodle ni correo institucional fuera de `E2-C15`. |
| `PENDIENTE` → `VALIDADO` | Solo Sistemas puede cambiarlo: `ADMIN_GENERAL` o un Auxiliar de Sistemas con delegación explícita `VALIDATE_TEACHERS`. Verifica identidad, unicidad y datos mínimos, conserva los vínculos y avisa a las coordinaciones relacionadas. |
| `VALIDADO` → `PENDIENTE` | Solo Sistemas con `VALIDATE_TEACHERS` puede devolverlo a revisión. Conserva las asignaciones existentes, bloquea nuevas selecciones y crea `DOCENTE_REQUIERE_REVISION` con aviso a las coordinaciones involucradas; no sustituye ni borra al docente automáticamente. |
| Edición ordinaria de `VALIDADO` | `ADMIN_GENERAL`, Alta de Docentes dueña de la alta o una Coordinación Académica creadora o incluida en `assignedCoordinatorIds` puede actualizar los datos de ficha; no cambia identidad, estado ni ámbito. |
| `PENDIENTE` → retiro | Alta de Docentes o la Coordinación Académica creadora puede retirar únicamente un alta manual propia, nueva y sin referencias. Es una eliminación lógica, no un cambio de `status`; en cualquier otro caso interviene Sistemas. |
| `PENDIENTE` o `VALIDADO` → `INACTIVO`, o reactivación | Solo Sistemas con `VALIDATE_TEACHERS`, con motivo y revisión de asignaciones activas o cargadas antes de confirmar. Conserva las referencias existentes, bloquea nuevas selecciones mientras no esté `VALIDADO` y nunca sustituye ni borra al docente automáticamente. |

Solo docentes `VALIDADO` se pueden seleccionar como responsables de una asignación. `TEMPORALMENTE SIN DOCENTE` es un valor operativo de asignación, no un docente que pueda validarse, editarse o convertirse en una identidad.


## Control de entregas y evidencia de cierre

Cada entrega se identifica con `E2-Rxx` y conserva una ficha con los campos siguientes:

| Evidencia obligatoria | Contenido |
|---|---|
| Contratos | Contratos incluidos y contratos expresamente fuera de alcance. |
| Criterios de aceptación | Operaciones permitidas y denegadas, con resultados esperados. |
| Pruebas | Enlace o resultado de pruebas unitarias, reglas, Functions, integración y regresión aplicables. |
| Commit | SHA o referencia verificable de la implementación revisada. |
| Ambiente | Estado: `BORRADOR`, `VALIDADA_LOCAL`, `VALIDADA_PRUEBAS`, `DESPLEGADA_PRODUCCION` o `REVERTIDA`. |
| Publicación y reversión | Build, reglas y Functions verificados; procedimiento de reversión o respaldo aplicable. |

| Entrega | Alcance | Estado inicial |
|---|---|---|
| `E2-R01` — Seguridad y permisos | `E2-C01`, `E2-C01.1`, `E2-C01.2`, porción administrativa de `E2-C09` y pruebas aplicables de `E2-C11`. Incluye capacidades y ámbitos efectivos, prevención de autoescalamiento, delegaciones, último administrador, perfiles heredados, revocación y sus revisiones. Excluye ciclos, asignaciones, docentes, recuperación, catálogos y Moodle. | `BORRADOR` |
| `E2-R02` — Ciclo y Especiales | `E2-C02` y las reglas de autorización de ciclo de `E2-C03`. | `BORRADOR` |
| `E2-R03` — Asignaciones, solicitudes y conciliación Moodle | Reglas restantes de `E2-C03`, `E2-C08`, partes operativas de `E2-C09` y pruebas de concurrencia de `E2-C11`. Las integraciones de solicitudes que dependan de ciclos o docentes se habilitan solo cuando sus entregas correspondientes estén disponibles. | `BORRADOR` |
| `E2-R04` — Recuperación y depuración | `E2-C04` y `E2-C05`, con procedimiento de restauración probado. Antes del primer borrado, un cambio invalida el respaldo; después del primer lote borrado se bloquean modificaciones del ciclo y solo se reanuda con el manifiesto original o mediante recuperación controlada. | `BORRADOR` |
| `E2-R05` — Catálogos, importación, Ligas Meet y rendimiento | `E2-C06`, `E2-C07`, `E2-C10`, `E2-C14` y la parte pertinente de `E2-C12`. | `BORRADOR` |
| `E2-R06` — Docentes e identidad | `E2-C15` y `E2-C16`, con migración de identidad y referencias recuperables. El cambio canónico, bitácora y registro de migración deben ser atómicos; las referencias materializadas pueden procesarse por lotes, pero las exportaciones resuelven siempre la identidad canónica vigente y la migración no concluye hasta verificarlas. | `BORRADOR` |
| `E2-R07` — Calidad transversal | CI y endurecimiento de `E2-C11` y `E2-C12`; acompaña todas las entregas, no se pospone al final. | `BORRADOR` |
| `E2-R08` — SAEKO | `E2-C13`, solo después de las entregas de seguridad, trazabilidad y pruebas requeridas. | `BORRADOR` |

Un contrato o entrega no se considera cerrado porque la interfaz se vea correcta. Debe tener reglas de servidor aplicadas, prueba automatizada o reproducible, evidencia de prueba, actualización del SPEC y despliegue validado en ambiente de pruebas; producción requiere además la evidencia de reversión correspondiente.
