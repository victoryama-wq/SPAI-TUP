# Demo sintética en la red local

La configuración `lan` es optativa. `npm start` y los emuladores conservan sus
direcciones de loopback. No se utilizan los datos de producción ni se cambia
`.local/data-source.json`. La copia privada permanece fuera de la compilación.

## Inicio desde Visual Studio Code

En este equipo se preparó `.vscode/tasks.json` (configuración local ignorada por
Git). Con los emuladores sintéticos activos, selecciona **Terminal → Ejecutar
tarea → SPAI: Compartir demo en LAN** e indica la IPv4 del equipo. La tarea
compila el frontend y deja el servicio en su terminal; Ctrl+C lo detiene.

Dirección detectada el 14 de octubre de 2026: `http://192.168.41.254:4201/`.
La dirección puede cambiar al reconectar el Wi-Fi. Las otras computadoras deben
estar en la misma subred, sin aislamiento de clientes Wi-Fi.

Equivalente con Node 22 desde una terminal en la raíz del proyecto:

```powershell
node node_modules/@angular/cli/bin/ng.js build --configuration lan
node tools/local/lan.mjs 192.168.41.254
```

Si los emuladores están detenidos, iniciarlos primero en otra terminal:

```powershell
$env:SPAI_LOCAL_SYNTHETIC = 'true'
node tools/local/run.mjs
```

Cuando indique DEMO listo, preparar la identidad de aceptación desde otra terminal:

```powershell
npm run local:r01:prepare -- --capture-fixture
```

Esto crea/vincula únicamente **Consulta R01 DEMO**, con VIEW Asignaciones en
ADM / 27-1. La opción deja el ciclo ficticio 27-1 en Captura y conserva antes
su estado en `.local/acceptance`; omitirla si se desea conservar el estado actual.
No reactiva perfiles ni asignaciones retiradas. Después compilar/iniciar LAN
con los comandos anteriores o la tarea de VS Code. No iniciar una segunda
instancia si la tarea ya muestra «DEMO LAN lista».

No ejecutar `local:data:synthetic`: cambiaría la selección persistente. El
supervisor registra el modo sintético de esta ejecución en `.local/session.json`.
La pasarela exige ese modo, verifica el hub y rechaza una sesión que cambie.

## Alcance

- Solo escucha en la IPv4 privada indicada, puerto TCP 4201; acepta la subred
  de esa interfaz y el Host/Origin esperados.
- Publica el frontend compilado y las rutas de cliente de Auth, Firestore,
  Functions y Storage. Los SDK apuntan al mismo origen y la CSP bloquea otros
  destinos. No publica UI, hub, control ni rutas administrativas de emuladores.
- Los datos de prueba son compartidos: las modificaciones de un probador son
  visibles para los demás. Las cuentas del selector son ficticias y los correos
  se simulan. Es un entorno de pruebas de confianza, sin capacidad productiva.
- Los identificadores de operaciones usan UUID criptográficos también en HTTP
  LAN, donde `crypto.randomUUID` puede no estar disponible.
- El equipo anfitrión debe permanecer encendido, conectado y sin suspenderse.

## Evidencia y límites actualizados el 14 de octubre

El usuario inició la tarea LAN en VS Code después del bloqueo automático del
intento anterior. Esta revisión conservó el servicio y actualizó su frontend.
Chromium en el anfitrión comprobó por la IP LAN inicio, navegación y recarga
con Sistemas y Consulta R01, Auth/Firestore/Functions por el mismo origen,
sin conexiones observadas a producción. Rutas administrativas y bearer owner
rechazados. `tools/e2-r01/lan-smoke.mjs` deja evidencia en `.local/acceptance`.
El recorrido completo desde **otra computadora física sigue pendiente**;
la revocación entre dos laptops ya reportada por el usuario se conserva.
No se cambió el firewall ni se publicó el servicio en Internet.

El selector DEMO no es el acceso institucional definitivo. Production conserva
Google institucional y su dominio autorizado; ningún parámetro URL activa DEMO.
La aprobación manual del propietario permanece pendiente: véase
[el guion y reporte corregido](HALLAZGOS-PRUEBA-MANUAL-E2-R01.md).

## Pruebas sin interrumpir a los compañeros

Con Node 22, `npm run test:r01:acceptance` arranca emuladores **aislados** en
loopback (19099/18080/15001/19199, hub 14400, UI 14000, web 4202) con fixtures
ficticios, ejecuta R01/E1/UI y los detiene al terminar. No reinicia la demo LAN.
`npm run test:contracts` conserva la salida 1 por los 18 incumplimientos R02/R03;
no confundir ese gate contractual con las caracterizaciones aprobadas.

## Detener y volver a iniciar

1. Ctrl+C en la terminal de la tarea **SPAI: Compartir demo en LAN** detiene 4201.
2. Si se usa `npm start` para 4200, Ctrl+C en su terminal detiene ese frontend.
3. `npm run local:stop` detiene solo los emuladores de la sesión de este proyecto.
4. Para volver a iniciar, repetir el inicio sintético, preparación de la cuenta,
   compilación LAN y pasarela, en ese orden. No ejecutar `local:reset` durante
   pruebas compartidas: los datos sintéticos de esta sesión son temporales.

La revisión deja funcionando la demo existente. La copia privada y su selección
persistente permanecen intactas; no usar `local:data:copy` ni `local:data:synthetic`
para este procedimiento. El presupuesto del build production sigue mostrando
un aviso de 768.66 kB frente a 750 kB; compila sin error. No autoriza despliegue.
