# Guardado para apagado — 26 de octubre de 2026

Repositorio: SPAI-TUP-BAJA-20261021. Rama codex/usuarios-baja-complemento; HEAD 5ef70c31a44fdc9a11a3ca02b8925f7677b46c91. Cambios locales conservados sin reset ni incorporación indiscriminada a Git.

## Estado conservado

- Demo compartida: exportación final Auth/Firestore/Storage a las 22:51:35 UTC (17:51:35 Cancún), mediante el supervisor antes de detener los emuladores. El primer intento encontró EPERM al renombrar; el segundo confirmó exported=true y stopped=true. Ruta en `.local/r02-review/latest.json`.
- Revisión aislada: se conserva la exportación verificada de las 21:48:41 UTC (16:48:41 Cancún), escenario Preparación preparado al finalizar las pruebas. Ruta en `.local/r02-complement-20261023/.local/r02-review/latest.json`. Su supervisor de pruebas se detuvo sin una nueva exportación; no se atribuye a esta copia la hora del apagado.
- Frontend compartido conservado: `tunnel-r02-5ef70c31a44f-20261026215238`, en `dist/spai-tup-r02-tunnel/browser`.
- Origen guardado: https://q16qrh63-4206.usw3.devtunnels.ms/ en `.local/tunnel-recovery/origin.json`; tareas VS Code preservadas.
- Resguardo adicional local: `.local/shutdown-20261026/`, con bundle Git, parche de cambios, ZIP de archivos/configuración/runtime, exportaciones y hashes. No contiene una copia nueva del respaldo privado ni modifica su selección.
- Puertos de ambas demos cerrados tras el guardado. La laptop apagada no sirve el túnel.

## Mañana

1. Abrir esta carpeta en VS Code.
2. Terminal → Ejecutar tarea → **SPAI: Restaurar demo R02 guardada**. Esperar DEMO R02 RESTAURADA. Importa el último guardado; no regenera fixtures.
3. Ejecutar **SPAI: 3 Servir demo para tunel**. Esperar PASARELA LISTA. No es necesario recompilar.
4. Puertos → Agregar puerto → **4206**, visibilidad Pública. Si cambia la URL, ejecutar **SPAI: 4 Autorizar URL del tunel** con el nuevo origen HTTPS.
5. Solo si se necesita el entorno aislado: **SPAI: Restaurar revision R02 aislada guardada**, después **SPAI: Servir revision R02 aislada** (4204).

La validación de archivos/hashes y `--check` no constituye una restauración funcional completa de R04 ni respaldo externo frente a pérdida del disco. R02 sigue pendiente de aceptación, con sus controles inconclusos, límite de 200 documentos y pendientes de R03/producción intactos. Sin push, merge ni despliegues.
