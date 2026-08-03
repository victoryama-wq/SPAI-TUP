# SPAI TUP - Especificacion del Proyecto v2

Fecha: 2026-05-27  
Ultima actualizacion: 2026-06-20
Proyecto: **Sistema de Planeación Académica Institucional TUP**  
Nombre corto: **SPAI TUP**

## 1. Resumen ejecutivo

SPAI TUP sera una plataforma web institucional para administrar la planeación académica por ciclo. Permitira que las coordinaciones académicas asignen materias, docentes y grupos desde un panel propio, mientras que Coordinación de Sistemas podra administrar ciclos, usuarios, grupos, docentes, asignaturas, importaciones CSV, clases compartidas, ligas Meet para grupos virtuales y exportaciones futuras para Moodle.

La primera version se enfocara en planeacion academica base y procesos operativos de Sistemas. El modulo de horarios queda suspendido para el MVP y se considera fase futura.

### Estado funcional actual al 20 de junio de 2026

SPAI TUP ya cuenta con una base Angular/Firebase funcional para pruebas operativas reales en entorno local y preparacion de despliegue en Firebase Hosting.

Modulos implementados o en integracion funcional:

- Login institucional con Google/Firebase Authentication y restriccion de dominio `@tecplayacar.edu.mx`.
- Dashboard por rol con ciclo activo, tarjetas reales de Firestore, bienvenida institucional y accesos por modulo.
- Usuarios y roles con alta, edicion, activacion/inactivacion, permisos por modulo y roles personalizados.
- Ciclos con creacion, activacion de captura, cierre, reapertura, eliminacion de ciclos de preparacion y ciclo activo global.
- Nomenclaturas con alta manual, carga CSV, edicion, inhabilitacion, eliminacion permitida, asignacion de coordinador responsable, sincronizacion con programas asignados y paginacion.
- Grupos con carga CSV, alta individual por Sistemas, ciclo activo integrado en alta individual, actualizacion masiva por CSV, busqueda, filtro por ciclo, paginacion, eliminacion individual y eliminacion de grupos por ciclo seleccionado.
- Docentes con catalogo global, alta manual, correo derivado del usuario Moodle, carga CSV, asignacion a una o varias coordinaciones, validacion por Sistemas, inactivacion y eliminacion de docentes inactivos.
- Asignaturas con catalogo global, carga CSV y consulta operativa.
- Asignaciones academicas con captura por ciclo activo, busqueda predictiva por programa/grupo/docente/asignatura, separacion por modalidad/area, docente temporal y soporte visual de clase compartida.
- Solicitudes a Sistemas desde dashboard para Coordinacion Academica y bandeja de seguimiento para Sistemas.
- Notificaciones por campana para Sistemas y Coordinacion Academica segun flujo operativo.
- Bitacora base para registrar acciones relevantes.

Pendiente o fase posterior:

- Ligas Meet operativas completas.
- Moodle/exportaciones finales por lotes.
- Horarios.
- Matriculas adicionales como modulo independiente.
- Pruebas completas con datos reales de ciclo activo antes de despliegue.

## 2. Objetivo general

Crear una plataforma centralizada, formal e intuitiva para gestionar la planeación académica institucional por ciclo, reduciendo el uso de hojas sueltas, evitando duplicidades y mejorando la trazabilidad de la informacion.

## 3. Problemas actuales

- La informacion se captura en plantillas separadas.
- Sistemas debe revisar manualmente materias, docentes, grupos y observaciones.
- Puede haber docentes duplicados.
- Las clases compartidas se manejan de forma informal.
- Las clases virtuales pueden revisarse varias veces cuando se comparten.
- Los ciclos anteriores pueden mezclarse con el ciclo nuevo.
- La preparacion para Moodle requiere transformar datos manualmente.

## 4. Decision tecnica recomendada

Stack recomendado:

```text
Angular + TypeScript + Firebase
```

### Aclaracion sobre Node.js

SPAI TUP no usara Node.js como backend ni como servidor en produccion.

Node.js se usara solo como herramienta local de desarrollo para:

- Crear el proyecto Angular.
- Instalar dependencias.
- Ejecutar el servidor local de desarrollo.
- Compilar la aplicacion.
- Publicar en Firebase Hosting.

El sistema final operara en Firebase:

```text
Angular compilado -> Firebase Hosting
OAuth2 con Google / Firebase Authentication -> Login
Cloud Firestore -> Base de datos
Cloud Storage -> Archivos CSV y exportaciones
Cloud Functions -> Procesos futuros
```

### Tecnologias

Frontend:

- Angular
- TypeScript
- Angular Router
- Angular Signals
- Reactive Forms
- Angular Material
- Tailwind CSS

Firebase:

- Firebase Authentication
- OAuth2 con Google como modo de autenticacion
- Cloud Firestore
- Cloud Storage
- Firebase Hosting
- Firebase Security Rules
- Firebase Emulator Suite
- Cloud Functions for Firebase, fase futura

### Autenticacion

El modo de autenticacion sera **OAuth2 con Google**.

Reglas:

- El login institucional se hara mediante Google como proveedor OAuth2.
- Firebase Authentication se usara para gestionar sesion, UID del usuario y tokens de autenticacion cuando se configure el proveedor.
- Firebase Authentication debera configurar Google como proveedor de inicio de sesion.
- El documento `usuarios/{id_usuario}` en Firestore debe enlazarse con el `auth_uid` emitido por Firebase Authentication.
- Los permisos visibles en la interfaz no deben depender solo del frontend; deben reforzarse con Firebase Security Rules.
- El dominio institucional permitido para usuarios del sistema es `@tecplayacar.edu.mx`.
- El acceso debe restringirse a cuentas Google con correo institucional autorizado.
- El proveedor Google debe enviar la sugerencia de dominio institucional mediante `hd: tecplayacar.edu.mx`.
- Si el correo autenticado no termina en `@tecplayacar.edu.mx`, la aplicacion debe cerrar sesion y negar el acceso.
- La sesion autenticada debe cerrarse automaticamente despues de 45 minutos de inactividad para forzar una carga limpia del sistema en el siguiente ingreso.

### Estado implementado de Firebase backend base

- La base Angular ya inicializa Firebase desde `src/environments/environment.ts` y `src/environments/environment.prod.ts`.
- La configuracion real del proyecto Firebase ya fue integrada para el proyecto `spai-tup-2f261`.
- La aplicacion usa Firebase SDK modular directamente y Cloud Functions puntuales para procesos que requieren privilegios de servidor.
- `app.config.ts` registra providers para Firebase App, Firebase Authentication y Cloud Firestore.
- `AuthService` gestiona inicio de sesion con Google mediante popup, persistencia local, sugerencia de dominio institucional y cierre de sesion.
- `UserSessionService` observa la sesion autenticada y busca primero el documento exacto por UID; si no existe, busca por correo institucional y prioriza documentos activos.
- Si un usuario activo fue creado con ID automatico antes de tener UID de Firebase Auth, SPAI debe migrarlo a `usuarios/{auth.uid}` mediante Cloud Functions, copiando `role`, `access`, `assignedPrograms`, `status` y datos institucionales desde el perfil activo.
- La sincronizacion por correo no debe permitir que el cliente se autoasigne permisos desde el frontend; debe ejecutarse en servidor con validacion de dominio `@tecplayacar.edu.mx`.
- Si una cuenta Google entra sin usuario activo, se crea un documento bootstrap inactivo en `usuarios`.
- Si Sistemas creo antes el usuario por correo, el primer inicio de sesion con Google migra el perfil existente al documento por UID que requieren las reglas de Firestore.
- No deben conservarse perfiles espejo ni documentos duplicados para el mismo correo institucional. La fuente operativa debe ser un solo documento canonico en `usuarios/{auth.uid}`. Antes de eliminar duplicados historicos, SPAI debe actualizar referencias internas que apunten al ID anterior, por ejemplo `docentes.assignedCoordinatorIds`, sin modificar asignaciones academicas.
- La interfaz puede deduplicar usuarios como defensa visual, pero no debe depender de duplicados persistidos para permisos ni escritura.
- La sesion activa de producto depende del documento Firestore en `usuarios`, no solamente del `displayName` de Google.
- Firebase Hosting queda preparado con `firebase.json`, salida `dist/spai-tup-angular/browser` y rewrite a `index.html`.
- Cloud Functions for Firebase queda implementado para notificaciones por correo y sincronizacion segura de perfiles por UID.
- Cloud Storage queda declarado para fase CSV, pero con reglas iniciales cerradas hasta implementar flujos de archivos.
- Firestore indexes queda preparado con `firestore.indexes.json` inicialmente vacio.

### Reglas de seguridad implementadas

- `firestore.rules` permite lectura de `usuarios` a usuarios autenticados cuando pueden administrar usuarios, cuando consultan su propio documento por `authUid`, cuando coincide su correo institucional o cuando consultan su documento bootstrap por UID.
- La creacion de usuarios la puede hacer Coordinacion de Sistemas activo, un usuario activo con `access.usuarios == true`, o el propio usuario autenticado para crear su documento bootstrap inactivo.
- La actualizacion y eliminacion de usuarios queda permitida a Coordinacion de Sistemas activo o usuarios autorizados con `access.usuarios == true`, salvo el enlace inicial de `authUid` por correo institucional coincidente.
- El permiso operativo `access.usuarios == true` permite que Auxiliar de Sistemas trabaje el modulo Usuarios cuando Coordinacion de Sistemas se lo habilita.
- `roles_personalizados` permite lectura a usuarios autenticados y escritura a Coordinacion de Sistemas activo o usuarios autorizados con `access.usuarios == true`.
- `ciclos` permite lectura a usuarios autenticados y escritura solo a Coordinacion de Sistemas activo.
- `programas` permite lectura a usuarios autenticados y escritura solo a Coordinacion de Sistemas activo.
- `nomenclaturas_programas` permite lectura a usuarios autenticados y escritura solo a Coordinacion de Sistemas activo.
- `grupos` permite lectura a usuarios autenticados y escritura solo a Coordinacion de Sistemas activo.
- `docentes` permite lectura a usuarios autenticados segun permisos del modulo, docentes validados o Coordinacion Academica; la escritura queda para Sistemas, auxiliares autorizados o altas manuales pendientes de Coordinacion Academica.
- `asignaturas` permite lectura de asignaturas activas a usuarios autenticados y escritura solo a Sistemas o auxiliares autorizados.
- `asignaciones` permite lectura a usuarios con correo institucional para que Firestore entregue el catalogo requerido por la vista; la interfaz limita a Coordinacion Academica a **Mis asignaciones** por defecto y permite alternar a **Catalogo global** para consultar las demas asignaciones. La escritura, edicion y borrado respetan programas asignados, incluyendo clases compartidas donde el programa participa como grupo base o grupo compartido.
- `solicitudes_compartidas` permite lectura a usuarios con acceso al modulo y controla creacion/respuesta/cancelacion segun programa y rol.
- `solicitudes_sistemas` permite que usuarios activos creen solicitudes operativas dirigidas a Sistemas para reabrir captura, alta de grupo, cambio de ID de asignatura o validacion de docente nuevo; Sistemas puede leer, actualizar y eliminar solicitudes segun permisos publicados.
- `notificaciones` permite lectura a miembros activos de Sistemas y a Coordinacion Academica cuando la notificacion esta dirigida a su `authUid`; permite crear avisos hacia Sistemas desde flujos autorizados y avisos hacia Coordinacion Academica cuando Sistemas responde o activa un docente.
- `bitacora` permite lectura a Sistemas o usuarios con acceso a bitacora; la creacion queda abierta a usuarios autenticados para registrar acciones del sistema.
- Cualquier otra coleccion Firestore queda cerrada por defecto.
- `storage.rules` mantiene Cloud Storage cerrado por defecto hasta desarrollar importacion/exportacion CSV.

## 5. Principios de producto

SPAI TUP debe sentirse:

- Formal.
- Rapido.
- Intuitivo.
- Ordenado por modulos.
- Claro para coordinadores.
- Potente para Sistemas.

Direccion visual recomendada:

```text
Operativa moderna con toque institucional.
```

Lineamientos:

- Sidebar limpio.
- Encabezado con ciclo activo y usuario.
- Tablas como elemento principal.
- Chips de estado.
- Filtros visibles.
- Acciones principales claras.
- Formularios cortos.
- Validaciones antes de guardar.

### Decisiones visuales implementadas en la base Angular

- El layout usa encabezado institucional superior con el logo completo TUP.
- El titulo institucional debe mostrarse como **Sistema de Planeación Académica Institucional**.
- El titulo institucional usa tipografia **Arvo**.
- La navegacion principal usa una barra superior institucional con modulos centrados.
- La cinta del navbar se mantiene centrada.
- La cuenta de usuario se muestra en la parte derecha con campana de notificaciones y avatar circular con iniciales.
- El texto del panel del modulo debe indicar el panel operativo, por ejemplo: **Panel de Coordinación de Sistemas**.
- Los titulos de paneles deben mantener tamaño consistente con el encabezado institucional.
- El dashboard debe incluir un panel de bienvenida personalizado debajo del nombre del panel operativo.
- El panel de bienvenida debe tomar el nombre y rol desde el documento activo del usuario en Firestore.
- El saludo institucional del dashboard debe usar `Bienvenida` o `Bienvenido` segun el campo `greetingGender` del usuario.
- El modulo Usuarios debe permitir definir el saludo del usuario con selector simple:
  - `Femenino` -> `Bienvenida`.
  - `Masculino` -> `Bienvenido`.
- Si el usuario no tiene `greetingGender`, el dashboard puede inferir temporalmente el saludo desde el primer nombre; al editar el usuario, Sistemas debe poder corregirlo.
- No se usa `Bienvenid@` ni formato `a/o` en el dashboard.
- Ejemplos de bienvenida:

```text
Bienvenido Auxiliar de Sistemas Juan Perez
Bienvenida Coordinacion de Sistemas Maria Torres
Bienvenida Coordinacion Academica Ana Lopez
```

- El panel de bienvenida debe conectarse a Firebase Authentication y al documento del usuario en Firestore cuando exista persistencia.
- El panel muestra como metadatos de sesion el rol operativo y el ultimo acceso.
- Si no existe usuario activo en Firestore, el dashboard no debe mostrar nombres demo ni `displayName` de Google; debe mostrar un estado institucional neutro.
- El dashboard contempla metricas conectadas a Firestore: **Usuarios activos**, **Ciclos registrados**, **Ciclo activo** y **Roles personalizados**.
- El dashboard ya no debe mostrar tarjetas demo de avance de modulos ni tarjetas tecnicas como estado Firebase.
- El dashboard debe mostrar un bloque de registros reales: usuarios registrados, nomenclaturas, grupos del ciclo activo, docentes, asignaturas, asignaciones del ciclo y solicitudes pendientes.
- Los conteos del dashboard deben salir de colecciones Firestore reales; si no hay datos, se muestra cero o estado vacio, nunca avances inventados.
- Para Coordinacion Academica, el dashboard debe adaptar sus tarjetas superiores: **Docentes registrados**, **Ciclos registrados**, **Ciclo activo** y **Programas asignados**.
- Para Coordinacion Academica, el conteo de programas asignados debe considerar tanto `usuarios.assignedPrograms` como los programas donde `programas.coordinator` coincida con el usuario activo.
- Para Coordinacion Academica, el dashboard muestra una tarjeta-boton compacta **Solicitudes a Sistemas** ubicada en el bloque superior junto a las tarjetas de conteo.
- La tarjeta **Solicitudes a Sistemas** abre una vista modal con acciones rapidas: reabrir captura, alta de grupo y cambio de ID de asignatura.
- Para Coordinacion Academica, el modulo grande `/solicitudes` no aparece en la navegacion; las solicitudes operativas hacia Sistemas se crean desde el dashboard para evitar una pantalla innecesaria.
- La ruta `/usuarios` corresponde al modulo **Usuarios y roles**.
- El login institucional debe tener una pantalla propia, con identidad TUP, mascota institucional, boton Google con icono a color y texto: **Accede con tu correo institucional @tecplayacar.edu.mx**.
- El encabezado y navbar del sistema deben permanecer fijos; solo el contenido operativo debe desplazarse al hacer scroll.
- El encabezado institucional puede ocultarse mediante un boton tipo menu ubicado en la zona del navbar; cuando se oculta, el navbar conserva identidad institucional compacta con logo mini y texto SPAI.
- El menu de perfil debe incluir la accion **Salir del sistema** dentro del desplegable.
- La campana de notificaciones debe mostrarse en el encabezado; para Coordinacion Academica puede permanecer sin notificaciones hasta que se definan sus avisos.
- La campana de notificaciones ya muestra avisos operativos para Sistemas; en solicitudes a Sistemas puede generar avisos directamente desde `solicitudes_sistemas` para no depender de una coleccion auxiliar de notificaciones.
- Las acciones que requieren confirmacion no deben usar `confirm()` ni `alert()` del navegador. SPAI TUP usa un modal institucional propio para confirmar eliminaciones, cierres, reaperturas y avisos operativos.
- El modal institucional de confirmacion debe mantener estilo formal: fondo claro, borde azul, boton de cierre, acciones claras y variante de peligro para eliminaciones.

Modulos en navegacion:

```text
Dashboard
Usuarios
Ciclos
Nomenclaturas
Grupos
Docentes
Asignaturas
Asignaciones
Solicitudes
Ligas Meet
Moodle
Bitacora
```

## 6. Usuarios, roles y accesos

El modulo **Usuarios y roles** sera administrado por Coordinación de Sistemas.

Funciones del modulo:

- Ver tabla de usuarios registrados.
- Crear nuevo usuario mediante modal.
- Editar usuarios existentes mediante el mismo modal.
- Activar o inactivar usuarios.
- Eliminar acceso de un usuario.
- Definir rol del usuario.
- Definir accesos por modulo cuando el usuario sea Auxiliar de Sistemas.
- Permitir que Auxiliar de Sistemas administre usuarios si Coordinacion de Sistemas le habilita `access.usuarios`.
- Administrar roles personalizados desde el panel de Coordinación de Sistemas.
- Definir por rol si cada modulo queda sin acceso, solo consulta o consulta y edicion.
- Preparar la estructura para OAuth2 con Google, Firebase Authentication y Cloud Firestore.
- El titulo visible de la pantalla debe ser **Control de accesos**, sin repetir SPAI TUP porque el encabezado global ya identifica el sistema.
- Las tarjetas resumen deben mostrar informacion operativa para el usuario, por ejemplo usuarios registrados, usuarios activos, coordinadores y roles disponibles.
- Los nombres tecnicos de colecciones Firestore, como `users`, no deben mostrarse como tarjetas de la interfaz.
- Si Firebase niega lectura o escritura, el modulo debe mostrar un mensaje claro de permisos insuficientes para facilitar diagnostico.
- Los usuarios deben cargarse al regresar al modulo usando suscripciones Firestore, sin depender de datos demo ni memoria local.

Roles personalizados:

- La administracion de roles personalizados debe estar oculta inicialmente en un boton **Agregar rol**.
- Al hacer clic en **Agregar rol**, el sistema debe abrir una vista modal.
- El modal debe pedir el nombre del nuevo rol.
- El modal debe mostrar a que modulos se le puede dar acceso.
- Para cada modulo se debe seleccionar uno de estos niveles:

```text
Sin acceso
Solo consulta
Consulta y edicion
```

- El modal no debe listar los roles base existentes.
- Los roles base actuales deben permanecer protegidos.
- Los roles personalizados se guardaran en Firestore cuando se conecte persistencia.
- Estado implementado: los roles personalizados ya se guardan en la coleccion `roles_personalizados`.
- La implementacion actual usa niveles tecnicos `none`, `view` y `edit` para representar sin acceso, solo consulta y consulta con edicion.

Reglas de correo institucional:

- El formulario pedira solo el usuario del correo.
- El dominio `@tecplayacar.edu.mx` se mostrara fijo en la plantilla del campo.
- Al guardar, el sistema construira el correo completo.
- Ejemplo: si se captura `juan.perez`, el sistema guardara `juan.perez@tecplayacar.edu.mx`.
- Solo se permiten letras, numeros, punto, guion y guion bajo en el usuario del correo.
- Estado implementado: usuarios y accesos se guardan en la coleccion `usuarios`; no existe aun una coleccion separada `usuarios_permisos`.
- Los permisos por modulo se guardan embebidos en el documento del usuario como `access`.
- El formulario de usuario incluye el campo **Saludo** para guardar `greetingGender` con valores `Femenino` o `Masculino`.
- Este campo controla el texto del panel de bienvenida del dashboard: `Bienvenida` o `Bienvenido`.
- En Crear usuario, el selector de programas asignados se alimenta de nomenclaturas activas; no debe mostrar programas huerfanos que ya no existan en el panel de Nomenclaturas.
- Si todas las nomenclaturas activas ya estan asignadas a Coordinacion Academica, debe mostrar el mensaje **Nomenclaturas totales asignadas** en lugar de listar opciones ocupadas.

Estados de usuario:

```text
Activo
Inactivo
```

### Coordinación de Sistemas

Rol administrador principal y operativo.

Puede:

- Administrar usuarios.
- Crear accesos.
- Editar accesos.
- Activar o inactivar usuarios.
- Eliminar accesos.
- Definir permisos de Auxiliar de Sistemas por modulo.
- Administrar ciclos.
- Renovar ciclo academico.
- Administrar nomenclaturas y equivalencias de programas.
- Importar grupos por CSV.
- Importar docentes por CSV.
- Importar asignaturas por CSV de forma incremental.
- Validar docentes.
- Ver todos los programas y grupos.
- Ver todas las asignaciones.
- Revisar clases compartidas.
- Administrar ligas Meet de grupos virtuales.
- Validar informacion para Moodle.
- Consultar bitacora.

Accesos por defecto:

```text
Acceso total a todos los modulos.
```

### Auxiliar de Sistemas

Rol operativo de apoyo para Coordinación de Sistemas.

Reglas:

- Pertenece al area de Sistemas.
- Puede iniciar con acceso administrativo.
- Coordinación de Sistemas puede quitar o dejar privilegios por modulo.
- Sus accesos deben guardarse como matriz de permisos por modulo.
- No puede modificar sus propios privilegios si esa restriccion se implementa en Firebase Security Rules.

Accesos configurables:

```text
Dashboard
Usuarios
Ciclos
Nomenclaturas
Grupos
Docentes
Asignaturas
Asignaciones
Solicitudes
Ligas Meet
Moodle
Bitacora
```

Niveles de permiso por modulo:

```text
Sin acceso
Solo consulta
Consulta y edicion
```

### Coordinación Académica

Rol de captura academica.

Puede:

- Ver sus programas asignados.
- Ver grupos del ciclo activo.
- Seleccionar materias del catalogo global.
- Consultar Nomenclaturas, Grupos, Docentes, Asignaturas y Asignaciones como modulos academicos base por rol, aunque existan usuarios creados con banderas de acceso heredadas incompletas.
- Asignar materias a grupos.
- Capturar ID asignatura por asignacion.
- Asignar docentes.
- Agregar docentes manualmente si tienen usuario Moodle.
- Agregar matriculas adicionales.
- Solicitar clases compartidas.
- Responder solicitudes recibidas.
- Consultar asignaciones del ciclo anterior en modo solo lectura.

No tiene acceso a:

```text
Moodle
Bitacora
```

Acceso especial:

- Puede solicitar a Coordinación de Sistemas acceso de consulta a Ligas Meet.
- Mientras Coordinación de Sistemas no autorice esa consulta, Coordinación Académica no vera el modulo Ligas Meet.
- Si se autoriza, el acceso a Ligas Meet sera solo de consulta.
- Coordinación Académica nunca tendra acceso a Moodle ni Bitacora.

Notas:

- El rol **Consulta** se elimina del MVP porque no se ocupa actualmente.
- Si en el futuro se requiere consulta de avances, se reabrira como fase futura.

## 7. Estructura academica

Areas academicas:

- Universidad
- Facultad de Ciencias de la Salud

Tipos de programa:

- Licenciatura
- Maestria
- Especialidad

Modalidades:

- Escolarizado
- Ejecutivo
- Virtual

Reglas:

- Universidad maneja licenciaturas y maestrias.
- Facultad de Ciencias de la Salud maneja licenciaturas, maestrias y especialidades.
- Salud no es modalidad; es area academica.
- El grupo completo es el identificador operativo del grupo.

## 8. Reglas para interpretar grupos

Ejemplo:

```text
26-3 DER 53 01A
27-1 CRIMYCRI 11 03 C.A
```

Interpretacion:

```text
Ciclo: 26-3
Siglas del programa: DER
Codigo despues de siglas: 53
Seccion: 01A
```

El formato de seccion acepta letras, numeros, puntos y espacios para casos especiales. Ejemplo:

```text
27-1 CRIMYCRI 11 03 C.A
```

En este caso:

```text
Ciclo: 27-1
Siglas del programa: CRIMYCRI
Codigo despues de siglas: 11
Seccion: 03 C.A
```

### Modalidad por codigo

El sistema detectara modalidad usando el primer digito del codigo despues de las siglas:

```text
1 = Escolarizado
4 = Escolarizado
2 = Ejecutivo
5 = Virtual
```

Ejemplo:

```text
26-3 DER 53 01A -> Virtual
```

### Turno por codigo

El sistema podra detectar turno usando el segundo digito del codigo:

```text
1 = Matutino
2 = Vespertino
3 = Matutino
4 = Vespertino
8 = Nocturno
```

Cuando el primer digito sea `5` y el segundo digito sea `3`, el sistema debe detectar la modalidad como `Virtual`.

### Salud

Si las siglas son:

```text
ENF
NUT
PSIC
EECI
EEQX
MADH
```

El sistema clasificara el grupo como:

```text
Facultad de Ciencias de la Salud
```

La clasificacion por siglas es una regla de respaldo. La regla prioritaria para no depender de programacion futura es el campo `observaciones/notes` de Nomenclaturas:

```text
Campus TUP -> Campus TUP
Facultad de Ciencias de la Salud -> Facultad de Ciencias de la Salud
```

## 9. Catalogos globales

### Asignaturas

El catalogo de asignaturas es global, permanente y acumulativo.

Reglas:

- `id_asignatura` es unico.
- `nombre_asignatura` puede repetirse.
- El nombre puede repetirse porque puede haber materias con mismo nombre pero diferente contenido, reticula o programa.
- Las asignaturas no se cargan de nuevo en cada ciclo.
- Sistemas puede importar asignaturas nuevas por CSV solo cuando cambien reticulas o se agreguen materias.
- Coordinadores seleccionan materias desde este catalogo global.
- Coordinacion Academica debe poder consultar las asignaturas activas del catalogo global y usarlas en Asignaciones inmediatamente despues de que Sistemas las cree o importe.
- El sistema debe reconocer como activas las variantes equivalentes de estatus (`Activo`, `ACTIVO`, `ACTIVA`, `SI`, `true`, `1`) para no ocultar asignaturas por diferencias de formato heredadas.
- El catalogo de Asignaturas debe buscar en tiempo real y priorizar registros recien creados o actualizados para evitar que una materia nueva quede escondida por paginacion.

### Docentes

El catalogo de docentes es global.

Reglas:

- `usuario_moodle` es unico.
- Todos los coordinadores pueden ver docentes.
- Coordinadores pueden agregar docentes manualmente si tienen usuario Moodle.
- Sistemas puede importar docentes por CSV.
- Sistemas puede validar docentes.
- Sistemas puede asignar un docente a una o varias Coordinaciones Academicas.
- La asignacion puede hacerse manualmente desde el panel o desde CSV usando la columna `coordinador_responsable`.
- La columna `coordinador_responsable` puede reconocer nombre, correo institucional, `authUid` o ID interno del usuario de Coordinacion Academica.
- Para asignar varias coordinaciones en un mismo docente desde CSV, se pueden separar valores por `;`, `|` o coma dentro de una celda entre comillas.
- Coordinacion Academica puede alternar entre catalogo global y subpanel **Mis docentes**.
- El subpanel **Mis docentes** muestra docentes asignados explicitamente a esa coordinacion o relacionados por programas asignados.
- En alta manual, el correo institucional se deriva del `usuario_moodle`; el usuario Moodle equivale a la parte local del correo sin dominio.
- El campo de correo en el modal de nuevo docente debe mostrarse como dato derivado de solo lectura con el dominio fijo `@tecplayacar.edu.mx`.
- Ejemplo: si se captura `jperez` como usuario Moodle, el sistema guarda `jperez@tecplayacar.edu.mx`.
- Si se pega un correo completo en el campo de usuario Moodle, el sistema conserva solo la parte local antes de `@`.
- La carga CSV de docentes se inicia desde el boton principal **Cargar CSV**; al presionarlo debe abrir directamente el explorador de archivos.
- No debe mostrarse un panel redundante de `Importar docentes` antes de seleccionar archivo.
- La vista de importacion CSV solo aparece cuando existe previsualizacion, mensaje o error de importacion.
- El boton **Plantilla CSV** permanece separado para descargar el formato esperado.
- Si Coordinacion Academica agrega un docente manualmente, se guarda como `PENDIENTE`, se genera notificacion para Sistemas y se crea una solicitud en `solicitudes_sistemas` tipo `DOCENTE_NUEVO`.
- Cuando Sistemas valida/activa el docente, se notifica a la Coordinacion Academica relacionada.
- Sistemas puede inactivar docentes.
- El boton de eliminar docente solo se muestra cuando el docente esta `INACTIVO`.
- El borrado elimina el documento del catalogo de docentes cuando Sistemas confirma la accion.

### Programas academicos

Catalogo global de programas.

Debe guardar:

- Clave del programa.
- Nombre del programa.
- Area academica.
- Tipo de programa.
- Modalidad.
- Coordinador responsable.
- Estado activo/inactivo.

Nota operativa:

- Las carreras/programas no se capturan directamente desde Usuarios.
- Las carreras se cargaran y administraran junto con Nomenclaturas.
- El modulo Usuarios solo reservara el espacio de programas asignados y los enlazara cuando exista el catalogo correspondiente.

### Nomenclaturas de programas

El sistema debe contar con un catalogo administrable por Sistemas para reconocer abreviaturas de carreras y planes academicos.

Objetivo:

- Evitar quemar abreviaturas en el codigo.
- Permitir que Sistemas de de alta nuevas nomenclaturas desde su panel.
- Permitir que nomenclaturas anteriores y nuevas convivan durante los ciclos donde todavia existan alumnos de ambos planes.
- Facilitar importaciones CSV de grupos aunque usen abreviaturas diferentes.
- Permitir que Sistemas inhabilite nomenclaturas cuando ya no se ocupen.
- Permitir que Sistemas borre nomenclaturas creadas por error, siempre que no tengan uso operativo.

Reglas:

- Una abreviatura debe ser unica dentro del catalogo de nomenclaturas.
- Las nomenclaturas anteriores pueden seguir vigentes mientras existan grupos o alumnos de esos planes.
- Las nomenclaturas nuevas pueden agregarse sin eliminar las anteriores.
- Sistemas administra desde su panel si una abreviatura esta activa o inactiva.
- Las abreviaturas activas se permiten para importar grupos nuevos.
- Las abreviaturas inactivas no se permiten para importar grupos nuevos, pero pueden conservarse para consulta si ya fueron usadas.
- Si una abreviatura ya fue usada en grupos, asignaciones o historico, no debe borrarse fisicamente; debe inhabilitarse.
- Si una abreviatura fue creada por error y no tiene uso, Sistemas puede borrarla.
- Si durante la importacion de grupos aparece una abreviatura no registrada, el sistema debe marcar la fila como observacion o error para que Sistemas la de de alta o corrija el archivo.

Estados de abreviatura:

```text
ACTIVA
INACTIVA
```

Comportamiento esperado:

```text
ACTIVA: Se permite para importar grupos nuevos.
INACTIVA: No se permite para importar grupos nuevos, pero puede mantenerse para referencia o historico.
```

Equivalencias iniciales:

```text
Administracion de Empresas | ADEM | Administracion y Finanzas | LAF
Administracion de Empresas Turisticas | ADETUR | Administracion de Empresas Turisticas | LAET
Criminologia y Criminalistica | CRIMYCRI | Criminologia y Criminalistica | LCRIMYCRI
Derecho | DE | Derecho y Legislacion | LDL
Mercadotecnia | MERC | Mercadotecnia y Medios Digitales | LMMD
Pedagogia | PED | Pedagogia e Innovacion Educativa | LPIE
Contaduria Publica | CONPUB | Contaduria Publica y Finanzas | LCPF
Ingenieria en Sistemas Computacionales | SISCOM | Ingenieria en Tecnologia Digital y Sistemas Computacionales | ITDySC
Comercio Internacional | CINTER | Comercio Internacional y Aduanas | LCIyA
Diseno Grafico Digital | DIGRAF | Diseno Grafico Digital | LDGD
Arquitectura | ARQ | Arquitectura | LARQ
```

Estado implementado:

- La ruta `/nomenclaturas` ya muestra un modulo real, no placeholder.
- El modulo persiste programas en `programas` y abreviaturas en `nomenclaturas_programas`.
- La pantalla permite crear, editar, activar, inhabilitar y eliminar nomenclaturas.
- La abreviatura se valida como unica dentro del catalogo antes de guardar.
- El coordinador responsable es opcional en captura manual y CSV; si no se asigna, el programa queda como `Sin asignar`.
- El borrado solo se permite cuando `usageCount` es `0`; si ya tiene uso operativo debe conservarse inactiva.
- La pantalla incluye resumen de nomenclaturas totales, activas, inactivas, programas y registros con uso historico.
- Se agrego la accion **Cargar equivalencias base** para crear las equivalencias iniciales del spec sin duplicar abreviaturas existentes.
- Al crear o editar una nomenclatura, el sistema asegura tambien el documento del programa asociado por clave.
- Al asignar un coordinador responsable desde Nomenclaturas, el sistema sincroniza el codigo del programa con `usuarios.assignedPrograms` del usuario activo de Coordinacion Academica correspondiente.
- La importacion CSV de nomenclaturas funciona como carga masiva tipo upsert: si la abreviatura no existe, se crea; si ya existe, se actualizan programa, plan, estado, coordinador y observaciones sin borrar historico.
- Los campos implementados para `programas` son `code`, `name`, `academicArea`, `programType`, `modality`, `coordinator`, `status`, `createdAt` y `updatedAt`.
- Los campos implementados para `nomenclaturas_programas` son `abbreviation`, `programCode`, `programName`, `planName`, `planCode`, `status`, `usageCount`, `notes`, `createdAt` y `updatedAt`.
- El campo visible como observaciones se usa operativamente para indicar area institucional.
- En alta/edicion manual, `notes` se captura como desplegable con valores:
  - `Campus TUP`.
  - `Facultad de Ciencias de la Salud`.
- En importacion CSV de nomenclaturas, la columna `observaciones` tambien alimenta `notes`.
- La deteccion de area de grupos usa primero `notes` de la nomenclatura; si contiene Facultad, Salud o Facultad de Ciencias de la Salud, el grupo se clasifica como `Facultad de Ciencias de la Salud`.
- Si `notes` contiene Campus o Campus TUP, el grupo se clasifica como `Campus TUP`.
- La tabla de Nomenclaturas debe usar paginacion y selector de registros por pagina para evitar scroll excesivo.

## 10. Ciclos academicos

El sistema trabajara sobre un ciclo activo operativo cuando Coordinación de Sistemas active la captura desde el modulo Ciclos.

Antes de cargar ciclos:

- La interfaz no debe mostrar un ciclo quemado o fijo.
- El encabezado puede mostrar `Ciclo activo: Pendiente de configurar`.
- Ningun modulo debe asumir `26-3` u otro ciclo por defecto.
- El ciclo activo operativo se obtiene del catalogo de ciclos en Firestore cuando exista.

Estados del modulo Ciclos:

```text
Preparacion
Captura
Captura cerrada
Cerrado
```

Flujo operativo:

- `Preparacion`: Sistemas crea y configura el ciclo. En la implementacion inicial solo debe existir `27-1` en preparacion.
- `Captura`: Coordinacion de Sistemas activa la captura; este estado representa el ciclo activo operativo y permite que las coordinaciones academicas registren sus materias.
- `Captura cerrada`: Coordinacion de Sistemas cierra la captura; el ciclo sigue siendo el ciclo activo operativo mientras Sistemas revisa o decide cerrarlo.
- `Cerrado`: ciclo historico de consulta. Al cerrarse, deja de ser el ciclo activo operativo y el sistema queda en espera de un nuevo ciclo.

Acciones del modulo:

- Crear nuevo ciclo validando formato `YY-N`, por ejemplo `27-1`.
- Evitar ciclos duplicados.
- Activar captura de un ciclo en `Preparacion`.
- Cerrar captura de un ciclo en `Captura`.
- Reabrir captura de un ciclo en `Captura cerrada` cuando las coordinaciones academicas necesiten hacer ajustes.
- Cerrar ciclo usando un boton visible como **Cerrar ciclo**.
- Eliminar solo ciclos en `Preparacion`, usando una accion visible como **Eliminar** para ciclos de prueba o ciclos creados por error.
- No permitir eliminar ciclos que ya estuvieron en captura desde el boton normal del modulo.
- No exigir fechas al crear el ciclo.
- Permitir que Sistemas capture una fecha de Cierre de Captura (`tentativeCaptureCloseAt`) para avisar a las coordinaciones cuando se planea cerrar el ciclo.
- Registrar fechas tecnicas: creacion, inicio de captura, Cierre de Captura y cierre de ciclo.
- No mostrar tarjetas con nombres tecnicos de colecciones Firestore, como `academic_cycles`.
- Estado implementado: el modulo Ciclos ya persiste en la coleccion Firestore `ciclos`.
- La pantalla ya no usa ciclos demo en memoria; si Firestore no contiene ciclos, muestra estado pendiente.
- Las acciones implementadas escriben fechas tecnicas como cadenas ISO: `createdAt`, `captureStartedAt`, `captureClosedAt` y `closedAt`; la fecha de Cierre de Captura puede guardarse como fecha simple `YYYY-MM-DD`.
- El dashboard y el encabezado operativo muestran el ciclo activo junto con la fecha de Cierre de Captura cuando exista.

### Renovacion de ciclo

Sistemas podra crear un nuevo ciclo, activar captura, cerrar captura, reabrir captura y cerrar ciclo.

Al activar captura de un nuevo ciclo:

- El ciclo anterior se conserva.
- El ciclo anterior deja de verse por defecto.
- Las pantallas principales muestran el ciclo activo operativo.
- Coordinadores ven captura limpia.
- Coordinadores pueden consultar ciclo anterior en modo solo lectura.
- La vista operativa debe mostrar por defecto el ciclo activo y permitir consulta del ciclo anterior.
- Los ciclos anteriores al ciclo anterior deben ocultarse de las vistas operativas normales.
- La limpieza de datos por antiguedad debe trabajarse como proceso separado de Sistemas, con confirmacion fuerte, para no borrar por accidente el ciclo activo ni el ciclo anterior.
- Grupos se importan o confirman para el nuevo ciclo.
- Asignaturas y docentes siguen siendo catalogos globales.
- Para el arranque del sistema, el ciclo `27-1` inicia en estado `Preparacion`.
- Los ciclos historicos no deben mostrarse como datos iniciales si aun no existen en Firestore.

### Cierre de ciclo y permisos

Cuando un ciclo se cierre:

- Coordinación Académica pasa automaticamente a modo solo consulta para ese ciclo.
- Coordinación Académica no debe editar asignaciones, solicitudes ni datos operativos de ciclos cerrados.
- Coordinación de Sistemas conserva permisos de edicion para auditoria, correccion operativa o reapertura.
- Los auxiliares de Sistemas conservan los permisos que Coordinación de Sistemas les haya definido.
- El ciclo pasa a historico, deja de mostrarse como ciclo activo operativo y el encabezado vuelve a `Ciclo activo: Pendiente de configurar` hasta activar captura de un nuevo ciclo.

Para volver a permitir edicion academica:

- Coordinación de Sistemas puede reabrir la captura cambiando el estado de `Captura cerrada` a `Captura`.
- Coordinación de Sistemas puede autorizar una excepcion temporal de edicion para una coordinación o usuario especifico.

La regla de permisos efectiva debe calcularse combinando:

```text
permiso_final = permiso_del_rol + estado_del_ciclo + excepciones_autorizadas
```

Estados recomendados para edicion:

```text
Preparacion: solo Coordinacion de Sistemas configura el ciclo.
Captura: Coordinacion Academica puede editar segun su rol.
Captura cerrada: Coordinacion Academica queda en solo consulta; Sistemas puede revisar, reabrir captura o cerrar ciclo.
Cerrado: Coordinacion Academica solo consulta.
```

## 11. Importaciones CSV

Modulo exclusivo de Sistemas.

Tipos soportados:

- Docentes.
- Asignaturas.
- Grupos.

### Importar docentes

CSV esperado:

```csv
id_docente,nombre_completo,usuario_moodle,estatus,correo,tipo_pago,categoria,telefono,ubicacion,coordinador_responsable,observaciones
DOC-0001,JUAN PEREZ LOPEZ,jperez,ACTIVO,juan.perez@tecplayacar.edu.mx,1,V,9841234567,LOCAL,coord1@tecplayacar.edu.mx,
DOC-0002,MARIA TORRES GARCIA,mtorres,ACTIVO,maria.torres@tecplayacar.edu.mx,2,M,9847654321,FORANEO,"coord1@tecplayacar.edu.mx; coord2@tecplayacar.edu.mx",
```

Reglas:

- `nombre_completo` obligatorio.
- `usuario_moodle` obligatorio.
- `usuario_moodle` no puede duplicarse.
- Si `id_docente` viene vacio, el sistema lo genera.
- Si `estatus` viene vacio, se guarda como `VALIDADO`.
- `estatus` acepta `ACTIVO`/`ACTIVA` como sinonimo operativo de `VALIDADO`, ademas de `PENDIENTE`, `VALIDADO` e `INACTIVO`.
- `correo` es opcional.
- En alta manual, `correo` ya no se captura como dato independiente; se construye desde `usuario_moodle` y el dominio institucional.
- `tipo_pago` es opcional y acepta texto o codificacion administrativa: `1` Santander, `2` Banorte, `3` Efectivo.
- `categoria` es opcional y acepta abreviatura o etiqueta completa: `V`/`V-35hrs`, `M`/`M-25hrs` o `N`/`N-15hrs`.
- `telefono` es opcional; si se captura debe tener exactamente 10 digitos numericos.
- `ubicacion` es opcional y acepta `FORANEO`/`FORÁNEO`, `LOCAL` o `VIRTUAL`.
- `coordinador_responsable` es opcional.
- Si `coordinador_responsable` viene lleno, el sistema intenta enlazarlo con usuarios activos de Coordinacion Academica.
- El enlace puede hacerse por nombre, correo institucional, `authUid` o ID interno.
- Si el coordinador no existe o no es Coordinacion Academica activa, la fila queda con observacion y no se guarda hasta corregirla.
- La carga CSV funciona como upsert: crea docentes nuevos y actualiza docentes existentes por `usuario_moodle`.
- Si en una actualizacion CSV los campos opcionales de pago, categoria, telefono, ubicacion u observaciones vienen vacios, el sistema conserva el dato existente del docente.

### Importar asignaturas

CSV esperado:

```csv
id_asignatura,nombre_asignatura,activo
1045,DERECHO TRIBUTARIO SUSTANTIVO,SI
573,DISENO Y EVALUACION DE RECURSOS EDUCATIVOS VIRTUALES,SI
```

Reglas:

- `id_asignatura` obligatorio.
- `nombre_asignatura` obligatorio.
- `id_asignatura` no puede duplicarse.
- El nombre de asignatura si puede repetirse.
- El proceso es incremental.
- Si `activo` viene vacio, se guarda como activo.
- Si `activo` viene como `NO`, la asignatura queda inactiva.
- Si el ID ya existe, se omite y se reporta.
- Antes de guardar, el sistema muestra resumen de registros validos, duplicados y registros con error.

### Importar grupos

CSV esperado:

```csv
grupo,activo
26-3 DER 53 01A,SI
26-3 ENF 11 01A,SI
27-1 CRIMYCRI 11 03 C.A,SI
```

Reglas:

- `grupo` obligatorio.
- `programa` ya no es obligatorio cuando el grupo se puede resolver por nomenclatura.
- No duplicar grupo completo.
- El sistema detecta ciclo.
- El sistema detecta siglas del programa.
- El sistema valida las siglas contra el catalogo de nomenclaturas y equivalencias.
- El sistema valida si la abreviatura esta activa para nuevos grupos.
- El sistema detecta codigo del grupo.
- El sistema detecta modalidad.
- El sistema detecta turno.
- El sistema detecta si pertenece a Salud.
- Si la abreviatura no existe en el catalogo, la fila se marca para revision de Sistemas.
- Si la abreviatura existe pero esta inactiva, la fila se marca como observacion para que Sistemas confirme si debe reactivarse o corregirse.
- Si `activo` viene vacio, se guarda como `SI`.
- La importacion CSV funciona como upsert para actualizar registros existentes.
- Sistemas puede eliminar un grupo individual.
- Sistemas puede eliminar todos los grupos de un ciclo seleccionado desde el modulo Grupos.
- El boton de eliminar grupos de ciclo permanece inhabilitado hasta seleccionar un ciclo; al entrar con `Todos los ciclos` no debe aparecer habilitado.
- La vista cuenta con barra de busqueda para localizar grupos cargados.
- La tabla de Grupos debe usar paginacion y selector de registros por pagina para evitar scroll excesivo.
- En alta individual de grupo, el ciclo activo operativo se antepone automaticamente al grupo; el usuario captura solo abreviatura, codigo y seccion.
- En el modal de nuevo grupo, el campo visible debe seguir llamandose **Grupo**; el ciclo operativo fijo se muestra integrado junto al campo, no como captura repetida.
- Coordinacion Academica ve por defecto sus grupos asignados; puede consultar todos los grupos cuando se habilite la vista correspondiente.

Flujo de importacion:

1. Sistemas selecciona tipo de importacion.
2. Sube CSV.
3. El sistema valida encabezados.
4. El sistema muestra vista previa.
5. El sistema muestra registros validos, duplicados y errores.
6. Sistemas confirma.
7. El sistema guarda registros validos.
8. Se registra en bitacora.

## 12. Asignaciones academicas

Modulo principal de captura para coordinadores.

Una asignacion relaciona:

- Ciclo.
- Programa.
- Grupo.
- ID de asignatura.
- Nombre de asignatura.
- ID asignatura para busqueda.
- Usuario Moodle del docente.
- Nombre del docente.
- Estado.
- Observaciones.
- Indicador de clase compartida.
- Asignacion origen cuando sea compartida.
- Usuario y fecha de creacion.
- Usuario y fecha de actualizacion.

Reglas:

- La asignatura se selecciona del catalogo global de Asignaturas.
- El docente se selecciona del catalogo global de Docentes.
- El docente puede quedar temporalmente como `TEMPORALMENTE SIN DOCENTE` cuando aun no este definido.
- El grupo se selecciona de Grupos del ciclo activo.
- La asignacion pertenece a un ciclo.
- El coordinador debe capturar el ID Moodle de la asignacion, separado del ID interno SPAI de la asignatura.
- En la interfaz de Asignaciones, el ID capturado se trata como ID Moodle operativo para busqueda, seguimiento y futura exportacion.
- El ID Moodle puede repetirse dentro del mismo ciclo si corresponde a materias distintas.
- El ID Moodle no debe duplicarse para la misma materia dentro del mismo ciclo, salvo cuando sea clase compartida.
- Si una clase se comparte, la clase origen y destino deben compartir el mismo ID asignatura de captura.
- Si la asignacion es compartida, debe conservar `id_asignacion_origen`.
- Coordinacion Academica consulta por defecto asignaciones de sus programas/grupos asignados y puede usar el boton **Catalogo global** para ver todas las asignaciones del ciclo activo: propias, de otras coordinaciones y registros creados por Sistemas, manteniendo solo permisos de consulta sobre lo ajeno.
- Coordinacion Academica crea, edita y elimina asignaciones de sus programas/grupos asignados. Si una asignacion creada por Sistemas pertenece a uno de sus programas, tambien puede gestionarla.
- Para captura en Asignaciones, los programas permitidos de Coordinacion Academica se calculan con `usuarios.assignedPrograms` y tambien con los programas donde `programas.coordinator` coincida con el nombre o correo del usuario activo.
- La validacion de programa permitido en Asignaciones debe usar equivalencias de Nomenclaturas entre `abbreviation` y `programCode`, para que un grupo no quede oculto cuando el usuario tenga asignado el codigo relacionado y no la abreviatura exacta del grupo.
- Al guardar Asignaciones, `createdBy` debe guardar el UID real de Firebase Auth y el codigo de programa enviado a Firestore debe ser compatible con `usuarios.assignedPrograms` o con las equivalencias calculadas en `createdByPrograms`.
- Las asignaciones nuevas usan ID deterministico de Firestore calculado con ciclo, programa, grupo o matricula, asignatura, ID Moodle y tipo de asignacion. Si se reintenta el mismo guardado por doble clic, recarga o inestabilidad de red, SPAI debe actualizar el mismo documento y no crear duplicados.
- Antes de mostrar exito o cerrar el modal, SPAI debe confirmar el documento guardado con lectura directa desde servidor. No se considera guardada una asignacion solo por cache local o escritura pendiente.
- La recarga global de la tabla despues del guardado no debe bloquear el cierre del modal; la confirmacion critica se hace por documento individual y el refresco de la vista ocurre en segundo plano.
- Las reglas de Firestore para Asignaciones deben permitir que Sistemas gestione todo y que Coordinacion Academica gestione registros cuyo `program` o `sharedPrograms` coincidan con sus `assignedPrograms`.
- La accion eliminar en Asignaciones debe borrar fisicamente el documento de Firestore cuando las reglas lo permitan; no debe ocultarlo con `deletedAt` como respaldo silencioso.
- La deteccion de Posgrados en Asignaciones debe usar programas, nomenclaturas, `programType`, nombre de programa, plan y notas para identificar maestrias, doctorados, posgrados o especializaciones de Campus TUP.
- Coordinacion Academica no puede modificar la asignacion origen de otra coordinacion.
- Coordinacion de Sistemas puede consultar todas las asignaciones y validar o revisar informacion.
- Auxiliar de Sistemas puede consultar y gestionar Asignaciones cuando Coordinacion de Sistemas le habilita `access.asignaciones == true`.
- La captura y edicion solo estan habilitadas cuando el ciclo activo operativo esta en estado `Captura`.
- Si el ciclo activo esta en `Preparacion`, `Captura cerrada` o `Cerrado`, el modulo muestra mensaje claro y bloquea alta/edicion.
- Las acciones importantes se registran en Bitacora.
- Horarios y exportacion Moodle final quedan fuera de este modulo por ahora.
- No debe existir campo ni columna **Distribucion** dentro de Asignaciones.

Vista implementada:

- El ciclo no se selecciona manualmente; se toma del ciclo activo operativo.
- El ciclo activo operativo se obtiene desde `CyclesRepository.activeCycle`.
- El ciclo activo no debe repetirse dentro de la barra de busqueda/filtros porque ya aparece en el encabezado global del sistema.
- El panel principal se llama `Asignaciones academicas`.
- La busqueda principal debe ser una barra predictiva, no una lista desplegable larga.
- La barra permite elegir el criterio **Buscar por**:
  - Programa.
  - Grupo.
  - Docente.
  - Asignatura.
- Mientras el usuario escribe, el sistema muestra sugerencias predictivas compactas dentro o junto a la misma barra de busqueda.
- Las sugerencias deben calcularse segun ciclo activo, permisos del usuario y pestaña activa.
- En la pestaña Salud, las sugerencias de programa y grupo deben limitarse a Facultad de Ciencias de la Salud, incluyendo programas detectados por area academica, siglas de respaldo, nombre del programa o especialidad sin clasificacion Campus TUP.
- En la pestaña Posgrados, cuando el selector de grupo no tenga opciones, debe indicar si no hay posgrados del ciclo, si los posgrados detectados pertenecen a Salud, si no estan clasificados como Campus TUP o si no estan asignados a la coordinacion activa.
- En la pestaña Escolarizado, las sugerencias de grupo deben limitarse a grupos escolarizados que no pertenezcan a Facultad de Ciencias de la Salud.
- Las asignaciones se separan por pestañas estilo navegador en la parte superior derecha del panel:
  - Escolarizado.
  - Ejecutivo.
  - Virtual.
  - Salud.
  - Posgrados.
  - Especiales.
- Regla vigente por pestana:
  - Escolarizado: solo grupos con modalidad Escolarizado y area academica distinta de Facultad de Ciencias de la Salud.
  - Ejecutivo: solo grupos con modalidad Ejecutivo y area academica distinta de Facultad de Ciencias de la Salud.
  - Virtual: grupos virtuales del area Campus TUP.
  - Salud: exclusivamente grupos y programas cuyo `academicArea`, area academica derivada o sigla de respaldo pertenezca a `Facultad de Ciencias de la Salud`; incluye licenciaturas, maestrias y especialidades de la Facultad.
  - Posgrados: maestrias de Campus TUP, sin incluir programas de Facultad de Ciencias de la Salud.
  - Especiales: grupos con terminacion `C.A`, materias autogestivas y casos con matriculas adicionales.
- Salud no es modalidad; se muestra como pestaña separada porque sus asignaciones pertenecen a Facultad de Ciencias de la Salud.
- La pestaña Salud se basa en el area academica derivada de nomenclatura o programa; no se decide por modalidad.
- Posgrados se muestra como pestaña separada para maestrias de Campus TUP.
- La pestaña Posgrados se ubica entre Salud y Especiales.
- Especiales no es modalidad; se usa para casos especiales, grupos con terminacion `C.A`, materias autogestivas y casos con matriculas adicionales.
- No existe pestaña Todas; las asignaciones se revisan por separacion operativa.
- La tabla muestra las columnas en este orden:
  1. Ciclo.
  2. ID asignatura.
  3. Asignatura.
  4. Programa.
  5. Grupo.
  6. Matriculas adicionales.
  7. Estado.
  8. Observaciones.
  9. Compartida.
  10. Acciones.
- La vista compacta operativa debe conservar el flujo: ID Moodle, Materia, Docente, Carrera/Programa, Grupo, Compartida y Estado.
- La columna Matriculas adicionales queda en `Pendiente` mientras no se implemente el modulo correspondiente.
- La columna Estado debe mostrarse centrada.
- La columna Compartida marca tanto la asignacion base como sus destinos cuando pertenecen a una clase compartida, y el visor muestra el grupo base y los grupos relacionados.
- La columna Acciones muestra solo Editar y Eliminar.
- Sistemas puede eliminar cualquier asignacion; Coordinacion Academica puede eliminar asignaciones de sus programas asignados, incluyendo registros creados por Sistemas y clases compartidas donde su programa participa.
- Si Firestore no permite el borrado fisico directo, la eliminacion operativa debe archivar el registro con `deletedAt` y excluirlo de las vistas, conteos, busquedas y conflictos de ID Moodle.
- Si no hay ciclo activo, grupos disponibles, docentes validados o asignaturas activas, el modulo muestra avisos claros para orientar la prueba operativa.
- La captura normal permite registrar Matriculas adicionales como campo opcional.

Alta y edicion:

- El boton `Nueva asignacion` abre un modal o panel de captura.
- En la captura, el ciclo activo se muestra como solo lectura.
- El grupo se selecciona de los grupos activos del ciclo activo y se filtra segun la pestaña operativa seleccionada.
- Coordinacion Academica ve por defecto en la tabla principal solo asignaciones de sus programas asignados, con boton **Catalogo global** para consultar tambien asignaciones de las demas coordinaciones y las creadas por Sistemas en el ciclo activo.
- Coordinacion Academica solo ve grupos de sus programas asignados al elegir el grupo base de una captura.
- Para clase compartida, el buscador de grupos compartidos puede incluir grupos activos de otras coordinaciones dentro del ciclo y pestaña operativa seleccionada.
- Sistemas ve todos los grupos del ciclo activo.
- La asignatura se selecciona del catalogo global activo.
- El docente se selecciona del catalogo global validado.
- El selector de docente incluye la opcion `Temporalmente sin Docente`.
- Los campos Materia, Docente y Grupo en el modal funcionan como campos escribibles con lista desplegable de opciones validas del catalogo.
- El modal de captura y edicion de Asignaciones guarda siempre el estado fijo `EN_CAPTURA`.
- Los cambios a `EN_REVISION` y `CARGADO_MOODLE` se realizan desde el panel operativo de Moodle, no desde el modal de Asignaciones.
- En el modal de captura, `Clase compartida` se muestra como control compacto junto al estado fijo, y `Detalles operativos` queda como bloque inferior.
- Debe agregarse el boton **Guardar y continuar agregando** para capturas repetitivas del mismo flujo operativo.
- Si se elige `Temporalmente sin Docente`, la asignacion se guarda con:
  - `usuario_moodle_docente`: `temporalmente_sin_docente`.
  - `docente`: `TEMPORALMENTE SIN DOCENTE`.

Casos especiales y autogestivos:

- La pestaña Especiales permite capturar asignaciones sin grupo, cursos especiales por grupo y propedeuticos.
- En Especiales, el selector superior muestra tres botones: **Especial**, **Curso especial** y **Propedeutico**.
- **Especial** no solicita grupo; solicita programa y matricula(s).
- **Curso especial** solicita grupo y se guarda en la pestaña Especiales con tipo `CURSO_ESPECIAL`.
- Al activar **Propedeutico**, el campo ID Moodle queda bloqueado y muestra `Propedeutico`.
- En **Propedeutico**, el selector de materia solo muestra cursos activos cuyo nombre inicia con `TUP --` o `FCS --`.
- Los cursos con prefijo `TUP --` o `FCS --` no deben aparecer en el selector de materia de las demas capturas de Asignaciones.
- Las asignaciones propedeuticas se guardan con tipo `PROPEDEUTICO` y valor tecnico de ID Moodle `propedeutico` para evitar capturar IDs Moodle falsos.
- Las matriculas pueden capturarse en una lista separada por saltos de linea, comas o punto y coma.
- En Especiales la asignacion conserva ciclo, programa, asignatura, ID asignatura de captura, docente, estado y observaciones.
- El docente puede asignarse desde catalogo o quedar `Temporalmente sin Docente`.
- Coordinacion Academica solo puede crear casos especiales en sus programas asignados.
- Sistemas puede crear casos especiales para cualquier programa.
- Los casos especiales aparecen en tabla dentro de la pestaña Especiales.
- En la pestaña Especiales, el filtro por Grupo se reemplaza por filtro de Matricula.
- En tabla, la columna Grupo muestra `Sin grupo` para casos especiales.
- En tabla, los cursos especiales por grupo muestran el grupo base y la nota `Curso especial por grupo`.
- En tabla, la columna Matriculas adicionales muestra las matriculas capturadas para casos especiales.
- En tabla, la columna Observaciones muestra las observaciones capturadas para la asignacion.
- Las asignaciones especiales no pueden usarse como origen de clase compartida.
- En el modal responsive de Especiales, los controles compactos de caso especial, clase compartida y estado deben acomodarse sin superposicion ni recorte de texto.

Catalogo global en Asignaciones:

- En modo **Mis asignaciones**, Coordinacion Academica ve las asignaciones del ciclo activo que correspondan a sus programas asignados, aunque las haya capturado Sistemas u otra coordinacion como clase compartida.
- En modo **Catalogo global**, Coordinacion Academica ve tambien asignaciones del ciclo activo creadas por otras coordinaciones o por Sistemas, aunque el programa no este en `usuarios.assignedPrograms`.
- Sistemas y Auxiliar de Sistemas con permiso de Asignaciones ven siempre **Catalogo global** en el modulo Asignaciones; no requieren alternar alcance.
- La tabla, conteos, sugerencias y opciones de consulta de Coordinacion Academica deben respetar **Mis asignaciones** por defecto; las asignaciones ajenas solo se muestran cuando el usuario activa el boton **Catalogo global**.
- El alcance global no concede permisos de captura, edicion o eliminacion sobre programas ajenos; esas acciones siguen sujetas al programa asignado, creador del registro y rol operativo.
- Si una asignacion del ciclo activo no puede resolver su grupo contra el catalogo de Grupos, la interfaz debe clasificarla por los datos guardados de la asignacion para evitar que quede invisible en la vista global.
- Si existen asignaciones del ciclo activo pero no aparecen por pestana, estado o busqueda, la tabla debe mostrar un mensaje de vacio explicando que la vista actual las esta filtrando.
- El guardado de Asignaciones debe esperar confirmacion de Firestore antes de cerrar el modal o mostrar exito; si Firestore rechaza la escritura, no responde a tiempo o no devuelve el documento confirmado desde servidor, el modal permanece abierto y muestra el error.
- Si una lectura de catalogo o tabla falla por permisos, red o timeout, SPAI no debe vaciar silenciosamente los datos ya cargados en pantalla; debe conservar la ultima vista util y mostrar el error de lectura.

Clases compartidas en tabla:

- La tabla muestra una sola fila por clase Moodle. Si hay grupos compartidos, la asignacion base se marca como compartida y lista los grupos vinculados. No se deben crear filas duplicadas por cada grupo unido.
- El visor de clase compartida debe indicar grupo base y grupos con los que comparte.
- La tabla ya no inicia el flujo con boton Compartir o Solicitar.
- El flujo de clase compartida se captura desde el modal de Asignaciones o se formaliza desde Solicitudes cuando aplique.
- El grupo destino compartido puede pertenecer a otra Coordinacion Academica; la restriccion de programas asignados solo aplica al grupo base que captura la coordinacion.
- Al editar una asignacion base para convertirla en clase compartida, la asignacion editada funciona como origen y no debe pedir seleccionar una asignacion origen adicional.
- No se permite encadenar una asignacion compartida como origen de otra compartida.

Estados sugeridos:

```text
EN_CAPTURA
EN_REVISION
CARGADO_MOODLE
```

## 13. Matriculas adicionales

Permite capturar alumnos adicionales para una asignatura.

El coordinador captura:

- ID de asignatura.
- Matricula del alumno.

El sistema autocompleta:

- Nombre de asignatura.
- Ciclo.
- Usuario.
- Fecha.

## 14. Solicitudes operativas

Modulo centralizado para solicitudes entre Coordinacion Academica y Sistemas.

Tipos implementados:

```text
COMPARTIR_CLASE
REABRIR_CAPTURA
ALTA_GRUPO
ASIGNACION_ESPECIAL
```

Flujo base:

1. Coordinacion Academica crea una solicitud operativa.
2. La solicitud queda en estado `PENDIENTE`.
3. Sistemas revisa las solicitudes recibidas.
4. Sistemas acepta o rechaza.
5. Si acepta, el sistema ejecuta la accion correspondiente y registra Bitacora.
6. Si rechaza, se guarda motivo u observacion.

Flujo para compartir clases entre coordinaciones.

Proceso:

1. Un coordinador busca una clase de otra coordinacion.
2. Solicita compartirla con uno de sus grupos.
3. El coordinador responsable acepta o rechaza.
4. Si acepta, ambas clases comparten el mismo ID asignatura de captura.
5. Sistemas puede consultar la relacion.

Objetivo operativo:

- Formalizar las clases compartidas mediante una solicitud antes de vincular un grupo destino.
- Evitar que una coordinacion cree directamente una clase compartida sin respuesta de la coordinacion responsable.
- Al aceptar, actualizar la asignacion origen agregando el grupo destino en `sharedGroups` y su programa en `sharedPrograms`; se conserva un solo `moodleId`, docente y asignatura.
- La clase aceptada debe quedar visible en Asignaciones como una sola fila compartida. La coordinacion destino debe verla en **Mis asignaciones** con aviso de que el grupo base pertenece a la coordinacion origen.
- Si una coordinacion destino elimina una clase compartida cuyo grupo base pertenece a otra coordinacion, el sistema solo retira sus grupos de `sharedGroups`; no elimina la asignacion base ajena.

Datos minimos de `solicitudes_compartidas` en la implementacion Angular/Firebase:

```ts
export interface SharedClassRequest {
  id: string
  requestType: 'COMPARTIR_CLASE' | 'REABRIR_CAPTURA' | 'ALTA_GRUPO' | 'ASIGNACION_ESPECIAL'
  cycle: string
  sourceAssignmentId: string
  destinationAssignmentId: string
  sourceCoordination: string
  destinationCoordination: string
  sourceProgram: string
  destinationProgram: string
  sourceGroup: string
  destinationGroup: string
  subjectId: string
  subjectName: string
  moodleId: string
  teacherMoodleUser: string
  teacherName: string
  targetCycle?: string
  requestedProgram?: string
  reason?: string
  groupFullGroup?: string
  groupCode?: string
  groupSection?: string
  groupProgramName?: string
  groupModality?: string
  groupShift?: string
  groupAcademicArea?: string
  specialSubjectId?: string
  specialSubjectName?: string
  specialMoodleId?: string
  specialTeacherMoodleUser?: string
  specialTeacherName?: string
  specialStudentEnrollments?: string
  createdEntityId?: string
  status: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA' | 'CANCELADA'
  requestMessage: string
  responseObservations: string
  requestedBy: string
  requestedByName: string
  requestedByRole: string
  requestedAt: string
  respondedBy: string
  respondedByName: string
  respondedByRole: string
  respondedAt: string
  updatedAt: string
}
```

Reglas implementadas:

- Coordinacion Academica puede crear solicitudes operativas para sus programas asignados.
- Sistemas puede consultar y responder todas las solicitudes operativas.
- Solo se pueden crear solicitudes para asignaciones del ciclo activo en estado `Captura`.
- El solicitante debe elegir un grupo destino activo del ciclo activo.
- El grupo destino debe pertenecer a un programa asignado al solicitante, salvo Coordinacion de Sistemas.
- No se permite duplicar una solicitud `PENDIENTE` para la misma asignacion origen y grupo destino.
- No se permite solicitar como origen una asignacion destino heredada ni una asignacion especial. Una asignacion base ya compartida puede volver a compartirse con mas grupos.
- El grupo destino no puede ser el mismo grupo de la asignacion origen.
- La coordinacion responsable puede aceptar o rechazar solicitudes donde el programa origen pertenece a sus programas asignados.
- Sistemas puede consultar todas las solicitudes.
- Si se acepta, no se crea una asignacion destino duplicada. Se actualiza la asignacion origen con `shared: true`, `sharedGroups` y `sharedPrograms`.
- Si se acepta `REABRIR_CAPTURA`, Sistemas reabre el ciclo solicitado.
- Si se acepta `ALTA_GRUPO`, Sistemas crea el grupo en `grupos` con estatus `Activo`.
- Si se acepta `ASIGNACION_ESPECIAL`, Sistemas crea una asignacion especial `special: true` aun cuando el ciclo ya este cerrado o en captura cerrada.
- Si se rechaza, se debe capturar motivo u observacion.
- Si se cancela, se conserva la solicitud como `CANCELADA`.
- Se registra bitacora para solicitud creada, aceptada, rechazada y cancelada.

Vista implementada:

- Ruta real `/solicitudes`.
- Tarjetas resumen: Pendientes, Aceptadas, Rechazadas y Mis solicitudes.
- Tabs: Recibidas, Enviadas y Todas cuando el usuario es Sistemas.
- Tabla principal con chips de estado y columna `Asunto`.
- La columna `Asunto` muestra datos contextuales segun el tipo de solicitud: asignatura/docente/Moodle cuando sea compartir clase o asignacion especial, ciclo/motivo cuando sea reabrir captura, y grupo/programa cuando sea alta de grupo.
- Filtros por programa, grupo, estado y busqueda libre dentro de modal de busqueda. El ciclo no aparece como filtro en Solicitudes.
- El panel principal muestra chips compactos solo cuando hay filtros activos.
- El icono de Solicitudes en la navegacion muestra un contador seguro de solicitudes `PENDIENTE` accionables para el usuario activo; si no hay sesion activa o Firestore niega la lectura, el contador permanece oculto.
- Modal para crear solicitud con selector de tipo y campos condicionales.
- Modal para responder con aceptacion o rechazo.
- La tabla de Asignaciones no muestra boton `Solicitar`; las acciones operativas visibles quedan como Editar y Eliminar.
- El formulario de Asignaciones permite capturar clase compartida con grupo base y grupos destino; la tabla muestra la relacion para la base y los destinos.

### Solicitudes a Sistemas desde dashboard

Ademas de las solicitudes operativas para compartir clases, Coordinacion Academica cuenta con una entrada ligera desde el dashboard llamada **Solicitudes a Sistemas**.

Objetivo:

- Evitar que Coordinacion Academica tenga una pantalla grande de Solicitudes para casos puntuales.
- Permitir solicitudes simples a Sistemas sin salir del dashboard.
- Centralizar para Sistemas la revision de apoyos operativos.

Tipos implementados:

```text
REABRIR_CAPTURA
ALTA_GRUPO
CAMBIAR_ID_ASIGNATURA
DOCENTE_NUEVO
```

Reglas implementadas:

- Coordinacion Academica crea solicitudes desde el modal del dashboard.
- La solicitud se guarda en `solicitudes_sistemas` con estado `PENDIENTE`.
- Si la creacion de una notificacion auxiliar falla por reglas de Firebase, la solicitud sigue considerandose enviada.
- Sistemas consulta la bandeja de solicitudes desde el modulo `/solicitudes`.
- Sistemas puede marcar solicitudes como `EN_PROCESO`, `ATENDIDA` o `RECHAZADA`.
- Al cambiar estado, se intenta notificar a la Coordinacion Academica solicitante.
- Cuando Coordinacion Academica registra un docente nuevo, tambien se genera una solicitud `DOCENTE_NUEVO` para que Sistemas la vea en la bandeja y conserve registro operativo.
- Si Sistemas marca como `ATENDIDA` una solicitud `DOCENTE_NUEVO`, SPAI busca el docente pendiente vinculado por usuario Moodle y coordinacion solicitante, lo valida automaticamente antes de cerrar la solicitud y notifica a la Coordinacion Academica relacionada. Si no se encuentra un docente vinculado, la solicitud no se cierra como atendida y Sistemas debe revisar el catalogo de Docentes.
- Al activar el docente desde el modulo Docentes, Sistemas notifica a la Coordinacion Academica relacionada mediante campana.
- Sistemas puede eliminar solicitudes de prueba o registros no necesarios desde la bandeja.
- Si Firebase no permite `delete` directo por reglas publicadas, el sistema archiva la solicitud con `deletedAt` y deja de mostrarla en la bandeja.
- La campana de Sistemas muestra avisos generados directamente desde `solicitudes_sistemas` cuando existen solicitudes pendientes.
- El boton **Marcar leidas** de la campana marca tanto notificaciones reales como avisos derivados de solicitudes.
- Al hacer clic en una notificacion de solicitud, el sistema navega a `/solicitudes` con el identificador de la solicitud.

Estados:

```text
PENDIENTE
EN_PROCESO
ATENDIDA
RECHAZADA
```

## 15. Ligas Meet para grupos virtuales

Este modulo si forma parte del MVP, aunque horarios quede suspendido.

Se basa en:

```text
grupos virtuales + asignaciones + clases compartidas
```

Reglas:

- Si el grupo es virtual, sus asignaciones aparecen en la vista **Sesiones Virtuales** del modulo de Ligas Meet.
- Si el grupo pertenece a posgrados Campus TUP, sus asignaciones aparecen en la vista **Sesiones de Posgrado** del mismo modulo porque tambien requieren liga Meet.
- Una clase virtual no compartida tiene una liga Meet propia.
- Una clase virtual compartida debe tener una sola liga Meet.
- La liga se registra en la clase origen o anfitriona.
- La liga se muestra a todos los grupos vinculados.
- Sistemas puede crear, editar, revisar o marcar observacion.
- Coordinación Académica no tiene acceso al modulo Ligas Meet por defecto.
- Coordinación Académica puede solicitar acceso de consulta a Ligas Meet.
- Coordinación de Sistemas puede aprobar o retirar ese acceso de consulta.
- Ligas Meet es editable solo por Coordinación de Sistemas y usuarios auxiliares autorizados.

Estados de liga Meet:

```text
PENDIENTE
REVISADA
GENERADA
```

Datos visibles para Sistemas:

- Ciclo.
- Grupo origen.
- Grupos compartidos.
- ID asignatura.
- Nombre de asignatura.
- ID asignatura de captura.
- Docente.
- Usuario Moodle del docente.
- Estado Meet.
- Liga Meet.
- Horario de clase virtual.

Implementacion actual:

- El modulo Ligas Meet lee las asignaciones del ciclo activo y permite alternar entre sesiones virtuales y sesiones de posgrado.
- La vista **Sesiones Virtuales** muestra clases que incluyan grupos virtuales.
- La vista **Sesiones de Posgrado** muestra clases de posgrado Campus TUP.
- Si una clase virtual esta compartida, se muestra una sola fila asociada a la asignacion origen/anfitriona.
- La liga se guarda en la coleccion `ligas_meet` usando como documento el ID de la asignacion origen.
- Coordinacion de Sistemas puede capturar liga, estado Meet y horario de clase virtual mediante selector de fecha y hora.
- Coordinacion Academica solo puede consultar Ligas Meet si Sistemas le habilita el acceso al modulo.

## 16. Moodle

Modulo para exportacion futura de cursos.

Regla de acceso:

- Moodle es un modulo exclusivo de Coordinación de Sistemas y usuarios auxiliares autorizados.
- Coordinación Académica no tiene acceso a Moodle bajo ninguna circunstancia del MVP.

CSV esperado:

```csv
shortname,fullname,category,visible,templatecourse
```

Reglas:

- `fullname` se construye con `id_moodle + nombre_asignatura + ciclo`.
- En la implementacion actual de Asignaciones, el valor operativo equivalente se captura como `id_asignatura_captura`; la transformacion final a campos Moodle queda pendiente para el modulo Moodle.
- `fullname` se convierte a mayusculas y sin acentos.
- `shortname` usa el mismo valor que `fullname`, reemplazando espacios por guiones bajos.
- `visible` sera `1`.
- `category` se obtiene desde configuracion de categorias Moodle.
- `templatecourse` se infiere segun modalidad, tipo de programa y area academica.

Reglas de `templatecourse`:

- Virtual, Ejecutivo, Maestria o Especialidad: nombre de asignatura en mayusculas, sin acentos y con guiones bajos.
- Licenciatura escolarizada ENF: si existe plantilla especifica por nombre de asignatura se usa esa plantilla; si no existe, se usa `CURSO_DEMO_ENF`.
- Licenciatura escolarizada NUT: si existe plantilla especifica por nombre de asignatura se usa esa plantilla; si no existe, se usa `CURSO_DEMO_NUT`.
- Casos especiales de Arquitectura (`ARQ` o `LARQ`): si no existe plantilla especifica por codigo o nombre de asignatura, se usa `CURSO_DEMO_ESCOLARIZADO`.
- Resto de licenciaturas escolarizadas: `CURSO_DEMO_ESCOLARIZADO`.

Estado operativo implementado:

- El modulo Moodle deja de ser placeholder y se organiza en catálogos operativos y lotes Moodle.
- El bloque de catálogos muestra Categorias Moodle como panel lateral izquierdo y Plantillas de curso al lado derecho para consulta y captura rapida.
- Categorias permite cargar CSV, alta manual, edicion y eliminacion de numeros de categoria asociados a programas.
- Plantillas de curso permite cargar CSV, alta manual, edicion y eliminacion de cursos base para replicacion en Moodle.
- Las plantillas tienen ID interno SPAI incremental oculto para el usuario; en pantalla solo se muestra el nombre corto Moodle, el tipo de plantilla y el programa cuando el tipo sea "Por programa".
- Los tipos de plantilla contemplados son Axiologica, Demo, Transversal, Generica y Por programa.
- Lotes Moodle muestra asignaciones del ciclo activo, permite seleccionar asignaciones, asignar plantilla, verificar categoria y generar CSV con `shortname`, `fullname`, `category`, `visible` y `templatecourse`.
- Desde Lotes Moodle, Sistemas puede actualizar el estado operativo de una asignacion a `EN_REVISION` o `CARGADO_MOODLE`.
- Las colecciones `moodle_categorias` y `moodle_plantillas` quedan protegidas por reglas Firestore para lectura/escritura del modulo Moodle por Sistemas.

### 16.1 Bitacora

Modulo administrativo para consultar acciones relevantes del sistema y dar trazabilidad operativa por usuario, modulo, fecha y ciclo.

Regla de acceso:

- Bitacora es un modulo exclusivo de Coordinacion de Sistemas y auxiliares autorizados.
- Coordinacion Academica no tiene acceso a Bitacora bajo ninguna circunstancia del MVP.

Eventos a registrar:

- Usuarios y roles: creacion, edicion, activacion, inactivacion, eliminacion de acceso y cambios de permisos.
- Ciclos: creacion, activacion de captura, Cierre de Captura, reapertura y cierre final.
- Nomenclaturas: altas, ediciones, inactivaciones y eliminaciones permitidas.
- Importaciones CSV: grupos, docentes y asignaturas.
- Asignaciones: creacion, edicion, cambio de estado y observaciones.
- Solicitudes compartidas: solicitud, aceptacion y rechazo.
- Ligas Meet: generacion, revision y actualizacion.
- Moodle: configuraciones, previsualizaciones y exportaciones futuras.

Filtros recomendados:

- Ciclo.
- Usuario.
- Rol.
- Modulo.
- Accion.
- Rango de fechas.

## 17. Horarios

El modulo de horarios queda suspendido para el MVP.

No forman parte del MVP:

- Captura de horarios.
- Choques de horario.
- Carga semanal docente.
- Generador de horarios institucionales.
- Exportacion de horarios PDF/JPG/PNG.

Quedan como fase futura.

## 18. Colecciones Firestore

Colecciones MVP:

```text
usuarios
usuarios_permisos
roles_personalizados
ciclos
programas
nomenclaturas_programas
grupos
docentes
asignaturas
asignaciones
matriculas_adicionales
solicitudes_compartidas
solicitudes_sistemas
notificaciones
ligas_meet
moodle_categorias
moodle_config
importaciones
exportaciones
bitacora
```

Colecciones implementadas en la fase Firebase backend base:

```text
usuarios
roles_personalizados
ciclos
programas
nomenclaturas_programas
grupos
docentes
asignaturas
asignaciones
solicitudes_compartidas
solicitudes_sistemas
notificaciones
bitacora
```

Notas de implementacion actual:

- `usuarios_permisos` queda pendiente; los permisos por modulo viven embebidos en `usuarios.access`.
- `usuarios` usa actualmente campos frontend en ingles: `authUid`, `name`, `email`, `role`, `greetingGender`, `assignedPrograms`, `access`, `status`, `createdAt`, `updatedAt`.
- `roles_personalizados` usa `name`, `description`, `permissions`, `createdAt` y `updatedAt`.
- `ciclos` usa `code`, `label`, `status`, `notes`, `createdAt`, `captureStartedAt`, `tentativeCaptureCloseAt`, `captureClosedAt` y `closedAt`.
- `programas` y `nomenclaturas_programas` ya estan implementadas para el modulo Nomenclaturas.
- `grupos` ya esta implementada para alta/importacion operativa por CSV y deteccion de modalidad/turno desde la nomenclatura del grupo.
- `docentes` ya esta implementada como catalogo global con alta manual, validacion, inactivacion, carga CSV y control por `usuario_moodle`.
- `asignaturas` ya esta implementada como catalogo global con alta manual, edicion, activacion/inactivacion y carga CSV.
- `asignaciones` ya esta implementada para captura operativa y clases compartidas aceptadas.
- `solicitudes_compartidas` ya esta implementada para crear, aceptar, rechazar y cancelar solicitudes operativas.
- `solicitudes_sistemas` ya esta implementada para solicitudes ligeras a Sistemas desde dashboard y para solicitudes de validacion de docente nuevo.
- `notificaciones` ya esta implementada para campana de Sistemas y avisos dirigidos a Coordinacion Academica.
- `bitacora` ya cuenta con repositorio base para registrar acciones desde modulos implementados.
- El orden inicial de consulta usa `createdAt desc` para usuarios, roles y ciclos; `programas` ordena por `name asc` y `nomenclaturas_programas` por `abbreviation asc`.

Colecciones futuras:

```text
horarios
horarios_institucionales
clases_virtuales_horario
```

## 19. Modelos principales

### Usuario

```ts
export type RolUsuario =
  | 'Coordinación Académica'
  | 'Coordinación de Sistemas'
  | 'Auxiliar de Sistemas'

export type EstadoUsuario = 'Activo' | 'Inactivo'
export type GeneroSaludoUsuario = 'Femenino' | 'Masculino'

export type NivelPermiso = 'sin_acceso' | 'consulta' | 'edicion'

export interface AccesosModulo {
  dashboard: NivelPermiso
  usuarios: NivelPermiso
  ciclos: NivelPermiso
  nomenclaturas: NivelPermiso
  grupos: NivelPermiso
  docentes: NivelPermiso
  asignaturas: NivelPermiso
  asignaciones: NivelPermiso
  solicitudes: NivelPermiso
  ligasMeet: NivelPermiso
  moodle: NivelPermiso
  bitacora: NivelPermiso
}

export interface Usuario {
  id_usuario: string
  auth_uid?: string
  nombre: string
  correo: string
  rol: RolUsuario
  genero_saludo?: GeneroSaludoUsuario
  programas_asignados: string[]
  accesos: AccesosModulo
  estado: EstadoUsuario
  creado_por?: string
  fecha_creacion: Date
  actualizado_por?: string
  fecha_actualizacion: Date
}
```

### RolPersonalizado

```ts
export interface RolPersonalizado {
  id_rol: string
  nombre: string
  descripcion?: string
  accesos: AccesosModulo
  activo: boolean
  es_rol_base: boolean
  creado_por?: string
  fecha_creacion: Date
  actualizado_por?: string
  fecha_actualizacion?: Date
}
```

Reglas del modelo RolPersonalizado:

- Los roles base no deben editarse desde el modal de creacion de roles personalizados.
- El modal de nuevo rol solo crea roles adicionales.
- Cada rol personalizado define permisos por modulo usando `NivelPermiso`.
- Los niveles permitidos son `sin_acceso`, `consulta` y `edicion`.

Reglas del modelo Usuario:

- `correo` debe pertenecer al dominio `@tecplayacar.edu.mx`.
- En la interfaz, el usuario solo captura la parte local del correo; el dominio se agrega automaticamente.
- `auth_uid` se usara para enlazar el documento de Firestore con Firebase Authentication.
- `programas_asignados` se alimentara desde el catalogo de Nomenclaturas/Programas.
- Coordinación de Sistemas tiene acceso total.
- Coordinación Académica no tiene acceso a Moodle.
- Coordinación Académica no tiene acceso a Bitacora.
- Coordinación Académica solo puede ver Ligas Meet en modo consulta si Coordinación de Sistemas lo autoriza.
- Auxiliar de Sistemas puede tener permisos configurables por modulo.

Accesos base por rol:

```text
Coordinación de Sistemas:
  Acceso total.

Coordinación Académica:
  Dashboard
  Grupos
  Docentes
  Asignaturas
  Asignaciones
  Solicitudes
  Ligas Meet solo en modo consulta si Sistemas autoriza
  Moodle no permitido
  Bitacora no permitido

Auxiliar de Sistemas:
  Acceso inicial administrativo, configurable por Coordinación de Sistemas.
```

### CicloAcademico

```ts
export type EstadoCiclo =
  | 'Preparacion'
  | 'Captura'
  | 'Captura cerrada'
  | 'Cerrado'

export interface CicloAcademico {
  id_ciclo: string
  codigo: string
  nombre_visible: string
  estado: EstadoCiclo
  observaciones?: string
  fecha_creacion: Date
  fecha_inicio_captura?: Date
  fecha_cierre_captura?: Date
  fecha_cierre?: Date
}
```

Reglas del modelo CicloAcademico:

- `codigo` debe seguir el formato `YY-N`, por ejemplo `27-1`.
- Solo debe existir un ciclo activo operativo a la vez; corresponde al ciclo en `Captura` o `Captura cerrada`.
- Las fechas no son obligatorias al crear el ciclo; se registran conforme avanza el flujo.
- El ciclo activo del encabezado global se obtiene del ciclo con estado `Captura` o `Captura cerrada`.

### Asignatura

```ts
export interface Asignatura {
  id_asignatura: string
  nombre_asignatura: string
  activo: boolean
}
```

### Grupo

```ts
export interface Grupo {
  grupo: string
  ciclo: string
  siglas_programa: string
  codigo_grupo: string
  seccion: string
  programa: string
  area_academica: 'Universidad' | 'Facultad de Ciencias de la Salud'
  modalidad: 'Escolarizado' | 'Ejecutivo' | 'Virtual'
  turno?: 'Matutino' | 'Vespertino' | 'Nocturno' | 'No definido'
  activo: boolean
}
```

### NomenclaturaPrograma

```ts
export interface NomenclaturaPrograma {
  id_nomenclatura: string
  abreviatura: string
  nombre_programa: string
  plan?: string
  programa_relacionado?: string
  estado: 'ACTIVA' | 'INACTIVA'
  tiene_uso: boolean
  activo: boolean
  creado_por?: string
  fecha_creacion?: Date
  actualizado_por?: string
  fecha_actualizacion?: Date
}
```

### Docente

```ts
export interface Docente {
  id_docente: string
  nombre_completo: string
  usuario_moodle: string
  correo?: string
  tipo_pago?: 'EFECTIVO' | 'SANTANDER' | 'BANORTE'
  categoria?: 'V_35HRS' | 'M_25HRS' | 'N_15HRS'
  telefono?: string
  ubicacion?: 'FORANEO' | 'LOCAL' | 'VIRTUAL'
  estatus: 'PENDIENTE' | 'VALIDADO' | 'INACTIVO'
  creado_por: string
  fecha_creacion: Date
}
```

### Asignacion

```ts
export interface Asignacion {
  id_asignacion: string
  ciclo: string
  programa: string
  grupo: string
  id_asignatura: string
  asignatura: string
  id_asignatura_captura: string
  usuario_moodle_docente: string // permite temporalmente_sin_docente
  docente: string
  estado: 'EN_CAPTURA' | 'EN_REVISION' | 'CARGADO_MOODLE'
  observaciones?: string
  tipo_asignacion?: 'REGULAR' | 'ESPECIAL' | 'CURSO_ESPECIAL' | 'PROPEDEUTICO'
  es_compartida: boolean
  id_asignacion_origen?: string
  es_especial: boolean
  matriculas?: string
  creado_por: string
  creado_por_nombre?: string
  creado_por_rol?: string
  programas_creador?: string[]
  fecha_creacion: Date
  actualizado_por: string
  actualizado_por_nombre?: string
  actualizado_por_rol?: string
  fecha_actualizacion: Date
}
```

### LigaMeet

```ts
export interface LigaMeet {
  id_liga_meet: string
  ciclo: string
  id_asignacion_origen: string
  id_asignatura_captura: string
  id_asignatura: string
  asignatura: string
  docente: string
  usuario_moodle_docente: string
  grupo_origen: string
  grupos_compartidos: string[]
  meet_url?: string
  estado: 'PENDIENTE' | 'REVISADA' | 'GENERADA'
  creado_por?: string
  revisado_por?: string
  fecha_creacion?: Date
  fecha_revision?: Date
}
```

### Bitacora

```ts
export interface Bitacora {
  id_bitacora: string
  modulo: string
  accion: string
  descripcion: string
  usuario: string
  rol_usuario: string
  fecha: Date
  ciclo?: string
  entidad_afectada?: string
  id_entidad?: string
  metadata?: Record<string, unknown>
}
```

## 20. Estructura Angular recomendada

```text
src/
  app/
    app.config.ts
    app.routes.ts
    core/
      auth/
      data/
      firebase/
      guards/
      services/
      layouts/
    shared/
      components/
      pipes/
      utils/
    features/
      auth/
      dashboard/
      usuarios/
      ciclos/
      renovacion-ciclo/
      historico-ciclos/
      programas/
      nomenclaturas-programas/
      grupos/
      docentes/
      asignaturas/
      asignaciones/
      matriculas-adicionales/
      solicitudes-compartidas/
      ligas-meet/
      importaciones/
      validacion/
      moodle/
      bitacora/
      configuracion/
  models/
  environments/
  main.ts
```

Estructura implementada para Firebase backend base:

```text
src/
  environments/
    environment.ts
    environment.prod.ts
  app/
    core/
      auth/
        auth.service.ts
        user-session.service.ts
      data/
        firestore.repository.ts
      firebase/
        firebase.tokens.ts
    features/
      dashboard/
      users/
        data/
          users.repository.ts
          custom-roles.repository.ts
      cycles/
        data/
          cycles.repository.ts
      nomenclatures/
        data/
          nomenclatures.repository.ts
          programs.repository.ts
        pages/
          nomenclatures-page.component.ts
          nomenclatures-page.component.html
          nomenclatures-page.component.css
firebase.json
.firebaserc
firestore.rules
firestore.indexes.json
storage.rules
```

Nota: la carpeta implementada usa nombres en ingles (`users`, `cycles`) dentro del codigo Angular, mientras que las rutas visibles y colecciones Firestore se mantienen en espanol (`usuarios`, `ciclos`, `roles_personalizados`).

## 21. Fases del MVP

### Fase 1 - Base

- Angular + Firebase.
- Login.
- Roles.
- Guards.
- Layout principal.
- Dashboard.
- Estado actual: base Firebase App/Auth/Firestore/Hosting ya montada; guards quedan pendientes.
- Estado actual: Dashboard conectado a sesion y colecciones Firestore base.
- Estado actual: Login institucional con Google, dominio `@tecplayacar.edu.mx`, pantalla visual TUP y validacion de usuario activo en Firestore.
- Estado actual: Encabezado y navbar fijos; el navbar puede ocultarse con boton tipo menu horizontal y el contenido operativo es el area que hace scroll.
- Estado actual: Dashboard sin avances demo; ahora muestra registros reales desde Firestore para usuarios, nomenclaturas, grupos del ciclo activo, docentes, asignaturas, asignaciones y solicitudes pendientes.

### Fase 2 - Catalogos

- Usuarios y roles.
- Alta de usuario en modal.
- Edicion de usuario en modal.
- Activar/inactivar usuario.
- Eliminar acceso de usuario.
- Dominio institucional fijo `@tecplayacar.edu.mx`.
- Roles: Coordinación de Sistemas, Auxiliar de Sistemas, Coordinación Académica.
- Matriz de permisos por modulo para Auxiliar de Sistemas.
- Componente de roles personalizados oculto en boton **Agregar rol**.
- Modal para crear roles personalizados con nombre y permisos por modulo.
- Niveles de permiso por modulo: sin acceso, solo consulta, consulta y edicion.
- Preparacion para OAuth2 con Google + Firebase Authentication + Cloud Firestore.
- Ciclos.
- Estado actual: Usuarios, roles personalizados y ciclos ya persisten en Firestore.
- Estado actual: colecciones iniciales implementadas `usuarios`, `roles_personalizados` y `ciclos`.
- Estado actual: Usuarios y roles contempla permisos operativos por modulo; Auxiliar de Sistemas puede ver y administrar usuarios si `access.usuarios` esta habilitado por Coordinacion de Sistemas.
- Programas.
- Nomenclaturas y equivalencias de programas.
- Estado actual: Nomenclaturas ya cuenta con CRUD base, persistencia Firestore y carga de equivalencias iniciales.
- Grupos.
- Estado actual: Grupos ya cuenta con catalogo Firestore, carga operativa por CSV, validacion de nomenclatura y deteccion de modalidad/turno.
- Docentes.
- Estado actual: Docentes ya cuenta con catalogo Firestore, alta manual, validacion/inactivacion, paneles operativos, carga CSV con apertura directa del explorador de archivos, vista previa solo despues de seleccionar archivo y bitacora.
- Asignaturas.
- Estado actual: Asignaturas ya cuenta con catalogo Firestore, alta manual, edicion, activacion/inactivacion, consulta de activas para coordinadores y carga CSV con vista previa de validos, duplicados y errores.
- Asignaciones.
- Estado actual: Asignaciones ya cuenta con repositorio Firestore, ruta funcional, captura/edicion condicionada al ciclo activo en Captura, vista de Sistemas completa, vista de Coordinacion Academica con **Mis programas** por defecto y boton **Catalogo global** para consulta general, filtros por ciclo activo, programa, grupo/matricula, estado, docente y asignatura, pestanas por Escolarizado, Ejecutivo, Virtual, Salud, Posgrados y Especiales, captura especial por matriculas sin grupo, docente temporal, acciones de editar/eliminar, relacion visual de clase compartida para base y destinos, permisos de borrado por rol/creador, bitacora, guardado con ID deterministico y confirmacion directa de Firestore antes de mostrar exito.

- Solicitudes.
- Estado actual: Solicitudes ya cuenta con repositorio Firestore, ruta funcional, tipos `COMPARTIR_CLASE`, `REABRIR_CAPTURA`, `ALTA_GRUPO` y `ASIGNACION_ESPECIAL`, tabla con columna `Asunto`, filtros en modal por programa/grupo/estado/busqueda libre, chips de filtros activos, tabs Recibidas/Enviadas/Todas para Sistemas, respuesta por modal, acciones automaticas al aceptar y bitacora. El ciclo no aparece como filtro.
- Estado actual: Solicitudes a Sistemas desde dashboard ya permite crear apoyos operativos para `REABRIR_CAPTURA`, `ALTA_GRUPO`, `CAMBIAR_ID_ASIGNATURA` y `DOCENTE_NUEVO`; Sistemas las atiende en bandeja, recibe aviso en campanita, puede marcar leidas, puede eliminar/archivar solicitudes no necesarias y puede validar automaticamente docentes nuevos al marcar su solicitud como `ATENDIDA`.

### Fase 3 - Importaciones

- CSV docentes.
- CSV asignaturas.
- CSV grupos.
- Vista previa.
- Validaciones.
- Historial.

### Fase 4 - Planeacion

- Asignaciones.
- Estado actual: Modulo Asignaciones implementado para captura operativa del ciclo activo desde `CyclesRepository.activeCycle`; bloquea alta/edicion fuera de estado `Captura`.
- ID asignatura de captura.
- Matriculas adicionales.
- Historico ciclo anterior.
- Reglas de ciclo cerrado: Coordinación Académica pasa a solo consulta.
- Reapertura o excepcion temporal de edicion autorizada por Coordinación de Sistemas.

### Fase 5 - Compartidas y Meet

- Solicitudes operativas.
- Estado actual: Modulo Solicitudes implementado con repositorio `solicitudes_compartidas`, repositorio `solicitudes_sistemas`, ruta real, filtros, tabs, modales de creacion/respuesta, campanita operativa, bitacora, reglas Firestore y acciones automaticas para compartir clase, reabrir captura, alta de grupo, cambio de ID de asignatura y asignacion especial.
- Aceptar/rechazar.
- Ligas Meet para virtuales.
- Ligas Meet compartidas una sola vez.

### Fase 6 - Moodle

- Configuracion categorias.
- Configuracion plantillas.
- Previsualizacion CSV.
- Exportacion CSV.
- Bitacora operativa de acciones relevantes.

### Fase futura - Horarios

- Horarios por grupo.
- Horarios por docente.
- Carga docente.
- Choques.
- Horarios institucionales PDF/JPG/PNG.

## 22. Criterios de exito

El proyecto sera exitoso si:

- Sistemas puede crear ciclos, activar captura, cerrar captura, reabrir captura y cerrar ciclo.
- Coordinación de Sistemas puede crear, editar, inactivar y eliminar accesos de usuarios.
- Coordinación de Sistemas puede administrar permisos de Auxiliar de Sistemas por modulo.
- Coordinación de Sistemas puede crear roles personalizados desde un modal sin exponer los roles base.
- Los roles personalizados pueden definir permisos por modulo como sin acceso, solo consulta o consulta y edicion.
- Al cerrar un ciclo, Coordinación Académica queda en solo consulta para ese ciclo.
- Coordinación de Sistemas puede reabrir captura o autorizar una excepcion temporal de edicion.
- Coordinación Académica puede solicitar acceso de consulta a Ligas Meet.
- Coordinación Académica no tiene acceso a Moodle.
- Los usuarios institucionales usan correos `@tecplayacar.edu.mx`.
- Sistemas puede importar grupos por CSV.
- Sistemas puede mantener abreviaturas actuales y nuevas abreviaturas Plan 2027.
- El sistema reconoce grupos con nomenclatura actual o Plan 2027.
- Sistemas puede importar docentes por CSV.
- Sistemas puede importar asignaturas nuevas de forma incremental.
- Coordinadores pueden asignar materias desde catalogo global.
- El sistema evita docentes duplicados por usuario Moodle.
- El sistema evita duplicar ID Moodle para la misma materia y ciclo, salvo clases compartidas aprobadas.
- Coordinadores pueden consultar ciclo anterior en solo lectura.
- Se pueden gestionar clases compartidas formalmente.
- Las clases virtuales generan una lista de ligas Meet para Sistemas.
- Una clase virtual compartida usa una sola liga Meet.
- Sistemas puede exportar informacion preparada para Moodle.
- Sistemas puede consultar bitacora de acciones relevantes por usuario, modulo, ciclo y fecha.

## 23. Actualizacion de avance - 19 de junio de 2026

Esta seccion documenta el estado real del desarrollo al preparar el traspaso del proyecto a otra computadora.

### 23.1 Estado general del sistema

SPAI TUP ya cuenta con una base Angular + TypeScript conectada a Firebase Authentication y Cloud Firestore. El sistema trabaja con roles, accesos por modulo, ciclo activo, catalogos operativos y vistas diferenciadas para Sistemas y Coordinacion Academica.

La interfaz principal ya tiene identidad institucional TUP, encabezado premium, barra de navegacion fija, opcion para ocultar encabezado, menu de usuario, campanita de notificaciones y paneles por modulo. Se hicieron ajustes responsivos para que la navegacion no se sobreponga en laptop.

### 23.2 Autenticacion y usuarios

- Inicio de sesion con Google OAuth usando cuentas institucionales `@tecplayacar.edu.mx`.
- Pantalla de login institucional con logo TUP y mascota animada en dos poses: inicial y saludo.
- Control de acceso por documento de usuario en Firestore.
- Roles base implementados: Coordinacion de Sistemas, Auxiliar de Sistemas y Coordinacion Academica.
- Roles personalizados implementados con alta, edicion y eliminacion.
- Los roles personalizados aparecen como opciones al crear o editar usuarios.
- El saludo del dashboard se controla por usuario mediante `greetingGender`: `Bienvenida` o `Bienvenido`.
- El formulario de Usuarios ya incluye selector **Saludo** para definir el texto del panel de bienvenida.
- En alta de usuario, el dominio `@tecplayacar.edu.mx` se muestra integrado para evitar capturas inconsistentes.
- Para Coordinacion Academica, los modulos Usuarios y Ciclos no se muestran.
- Coordinacion Academica consulta Nomenclaturas y Grupos, pero no administra esos catalogos.
- Los programas asignados a Coordinacion Academica se basan en nomenclaturas/programas registrados.
- Regla operativa: una nomenclatura/programa no debe asignarse a dos coordinaciones academicas al mismo tiempo.

### 23.3 Ciclos

- Modulo de ciclos implementado para crear, activar, cerrar y consultar ciclos.
- El ciclo activo se muestra de forma global en el dashboard y modulos.
- Los ciclos cerrados quedan como historicos.
- Se agrego eliminacion de ciclos de prueba/historicos desde Sistemas.
- Regla operativa: la captura depende del ciclo activo y del estado del ciclo.

### 23.4 Nomenclaturas

- Modulo de nomenclaturas implementado con alta manual y carga masiva por CSV.
- Las nomenclaturas guardan abreviatura, programa, plan, estado, coordinador responsable y area academica.
- El campo anterior de observaciones se transformo en selector operativo:
  - Campus TUP.
  - Facultad de Ciencias de la Salud.
- Las nomenclaturas nuevas y anteriores pueden coexistir para planes vigentes e historicos.
- Sistemas puede inhabilitar nomenclaturas cuando ya no se usen.
- La asignacion de coordinador responsable debe considerar solo usuarios de Coordinacion Academica.
- La busqueda permite filtrar por abreviatura, programa, estado, plan o coordinador.
- Se agrego paginacion con selector de registros por pagina para evitar scroll excesivo.

### 23.5 Grupos

- Modulo de grupos implementado con carga CSV y alta individual por Sistemas.
- El sistema interpreta el grupo completo para detectar ciclo, abreviatura, modalidad, turno y casos especiales.
- Reglas de deteccion:
  - Codigos 11 y 12: escolarizado.
  - Codigos 23 y 24: ejecutivo.
  - Codigo 53: virtual.
  - Terminacion `C.A`: caso especial.
- El area academica del grupo se deriva de la nomenclatura asociada: Campus TUP o Facultad de Ciencias de la Salud.
- Se agrego eliminacion individual y eliminacion por ciclo.
- Se agrego busqueda, filtros por ciclo y paginacion.
- El boton para eliminar grupos de ciclo solo se habilita cuando hay un ciclo especifico seleccionado.
- En alta individual, el ciclo activo se agrega automaticamente al inicio del grupo; el usuario captura solo el resto del identificador operativo.
- En vista de Coordinacion Academica, debe mostrarse primero lo asignado a su coordinacion y ofrecer un boton de **Catalogo global** para consultar asignaciones de otras coordinaciones sin ampliar permisos de captura, edicion o eliminacion.

### 23.6 Docentes

- Modulo de docentes implementado con alta manual, carga CSV, busqueda, filtros y paginacion.
- Se evita duplicidad por usuario Moodle.
- En alta manual, el correo del docente se autorrellena desde el usuario Moodle y queda como dato derivado con dominio institucional fijo.
- Sistemas puede asignar un docente a una o varias coordinaciones academicas.
- Sistemas puede editar, asignar, inactivar y eliminar docentes inactivos.
- Coordinacion Academica puede agregar docentes, pero se guardan como pendientes.
- Cuando Coordinacion Academica agrega un docente, Sistemas debe recibir notificacion en la campanita y el registro debe quedar visible para revision.
- Cuando Sistemas activa o valida el docente, Coordinacion Academica debe recibir notificacion en su campanita.
- El catalogo global de docentes debe estar disponible para consulta de Coordinacion Academica; "Mis docentes" funciona como filtro operativo por coordinacion asignada.

### 23.7 Asignaturas

- Modulo de asignaturas implementado con alta manual, CSV, edicion, inactivacion, eliminacion, busqueda, filtros y paginacion.
- Coordinacion Academica consulta las asignaturas activas del catalogo global por rol academico, sin depender de banderas de acceso heredadas.
- La busqueda de Asignaturas es inmediata y la vista prioriza las materias con actualizacion mas reciente.
- Se separa el ID interno SPAI del ID de captura/Moodle que usara Coordinacion Academica en asignaciones.
- El ID interno SPAI se genera con nomenclatura incremental `TUP0000`.
- Al subir CSV sin ID, el sistema asigna el siguiente ID interno disponible.
- Si el CSV incluye ID, se respeta como dato de importacion cuando corresponda.
- Si se detecta el mismo nombre dentro del CSV, no se importa duplicado.
- Si una asignatura ya existe por nombre normalizado, el sistema actualiza el registro existente.
- Regla de acentos: si el nuevo CSV trae el nombre con acento y el catalogo no, se actualiza al nombre acentuado; si el catalogo ya tiene acento y el CSV no, se conserva el nombre del catalogo.
- El sistema muestra advertencia visual cuando existen nombres duplicados en catalogo.
- Se agrego limpieza masiva de duplicados, activada solo cuando el sistema detecta duplicados.

### 23.8 Solicitudes y notificaciones

- Coordinacion Academica envia solicitudes desde una tarjeta compacta del dashboard.
- Tipos operativos actuales:
  - Reabrir captura.
  - Alta de grupo.
  - Cambiar ID de asignatura.
- Sistemas cuenta con bandeja de solicitudes con filtros y estados:
  - Pendientes.
  - En proceso.
  - Atendidas.
  - Rechazadas.
  - Todas.
- Las notificaciones deben mostrarse en la campanita, no como paneles grandes innecesarios.
- Al dar clic en una notificacion, debe dirigir al modulo relacionado.
- Marcar como leida debe retirar el contador y la notificacion pendiente.
- Sistemas puede eliminar solicitudes de prueba.
- Las notificaciones relacionadas con docentes deben dirigir al modulo Docentes.

### 23.9 Asignaciones

- El modulo de asignaciones existe y permite captura operativa.
- Coordinacion Academica puede editar asignaciones cuando el ciclo esta en captura.
- Estado actual:
  - Las pestanas filtran asignaciones, grupos y sugerencias por ciclo activo, permisos y criterio operativo.
  - Escolarizado muestra grupos escolarizados que no pertenecen a Facultad de Ciencias de la Salud.
  - Salud muestra solo grupos y programas de Facultad de Ciencias de la Salud, incluyendo licenciaturas, maestrias y especialidades.
  - Posgrados se limita a maestrias de Campus TUP y excluye programas de Facultad de Ciencias de la Salud.
  - Especiales agrupa terminacion `C.A`, materias autogestivas y casos con matriculas adicionales.
  - La barra de busqueda usa predicciones por Programa, Grupo, Docente o Asignatura.
  - El campo/columna Distribucion fue retirado del flujo.
- Pendientes prioritarios:
  - Terminar el boton `Guardar y continuar agregando`.
  - Consolidar el flujo final de clase compartida desde captura o solicitud sin duplicar registros.
  - Notificar a Sistemas cuando una asignacion requiera revision por compartida.

### 23.10 Ligas Meet

- Pendiente de implementacion funcional.
- Debe generarse un panel para Sistemas con clases virtuales provenientes de asignaciones.
- El panel debe mostrar ID de clase/asignacion, grupo virtual, docente y grupos con los que se comparte.
- Objetivo operativo: evitar revisar varias veces la misma clase virtual compartida.

### 23.11 Moodle y exportaciones

- Exportacion Moodle queda pausada para una fase posterior.
- Requisito pendiente: exportacion por lotes para no saturar Moodle.
- Cada lote debe permitir marcar materias ya subidas y materias pendientes.

### 23.12 Bitacora

- La bitacora debe registrar acciones relevantes de Sistemas y Coordinacion Academica:
  - Altas.
  - Ediciones.
  - Inactivaciones.
  - Eliminaciones.
  - Cambios de estado.
  - Importaciones CSV.
  - Solicitudes enviadas y atendidas.

### 23.13 Traspaso a otra computadora

Para continuar el desarrollo en otra computadora se debe llevar la carpeta `SPAI-TUP-TRASPASO-2026-06-19`.

La carpeta de traspaso incluye:

- Proyecto Angular `spai-tup-angular`.
- `package.json` y `package-lock.json`.
- Configuracion Firebase: `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json` y `storage.rules`.
- Codigo fuente `src`.
- Assets publicos `public`.
- Spec actualizado `SPAI-TUP-SPEC-v2.md`.
- Instrucciones de continuacion.

No se incluye `node_modules`, `.angular` ni `dist` porque son carpetas pesadas y se regeneran con comandos.

Comandos para continuar:

```powershell
cd spai-tup-angular
npm install
npm start
```

El servidor local queda normalmente en `http://localhost:4200/`.

### 23.14 Pendientes criticos antes de entrega operativa

- Verificar reglas Firestore completas despues de cada cambio de permisos.
- Validar login de Sistemas y Coordinacion Academica.
- Validar que Coordinacion Academica vea sus programas, docentes asignados, grupos permitidos, sus asignaciones por defecto y el Catalogo global de asignaciones como consulta.
- Validar carga CSV de docentes, asignaturas y grupos.
- Validar notificaciones:
  - Nuevo docente agregado por Coordinacion Academica hacia Sistemas.
  - Docente activado por Sistemas hacia Coordinacion Academica.
  - Solicitud atendida/rechazada hacia Coordinacion Academica.
- Validar reglas de asignaciones por modalidad/area con datos reales de ciclo activo.
- Probar carga real de datos antes de publicar en Firebase Hosting.

## 24. Actualizacion operativa vigente - julio 2026

Esta seccion documenta los cambios funcionales definidos e implementados despues de la base inicial del spec. Si algun punto anterior del documento contradice esta seccion, debe prevalecer lo descrito aqui.

### 24.1 Publicacion y entorno operativo

- SPAI TUP se publica en Firebase Hosting.
- Enlace operativo principal: `https://spai-6ef68.web.app`.
- Los cambios funcionales deben probarse localmente, compilarse y desplegarse a Hosting cuando el usuario lo solicite como cambio visible.
- El despliegue a Hosting no modifica Firestore ni Authentication; las reglas de Firestore deben publicarse aparte cuando cambien permisos.

### 24.2 Ciclo activo y Cierre de Captura

- El ciclo activo se muestra como dato operativo global.
- La fecha se muestra como **Cierre de Captura** y no como fecha tentativa.
- En modulos operativos compactos como Moodle y Ligas Meet, el ciclo activo y el Cierre de Captura se presentan como panel institucional reducido para no consumir altura innecesaria.
- En los demas modulos se conserva la presentacion original del ciclo cuando no se haya solicitado rediseño especifico.
- Cuando falten 4 dias o menos para el Cierre de Captura, Coordinacion Academica debe ver al iniciar sesion un aviso modal institucional con boton de cierre `X` y accion `Entendido`; el aviso se puede descartar durante esa sesion y vuelve a mostrarse despues de cerrar sesion e ingresar nuevamente mientras siga dentro del periodo de alerta.
- Los historicos deben permitir consultar informacion vinculada al ciclo anterior cuando el modulo lo soporte.

### 24.3 Usuarios, roles y sincronizacion Auth

- Los usuarios pueden existir en Firestore antes de tener `authUid`.
- Cuando una persona inicia sesion con Google por primera vez, el sistema debe permitir sincronizar su `authUid` con el usuario institucional ya creado.
- Las reglas de Firestore toman los permisos efectivos desde `usuarios/{auth.uid}`; por eso todo usuario activo debe terminar con un documento por UID que contenga `role`, `access`, `assignedPrograms`, `status`, `email` y `authUid`.
- Si existe un perfil activo por correo con ID automatico, `syncUserProfileByEmail` migra los permisos al documento UID desde Cloud Functions y elimina duplicados por correo despues de preservar referencias internas necesarias. La interfaz no debe usar el perfil por correo como sesion operativa si aun no existe el documento UID.
- El estado `Activo` no es suficiente si `authUid` sigue pendiente; Sistemas debe poder detectar y sincronizar usuarios con OAuth pendiente.
- Coordinacion Academica no ve Usuarios ni Ciclos.
- Sistemas y auxiliares autorizados pueden administrar usuarios, accesos y programas asignados.

### 24.4 Nomenclaturas, areas y categorias operativas

- La nomenclatura define programa, abreviatura, modalidad, area academica y relacion con grupos.
- El area academica puede ser `Campus TUP` o `Facultad de Ciencias de la Salud`.
- `ING` e `ING-FCS` son nomenclaturas exclusivas de la pestaña Ingles en Asignaciones.
- `ING-FCS` no debe aparecer en Salud aunque pertenezca a Facultad de Ciencias de la Salud.
- `ING` e `ING-FCS` no deben aparecer en Escolarizado, Ejecutivo, Virtual, Posgrados ni Especiales.
- Las categorias Moodle pueden agrupar varias nomenclaturas bajo el mismo numero.
- El catalogo de Categorias Moodle debe permitir que un mismo numero de categoria tenga mas de un programa asociado.
- Recuento operativo de categorias Moodle vigentes:
  - `6`: `ARQ` / `LARQ`.
  - `7`: `ADEM` / `LAF`.
  - `8`: `CONPUB` / `LCPF`.
  - `9`: `CRIMYCRI` / `LCRIMYCRI`.
  - `10`: `DE` / `LDL`.
  - `11`: `EDU` / `MEIT`.
  - `46`: `ADETUR` / `LAET`.
  - `47`: `LPIE` / `PED`.
  - `48`: `ITDYSC` / `SISCOM`.
  - `49`: `LMMD` / `MERC`.
  - `50`: `CINTER` / `LCIYA`.
  - `51`: `DIGRAF` / `LDGD`.
  - `55`: `PROPEDEUTICOS_FCS`.
  - `58`: `PROPEDEUTICOS_TUP`.
  - `62`: `ENF`.
  - `63`: `NUT`.
  - `65`: `EEQX`.
  - `72`: `EECI`.

### 24.5 Grupos

- El modal de nuevo grupo agrega automaticamente el ciclo activo al inicio del grupo.
- El usuario captura solo abreviatura, codigo y seccion.
- La eliminacion masiva por ciclo solo se habilita cuando el filtro de ciclo tiene un ciclo especifico seleccionado.
- Grupos, Nomenclaturas, Docentes, Asignaturas y Asignaciones deben usar paginacion cuando el volumen genere listas largas.
- Los grupos se filtran por ciclo, modalidad, area academica, nomenclatura y permisos de la coordinacion.
- Para compartir clase, un grupo activo del ciclo puede aparecer como destino aunque pertenezca a otra coordinacion, siempre que la regla operativa lo permita.
- El grupo base de una asignacion no debe aparecer como opcion dentro de los grupos compartidos.

### 24.6 Docentes

- El alta manual de Docentes usa tres campos:
  - Nombres.
  - Apellido paterno.
  - Apellido materno.
- Al guardar, el nombre completo se normaliza en mayusculas.
- El usuario Moodle se genera automaticamente con consecutivo institucional `tup-d####`.
- El consecutivo no debe reutilizarse aunque un docente sea eliminado o inactivado.
- Si el ultimo usuario conocido es `tup-d1813`, el siguiente nuevo docente sera `tup-d1814`.
- Existe opcion **Docente que retoma** para capturar un usuario Moodle anterior cuando un docente regresa.
- El correo se deriva del usuario Moodle con dominio fijo `@tecplayacar.edu.mx`.
- Si se captura un correo completo, el sistema conserva la parte local antes de `@` para formar el usuario Moodle.
- El modal de alta y edicion de Docentes permite registrar metadatos operativos:
  - Tipo de pago: `Efectivo`, `Santander` o `Banorte`.
  - Categoria: `V-35hrs`, `M-25hrs` o `N-15hrs`.
  - Telefono del docente, limitado a 10 digitos numericos.
  - Ubicacion: `Foraneo`, `Local` o `Virtual`.
- La tabla actual del catalogo de Docentes muestra tipo de pago, categoria, telefono y ubicacion para facilitar revision operativa.
- La plantilla CSV de Docentes incluye `tipo_pago`, `categoria`, `telefono` y `ubicacion` para completar o actualizar informacion pendiente de forma masiva.
- La importacion CSV de Docentes acepta los codigos operativos usados en reportes: `tipo_pago` `1` Santander, `2` Banorte y `3` Efectivo; `categoria` `V`, `M` o `N`; `estatus` `ACTIVO` como equivalente de validado.
- El reporte CSV de Docentes exporta `tipo_pago` con codificacion administrativa: `1` Santander, `2` Banorte y `3` Efectivo.
- Coordinacion Academica puede agregar docentes; quedan pendientes hasta validacion de Sistemas.
- Al registrar un docente pendiente, Sistemas recibe notificacion en campanita y correo institucional cuando el servicio de correo este configurado.
- Al validar o activar un docente, la coordinacion relacionada recibe notificacion en campanita.
- Sistemas puede descargar un CSV de docentes con su coordinacion asignada.
- Solo Sistemas puede descargar un CSV Moodle de docentes pendientes de validacion con columnas `username`, `password`, `email`, `firstname`, `lastname`, `cohort1` y `auth`; `password` siempre es `#Tecplayacar2019`, `cohort1` queda vacio y `auth` siempre es `oauth2`.
- Al guardar un docente desde Coordinacion Academica, el modal debe limpiarse o cerrarse despues de confirmar escritura en Firestore.

### 24.7 Asignaturas

- Todas las asignaturas se guardan en mayusculas, aunque se capturen en minusculas.
- El ID interno SPAI se mantiene incremental con formato `TUP0000`.
- El ID interno SPAI no es el ID Moodle ni el codigo academico del nombre.
- Cuando una asignatura de plan nuevo incluye codigo, el codigo forma parte del nombre visible, por ejemplo `LDL01 - INTRODUCCION AL DERECHO`.
- Las asignaturas antiguas o de otro tipo con ID interno bajo no deben modificarse solo para agregar codigo al nombre.
- Regla operativa de importaciones masivas con codigo:
  - Si existe una asignatura equivalente con ID interno bajo, se conserva intacta.
  - Si existe una asignatura equivalente reciente con ID interno alto, se puede actualizar con el codigo en el nombre.
  - Si no existe, se crea una asignatura nueva con el siguiente ID interno SPAI.
- El catalogo debe permitir buscar por nombre, codigo incluido en el nombre y estado.
- Asignaturas puede clasificarse visualmente por pestañas equivalentes a las de Asignaciones cuando sea necesario para operar por modalidad/area.

### 24.8 Asignaciones academicas

- Las pestañas operativas vigentes son:
  - Escolarizado.
  - Ejecutivo.
  - Virtual.
  - Salud.
  - Posgrados.
  - Especiales.
  - Ingles.
- La tabla de Asignaciones usa paginacion para evitar listas interminables.
- La busqueda permite criterios por Programa, Grupo, Docente, Materia e ID Moodle.
- Al buscar por Materia, tambien debe considerar el ID Moodle capturado para la asignacion.
- El campo **Distribucion** no forma parte del flujo.
- El flujo principal se conserva como:
  - ID Moodle.
  - Materia.
  - Docente.
  - Carrera/Programa.
  - Grupo.
  - Compartida.
  - Estado.
- La columna Observaciones debe ser visible en tabla.
- Los estados operativos de Asignaciones son:
  - `EN_CAPTURA`.
  - `EN_REVISION`.
  - `CARGADO_MOODLE`.
- El modal de nueva asignacion o edicion siempre guarda `EN_CAPTURA`.
- `EN_REVISION` y `CARGADO_MOODLE` se cambian desde Moodle.
- El ID Moodle puede repetirse si la materia es distinta.
- Si el mismo ID Moodle se usa para la misma materia en el mismo ciclo, debe tratarse como clase compartida y no como duplicado independiente.
- Sistemas ve el Catalogo global de Asignaciones.
- Coordinacion Academica ve por defecto sus asignaciones y puede activar Catalogo global para consulta.
- Coordinacion Academica puede editar y eliminar asignaciones de sus programas asignados, aunque hayan sido creadas por Sistemas.
- Coordinacion Academica tambien puede ver asignaciones compartidas donde uno de sus grupos participa.
- Si la asignacion base pertenece a otra coordinacion, la coordinacion destino puede agregar grupos propios relacionados, pero no puede eliminar el grupo compartido original ni borrar la asignacion base.
- Solo la coordinacion propietaria del grupo base o Sistemas puede retirar grupos destino ya vinculados originalmente por el grupo base.
- Los mensajes de exito o eliminacion deben desaparecer despues de unos segundos.
- La tabla de Asignaciones no debe usar scroll horizontal innecesario en pantallas normales; en pantallas pequeñas debe priorizar acomodo responsive sin romper columnas.

### 24.9 Clases compartidas

- Una clase compartida se guarda como una sola asignacion con grupo base y lista de grupos compartidos.
- No se deben crear filas duplicadas por cada grupo unido.
- El grupo base tambien debe mostrarse como compartido cuando la asignacion tiene grupos destino.
- El visor de clase compartida muestra:
  - Grupo base.
  - Grupos con los que comparte, uno por linea.
- El buscador de grupos compartidos:
  - Busca mientras se escribe.
  - Evita desplegar listas largas completas.
  - Limita la seleccion a un maximo de 8 grupos.
  - Excluye el grupo base.
- Cuando una coordinacion comparte clase con un grupo de otra coordinacion, debe notificarse:
  - A Sistemas.
  - A la coordinacion destino en campanita.
- Cuando se edita una asignacion para compartirla despues de creada, tambien debe notificarse a Sistemas.
- Las notificaciones por hitos de carga de asignaciones se envian a Sistemas cuando una coordinacion alcanza 15 asignaciones y despues cada 15 adicionales.

### 24.10 Especiales y propedeuticos

- La pestaña Especiales tiene tres tipos:
  - Especial con matriculas.
  - Curso especial por grupo.
  - Propedeutico.
- **Especial con matriculas** no usa grupo base; requiere programa/carrera y matriculas.
- **Curso especial por grupo** usa grupo base.
- **Propedeutico** no usa ID Moodle; el campo muestra `Propedeutico`.
- En Propedeutico se aceptan matriculas o grupo, segun el caso operativo.
- Las materias propedeuticas solo aparecen en Especiales y deben iniciar con `TUP --` o `FCS --`.
- Las materias propedeuticas no aparecen en Escolarizado, Ejecutivo, Virtual, Salud, Posgrados ni Ingles.
- En tabla, un caso especial sin grupo debe mostrar `Caso especial`, `Sin grupo base` y las matriculas registradas debajo.
- En el modal de Especiales, matriculas es un dato esencial y debe mostrarse junto a carrera/programa, no escondido en Detalles operativos.

### 24.11 Ingles

- Ingles tiene pestaña propia dentro de Asignaciones.
- Ingles no usa ID Moodle.
- Ingles no usa el campo Observaciones como observacion operativa.
- El campo visible **Adicionales al nombre** fue retirado del modal de Ingles.
- En Ingles, `Materia` se interpreta como **Nivel**.
- En Ingles, `Carrera` se interpreta como **Asignacion** o Campus segun la vista.
- En Ingles, `Grupo` se interpreta como grupo/matriculas.
- Campus TUP asigna la nomenclatura `ING`.
- Facultad de Ciencias de la Salud asigna la nomenclatura `ING-FCS`.
- Modalidades de Ingles:
  - Escolarizado.
  - Ejecutivo.
- Niveles de Escolarizado:
  - `1A`, `1B`, `2A`, `2B`, `3A`, `3B`.
- Niveles de Ejecutivo:
  - `A1-1`, `A1-2`, `A2-1`, `A2-2`, `B1-1`, `B1-2`.
- La asignacion de Ingles debe construirse con ciclo, nomenclatura y nivel; cuando exista grupo, debe quedar alineada visual y operativamente con el grupo.
- Solo la coordinacion academica asignada a `ING` o `ING-FCS` puede crear, editar o eliminar asignaciones de Ingles.
- En Ingles solo deben aparecer docentes asignados a la coordinacion responsable de `ING` o `ING-FCS`.
- La coordinadora responsable de Ingles tambien administra sus docentes.

### 24.12 Reportes de Asignaciones

- Coordinacion Academica cuenta con boton de **Reporte Excel**.
- El reporte se descarga como `.xlsx`.
- El reporte debe incluir asignaciones cargadas por la coordinacion y asignaciones compartidas donde participe alguno de sus grupos, aunque el grupo base sea de otra coordinacion.
- Sistemas puede consultar y exportar desde Catalogo global.
- El boton de reporte se ubica en el panel de seguimiento para conservar una interfaz ordenada.

### 24.13 Ligas Meet

- Ligas Meet ya no es solo pendiente; el modulo opera con vistas derivadas de Asignaciones.
- El titulo operativo de la tabla cambia segun la vista seleccionada: **Sesiones Virtuales** o **Sesiones de Posgrado**.
- El modulo usa el ciclo activo.
- No debe mostrar ID interno SPAI de asignatura.
- Debe mostrar ID Moodle, asignatura, grupo origen, grupos virtuales o grupos de posgrado segun la vista, grupos compartidos, docente, estado de asignacion, estado Meet, liga Meet y horario.
- El campo anterior de Observaciones Meet se reemplaza por **Horario** con selector de fecha y hora.
- Estados Meet:
  - Pendiente.
  - Revisada.
  - Generada.
- El filtro de clase compartida se presenta como pestañas:
  - Todas.
  - Compartidas.
  - Sin compartir.
- Coordinacion Academica puede ver Ligas Meet solo en modo consulta si Sistemas le habilita acceso.
- No hay restriccion operativa si una coordinacion ve sesiones virtuales de todas las coordinaciones en modo consulta.
- Sistemas y auxiliares autorizados pueden editar liga, horario y estado Meet.

### 24.14 Moodle - Catalogos

- Moodle se organiza en dos vistas:
  - Catalogos Moodle.
  - Lotes Moodle.
- Catalogos Moodle muestra:
  - Categorias Moodle en panel lateral.
  - Plantillas de curso como panel principal.
- Categorias Moodle almacena:
  - Categoria Moodle.
  - Programa o programas asociados.
  - Acciones de editar y eliminar con iconos.
- Categorias Moodle permite:
  - Alta manual.
  - Carga CSV UTF-8.
  - Descarga de plantilla CSV.
  - Vista previa cuando se carga CSV.
  - Paginacion.
- Plantillas de curso almacena:
  - ID interno SPAI incremental, oculto al usuario.
  - Nombre corto Moodle.
  - Tipo.
  - Programa cuando aplica.
  - Estado.
- Tipos vigentes de plantilla:
  - Axiologica-Transversales.
  - Axiologica-Generica.
  - Demo.
  - Transversal.
  - Generica.
  - Propedeutico.
  - Fusionadas de Maestria.
  - Profesionalizantes Compartidas.
  - Por programa.
- Plantillas de curso permite:
  - Alta manual.
  - Carga CSV UTF-8.
  - Descarga de plantilla CSV.
  - Vista previa antes de confirmar carga.
  - Busqueda por nombre corto, tipo o programa.
  - Pestañas de clasificacion por tipo, estilo ceja de carpeta.
  - Paginacion para evitar listas largas.
- La plantilla CSV de plantillas debe usar columnas:
  - `nombre_corto_moodle`.
  - `tipo`.
  - `programa`.
  - `estado`.
- Cuando el tipo es `Por programa`, el programa debe elegirse desde un selector predictivo con nomenclaturas existentes.
- `PROPEDEUTICOS_TUP` y `PROPEDEUTICOS_FCS` no deben aparecer en selectores donde correspondan solo programas academicos ordinarios.

### 24.15 Moodle - Lotes

- Lotes Moodle prepara exportaciones CSV para crear cursos y matricular grupos/personas.
- La vista principal lista asignaciones del ciclo activo con categoria y plantilla detectadas.
- Existen pestañas por modalidad:
  - Escolarizado.
  - Ejecutivo.
  - Virtual.
  - Salud.
  - Posgrados.
  - Especiales.
  - Ingles.
- Tambien existe vista por plantilla para revisar asignaciones agrupadas por tipo de plantilla.
- El panel de seguimiento muestra lotes cargados y conteos por modalidad.
- El filtro **Estado** de la tabla principal controla la consulta operativa por estatus:
  - En captura: muestra solo asignaciones pendientes de preparar.
  - En revision: muestra asignaciones en revision o con observacion.
  - Cargado en Moodle: muestra asignaciones cargadas en Moodle o validadas.
- Cuando una asignacion cambia de estado, deja de aparecer en la vista del estado anterior y solo aparece al seleccionar el filtro correspondiente.
- El filtro superior de **Estado** debe recalcular la tabla al instante y usar la misma paleta visual que los estados de cada fila.
- El boton para cambiar de vista se ubica entre **Seleccionar vista** y **Generar CSV**.
- Los comandos superiores de Lotes Moodle se muestran como botones compactos con icono y tooltip para mantener los tres en una sola linea.
- El estado en Lotes debe mostrarse con diseño dinamico, no como selector plano cuando sea posible.

Reglas de deteccion de plantilla:

- Si la asignatura inicia con codigo `AX####` y existe una plantilla con el mismo codigo, se asigna esa plantilla.
- Esta regla aplica tambien para ENF y NUT cuando usen asignaturas axiologicas con codigo.
- Escolarizado usa `CURSO_DEMO_ESCOLARIZADO` solo cuando no pertenece a nomenclaturas del plan 2027 ni a reglas especiales por codigo.
- Salud ENF con grupos `ENF 11` o `ENF 12` primero busca plantilla especifica por nombre de asignatura; si no hay coincidencia, usa `CURSO_DEMO_ENF`.
- Salud NUT con grupos `NUT 11` o `NUT 12` primero busca plantilla especifica por nombre de asignatura; si no hay coincidencia, usa `CURSO_DEMO_NUT`.
- Ejecutivo, Virtual, Posgrados, Especiales, especialidades `EECI`/`EEQX` y maestria `MADH` deben buscar una plantilla cuyo nombre coincida con la asignatura, normalizando mayusculas, acentos, signos de puntuacion, espacios y guiones bajos.
- Para asignaciones de Posgrados, incluyendo la maestria `MADH`, tambien se permite detectar plantilla por codigo inicial de la asignatura o plantilla, por ejemplo `MAEH1`, antes de caer a la coincidencia por nombre.
- Las asignaturas del plan 2027 deben llevar codigo al inicio; si no lo tienen, Sistemas debe ver una alerta para verificarlas.
- Si el grupo es `PSIC`, la plantilla se detecta por codigo abreviado de Psicologia; por ejemplo `PSIC0102` puede coincidir con plantilla `PSIC02`.
- La plantilla Demo no debe reemplazar una plantilla especifica detectada por codigo.

CSV para crear cursos:

- Columnas:
  - `shortname`.
  - `fullname`.
  - `category`.
  - `templatecourse`.
- `shortname` se forma con ID Moodle, nombre de materia sin codigo inicial y ciclo activo, reemplazando espacios por guion bajo.
- Ejemplo: `80_ADMINISTRACION_DE_VENTAS_27-1`.
- Si la materia es `CPF01 - ADMINISTRACION DE VENTAS`, el codigo `CPF01 -` se elimina para construir `shortname` y `fullname`.
- `fullname` se forma con ID Moodle, nombre sin codigo inicial y ciclo activo con espacios.
- `category` usa la categoria Moodle detectada.
- `templatecourse` usa la plantilla detectada.

CSV para matriculacion por grupo:

- Columnas:
  - `shortname`.
  - `enrolment_1`.
  - `enrolment_1_cohortidnumber`.
  - `enrolment_1_role`.
- `enrolment_1` siempre lleva `cohort`.
- `enrolment_1_role` siempre lleva `student`.
- `enrolment_1_cohortidnumber` lleva el grupo asignado.
- Si una misma asignacion comparte varios grupos, cada grupo se genera en una fila separada con el mismo `shortname`.

CSV para matriculacion individual:

- Columnas:
  - `username`.
  - `course1`.
  - `role1`.
- Para matriculas adicionales, `username` lleva la matricula con prefijo `tup`; si ya lo trae, se conserva.
- Para matriculas adicionales, `role1` siempre es `student`.
- Para docentes, `username` lleva el usuario Moodle del docente y `role1` es `editingteacher`.
- Si la asignacion tiene `TEMPORALMENTE SIN DOCENTE`, no se genera fila de docente.
- Si no hay docente real ni matriculas adicionales, no se genera fila individual.

### 24.16 Notificaciones y correo

- La campanita sigue siendo el canal principal dentro del sistema.
- Las notificaciones por correo son un complemento, no reemplazan las notificaciones internas.
- El remitente institucional configurado es `noreply@tecplayacar.edu.mx`.
- Las credenciales o contraseñas de aplicacion deben guardarse como secretos de entorno o configuracion segura, nunca dentro del repositorio.
- El asunto para nuevo docente registrado debe ser `SPAI TUP - Nuevo docente registrado`.
- No se usan corchetes en el asunto para evitar que el correo sea interpretado como urgente.
- El correo HTML debe usar diseño institucional de SPAI:
  - Encabezado azul institucional.
  - Logo TUP en blanco.
  - Mascota institucional cuando se use como elemento visual.
  - Mensaje principal en cuerpo claro y legible.
- Estructura base del mensaje:
  - `El sistema SPAI notifica.`
  - `Equipo de Sistemas, ha llegado una nueva solicitud.`
  - La coordinacion o usuario generador en negritas.
  - Descripcion breve de la solicitud.
  - `Por favor darle seguimiento.`

### 24.17 Bitacora

- Bitacora esta implementada como modulo funcional en la ruta `/bitacora`.
- La lectura usa la coleccion Firestore `bitacora`.
- El repositorio consulta eventos ordenados por `createdAt desc`.
- Acceso:
  - Sistemas.
  - Auxiliares con acceso al modulo Bitacora.
- Coordinacion Academica no accede a Bitacora.
- La vista debe ser profesional y sin datos redundantes.
- Elementos de la vista:
  - Resumen superior de eventos.
  - Filtros por busqueda, modulo, accion y periodo.
  - Lista/timeline de eventos.
  - Detalles expandibles cuando existan metadatos.
  - Panel lateral de seguimiento por modulo y accion.
  - Paginacion.
- La Bitacora registra acciones relevantes de:
  - Usuarios.
  - Ciclos.
  - Nomenclaturas.
  - Grupos.
  - Docentes.
  - Asignaturas.
  - Asignaciones.
  - Solicitudes.
  - Ligas Meet.
  - Moodle.
  - Importaciones y exportaciones CSV.

### 24.18 Identidad visual operativa y tablero de actividades

- Los modulos operativos comparten una identidad visual institucional: panel principal azul profundo, acento cian lateral o superior, tarjetas claras de conteo, controles compactos y tablas con bordes discretos.
- La renovacion visual es responsiva: en pantallas angostas los paneles, filtros, chips, tarjetas y botones se apilan sin ocultar contenido ni alterar sus flujos funcionales.
- Los encabezados de Ciclos, Usuarios, Nomenclaturas, Grupos, Docentes, Asignaturas, Asignaciones, Solicitudes, Ligas Meet, Moodle y Bitacora conservan sus operaciones existentes; el rediseño no cambia permisos, colecciones ni reglas de Firestore.
- El ciclo activo y el cierre de captura se muestran dentro del encabezado operativo cuando aporta contexto; no se duplican en el Dashboard cuando el mismo dato ya esta representado en las tarjetas del rol.
- Los botones de importacion y descarga CSV usan iconos consistentes, texto legible, tooltip cuando aplica y conservan exactamente las acciones ya autorizadas.
- Las pestañas de modalidad, estado y tipo permanecen como controles de filtro funcionales. Se integran visualmente al borde de su panel y no deben romper la tabla o el panel de seguimiento.

#### Dashboard de Sistemas

- El Dashboard de Sistemas conserva bienvenida, tarjetas de conteo reales y el ciclo activo, y agrega un tablero de corcho de actividades solo para perfiles de Sistemas.
- El tablero ofrece las vistas **Equipo** y **Privada**, con columnas **Pendiente**, **En proceso**, **Para revisar** y **Listo**.
- Las actividades se crean, editan, mueven y eliminan solo despues de confirmar la operacion real en Firestore; no se muestra exito anticipado.
- La vista Equipo queda preparada para usar las notificaciones internas y correo existentes al crear actividades para Sistemas, sin modificar ni sustituir esos flujos.
- Coordinacion Academica y roles personalizados no ven el tablero de corcho.

#### Dashboard de Coordinacion Academica

- Coordinacion Academica conserva su dashboard sin tablero de corcho y muestra bienvenida institucional, tarjetas de docentes, ciclos, programas asignados y ciclo activo.
- La tarjeta **Solicitudes a Sistemas** mantiene acceso a los apoyos operativos y se presenta junto a las tarjetas superiores con el mismo lenguaje visual.
- El resumen academico conserva los datos reales y no escribe ni elimina informacion al aplicar cambios visuales.

#### Catalogos y reportes por rol

- En Docentes, Coordinacion Academica puede alternar entre **Mis docentes** y **Ver Global de docentes**. El boton de catalogo global debe tener ancho suficiente para su etiqueta completa.
- El **Reporte CSV** de Docentes para Coordinacion Academica exporta exclusivamente los docentes vinculados a su coordinacion o programas asignados; Sistemas conserva el reporte institucional completo.
- Las asignaturas registradas desde un perfil de Sistemas se identifican en la interfaz como **Sistemas**, no con un nombre tecnico, de prueba o del asistente.
- Ninguno de estos ajustes visuales modifica datos existentes de Firestore por si mismo.
- La publicación de esta renovación incluye una invalidación única de la sesión local por versión: al recargar o reabrir SPAI, cada usuario vuelve a autenticarse una vez para cargar los recursos actualizados. No se desactivan ni eliminan cuentas de Firebase Authentication.

## Exportacion de docentes nuevos y de reingreso

- El modulo Docentes permite a Sistemas exportar un archivo CSV UTF-8 con los docentes clasificados como `Nuevo` o `Reingreso`.
- Antes de descargar, Sistemas selecciona un rango inclusivo de fechas y puede revisar el total de nuevos, reingresos y registros incluidos.
- El reporte conserva los datos operativos del docente, su coordinacion, programas asignados, origen y usuario que realizo el alta.
