# Evidencia sintética de aceptación R01

Fecha: 2026-10-14. Base: ef82fc60d02a2eee8e158f04e1104b8110a4b9a5 más el commit que incorpora esta carpeta. Chromium 153.0.8010.12, Windows; fixtures demo-spai-tup. No contiene copia privada, tokens ni contraseñas institucionales.

| Archivo | Actor / procedencia | Qué acredita |
|---|---|---|
| usuarios-after-1366.png | Sistemas DEMO, Codex, 1366×900 | Formulario institucional, escritorio |
| usuarios-after-768.png | Sistemas DEMO, Codex, 768×1024 | Una columna en tableta, encabezado y acciones |
| usuarios-after-1032.png | Sistemas DEMO, Codex, 1032×1376 | Dos columnas con espacio suficiente |
| usuarios-after-390.png | Sistemas DEMO, Codex, 390×844 | Móvil, desplazamiento interno |
| roles-after-1366.png / roles-after-390.png | Sistemas DEMO, Codex | Editor desplazado a permisos; Consultar/Editar y acciones |
| t09.json | Consulta R01 DEMO, ensayo aislado | Resultado de ámbito y rechazos; código de ensayo en acceptance.spec.mjs |
| t10-actors-before.json | CA, CUSTOM y auxiliar ficticios | Perfil, delegación y facultades efectivas registrados antes de T10 |
| t11.json | AG/auxiliar/destinatario ficticios | Asignación ACTIVE y revisión pendiente tras revocar |
| lan-smoke.json | Sistemas/Consulta en navegador anfitrión | Inicio, recarga, origen LAN, rutas de administración bloqueadas; no segundo equipo físico |
| asignaciones-reportada-768.jpeg / asignaciones-reportada-1032.jpeg | Capturas aportadas por el usuario | Hallazgo de Asignaciones, separado de Usuarios/Roles |

Las capturas nuevas se inspeccionaron por el agente; no constituyen aceptación manual del propietario. Las pruebas de foco/scroll alcanzan campos que no caben simultáneamente en una imagen. La suite conserva las pruebas originales de modal nativo y persistencia; añade cuatro tamaños y escenarios T09/T10/T11.

Logs completos locales: `.local/acceptance/isolated-regression-4.log`, `isolated-ui-4.log`, `unit-final.log`, `contracts.log`, `build-local.log`, `build-lan.log`, `build-production.log`; informes ejecutables `.local/test-results/`. Los intentos fallidos y sus diagnósticos se conservan en `.local/acceptance/ui-attempt-{1,2,3}.json` y sus logs. El recibo `.local/acceptance/commit-validation.json` identifica el SHA final y la comprobación posterior.
