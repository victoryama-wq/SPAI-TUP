# E2-R02 — Entorno de aceptación funcional, 28/10/2026

Disponible en **http://127.0.0.1:4204/ciclos**, únicamente desde esta laptop (127.0.0.1). No se abrió acceso remoto ni se redirigió el túnel. El enlace compartido 4206 y su Firestore 18080 permanecieron ajenos a la preparación y a las comprobaciones de esta entrega.

Repositorio de referencia: `C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021`. Rama `codex/usuarios-baja-complemento`. **SHA completo del código de aplicación servido y evaluado: `5ef70c31a44fdc9a11a3ca02b8925f7677b46c91`**. Copia ejecutada: `.local/r02-complement-20261023`. Se compararon 100 archivos de aplicación/Functions y las Rules con el repositorio. Los cambios de esta preparación son scripts de fixtures, correos/nombres ficticios, banda de identificación y metadatos; no alteran lógica de la aplicación, permisos ni Rules. El SHA no se atribuye a estos archivos locales nuevos de preparación.

## Aislamiento e identificación

- Auth **29099**, Firestore **28080**, Functions **25001**, Storage **29199**, hub **24400**, supervisor **24310**, frontend **4204**, todos en loopback.
- Firestore usa el proyecto ficticio `demo-spai-tup` en un proceso y almacenamiento independientes de la demo compartida. Los correos de aceptación son diferentes de sus cuentas compartidas.
- Banda amarilla: **ACEPTACIÓN E2-R02 · PREPARACIÓN/RENOVACIÓN (escenario base) · AISLADO 4204 / 28080 · versión 5ef70c31a44f**. El estado real de cada ciclo sigue en la tabla; el nombre del escenario identifica la base cargada, no congela sus estados después de tus acciones.
- Metadato verificable: http://127.0.0.1:4204/acceptance-version.json.
- Supervisor de importación con guardado periódico cada cinco minutos; última copia en `.local/r02-complement-20261023/.local/r02-review/latest.json`. La tarea «Guardar y detener revision R02 aislada» de VS Code guarda antes de apagar este supervisor.
- No hay suites automáticas programadas ni procesos de pruebas en ejecución después de la entrega.

## Cuentas y facultades

Elegir la cuenta en el desplegable de inicio; no es Google institucional ni una cuenta real. El login DEMO utiliza la contraseña ficticia local `Demo-only-2026!`.

| Cuenta | Correo ficticio | Facultades efectivas |
|---|---|---|
| Sistemas ACEPTACIÓN R02 | demo.aceptacion.sistemas@tecplayacar.edu.mx | ADMIN_GENERAL activo; consulta institucional y gestión de ciclos, Especiales y depuración elegible, bajo validaciones de estado, versión y dependencias |
| Coordinación A ACEPTACIÓN R02 | demo.aceptacion.coordinacion.a@tecplayacar.edu.mx | Coordinación académica, ADM y ciclos autorizados; Asignaciones EDIT sujeto a Captura/Especiales. No administra transiciones de Ciclos |
| Coordinación B ACEPTACIÓN R02 | demo.aceptacion.coordinacion.b@tecplayacar.edu.mx | Equivalente en DER; no administra transiciones de Ciclos |
| Auxiliar ACEPTACIÓN R02 | demo.aceptacion.auxiliar@tecplayacar.edu.mx | Sin delegación en estos fixtures: acceso restringido; el nombre de perfil no concede facultades |
| Usuario inactivo ACEPTACIÓN R02 | demo.aceptacion.inactivo@tecplayacar.edu.mx | Cuenta inactiva, sin acceso efectivo |

No se copió ni alteró la delegación del propietario en la demo compartida. Para el recorrido principal usar Sistemas.

## Cambiar de escenario

En PowerShell, desde el repositorio principal:

```powershell
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021
.\tools\e2-r02\aceptacion.ps1 -Escenario Preparacion
# O, cuando termines el recorrido anterior:
.\tools\e2-r02\aceptacion.ps1 -Escenario Renovacion
```

**Cada comando reemplaza únicamente los datos y cuentas ficticios de la instancia 28080. Pierdes el progreso de tu recorrido anterior en esa instancia.** Cierra formularios/sesión antes de cambiar, espera «ESCENARIO LISTO Y GUARDADO» y recarga 4204. No ejecutar durante una revisión ajena. No modifica la selección de respaldo privado ni 4206/18080. Después de un apagado, primero iniciar «SPAI: Restaurar revision R02 aislada guardada» y «SPAI: Servir revision R02 aislada». Los comandos verifican el proceso/hub, puerto y carpeta antes de escribir.

Los dos escenarios se construyen separadamente con fixtures: Renovación nace sin referencias al histórico anterior; no ejecuta una depuración académica ni una cascada del producto para hacerlo elegible. Preparación vuelve a cargar todas sus referencias. Las restricciones del servidor permanecen intactas.

## Recorrido Preparación (dejado activo)

1. Ver exactamente **26-3 Cerrado** y **27-1 Preparación**, único operativo. Nuevo ciclo inhabilitado. 26-3 conserva dos grupos, dos asignaciones y una solicitud ficticia con referencias válidas.
2. En la fila 27-1 (desplazar horizontalmente la tabla hasta Operación si es necesario), **Iniciar captura** y confirmar. Salir a otro módulo y volver: aparece el modal de Captura, descartable por Entendido/×/Escape. Nuevo ciclo sigue bloqueado. No hay fecha de cierre definida para 27-1; no se inventa una.
3. **Cerrar captura**: revisar aviso y confirmar; comprobar bloqueo académico ordinario. Escribir motivo en la fila y **Reabrir captura**, confirmar. Volver a cerrar para probar **Habilitar Especiales** y **Deshabilitar Especiales**. En Asignaciones, solo la ficha Especiales puede operar con habilitación vigente y ámbito autorizado; existe el grupo ficticio ADM C.A. No habilita captura ordinaria.
4. Con Captura cerrada, **Cerrar ciclo** definitivamente. Revisar Bitácora con el actor de aceptación y consultar ambos históricos desde CICLO DE CONSULTA, dentro del panel azul a la derecha de ESTADO. Los históricos son de solo lectura.
5. Tras el cierre definitivo de 27-1, 26-3 es el histórico anterior: intentar eliminarlo con motivo debe rechazar sus dependencias y conservarlas. Antes del cierre, 26-3 sigue siendo el último histórico protegido; no se espera habilitar su eliminación en ese estado.

## Recorrido Renovación (cargar separadamente)

1. Dos Cerrados: **26-3 vacío** y **27-1 último histórico**, con referencias de consulta conservadas en 27-1. Abrir Nuevo ciclo es posible, pero Guardar permanece bloqueado por el máximo de dos.
2. Abrir Eliminar histórico en 26-3, escribir motivo y cancelar: los dos ciclos siguen iguales.
3. Volver a abrir, indicar motivo y confirmar: desaparece únicamente 26-3. 27-1 continúa como último histórico.
4. Crear **27-2**, con código y nombre, confirmando el formulario: nace en Preparación. Quedan un histórico y un único operativo. Nuevo ciclo se inhabilita de nuevo.

## Comprobación y límites

[Capturas](evidence/r02-acceptance-20261028/index.html), [versión comparada](evidence/r02-acceptance-20261028/source-version.json), [Preparación](evidence/r02-acceptance-20261028/preparation-ui.json), [Renovación](evidence/r02-acceptance-20261028/renewal-ui.json).

Comprobación técnica nueva: login real con cuenta exclusiva, dos ciclos, botón Iniciar habilitado en Preparación, rechazo del guard de dependencias sin modificar ciclos; en Renovación, límite de dos dentro del formulario, cancelación sin cambio, eliminación confirmada mediante modal y motivo, creación confirmada 27-2 y bloqueo posterior. Tras esas pruebas se reconstruyó y guardó Preparación limpia. Las transiciones, concurrencia y demás controles conservan la evidencia evaluada del 26/10; no se repitió una suite integral ni se ensayó sobre la demo compartida.

**No equivale a aceptación humana de E2-R02.** Las seis pruebas INCONCLUSIVE_EVALUATOR, los diez incumplimientos R03, el límite administrativo de 200 documentos, la depuración/renovación con dependencias reales de R04 y las validaciones de producción siguen pendientes. Sin push, merge, despliegue ni conexiones reales.


## Acceso remoto habilitado posteriormente por el propietario

El propietario pidió aplicar los escenarios al túnel 4206. Desde esta actualización, **https://q16qrh63-4206.usw3.devtunnels.ms/** sirve la aceptación de **28080**, compartiendo ese entorno con el acceso local 4204. Sustituye la indicación inicial de acceso solo local. No se copiaron ni reemplazaron los datos de la demo anterior 18080; sus emuladores y su compilación siguen conservados. Solo cambió el proceso de la pasarela 4206.

Versión remota: `tunnel-acceptance-5ef70c31a44f-20261028143511`; código base `5ef70c31a44fdc9a11a3ca02b8925f7677b46c91`, con configuración de aceptación. El banner y los metadatos leen el escenario preparado, por lo que cambiar con `aceptacion.ps1` se refleja en 4204 y en el túnel al recargar, sin recompilar. Ambos accesos actúan sobre los mismos datos aislados: coordinar los recorridos y no cambiar escenarios mientras alguien revisa.

Para reanudar tras un apagado: **SPAI: Restaurar revision R02 aislada guardada**, luego la nueva tarea **SPAI: Servir aceptación R02 por túnel 4206** y reenviar 4206 en VS Code. La tarea antigua «SPAI: 3 Servir demo para tunel» sigue disponible para volver deliberadamente a la demo anterior; no ejecutarlas simultáneamente. No se reenviaron los puertos de emuladores. Si cambia la URL, usar «SPAI: 4 Autorizar URL del tunel» con el nuevo origen, que comparten ambas pasarelas.

El frontend y los scripts de esta pasarela están en `.local/r02-complement-20261023/dist/spai-tup-acceptance-tunnel` y `tools/local/tunnel-acceptance.mjs` dentro de esa copia. El último dato de aceptación se guarda mediante su supervisor 24310. Mantener los respaldos locales existentes.

[Evidencia de revisión HTTPS](evidence/r02-acceptance-tunnel-20261028/result.json), [captura](evidence/r02-acceptance-tunnel-20261028/preparacion-tunel.png). Validación desde el navegador del anfitrión a través del enlace público; no prueba desde otra computadora física ni aceptación del propietario.
