# SPAI-TUP — Seguimiento de estabilizacion

## Alcance y punto de partida

- Fecha de intervencion: 2026-09-11, zona institucional America/Cancun.
- Repositorio de trabajo: `victoryama-wq/SPAI-TUP`.
- Rama: `codex/etapa-0-entorno-local`.
- `git fetch origin` confirmo que HEAD y origin/main siguen en
  `6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2` antes de los cambios.
- Arbol inicial limpio; no se encontraron archivos AGENTS.md aplicables.
- Autorizada en esta intervencion: **solo etapa 0**. Sin despliegues, fusiones
  con main, migraciones reales ni ampliaciones de permisos.
- Referencia funcional: `SPAI-TUP-SPEC-v2.md`. Sus contradicciones se conservan
  como pendientes; no se interpretan como autorizacion para cambiar contratos.

## Etapas

| Etapa | Alcance | Estado |
|---|---|---|
| 0 | Entorno seguro de pruebas | Completada y verificada localmente |
| 1 | Contratos funcionales, matriz por accion/campo, pruebas base y CI | Pendiente de autorizacion |
| 2 | Permisos Firestore y Functions; compatibilidad de perfiles existentes | Pendiente |
| 3 | Ciclos, solicitudes, atomicidad y estado Moodle | Pendiente |
| 4 | Integridad, referencias y migraciones repetibles | Pendiente |
| 5 | Actor confiable, borrados, deduplicacion, avisos y reintentos | Pendiente |
| 6 | CSV y trazabilidad de lotes Moodle | Pendiente |
| 7 | Dependencias, vulnerabilidades, estructura y consultas | Pendiente |
| 8 | Pruebas completas, piloto, recuperacion y publicacion autorizada | Pendiente |

## Revalidacion del analisis previo

Confirmada contra los archivos actuales antes de modificar. No se han consultado
ni probado las reglas desplegadas o datos reales. Los problemas funcionales
siguientes permanecen deliberadamente sin corregir.

| Hallazgo | Evidencia actual | Etapa |
|---|---|---|
| Privilegios por nombre de rol y permisos amplios | `firestore.rules`: `isSystemsMember`, `canEditCycles`, `canUpdateOwnPendingTeacher`, `solicitudes_compartidas` | 2 |
| Estado del ciclo sin proteccion de escritura; multiples ciclos operativos | Reglas de `asignaciones`; `CyclesRepository.activeCycle/startCapture` | 3 |
| Solicitudes que descartan promesas y actualizaciones separadas | `SharedRequestsRepository.createRequest/resolveRequest`, `RequestsPageComponent.acceptRequest` | 3 |
| Compartir fuerza EN_CAPTURA | `RequestsPageComponent.acceptRequest`, payload de `upsertAssignment` | 3 |
| Migracion borra usuarios sin reparar referencias de docentes | `functions/index.js`: `syncUserProfileByEmail`; `TeachersPageComponent.resolveTeacherCoordinators` | 4 |
| Autor de bitacora tomado del cliente; borrado ignora actor; eventos repetibles | `writeTrustedAssignmentAudit`, `AssignmentsRepository.deleteAssignment` | 5 |
| Desarrollo y produccion apuntaban a spai-6ef68 | Ambos environment y .firebaserc originales; aislado en esta etapa | 0 |
| usageCount no mantenido | `NomenclaturesRepository`: inicializa a 0 y comprueba al borrar; no se encuentra actualizacion | 4 |
| Avisos academicos limitados antes de ordenar | `SystemNotificationsRepository`: `limit(25)` sin orderBy de fecha | 5 |
| CSV Moodle separa lineas antes de resolver comillas | `MoodlePageComponent.parseCsv` | 6 |
| Ausencia de suite funcional y CI | Sin tests funcionales ni workflow inicial; se agregan solo pruebas del entorno | 1 |
| Dependencias y consultas pendientes de mantenimiento | Rangos funcionales conservados; repositorios completos en memoria y componentes grandes | 7 |

Las 31 alertas del audit anterior corresponden al 2026-09-10 y al arbol de
dependencias anterior. No se presentan como medicion actual tras incorporar
Firebase CLI. No se ejecuto `npm audit fix` ni una actualizacion funcional general.

## Decisiones de etapa 0

- Proyecto unico de pruebas `demo-spai-tup`, endpoints de loopback y SDKs
  conectados antes de su uso. No hay fallback a configuracion de produccion.
- `npm start` y Angular local/development son DEMO. Produccion sigue usando su
  environment y su index originales. `.firebaserc` requiere seleccionar
  explicitamente `production` para futuras operaciones reales.
- Se conserva Google OAuth en produccion; local usa cinco cuentas password
  ficticias, sin cambiar roles ni reglas. No se inventan identificadores de rol.
- Se conservan las reglas de Storage cerradas y se comprueba el rechazo local.
- Correos simulados antes de destinatarios/secretos/SMTP. Se aísla ADC y la
  configuracion de CLI heredada por los procesos locales.
- Fixtures deterministas (5 cuentas, 39 documentos base) y restablecimiento por
  reinicio de los procesos propios, sin lectura/copias de produccion.
- Se agrega solo Firebase CLI como herramienta del entorno; se fija el lockfile
  de Functions porque los emuladores necesitan instalar ese backend.
- Los scripts de migracion reales quedan fuera del procedimiento local.
- Cierre de captura para coordinaciones y operaciones permitidas a Sistemas
  siguen pendientes de definicion por **accion y campo** en etapa 1. No se
  cambiaron permisos para lograr que pasara una prueba.

## Evidencia y limites de verificacion

- Node 22.23.2, Java Microsoft OpenJDK 25.0.2, Firebase CLI 15.30.0.
- Instalacion reproducible con ambos lockfiles mediante `npm ci --ignore-scripts
  --no-audit --no-fund` (raiz y Functions): paso. En este equipo se utilizo
  explicitamente Node 22; el Node predeterminado del equipo es 24.
- Cinco pruebas de configuracion pasaron: rechazo de proyectos/hosts invalidos,
  Functions sin endpoints completos, coherencia de configuraciones, fixtures
  deterministas y correo que no puede acceder a SMTP ni a valores de secretos.
- Escritura autenticada mediante el mismo inicializador de SDKs de la app,
  lectura desde servidor y verificacion REST independiente del emulador: paso.
- Callable `syncUserProfileByEmail` con contexto autenticado local: paso.
- Storage rechazado con `storage/unauthorized`, sin cambiar reglas: paso.
- Trigger de notificaciones ejecutado en Functions: `SIMULADO_LOCAL`, cero
  destinatarios; cinco cuentas autentican y leen sus perfiles: paso.
- Carga repetida de fixtures sin colisiones de UID: paso.
- Emuladores apagados: cuatro SDKs fallan o no confirman; en la primera corrida
  se observaron siete intentos de socket, todos en loopback, sin fallback: paso.
- Build local y build de produccion pasaron. Produccion aviso 762.39 kB frente
  al umbral de advertencia de 750 kB; no se incremento el presupuesto permitido.
- Comprobacion sintactica de Functions: paso.
- Prueba automatizada del restablecimiento: paso; se eliminaron un documento
  adicional y una cuenta adicional, y se restauraron los fixtures originales.
- Acceso desde navegador local: paso; banner DEMO LOCAL, selector ficticio y
  dashboard de Sistemas DEMO con 4 usuarios activos, 4 ciclos y ciclo activo 27-1.
  Se observo el cierre inicial de sesion preexistente; el segundo ingreso funciono.
- Las cinco comprobaciones unitarias se repitieron despues de `npm ci`: pasaron.

## Archivos de esta etapa

| Proposito | Archivos modificados o nuevos |
|---|---|
| Instalacion y comandos | `.nvmrc`, `package.json`, `package-lock.json`, `functions/package-lock.json`, `.gitignore` |
| Configuracion local | `.firebaserc`, `firebase.local.json`, `angular.json`, `tsconfig.json`, `src/index.local.html`, `src/environments/environment.ts`, `src/environments/environment.prod.ts`, `src/environments/local-emulators.json`, `src/environments/local-accounts.json` |
| SDKs y acceso DEMO | `src/app/core/firebase/firebase.runtime.ts`, `src/app/core/firebase/firebase.tokens.ts`, `src/app/core/auth/auth.service.ts`, `src/app/core/auth/user-session.service.ts`, `src/app/features/auth/pages/login-page/login-page.component.ts`, `src/app/features/auth/pages/login-page/login-page.component.html` |
| Functions aisladas y correo simulado | `functions/index.js`, `functions/local-runtime.js` |
| Supervisor y datos ficticios | `tools/local/config.mjs`, `tools/local/control.mjs`, `tools/local/run.mjs`, `tools/local/seed.mjs`, `tools/local/fixtures.mjs` |
| Pruebas del entorno | `tools/local/tests/config.test.mjs`, `tools/local/tests/integration.mjs`, `tools/local/tests/reset.mjs`, `tools/local/tests/offline.mjs`, `tools/local/tests/runtime.mjs`, `tools/local/tests/network-guard.mjs` |
| Instrucciones y seguimiento | `README.md`, `docs/ENTORNO-LOCAL.md`, `docs/ESTABILIZACION.md` |

`firestore.rules`, `storage.rules`, `firebase.json` y los rangos de dependencias
de `functions/package.json` no cambiaron. Tampoco se modificaron las reglas
academicas de las etapas siguientes.

## Incidencias y pendientes

Incidencias resueltas durante la preparacion: la compilacion requirio salir del
sandbox de lectura por limitaciones de acceso del compilador a directorios; el
CLI necesitaba descargar Firestore Emulator 1.22.0. Se aumento a 30 s el limite
local de descubrimiento de Functions. Se detectaron credenciales ADC del equipo
y se aislaron. Una credencial personalizada provisional resulto incompatible
con Admin Firestore y fue retirada antes de las pruebas integradas exitosas.

Avisos no bloqueantes: Storage imprime deprecaciones Java y Firebase CLI avisa
que firebase-functions 6 es una version anterior. Su mantenimiento corresponde
a etapa 7. No hay evidencia aqui de despliegue, smoke de usuarios reales ni
recuperacion de backups de produccion.

## Continuidad

Consultar [ENTORNO-LOCAL.md](ENTORNO-LOCAL.md) para comandos y credenciales
ficticias. La siguiente intervencion propuesta es etapa 1, previa indicacion
del propietario. Preparar contratos por rol/coordinacion, accion, campo y
estado del ciclo, con compatibilidad de perfiles existentes; despues pruebas
de reproduccion y GitHub CI. No iniciar permisos ni migraciones en esa fase.

## Ampliacion autorizada — copia BD para DEMO (2026-09-11)

El propietario solicito trabajar con los datos de la BD online conservando el
inicio de sesion DEMO. Esta autorizacion sustituye la restriccion inicial de
usar exclusivamente fixtures en su entorno local. Las etapas 1 a 8 siguen
pendientes, sin cambios de permisos, estados ni escrituras online.

**Estado: completada.** Se leyeron 6.109 documentos de 17 colecciones con un
instante `readTime` comun; se revisaron subcolecciones y padres ausentes. La
copia original, SHA-256, seleccion y mapeos se guardan exclusivamente en
`.local/`, ignorada por Git. Ver [COPIA-BD-DEMO.md](COPIA-BD-DEMO.md).

Cuatro accesos DEMO usan los IDs de perfiles originales, conservando nombre,
rol, permisos, programas y referencias. Solo `email` y `authUid` cambian en esos
perfiles locales. El inactivo DEMO es ficticio y adicional: total 6.110 documentos.
La importacion suspende triggers de fondo para no alterar avisos ni bitacora;
despues se reactivan con el correo simulado existente. El reinicio carga la copia
seleccionada sin consultar produccion. La suite del entorno conserva fixtures
propios independientemente de esa seleccion.

Incidencias resueltas: se corrigio la codificacion del sufijo REST de listado de
colecciones antes de obtener el archivo completo. El primer intento de carga
local se detuvo al detectar un perfil creado por una sesion persistida de otra
pestana. Se cerro esa sesion y se agrego un control exclusivo de DEMO para que
el navegador espere perfiles del supervisor en vez de crearlos durante el
restablecimiento. No cambia el registro de usuarios de produccion.

Verificacion observada:

- Ocho pruebas unitarias: aprobadas, incluidas preservacion de IDs y valores,
  conversion de referencias al destino local, rechazo de origen/rutas
  incompatibles y precision de enteros y timestamps.
- Suite integrada original: aprobada con fixtures; incluye correo simulado,
  callable, Storage cerrado, restablecimiento y fallo de los cuatro SDK sin
  conexion alternativa al apagar emuladores.
- Comparacion exhaustiva de 6.110 documentos importados: aprobada en la carga
  inicial exitosa y nuevamente tras restablecer la copia.
- Cinco accesos DEMO y lectura autenticada de colecciones copiadas: aprobados
  antes y despues del restablecimiento; sockets observados solo en loopback.
- Restablecimiento con una sesion de navegador abierta: aprobado, eliminando
  ademas un documento y una cuenta de prueba y recuperando la copia seleccionada.
- Navegador: dashboard con perfil original de Sistemas, 16 usuarios activos,
  un ciclo y dos roles personalizados, mediante acceso DEMO.
- Build local aprobado; build de produccion aprobado tras el control de sesion,
  con advertencia de tamano de 762.42 kB frente a 750 kB (pendiente de etapa 7).
- Copia, manifiestos y mapeos excluidos de Git; no se exporto Authentication ni
  Storage ni se realizaron escrituras en Firestore online.

Archivos de la ampliacion: `.gitignore`, `README.md`, `package.json`,
`src/index.local.html`, `src/app/core/auth/user-session.service.ts`,
`tools/local/run.mjs`, `tools/local/seed.mjs`, `tools/local/export-source.mjs`,
`tools/local/import-snapshot.mjs`, `tools/local/select-data.mjs`,
`tools/local/snapshot.mjs`, `tools/local/tests/reset.mjs`,
`tools/local/tests/snapshot.test.mjs`, `tools/local/tests/verify-copy.mjs`,
`docs/ENTORNO-LOCAL.md`, `docs/COPIA-BD-DEMO.md` y este seguimiento.

Esta es una copia estatica para desarrollo, no sincronizacion continua ni un
respaldo administrado de recuperacion. Las fechas y datos academicos originales
se conservan con sus inconsistencias. Los datos reales no se anonimizan por la
instruccion recibida; no deben incorporarse al repositorio ni a un deploy.
