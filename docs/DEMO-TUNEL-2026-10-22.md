# Demo histórica por túnel — 22 de octubre de 2026

Preparación local en `SPAI-TUP-BAJA-20261021`, rama `codex/usuarios-baja-complemento`, base `16671e2b5b9021fa2069e2b0587e595338f7fb29` más cambios locales de esta revisión. Revisión servida: `tunnel-recovery-20261022-01`, consultable en `/demo-version.json`.

## Recuperación autorizada

El propietario eligió recuperar primero la sesión anterior y autorizó expresamente restaurar la captura histórica en una sesión separada al conocer sus límites. No se encontró exportación de la última sesión 4205. Se importó `SPAI-TUP/.local/lan-recovered-20261019/initial-native`, creada el 19 de octubre a partir de la captura del **16 de octubre**. No representa el estado del 20–21 de octubre.

Verificación antes de iniciar sesión: **39 documentos de 13 colecciones, 6 identidades**, comparación exacta de todos los documentos capturados, incluidos usuarios y delegaciones. La exportación fuente se mantiene intacta (manifiesto SHA256 verificado al exportar). Auth contiene identidades ficticias reconstruidas en aquella recuperación; las sesiones antiguas no se recuperan. Storage histórico está vacío. No se recuperan colecciones no capturadas ni se inventan mapeos, previews o idempotencias. No se leyó ni modificó el respaldo privado ni su selector en esta revisión.

La sesión usa puertos propios en loopback: Auth 49099, Firestore 48080, Functions 45001, Storage 49199, hub 44400, UI 44000 y control 44310. No sustituye los archivos de sesión de las demos anteriores. El supervisor importa la última exportación propia si existe; jamás llama a seed/reset. Guarda una exportación nueva al arrancar, cada cinco minutos y antes de detenerse; actualiza `latest.json` solo tras comprobar el éxito. No se debe cerrar la terminal a la fuerza: se podrían perder cambios posteriores al último guardado.

## Pasos exactos en este equipo

Carpeta que debe abrirse en VS Code:
`C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021`.

Las tareas locales preparadas están en `.vscode/tasks.json`, ignorado por Git. Usan Node 22 instalado en este equipo. Para un arranque futuro, ejecutar desde **Terminal → Ejecutar tarea**, en este orden:

1. **SPAI: 1 Recuperar demo historica**. Esperar `RECUPERACION HISTORICA LISTA`; conservar la terminal abierta.
2. **SPAI: 2 Compilar demo tunel**. Esperar a que termine.
3. **SPAI: 3 Servir demo para tunel**. Esperar `PASARELA LISTA`; conservar la terminal abierta.
4. `Ctrl+Shift+P` → `Ports: Focus on Ports View` → `Forward a Port` → **4206**. Autenticarse si lo solicita y conservar visibilidad **Private**.
5. Copiar `Forwarded Address`. Ejecutar **SPAI: 4 Autorizar URL del tunel** y pegar la URL HTTPS completa sin rutas adicionales. La pasarela lee el cambio sin reiniciar emuladores.
6. Abrir el enlace, autenticarse con la misma cuenta usada para el túnel y seleccionar **Sistemas DEMO → Ingresar a DEMO**. El aviso superior identifica expresamente la captura histórica.

En la ejecución actual los pasos 1–5 ya se realizaron. URL proporcionada por el propietario: `https://q16qrh63-4206.usw3.devtunnels.ms/`. Si VS Code entrega otra URL, repetir el paso 5. No iniciar otra instancia si los servicios ya están activos.

Para terminar: detener el reenvío en Puertos; Ctrl+C solo en la terminal de la pasarela; ejecutar **SPAI: Guardar y detener recuperacion** y esperar confirmación `exported: true, stopped: true`. Si el guardado falla, el supervisor conserva los servicios y la última exportación. No usar `local:reset`, `local:seed` ni el supervisor ordinario para esta recuperación.

El modo privado requiere la cuenta que abrió el túnel; no habilita automáticamente a compañeros con otras cuentas. No cambiarlo a público para compartir credenciales DEMO administrativas sin preparar antes el acceso de los revisores. Solo se reenvía 4206, nunca los emuladores o sus consolas.

## Comprobaciones y límites

- Configuración y política del túnel: **10/10** pruebas, incluyendo regresión LAN/producción, origen HTTPS exacto, bloqueo de altas administrativas Auth y APIs administrativas.
- Navegador Chromium con proxy TLS local: login, lectura Firestore y directorio mediante Functions correctos. Todas las peticiones observadas al mismo origen HTTPS; sin errores JavaScript. Evidencia local `.local/tunnel-recovery/browser.json` y `usuarios-https-local.png`.
- Pasarela: APIs administrativas 404; bearer owner y origen ajeno 403. Solo loopback, proyecto `demo-spai-tup` y sesión histórica verificada.
- Builds `tunnel` y `production` correctos. Aviso previo de tamaño: inicial production 784.27 kB frente al presupuesto 750 kB.
- La URL real respondió **302 hacia autenticación GitHub** sin credenciales: protección privada observable. El recorrido autenticado por Internet y la prueba desde otra computadora aún requieren al propietario; la prueba TLS local no los sustituye.
- Auth, Firestore y Functions tienen destinos HTTPS explícitos. No hay consumidores de Firebase Storage en las pantallas actuales; su transporte HTTPS no se acredita con este ensayo (la captura no contiene archivos). No se afirma validación de cargas/descargas por túnel.
- Se corrigió una carrera del arnés de pruebas: dos procesos sobrescribían el mismo módulo temporal. Cada proceso usa ahora su propio archivo; no se cambiaron expectativas.
- No se modificaron Rules, perfiles, delegaciones ni reglas de negocio. No hay push, merge, despliegue de producción ni conexión con Moodle/SAEKO. Permanecen el límite administrativo de 200 documentos y los gates contractuales/remotos/migración/reversión previamente documentados. Esta publicación de desarrollo no constituye aceptación humana ni preparación productiva.

Referencia operativa: [Port Forwarding de VS Code](https://code.visualstudio.com/docs/debugtest/port-forwarding).

## Corrección posterior: pantalla en blanco en el túnel real

El 22 de octubre el propietario reportó que solo aparecía la banda histórica. Se comprobó en su pestaña del navegador: HTML presente, `spai-root` vacío. La pasarela registró 403 en `main.js`, `polyfills.js` y los módulos porque VS Code reescribe `Host` y `Origin` a `localhost:4206` y `http://localhost:4206`, conservando `X-Forwarded-Host` con el dominio público autorizado.

Se acepta esa pareja reescrita **únicamente** con `X-Forwarded-Host` exactamente igual al origen configurado; se mantienen la escucha en loopback y los demás bloqueos. Se agregaron casos negativos para dominio ajeno, cabecera ausente, origen nulo y origen externo. Resultado **11/11**, comprobación HTTP real de la pasarela **200** para la reescritura autorizada y **403** para otro túnel.

Se reinició solo la pasarela 4206, sin reiniciar emuladores. Después se recargó la pestaña del propietario, apareció el login, se ingresó con Sistemas DEMO y se abrió Usuarios con las seis identidades históricas. Sin errores de consola. Esta comprobación ya usa el **túnel HTTPS real desde el anfitrión**; sigue sin acreditar otra computadora física ni aceptación humana. Evidencia: `.local/tunnel-recovery/usuarios-tunel-real.jpg`. Los avisos Angular sobre tamaño de imágenes no impidieron la carga.

## Destino actualizado por el propietario, 22/10/2026

El puerto 4206 ahora sirve la revisión sintética R02 de dos ciclos, manteniendo el mismo origen HTTPS. La recuperación histórica continúa activa e intacta en sus propios emuladores; ya no es el destino de la pasarela. Consultar la sección «Actualización del túnel existente» de [E2-R02-DEMO-DOS-CICLOS-2026-10-22.md](E2-R02-DEMO-DOS-CICLOS-2026-10-22.md). Las tareas 2/3/4 usan `--r02`; para servir manualmente se requiere `SPAI_LOCAL_TEST_ISOLATED=true`, `SPAI_LOCAL_SYNTHETIC=true`, `SPAI_LOCAL_TEST_SLOT=isolated`, y `node tools/local/tunnel.mjs --r02`. No se debe ejecutar la recuperación ni recargar fixtures para actualizar el frontend.
