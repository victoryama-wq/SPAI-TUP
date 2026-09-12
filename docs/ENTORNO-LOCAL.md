# SPAI-TUP — Entorno local y pruebas (etapas 0 y 1)

> Ampliacion autorizada el 2026-09-11: se admite una copia local de la BD real
> manteniendo las sesiones DEMO. Si existe `.local/data-source.json`, inicio y
> restablecimiento cargan esa copia. Ver [COPIA-BD-DEMO.md](COPIA-BD-DEMO.md).
> Las cuentas, programas y cantidades sinteticas descritas abajo corresponden
> al modo de fixtures original, que sigue disponible para las pruebas.

El entorno admite dos modos: **ficticio**, creado en codigo para pruebas, y
**copia privada**, con los datos ya descargados y sesiones DEMO. El inicio,
restablecimiento y pruebas no requieren acceso a un proyecto Firebase real
ni iniciar sesion con `firebase login`, Google o SMTP.
Las reglas de Firestore y Storage son las existentes: esta etapa no corrige
permisos, estados ni contratos academicos.

## Requisitos

- Node.js **22.23.2**, fijado en `.nvmrc`; se admite Node 22 desde 22.12.
  El supervisor rechaza otras versiones principales para concordar con Functions.
- npm disponible con Node 22; usar `npm ci` y conservar ambos lockfiles.
- Java **21 o superior** disponible en PATH. La verificacion de esta etapa usa
  Microsoft OpenJDK 25.0.2; Storage emite avisos de API Java deprecada, sin impedir
  la prueba de sus reglas.
- Firebase CLI **15.30.0**, dependencia local fijada; no hace falta instalarlo globalmente.
- Red solo para instalar dependencias y descargar los componentes iniciales de
  Emulator Suite. El trafico operativo de la aplicacion DEMO queda en loopback.

La base sigue en Angular 20 / Firebase SDK 12; las dependencias funcionales no
se actualizan de forma general en esta etapa. La revision de vulnerabilidades
corresponde a la etapa 7. `functions/package-lock.json` se agrega para poder
reproducir la instalacion del backend local.

## Iniciar

Desde la raiz de **SPAI-TUP** (no la carpeta contenedora):

```powershell
node --version
java -version
npm ci
npm ci --prefix functions
npm run local:emulators
```

Esperar **DEMO listo**. El supervisor comprueba puertos, arranca todos los
emuladores, espera una respuesta del emulador de Functions y carga las cuentas
y el conjunto seleccionado: copia si existe seleccion valida, fixtures si no.
Si falta un servicio, falla y detiene su propia sesion; no se conecta a produccion.
La primera descarga puede tardar mas: si vence el limite de arranque, corregir
la descarga o conexion y repetir el comando.

En otra terminal, desde la misma raiz:

```powershell
npm start
```

Abrir <http://127.0.0.1:4200/>. El encabezado indica **DEMO LOCAL**. Elegir una
cuenta DEMO y pulsar **Ingresar a DEMO**. En modo copia se enlazan cuatro perfiles
originales y un inactivo ficticio; en modo sintetico todos son ficticios.
El control de version de sesion
preexistente puede cerrar el primer acceso; volver a pulsar Ingresar si ocurre.

La tabla siguiente describe **solo los fixtures**, no los roles/programas de
los perfiles privados enlazados. Para estos, ver `.local/import-report.json`.

| Cuenta | Rol ficticio | Programas ficticios |
|---|---|---|
| `demo.sistemas@tecplayacar.edu.mx` | Coordinación de Sistemas | Acceso de Sistemas existente |
| `demo.auxiliar@tecplayacar.edu.mx` | Auxiliar de Sistemas | Acceso de Sistemas existente |
| `demo.coordinacion.a@tecplayacar.edu.mx` | Coordinación Académica | ADM |
| `demo.coordinacion.b@tecplayacar.edu.mx` | Coordinación Académica | DER |
| `demo.inactivo@tecplayacar.edu.mx` | Coordinación Académica, inactivo | Ninguno |

La clave local comun es `Demo-only-2026!`. Estas identidades solo existen en
Authentication Emulator. Se usa el dominio institucional para conservar la
validacion actual del producto; no se consulta Google ni se envia correo a ellas.
Los docentes ficticios usan `example.invalid`; los datos de la copia conservan
sus valores originales. No abrir sus ligas Moodle/Meet durante las pruebas.

## Servicios y aislamiento

| Servicio | Direccion |
|---|---|
| Authentication | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8080` |
| Functions, region `us-central1` | `127.0.0.1:5001` |
| Storage | `127.0.0.1:9199` |
| Interfaz de emuladores | <http://127.0.0.1:4000/> |
| Hub | `127.0.0.1:4400` |
| Control del supervisor | `127.0.0.1:4310` |
| Puertos auxiliares | `4500`, `9150` |

- `environment.ts` es local y contiene solo el proyecto `demo-spai-tup` y una
  API key ficticia. `environment.prod.ts` conserva `spai-6ef68`.
- `npm start`, las configuraciones Angular `local` y `development` usan el
  entorno DEMO. Solo el build `production` reemplaza el archivo de entorno.
- `firebase.runtime.ts` conecta Authentication, Firestore, Functions y Storage
  antes de entregar servicios a Angular. Una configuracion incompleta, un proyecto
  real en modo local o una inicializacion previa desconocida provoca error.
- El index local aplica CSP para bloquear conexiones de red fuera de loopback,
  no carga Google Fonts ni recursos de la web publicada. La compilacion local
  rechaza ejecutarse desde un host externo. La CSP permisiva para scripts de
  desarrollo **no se aplica al index de produccion**.
- No se permite Google OAuth real en el modo local. El selector DEMO solo invoca
  Authentication Emulator; no crea una via de acceso en produccion.
- Functions verifica proyecto y hosts. El correo termina en `SIMULADO_LOCAL`
  antes de obtener destinatarios, leer `SPAI_SMTP_PASSWORD` o abrir SMTP.
- El supervisor elimina tokens de nube heredados, aísla configuraciones del CLI
  y apunta ADC a una ruta inexistente bajo `.local`. No necesita service accounts.
- `firebase.local.json` referencia las mismas reglas; Storage sigue cerrado.
  Un intento de carga debe responder `storage/unauthorized` en el emulador.
- No se usa Hosting Emulator: Angular sirve la web local. No se hace ninguna
  importacion real en Moodle, creacion de Meet ni migracion de datos reales.
- `.firebaserc` selecciona DEMO por defecto. El alias `production` conserva el
  destino original para una publicacion futura expresamente autorizada.

Los emuladores confian en el equipo local y no deben exponerse en la red.
Usar los scripts, no lanzar un subconjunto de emuladores contra un proyecto real.
El script legado `tools/migrate-docentes.mjs` usa APIs reales y service accounts:
**no forma parte del entorno local y no debe ejecutarse para estas pruebas**.

## Datos ficticios y restablecimiento

Se generan 5 cuentas y 39 documentos base: perfiles con los roles actuales, una
plantilla de consulta, dos coordinaciones/programas, docentes en tres estados,
asignaturas, grupos, asignaciones, solicitudes, categorias y plantillas Moodle,
configuracion y un aviso que prueba el correo simulado. Los triggers pueden
agregar entradas de bitacora con fechas de ejecucion.

Los ciclos son `27-2` (Preparacion), `27-1` (Captura), `26-3` (Captura cerrada) y
`26-2` (Cerrado). **Limitacion funcional existente:** el repositorio considera
operativos tanto Captura como Captura cerrada. Se ordenan las fechas ficticias
para que seleccione 27-1; no se corrige esta ambiguedad en la etapa 0.

```powershell
npm run local:seed
```

En modo ficticio, vuelve a escribir documentos y cuentas conocidos usando IDs deterministas;
no elimina registros adicionales. Restablece los valores base de esos documentos.
Para empezar desde cero, manteniendo la web en su otra terminal:

```powershell
npm run local:reset
```

El supervisor detiene su arbol de procesos y arranca una sesion vacia, luego carga
el conjunto seleccionado. Se pierden las escrituras locales de prueba, usuarios adicionales
y objetos de Storage. Cerrar sesion/recargar el navegador y volver a elegir la
cuenta DEMO. En modo copia se importa el archivo privado ya descargado, sin
lectura online; se verifican sus documentos. `local:seed` rechaza mezclar una
copia con una BD poblada: en ese modo utilizar `local:reset`.

## Comandos y selección de datos

| Comando | Efecto | Copia privada / red |
|---|---|---|
| `local:emulators` | Inicia servicios y carga selección vigente | Lee copia local solo si seleccionada; sin consulta online |
| `start` | Inicia Angular DEMO en 4200 | No inicia ni carga emuladores |
| `local:data:copy` | Verifica y selecciona archivo de latest.json | No descarga; no modifica servicios ya abiertos |
| `local:data:synthetic` | Retira selección para próximo inicio/reset | Conserva archivo de copia; no modifica servicios abiertos |
| `local:seed` | Reescribe fixtures conocidos, sin borrar extras | Copia solo sobre emulador vacío; rechaza mezcla |
| `local:reset` | Reinicia servicios propios vacíos y carga selección | Pierde cambios locales; conserva archivo y selección |
| `local:stop` | Detiene solo sesión propia de emuladores | No borra copia ni selección; Angular se detiene aparte |
| `test:local:unit` | Pruebas de configuración/conversión con objetos ficticios | No requiere emuladores ni archivo privado |
| `test:local` | Suite original de aislamiento, reset y offline | Fuerza fixtures en el proceso, conserva selección privada |
| `test:stage1` | Suite original más permisos y lógica funcional | Siempre ficticio; requiere puertos libres; apaga al terminar |
| `test:contracts` | Evalúa reportes de la última ejecución de stage1 | No inicia servicios; retorna 1 mientras haya incumplimientos |
| `local:data:export` | Nueva descarga online, solo con autorización expresa | No es inicio ni test; crea otro archivo, conserva anterior |

Para aplicar una selección ejecutar `local:reset` si los servicios propios están
abiertos, o `local:emulators` si están detenidos. Las pruebas no deben ejecutar
comandos de selección ni exportación. Al terminarlas, `local:emulators` recupera
la copia seleccionada sin necesitar `local:data:copy` de nuevo.

La carga valida el PID del hub frente al proceso iniciado por el supervisor y
los endpoints esperados. El control exige un token efimero guardado en
`.local/session.json`, ignora llamadas del navegador con Origin y no acepta
parametros para cambiar de proyecto. Un puerto ocupado por otra aplicacion
produce error; no se termina ese proceso.

## Detener

```powershell
npm run local:stop
```

Tambien se admite Ctrl+C en la terminal de emuladores. Detener `npm start` con
Ctrl+C en su propia terminal. En Windows se usa `taskkill /T` exclusivamente
sobre el hijo iniciado por el supervisor; en otros sistemas se senaliza su grupo
de procesos. Solo Windows ha sido verificado en esta etapa.

## Comprobaciones reproducibles

Con los emuladores detenidos y puertos libres:

```powershell
npm run test:stage1
npm run test:contracts
npm run build:local
npm run build
npm run check:functions
```

`test:local` ejecuta las comprobaciones unitarias, inicia una sesion propia,
carga fixtures, prueba escrituras/lecturas con los SDK reales, una callable,
Storage cerrado, correo simulado, las cinco cuentas y la recarga de fixtures.
Tambien prueba restablecer y finalmente apaga los emuladores para comprobar el
fallo de los cuatro SDK sin conexion alternativa a produccion. El observador de
red de las pruebas registra y bloquea cualquier socket que no sea loopback.

Firestore puede dejar una escritura pendiente mientras no hay conexion; eso no
equivale a una escritura confirmada. La prueba exige que no se confirme y que
solo se intente 127.0.0.1. No modifica ese comportamiento del SDK.

La suite original verifica **aislamiento**. `test:stage1` añade caracterización
de reglas mediante SDKs reales y de métodos UI/repositorios TypeScript; no es
smoke completo de navegador. `test:contracts` debe fallar mientras existan
incumplimientos documentados. No equivale a aprobación de seguridad. Consultar
[ETAPA-1-PRUEBAS.md](ETAPA-1-PRUEBAS.md) y [ESTABILIZACION.md](ESTABILIZACION.md).

## Referencias

- [Firebase: proyectos demo y conexion a Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth).
- [Firebase: conexion a Functions Emulator](https://firebase.google.com/docs/emulator-suite/connect_functions).
- [Firebase: conexion a Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore).
