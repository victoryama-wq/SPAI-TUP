# Copia de la BD para la demo local

## Alcance autorizado

El 2026-09-11 el propietario autorizo copiar la BD online y trabajar con sus
datos, manteniendo el inicio de sesion DEMO. Esta indicacion amplia el uso de
datos de la etapa 0; no autoriza correcciones funcionales ni escrituras online.

Se lee Firestore `(default)` de `spai-6ef68` con la cuenta institucional ya
autorizada. No se exportan usuarios de Authentication, contrasenas, claves,
objetos de Storage ni configuracion de infraestructura. Las ligas almacenadas
en documentos se conservan; abrir una liga externa puede llevar al servicio real.

## Copia obtenida

- Instante de lectura consistente: **2026-09-11 13:58:34.492 America/Cancun**
  (`2026-09-11T18:58:34.492Z`).
- 6.109 documentos, 17 colecciones principales; se revisaron tambien las
  subcolecciones, sin encontrar documentos adicionales.
- Incluye 730 asignaciones, 1.078 asignaturas, 204 docentes, 291 grupos,
  75 ligas Meet, 347 plantillas Moodle, 16 perfiles y 1 ciclo, entre otros datos.
- SHA-256 del archivo original:
  `b3ddfc0d73a8b6c2e0415cb171456843c0d76bb84009b8562da66744321492ed`.

La copia completa y sus manifiestos estan en `.local/source-data/`, excluida de
Git. Contiene datos reales, sin anonimizacion por indicacion del propietario.
No se publica ni se incorpora a los archivos servidos por Angular.

El exportador solo permite listar colecciones y leer documentos en el proyecto
fijado. Usa el mismo `readTime` en la paginacion y recorrido de subcolecciones,
incluidos padres sin documento. Conserva los valores tipados REST de Firestore
para no perder enteros de 64 bits, timestamps, bytes o referencias. Los tokens
se usan en memoria; no se guardan en la copia ni se imprimen.

## Inicio de sesion conservado

Se conservan los cinco correos y el selector DEMO de la etapa 0. Para cuatro
cuentas se crea un usuario **solo en Authentication Emulator**, cuyo UID es el
ID del perfil original elegido. En ese perfil local cambian unicamente `email`
y `authUid`. Nombre, rol, estado, programas y permisos se conservan; no se
reescriben referencias de docentes, asignaciones, solicitudes o bitacora.

El usuario inactivo DEMO es adicional y ficticio porque no hay un equivalente
con su rol y estado en la copia. Por eso el entorno tiene **6.110 documentos**
al completar la importacion. Los otros 12 perfiles originales permanecen en la
BD; esta intervencion no crea accesos DEMO adicionales para ellos.

La asignacion exacta de cada selector a su perfil se guarda localmente en
`.local/import-report.json`. La clave DEMO sigue siendo `Demo-only-2026!`.
Los UID de los accesos ya no son los cinco UID sinteticos de la primera demo.
Despues del cambio de conjunto de datos, cerrar sesion y volver a ingresar.
En DEMO, el navegador no crea perfiles automaticamente cuando faltan: espera
los perfiles del supervisor. Esto evita que una sesion persistida contamine
la BD vacia durante un reinicio; el comportamiento de produccion se conserva.

## Reinicio y recuperacion de la copia

```powershell
npm run local:emulators
# En otra terminal:
npm start
```

`.local/data-source.json` selecciona el archivo por nombre y SHA-256.
El inicio normal carga esa copia automaticamente, sin conectarse a produccion.

```powershell
npm run local:reset
```

Restablece los emuladores propios y vuelve a importar la copia seleccionada;
se pierden las modificaciones de prueba locales. `local:seed` no mezcla la
copia con una BD poblada: en este modo debe usarse `local:reset`.

Durante la importacion se suspenden los triggers de fondo del emulador y se
reactivan al terminar. Asi se conservan los avisos y la bitacora copiados, sin
crear eventos por la carga. Las nuevas operaciones locales siguen ejecutando
Functions con correo simulado. Se verifica cada documento importado comparando
ruta, campos y tipos con la copia preparada. Los tiempos internos de creacion y
actualizacion de Firestore corresponden a la importacion; los campos de fecha
guardados dentro de los documentos se conservan.

## Cambiar conjunto de datos

```powershell
npm run local:data:synthetic
npm run local:reset
# Para volver a la copia descargada:
npm run local:data:copy
npm run local:reset
```

La seleccion no modifica por si sola el emulador en ejecucion. Cambia el conjunto
de datos que se cargara al reiniciar o restablecer.

Solo para una nueva descarga online autorizada:

```powershell
npm run local:data:export
npm run local:data:copy
npm run local:reset
```

La descarga genera otro archivo y conserva el anterior. No es sincronizacion
continua ni respaldo administrado para recuperacion de produccion. La lectura
online consume operaciones de lectura de Firestore.

## Verificacion

```powershell
npm run test:local:unit
# Con la copia ya cargada:
node tools/local/tests/verify-copy.mjs
```

La suite `npm run test:local` usa siempre fixtures sinteticos, aunque la copia
este seleccionada; requiere detener primero los emuladores. No modifica el
archivo de seleccion. Al terminar, iniciar `local:emulators` para recuperar la
copia. Esta suite no usa credenciales ni lee produccion.

Los resultados de la carga actual y las pruebas se registran en
[ESTABILIZACION.md](ESTABILIZACION.md). La copia conserva los problemas de datos
y permisos que existan; no los corrige ni certifica los flujos de otras etapas.

## Referencias

- [Firestore REST: listado de documentos, readTime y padres ausentes](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/list).
- [Firestore REST: listado de colecciones con readTime](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listCollectionIds).
