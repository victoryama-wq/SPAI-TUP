# Demo LAN del complemento — 21 de octubre de 2026

La petición posterior del propietario autoriza visualizar el complemento por LAN. Se publica una pasarela independiente en **http://192.168.42.1:4205/**; se conservan las demos anteriores y los datos presentes, sin fixtures ni reset.

- Implementación revisable: `9a646993b96a91316fc53804cc4dd8039affd1aa`, incluye la tarjeta de Ciclos de `775dc7e661e08442de9f57ce37b567b33f1d285b`.
- Interfaz comprobada: Wi-Fi, IPv4 192.168.42.1/22. La dirección puede cambiar al reconectar la red.
- Servicios: proyecto ficticio `demo-spai-tup`, slot `complement`; Auth 29099, Firestore 28080, Functions 25001 y Storage 29199 permanecen en loopback. La pasarela solo publica las rutas de aplicación y acepta clientes de la subred actual.
- Cuenta comprobada: **Sistemas DEMO**. Se conserva el estado resultante de los ensayos aislados, incluidas cuentas dadas de baja; no se reconstruyen cuentas para esta publicación.
- Ajuste técnico: puerto 4205 admitido únicamente con configuración DEMO LAN explícita y los cuatro servicios en el mismo origen. No cambia autorización funcional.

## Comprobación desde el anfitrión

Build Angular LAN aprobado y pruebas de configuración **7/7**. Navegador real contra 4205: login, directorio, vista previa de baja de una persona ficticia y cancelación; modal Cerrar captura y cancelación. Lectura de usuarios, delegaciones y ciclos idéntica antes/después. Único comando de baja: `prepare`. Sin errores JavaScript. Rutas administrativas no publicadas (404) y credencial administrativa rechazada (403).

Resultados de la ejecución del 22 octubre 00:20 UTC / 21 octubre 19:20 Cancún en `.local/lan-review-smoke.json`; capturas locales `lan-usuarios-confirmacion.png` y `lan-ciclos-confirmacion.png` en `.local/`. La demo anterior 4203 no se modifica.

## Incidencia de acceso físico

Firewall Windows habilitado. El intento de agregar una regla limitada a TCP 4205, dirección local y subred recibió **Acceso denegado**. No se cambió el firewall ni se deshabilitaron protecciones. No se ha probado otra computadora física. Si Windows bloquea su acceso, un administrador debe habilitar ese puerto para la red local; el script local `tools/local/allow-complement-lan.ps1` verifica la dirección y crea únicamente esa regla.

## Estado de validación

Esta comprobación acredita disponibilidad desde el anfitrión, no aceptación humana ni preparación productiva. Permanecen las dos verificaciones de Rules inconclusas por errores del evaluador documentadas en `USUARIOS-BAJA-VALIDACION-2026-10-21.md`, el límite administrativo de 200 documentos y los gates contractuales/remotos/migración/reversión previamente registrados. Sin push, merge, despliegue remoto ni acceso al respaldo privado.
