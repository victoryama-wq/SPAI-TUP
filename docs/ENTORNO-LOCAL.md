# SPAI-TUP — Entorno local aislado (etapa 0)

Este entorno usa datos ficticios creados en codigo. No requiere acceso a un
proyecto Firebase real ni iniciar sesion con `firebase login`, Google o SMTP.
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
emuladores, espera una respuesta real de Functions y carga las cuentas y fixtures.
Si falta un servicio, falla y detiene su propia sesion; no se conecta a produccion.
La primera descarga puede tardar mas: si vence el limite de arranque, corregir
la descarga o conexion y repetir el comando.

En otra terminal, desde la misma raiz:

```powershell
npm start
```

Abrir <http://127.0.0.1:4200/>. El encabezado indica **DEMO LOCAL**. Elegir una
cuenta ficticia y pulsar **Ingresar a DEMO**. El control de version de sesion
preexistente puede cerrar el primer acceso; volver a pulsar Ingresar si ocurre.

| Cuenta | Rol actual | Programas |
|---|---|---|
| `demo.sistemas@tecplayacar.edu.mx` | Coordinación de Sistemas | Acceso de Sistemas existente |
| `demo.auxiliar@tecplayacar.edu.mx` | Auxiliar de Sistemas | Acceso de Sistemas existente |
| `demo.coordinacion.a@tecplayacar.edu.mx` | Coordinación Académica | ADM |
| `demo.coordinacion.b@tecplayacar.edu.mx` | Coordinación Académica | DER |
| `demo.inactivo@tecplayacar.edu.mx` | Coordinación Académica, inactivo | Ninguno |

La clave local comun es `Demo-only-2026!`. Estas identidades solo existen en
Authentication Emulator. Se usa el dominio institucional para conservar la
validacion actual del producto; no se consulta Google ni se envia correo a ellas.
Los docentes ficticios usan `example.invalid`.

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

Vuelve a escribir los documentos y cuentas conocidos usando IDs deterministas;
no elimina registros adicionales. Restablece los valores base de esos documentos.
Para empezar desde cero, manteniendo la web en su otra terminal:

```powershell
npm run local:reset
```

El supervisor detiene su arbol de procesos y arranca una sesion vacia, luego carga
los fixtures. Se pierden las escrituras locales de prueba, usuarios adicionales
y objetos de Storage. Cerrar sesion/recargar el navegador y volver a elegir la
cuenta DEMO. No se guardan ni importan exportaciones de produccion.

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
npm run test:local:unit
npm run test:local
npm run build:local
npm run build
npm run lint --prefix functions
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

Estas pruebas verifican **aislamiento**, no certifican la matriz de permisos ni
los flujos academicos completos. El modo local conserva los fallos funcionales
registrados en [ESTABILIZACION.md](ESTABILIZACION.md).

## Referencias

- [Firebase: proyectos demo y conexion a Authentication Emulator](https://firebase.google.com/docs/emulator-suite/connect_auth).
- [Firebase: conexion a Functions Emulator](https://firebase.google.com/docs/emulator-suite/connect_functions).
- [Firebase: conexion a Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore).
