# Guardado antes del apagado — 22/10/2026

Se detuvieron primero los frontends/pasarela 4202 y 4206 para impedir nuevas escrituras por esos accesos. Después se exportaron Auth, Firestore y Storage de cada sesión y se detuvieron ambos conjuntos de emuladores por sus controles propios. Los puertos 4202/4206, 14310/44310, 18080/48080, 19099/49099, 15001/45001, 19199/49199 y sus hubs/UI quedaron sin listeners.

- R02: `.local/r02-review/latest.json` apunta a `saved-1792709614698`, exportada directamente desde el hub verificado 14400; cinco cuentas Auth.
- Histórica: `.local/tunnel-recovery/latest.json` apunta a `saved-1792709629570`; guardado confirmado antes del cierre del supervisor.
- Código y evidencia del árbol vigente: `.local/shutdown-20261022/working-tree.zip`, parche y estado Git. Sin commit, push, merge ni despliegue. Los archivos originales permanecen en el checkout.
- Integridad de archivos exportados: `.local/shutdown-20261022/exports-manifest.json`.
- El respaldo privado y su selección no se tocaron.

Incidencia resuelta: Firebase CLI descubre un único hub por proyecto aunque haya dos sesiones. El primer intento para R02 encontró el hub histórico 44400; su salida (`saved-1792709575504`) NO está seleccionada como copia R02. Se conservó sin reutilizar. La exportación válida se dirigió explícitamente al hub R02 14400 después de verificar PID y puertos; la histórica se guardó desde su supervisor 44400. No confiar en `--config` por sí solo para seleccionar el hub de exportación.

Próximo arranque: restaurar R02 desde su `latest.json` mediante `--import`, verificando el manifiesto. No ejecutar un reset ni el generador inicial de fixtures ni la antigua tarea «Iniciar escenario R02 de dos ciclos»: su arranque actual es desechable y aún no importa esta copia. La adaptación de esa tarea a reanudación persistida queda para el próximo arranque. La tarea de recuperación histórica utiliza su propio `latest.json`, NO el de R02. El túnel 4206 debe seguir conectado a R02 cuando se reanude.

El apagado del sistema operativo lo realiza el propietario. El enlace del túnel puede dejar de responder mientras los servicios estén detenidos.

Actualización 23/10/2026: se completó la adaptación a restauración persistida y se reanudó la sesión R02; véase `REANUDACION-DEMO-2026-10-23.md`. El pendiente de adaptación descrito arriba corresponde al estado del 22 de octubre.
