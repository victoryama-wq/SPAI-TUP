# Etapa 1 — Matriz de permisos por operación

> Evidencia histórica de Etapa 1. El contrato vigente es [Etapa 2 v0.4](ETAPA-2-CONTRATOS-ESTABILIZACION.md); ver [trazabilidad E2-R01](E2-R01-SEGURIDAD-PERMISOS.md). D2 y D3 ya tienen definición en v0.4. El contenido histórico inferior no se reescribe.

Revisión local del código en `3a93ea6`, 2026-09-12. No es una lectura de reglas
desplegadas. Las pruebas usan perfiles ficticios; cuatro accesos de la copia
privada **no** demuestran cobertura de todos los roles.

## Cómo leer la matriz

- **S**: Coordinación de Sistemas; **X**: auxiliar con delegación para la acción;
  **A**: Coordinación Académica; **P**: perfil personalizado; **I**: inactivo.
  Estas abreviaturas describen perfiles funcionales esperados, no autorizan por
  coincidencia de texto en `role`.
- **Global**: catálogo institucional independiente del ciclo. **Operativo**:
  ciclo seleccionado; **Captura** es precondición académica de escritura, D1.
- Campos enumerados son campos operativos de la acción; sellos de auditoría
  deben provenir del actor real. “Sin allowlist” significa que el servidor no
  limita los demás campos, no que el contrato autorice modificarlos.
- **R**: lectura de reglas/código; **T**: reproducción automatizada identificada;
  **PEND**: contrato o cobertura pendiente. Una comprobación del botón no
  sustituye una escritura directa. Los estados D1/D2/D3 están en los
  [contratos](ETAPA-1-CONTRATOS.md).
- Fuente funcional **SPEC**: [SPAI-TUP-SPEC-v2.md](SPAI-TUP-SPEC-v2.md).
  Fuente del servidor **Rules**: [firestore.rules](../firestore.rules).
  Cada sección remite al componente y repositorio correspondientes; todos
  residen en `src/app/features/<módulo>/`.

## Perfil, módulo y campos de autorización: aplican a TODAS las filas

| Perfil/condición | Interfaz actual | Autorización efectiva actual | Esperado / evidencia |
|---|---|---|---|
| Sin autenticar | Login; no sesión operativa | Deniega catálogos/asignaciones y callable sin Auth | Denegar; T `AUTH-anonymous-*`, `FUNCTION-ANONYMOUS` |
| I | Sesión no operativa | Propio perfil legible; callable sincroniza sin activar; datos académicos rechazados | Conservar estado; T `AUTH-inactive-*`, `INACTIVE-OWN-PROFILE`, `FUNCTION-INACTIVE-STAYS-INACTIVE` |
| S activo | Navegación concede todos los módulos por nombre | Helpers `isSystemsMember/isSystemsCoordinator` usan expresiones del nombre; varios omiten bits | Derechos de S base conforme SPEC §6; no extenderlos a P por compartir palabra |
| X con módulo apagado | Algunos controles usan nombre; Docentes permite gestionar, Moodle requiere bit | Helpers de catálogos aceptan nombre capitalizado `Sistemas` aunque bit sea falso | Revocación efectiva; T `UI-AUX-OFF`, `OFF-WRITE-aux-off` F01 |
| A activo con flags heredados ausentes/falsos | Lista base académica; consulta de catálogos sin todos los bits | Catálogos cualquier activo; asignaciones por rol A | D3: §§6/23.7 frente a §25.10; T `ACADEMIC-LEGACY-FLAGS` caracteriza, no resuelve |
| P con `none` o todos los bits apagados | Menú restringido por bits salvo que nombre contenga Sistemas | Catálogos y directorio legibles a cualquier activo; edición de docente pendiente también posible | Denegar módulo explícitamente no concedido; T `OFF-READ-*`, `TEACHER-OFF-EDIT` |
| P con `view`, nombre “Consulta Sistemas” | Docentes respeta `view`; otros componentes comprueban solo nombre | Rules no consulta `roles_personalizados.permissions`; permite editar ciclos | Solo consulta; T `UI-CUSTOM-VIEW` frente a `OFF-WRITE-custom-view` |
| P con `edit`, nombre sin Sistemas | `ModulePermissionService` concede edit, algunos componentes exigen además Sistemas | Catálogos de Sistemas denegados aunque plantilla diga edit | D3: alcance de edición personalizada en módulos exclusivos; T `CUSTOM-EDIT-GROUP` |
| P con plantilla ausente/no coincidente | `canEditModule` devuelve true para activo si no encuentra plantilla por nombre | No evalúa plantilla; combina nombre y bits | No inferir privilegios por nombre o plantilla perdida; R, casos de plantilla retirada pendientes |
| Propio perfil completo o incompleto | Usuarios permite administrar según rol de Sistemas; vinculación Auth separada | `canManageUsers` deja elevarse a auxiliar con Usuarios; `isOwnEmailBinding.changedKeys` ignora campos agregados | Propuesta C01: no autoescalamiento; T `PROFILE-*` F10; política de delegación fina pendiente antes de Etapa 2 |

`app.routes.ts` no declara guards; `app.component.ts#canAccessPath` hace control
de navegación desde la sesión. No se presume acceso efectivo seguro por faltar
un menú. `ModulePermissionService` solo se aplica en algunos componentes y
busca plantillas por nombre normalizado. Las restricciones esperadas de P/X
se aplican por acción en todas las filas, incluso donde no se repita el perfil.

La lista estática académica incluye Dashboard, Nomenclaturas, Grupos, Docentes,
Asignaturas y Asignaciones. Excluye Solicitudes y Ligas Meet incluso con el bit
habilitado, aunque los componentes respectivos admiten consulta/operación
académica. Es una divergencia de navegación confirmada por lectura (F01), sin
smoke de navegador en esta etapa; los tests de métodos de Solicitudes no prueban
que una coordinación pueda llegar a esa pantalla.

## Inicio, Dashboard, avisos y agenda

Fuentes: `dashboard/pages/dashboard-page.component.ts`, repositorios de agenda
y notificaciones; Rules `notificaciones`, `agenda_operativa_equipo`,
`agenda_operativa_privada`; SPEC §§24/25.3.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar resumen | S/X institucional; A coordinación | Activo/anterior; sin escritura | Contadores/vistas derivados de colecciones completas | Cada colección autoriza por separado; no permiso único Dashboard | Respetar ámbitos de cada módulo; R, smoke histórico Etapa 0 no repetido |
| Crear solicitud a Sistemas | A propia; S/X operativo | Reapertura admite cerrada; tipo, ciclo, programa, motivo, requestedBy | Formulario Dashboard guarda `solicitudes_sistemas` | Activo, tipo válido, solicitante UID; no estado de ciclo | C05; T cobertura lectura/borrado de solicitud; UI Dashboard pendiente |
| Leer/marcar aviso | S/X institucional; A destinatario | Cualquiera; lectura, `readBy` | Campanita filtra objetivos y limita registros | Lectura por destinatario o Sistemas; update `changedKeys` solo readBy, sin blindar campos añadidos | Solo destinatario autorizado, sin adulterar aviso; R F12/Etapa 5; sonda de campos añadidos pendiente |
| Generar aviso | Actor autorizado de operación | Tipo, target, targetUserId, contenido | Repositorio cliente lo genera al operar | Activos pueden crear tipos permitidos; agenda solo Sistemas base. Trigger simula correo local antes de destinatarios/SMTP | Aviso tras commit, deduplicado; T correo simulado; integridad/actor pendientes Etapa 5 |
| Agenda de equipo: consultar/crear/editar/mover/eliminar | S/X base, equipo | Global; title, column, priority, contenido; creador inmutable | Tablero de Sistemas | Solo nombres exactos de dos roles base activos; no bit; create actor UID, update creador/fecha inmutables | SPEC §25.3, mismo equipo; P no obtiene acceso por texto. R; pruebas CRUD pendientes |
| Agenda privada: consultar/crear/editar/mover/eliminar | S/X base, propia | Global; mismos campos, ownerId propio | Panel privado | Ruta ownerId==UID; scope/owner/creador inmutables | Privacidad por propietario; R, prueba cruzada pendiente |

## Usuarios y roles

Fuentes: `users/pages/users-page.component.ts`, `users/data/{users,custom-roles}.repository.ts`,
`users/data/module-permission.service.ts`; Rules `usuarios`, `roles_personalizados`;
Functions `syncUserProfileByEmail`; SPEC §§5/6/24.3/25.10.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar directorio | S/X autorizado; A requiere referencias de coordinadores, no administración | Global; sin escritura | A no ve Usuarios; otros módulos consumen directorio | Cualquier activo lee documentos completos; propio perfil por UID/authUid/correo aun inactivo | Minimizar lectura según capacidad y referencias necesarias; F01 `OFF-READ-usuarios`; separación proyección pública/privada pendiente |
| Crear/editar/activar/inactivar usuario | S/X delegado, institucional | Global; nombre/email/role/status/access/assignedPrograms; identidad protegida | `canManageAccess` exige Sistemas; A solo toggle Meet al configurar rol A | `canManageUsers`: S coordinador o Sistemas con bit Usuarios; no allowlist de delegación | Solo gestión delegada, no autoescalar; T `PROFILE-AUX-SELF-ESCALATION` |
| Retirar acceso | S/X delegado, institucional | Global; elimina documento, no cuenta Auth desde este método | Confirmación modal; promesa de repositorio descartada | Delete mismo `canManageUsers` | Confirmar servidor y preservar referencias; R, Etapas 2/4/5 |
| Crear/editar/eliminar plantilla P | S/X dentro de delegación | Global; name/permissions (`none/view/edit`) y metadatos | Catálogo de roles; roles base protegidos por UI | Mismo `canManageUsers`, no protege nombres base ni techo de privilegios | Respetar protección base y delegación; T `PROFILE-ESCALATED-CAPABILITY`; D3 |
| Vincular identidad propia | Autenticado, propio | Global; authUid/updatedAt, sin agregar status/role/access | Login usa sincronización; DEMO espera perfiles existentes | Callable autenticada usa Admin, conserva perfil por correo; ruta cliente de vinculación usa changedKeys | No convertir vinculación en activación; T `PROFILE-LEGACY-ADDED-FIELDS/CAPABILITY` F10 |
| Bootstrap propio | Autenticado sin perfil | Global; perfil inicial inactivo y sin capacidades | Producción registra pendiente, DEMO no autoalta | `isOwnBootstrapUser` restringe inicialización | Nunca crear Sistemas por solo autenticarse; R y tests Auth; más variantes legacy Etapa 2/4 |

## Ciclos

Fuentes: `cycles/pages/cycles-page.component.ts`, `cycles/data/cycles.repository.ts`;
Rules `ciclos/canEditCycles`; SPEC §10; contrato C02.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar/seleccionar operativo | S/X administrar; A consulta derivada en encabezado | Todos para gestión; activo/anterior operativo | Elige primero Captura o Captura cerrada | Lectura cualquier activo | Uno operativo o error de ambigüedad; T `CYCLE-*` F05 |
| Crear | S/X delegado institucional | Nuevo Preparacion; code, name, tentativeCaptureCloseAt opcional | Formulario valida duplicado local y espera escritura | Helper por Sistemas; sin schema/único por código | Preparacion, código único, sin exigir fecha; R + `UI-CYCLE-SAVE-ERROR` |
| Editar fecha/configuración | S/X delegado institucional | Preparación/operación; tentativeCaptureCloseAt, campos de formulario | Guarda fecha aparte | Igual helper; sin allowlist | No activar ni alterar historia indirectamente; R F01/F05 |
| Activar captura | S/X delegado institucional | Preparacion→Captura; status/captureStartedAt/captureClosedAt | Confirmación, llamada al repo sin esperar | Puede escribir estado sin comprobar otro ciclo | Exclusión global C02; T `CYCLE-MULTIPLE-OPERATIVE` |
| Cerrar/reabrir captura/cerrar ciclo | S/X delegado institucional | Transiciones C02; status y sellos técnicos | Confirmación, descarta promesa de transición | Sin FSM ni unicidad | Esperar commit, una transición válida; R F05/F06 |
| Eliminar | S/X delegado institucional | Solo Preparacion que nunca capturó | Botón condicionado al estado | Helper permite borrar cualquier estado | Proteger históricos; R, sonda específica pendiente Etapa 3 |

## Nomenclaturas y programas

Fuentes: `nomenclatures/pages/nomenclatures-page.component.ts`, repositorios de
nomenclaturas/programas; Rules `programas`, `nomenclaturas_programas`; SPEC §§9/24.4.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar | S/X/A autorizado, catálogo global | Global; activas e históricas | Consulta A, búsqueda/paginación | Cualquier activo | Catálogo para referencias; P/X apagado no acceso indiscriminado; R F01 |
| Crear/editar/importar/equivalencias | S/X delegado, institucional | Global; abbreviation, programCode/Name, planName/Code, notes, status; programa code/name/academicArea/programType/modality/coordinator | `canManageNomenclatures` por Sistemas; upsert CSV y asegura programa | Helper Sistemas, sin allowlist; sincronizar usuarios requiere permiso Usuarios adicional | Abreviatura única, datos coherentes, no borrar histórico; R; atomicidad de sincronización y CSV pendientes |
| Activar/inactivar | S/X delegado | Global; status | Control de gestión | Helper sin restricción de transición | Inactiva conserva referencias; solo activa para altas nuevas; R |
| Eliminar | S/X delegado | Global; solo sin uso real | Comprueba usageCount==0 | Helper permite delete sin comprobar referencias | Verificar uso real; usageCount no mantenido (F12/Etapa 4); R |
| Asignar coordinador de programa | S/X delegado | Global; coordinator + usuarios.assignedPrograms | Selector A y sincronización de programa | Permisos diferentes por colección, sin operación conjunta exigida | Referencia estable y consistente, no conceder programas por nombre enviado; F09/F12, R |

## Grupos

Fuentes: `groups/pages/groups-page.component.ts`, `groups/data/groups.repository.ts`;
Rules `grupos`; SPEC §§11/23.5/24.5.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar/exportar plantilla | S/X institucional; A sus programas y catálogo global | Activo/anterior; sin escritura | Filtros de coordinación/ciclo; catálogo global | Cualquier activo puede listar todo | Consulta no amplía captura; F01 `OFF-READ-grupos` |
| Crear/editar/importar CSV | S/X delegado, institucional | Ciclo de grupo; fullGroup/cycle/program/abreviatura/modalidad/turno/status | `canManageGroups` por nombre Sistemas; ciclo activo prefijado | canEditGroups por nombre/bit; sin campo/estado de ciclo | Validar nomenclatura activa y referencias del ciclo; A solicita alta; D3 `CUSTOM-EDIT-GROUP` |
| Eliminar individual | S/X delegado | Grupo elegido; documento completo | Confirmación | Helper sin validación de referencias | No romper asignaciones; política de integridad Etapa 4, R |
| Eliminar por ciclo | S/X delegado | Ciclo específico obligatorio | Habilita solo con filtro específico | Deletes individuales, sin límite institucional por ciclo en reglas | Confirmar alcance y resultado, proteger relaciones; R, pruebas masivas pendientes |

## Docentes

Fuentes: `teachers/pages/teachers-page.component.ts`, `teachers/data/teachers.repository.ts`;
Rules `docentes`, `configuracion/docentes`; SPEC §§9/23.6/24.6.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar global / Mis docentes | S/X/A; global o coordinación como filtro | Global; sin escritura | Mis docentes por IDs/nombres/programas; filtros | Todo activo lee catálogo completo | Consulta global A; no restringir solo a creador; F01 `OFF-READ-docentes` |
| Alta manual | S/X o A propio pendiente | Global; nombres/apellidos, Moodle derivado/retoma, correo, metadatos pago/categoría/teléfono/ubicación; status PENDIENTE para A | A registra pendiente y genera solicitud/aviso | canCreatePendingTeacher acepta cualquier activo con forma mínima, no módulo ni dueño fiable | Académica autorizada, no auto-validar ni asignar creador ajeno; R F02; transacción contador Etapa 4 |
| Editar docente validado/inactivo o asignar coordinaciones | S/X delegado institucional | Global; identidad/operativos/coordinatorIds/programs/status conforme validación | `canManageTeachers` y validaciones | Helper permite Sistemas sin bit; A no pasa helper salvo pendiente manual | Gestión Sistemas; T `TEACHER-VALIDATED-PROTECTED`, `UI-AUX-OFF` |
| Editar pendiente manual propio | A creador; propuesta de ámbito propio C01 | Global; propuesta: nombres y metadatos operativos; conservar usuario normalizado, creador, estado/origen y delegación | No hay control equivalente de edición A en `canManageTeachers`; sí existe helper de borrado propio | `canUpdateOwnPendingTeacher` no comprueba creador ni bit; permite también ajeno | T `TEACHER-EDIT-own/other`, `TEACHER-OFF-EDIT`; lista académica final de campos pendiente, no implementada |
| Validar/activar/inactivar | S/X delegado, institucional | Global; status/lifecycle y sellos; notificar coordinación | Gestión Sistemas | Helper amplio, sin FSM completa | Solo Sistemas autorizado; T pendiente/validado distingue acceso; transiciones integrales futuras |
| Eliminar inactivo | S/X delegado | Global; documento completo | Botón solo inactivo y confirmación | Exige INACTIVO en rama Sistemas | Conservar referencias institucionales según Etapa 4; R |
| Eliminar pendiente propio nuevo | A creador autorizado | Global; PENDIENTE + MANUAL + NUEVO | Helper verifica creador | Regla comprueba permiso Docentes y creador UID/alias authUid | T `TEACHER-DELETE-own/other`, `UI-TEACHER-OWNERSHIP`; no autoriza borrar ajeno |
| Importar / exportar CSV administrativo | Importación S/X; exportación según permiso de consulta | Global; nombres, Moodle, metadatos/coordinaciones | Importación gestión; descarga reporte si bit Docentes o gestión | CSV generado en cliente: reglas solo protegen lectura/escritura subyacentes | SPEC describe descarga Sistemas; UI permite bit a A: alcance de reporte por definir, R, no prueba de exportación |
| Exportar pendientes Moodle | S/X delegado exclusivamente | Global; columnas username/password/email/firstname/lastname/cohort1/auth | Requiere Sistemas + canEditModule, no bit directo | No endpoint de exportación; catálogo leído por activos | No inferir que ocultar exportación protege columnas ya leídas; R, datos/formato Etapa 6; no CSV real generado aquí |

## Asignaturas

Fuentes: `subjects/pages/subjects-page.component.ts`, repositorio de asignaturas;
Rules `asignaturas`; SPEC §§9/23.7/24.7.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar/buscar | S/X global; A catálogo activo | Global permanente | A filtra variantes de activo, prioriza nuevas | Cualquier activo lee incluso inactivas | D3 legado; F01 `OFF-READ-asignaturas`; activos equivalentes según SPEC |
| Crear/editar/importar CSV | S/X delegado | Global; subjectId interno, nombre mayúsculas, metadatos/status | `canManageSubjects`; ID interno incremental separado de Moodle | Helper Sistemas; create ID documento==subjectId, update subjectId inmutable | ID único, nombres pueden repetirse, no reescribir materias antiguas para añadir código; R |
| Inactivar/reactivar | S/X delegado | Global; status | Gestión | Helper amplio | Conservar uso histórico; R |
| Eliminar / depurar duplicados | S/X delegado | Global; selección explícita | Confirmación/selección de duplicados | Helper, sin referencias protegidas | Verificar uso antes de borrado, no confundir nombres iguales con duplicados; Etapa 4 R |

## Asignaciones

Fuentes: `assignments/pages/assignments-page.component.ts`,
`assignments/data/assignments.repository.ts`; Rules `asignaciones` y helpers;
SPEC §§12/24.8/25.4–25.6, C03/C04.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Consultar Mis programas/global/histórico | S/X institucional; A consulta global y filtro propio; P view si autorizado | Operativo/anterior | Vistas por rol/programas; canView por A/bit | Systems/Academic o bit leen toda colección, sin ciclo | Lectura global no habilita escritura ajena; D3, R |
| Crear base normal/inglés/especial | S/X institucional; A programas asignados | Académica solo Captura; cycle/group/program/subject/teacher/Moodle/enrollments | canCapture comprueba Captura; repo ID determinista y confirma servidor | Forma mínima, createdBy; fallback propio no inglés permite programa ajeno, createdByPrograms confiado; sin ciclo | T `CYCLE-CREATE-*`, `ACADEMIC-FOREIGN-CREATE` F04/F09; validar ámbito mediante servidor |
| Editar base propia no cargada | S/X; A programa autorizado | A Captura; teacherName/MoodleUser, group/program, sharedGroups/Programs, enrollments y sellos | Gestión académica/Systems; controles de campos | A allowlist operativa; Systems más amplio; sin ciclo | No poder alterar creador, ni usar datos del cliente para ampliar ámbito; T `CYCLE-WRITE-*` |
| Editar base propia cargada | S/X; A del programa origen | A Captura por D1; mismos operativos; identidad bloqueada | SPEC permite corregir cargada; capture gate independiente | `preservesLoadedAssignmentIdentity`; no verifica ciclo | T `MOODLE-IDENTITY-PROTECTED`, F04; sonda cargada+cerrada dedicada pendiente |
| Editar solo matrículas de otra coordinación | A global, excepción expresa | Solo Captura; studentEnrollments y sellos permitidos | Interfaz ofrece excepción según §25.4 | Existe helper, pero sonda supera 1000 expresiones y se rechaza | **Debe permitir**; T `ACADEMIC-FOREIGN-ENROLLMENTS` F11 y control propio; no afirmar protección correcta por cualquier permission-denied |
| Editar docente/base de otra coordinación | A fuera de ámbito | Ningún ciclo autoriza; sin campos | UI restringe fuente | Rechaza en prueba, también reporta límite de expresiones | Denegar por política; T `ACADEMIC-FOREIGN-TEACHER`; motivo semántico efectivo pendiente F11 |
| Compartir / desvincular destinos | Origen autorizado; destino solo participación propia; S/X | A Captura; sharedGroups/Programs, shared; conservar status | Modal directo y solicitudes son dos caminos; origen único | Helpers por programas/participación, sin aceptación obligatoria ni ciclo; cliente de solicitudes fuerza EN_CAPTURA | D2 canal pendiente; C04/C06 siempre; T `SHARE-*` F07/F08 |
| Eliminar base | S/X; A base autorizada, nunca base ajena por ser destino | A Captura; delete físico | Confirmación y espera repositorio | Helpers own/program/sharedsource; sin ciclo; no protege referencias completas | C03; R, borrados por estado/compartición pendientes Etapas 3/4/5 |
| Revisar/observar/estado Moodle | S/X delegado, institucional | Postcaptura permitido; status/observations | Desde módulos de Sistemas | Sistemas amplio; identidad cargada protegida | C04; T `SYSTEMS-CLOSED-OPERATIONS`, `MOODLE-*`; lote/exportación Etapa 6 |

## Solicitudes

Fuentes: `requests/pages/requests-page.component.ts`, repositorios
`shared-requests.repository.ts` y `system-requests.repository.ts`; SPEC §14;
Rules `solicitudes_compartidas/solicitudes_sistemas`; C05/C06.

| Acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Leer compartidas | S/X; A origen/destino/solicitante; P según delegación | Ciclo consultable, sin escritura | canAccessRequest filtra involucrados; custom view no consultado | Cualquier Systems/Academic/bit lee todas | T UI `UI-REQUEST-*` vs `REQUEST-READ-*` F03 |
| Crear compartida/operativa | A involucrada o S/X; datos reales de actor | Captura para compartir, cerrada para pedir reapertura; tipo/origen/destino/programa/motivo | Repo devuelve ID y descarta setDocument; UI éxito prematuro | Solo exige status PENDIENTE y acceso general, admite solicitante ajeno | T `REQUEST-FORGED-OWNER`, `REQUEST-CREATE-AWAITS`, `UI-PREMATURE-SUCCESS` |
| Aprobar compartida | A origen o S/X autorizado | Captura para A; status/respuesta y modificación de base | UI filtra origen, acepta en dos escrituras | Cualquier Academic/Systems/bit actualiza cualquier campo, sin FSM | T `REQUEST-RESOLVE-*`, `REQUEST-DOUBLE-ACCEPT`, `SHARE-PARTIAL-AND-SUCCESS`; C05/C06 |
| Aprobar operativa | S/X autorizado | Efecto ciclo/grupo/asignación según tipo | Método separado; algunas promesas descartadas | Mismo update general de compartidas | Atomicidad con cambio relacionado; R; integración por cada tipo pendiente |
| Rechazar | Mismo responsable de resolver | PENDIENTE; status/respondedBy/At/observations, motivo obligatorio | Modal exige motivo | Update general no exige motivo/actor/transición | F03/F07, R y `REQUEST-TERMINAL-REWRITE`; sonda de rechazo sin motivo pendiente |
| Cancelar | Solicitante/destino o S/X | PENDIENTE; cancelación y actor; A bloqueado fuera de Captura salvo solicitud de reapertura sin modificar datos | canCancelRequest filtra | Update general sin ámbito ni estado | C05 y D1; R, cancelación directa pendiente |
| Eliminar compartida | Nadie en flujo normal | Cualquiera | No operación de borrado normal | Delete false | Conservar traza de solicitud; R |
| Leer solicitud a Sistemas | Solicitante propio y S/X | Cualquier ciclo de consulta | UI agrega filtros | Sistemas o requestedBy==UID | T `SYSTEM-REQUEST-FOREIGN-READ` |
| Crear solicitud a Sistemas | Activo propio | Datos del tipo, motivo y actor | Repo async espera; distinta colección | Comprueba tipo, campos mínimos y actor | C05; no extrapolar defecto de shared repo a éste; R |
| Atender/rechazar solicitud a Sistemas | S/X autorizado | C05; status/observations/respuesta; docente relacionado si aplica | Espera docente y solicitud, por separado | Sistemas, createdAt/requestedBy inmutables; sin FSM | Efecto y resolución conjuntos; R, integración futura |
| Borrar/archivar solicitud a Sistemas | S/X delegado, no A ajeno | Documento/archivado | Repositorio intenta delete y ante cualquier error archiva | Delete Sistemas **o bit solicitudes**, incluso A ajeno | T `SYSTEM-REQUEST-FOREIGN-DELETE` F03; fallback no es recuperación aprobada Etapa 5 |

## Ligas Meet, Moodle y Bitácora

Fuentes: `meet-links/pages/meet-links-page.component.ts`, `moodle/pages/moodle-page.component.ts`,
`audit/pages/audit-log-page.component.ts` y sus repositorios; Rules `ligas_meet`,
`moodle_categorias`, `moodle_plantillas`, `bitacora`, `configuracion`;
Functions `auditAssignment*`, `auditAssignmentAlertsConfiguration`;
SPEC §§15/16/16.1/25.

| Módulo/acción | Perfil y alcance | Ciclo y campos | UI actual | Firestore/Functions actual | Esperado y evidencia |
|---|---|---|---|---|---|
| Meet consultar | S/X; A solo consulta concedida | Operativo, una fila anfitriona para compartidas | canView Sistemas o bit ligasMeet; navegación A puede excluir módulo | Sistemas o bit, no limita ciclo | A nunca editar; compatibilidad menú/acceso concedido pendiente, R |
| Meet crear/editar/revisar/marcar estado/horario | S/X delegado, clase origen institucional | Operativo/postcaptura; liga/estado/horario y metadatos de asignación | canEdit solo nombre Sistemas | Sistemas, forma requerida y updatedBy==UID; bit apagado no impide | Una liga por origen, autorización de módulo efectiva; F01 R, sonda dedicada pendiente |
| Meet eliminar | S/X delegado | Documento de origen | Revisar uso antes de cambio operativo | Delete Sistemas según helper | No romper vínculo; no acción externa ejecutada; R, política de borrado pendiente |
| Moodle categorías/plantillas consultar | S/X autorizado, institucional; A excluido MVP | Global | Panel de catálogos | Sistemas o bit Moodle pueden leer, incluso perfil no Sistemas con bit | Exclusividad §16; P/X según D3; R |
| Moodle categorías/plantillas crear/editar/importar/eliminar | S/X delegado | Global; categoría/programas, plantilla/shortname/tipo/programa y metadatos | canManage exige Sistemas y bit Moodle | Helper Sistemas con bypass por nombre, validaciones de forma/actor | Bit apagado no escritura; referencias y CSV Etapas 4/6; R |
| Moodle previsualizar/exportar lote CSV | S/X delegado, selección institucional | Ciclo operativo; campos CSV y status EN_REVISION | Cliente calcula CSV; sin API de Moodle | Lecturas de catálogo + updates asignaciones; no permiso de exportación independiente | Esperar escritura; formato correcto y selección trazable; C04, pruebas completas Etapa 6 |
| Moodle confirmar cargado / observaciones | S/X delegado | Operativo/postcaptura; status CARGADO_MOODLE, observations | Confirmación manual por lote | Reglas de asignaciones, no prueba externa de carga | No inferir éxito Moodle por descarga; F08, R/T protección identidad |
| Bitácora consultar/filtrar | S/X autorizado, institucional; A excluido | Ciclo/actor/fechas, sin escritura | Pantalla/menú por rol/bit | Sistemas o bit bitacora, incluso no Sistemas con bit | Exclusivo §16.1; R F01, cobertura directa pendiente |
| Bitácora registrar evento cliente | Activo autorizado para operación | source CLIENTE, integrity NO_VERIFICADO, actor/fecha/datos | register invocado desde UI | Activo con forma requerida; no convierte actor enviado en actor confiable | Distinguir no verificado; R, actor/deduplicación Etapa 5 |
| Bitácora evento confiable | Functions, efecto de cambio académico | Datos before/after, actor y fecha de evento | No escritura directa de UI | Admin triggers; reglas impiden evento servidor desde cliente | Actor confiable e idempotencia pendientes; no certificación por usar Admin |
| Bitácora editar/eliminar | Ningún cliente | Todos | Sin edición normal | Update/delete false | Inmutable; R |
| Activar avisos de asignaciones | S/X delegado | Global; enabled, updatedBy/Name/At | Toggle en Bitácora por Sistemas | Sistemas y forma requerida, no bit | Autorización efectiva de acción y auditoría; R |

## Functions, Storage y módulos suspendidos

`syncUserProfileByEmail` es la única callable exportada: autenticación y
sincronización no equivalen a permisos de operación. Usa Admin, por lo que sus
escrituras no se evalúan con Rules; las pruebas comprueban anónimo e inactivo,
pero reparación de referencias/duplicados queda en Etapa 4. Los demás exports
son triggers de auditoría/correo, no APIs de aprobar solicitudes.

Storage deniega toda lectura/escritura según `storage.rules`; prueba original
de carga devuelve `storage/unauthorized`. Horarios no tiene ruta funcional en
MVP (SPEC §17), por lo que no se inventan acciones o permisos. Moodle/Meet
almacenan ligas y exportan archivos; esta etapa no navega ligas reales ni
realiza importaciones externas.

## Cobertura pendiente explícita

La matriz cubre módulos/acciones identificados; no todas las filas son tests.
Faltan smoke de DOM/navegación de cada perfil, transiciones integradas por cada
tipo de solicitud, cancelación/rechazo concurrente en Firestore, borrados por
estado/referencias, exportaciones CSV completas, agenda privada cruzada,
plantillas retiradas, flags ausentes frente a false y política de delegación.
No convertir lectura de código (R) en “prueba aprobada”. Ver el
[registro de pruebas](ETAPA-1-PRUEBAS.md) para los resultados ejecutados.
