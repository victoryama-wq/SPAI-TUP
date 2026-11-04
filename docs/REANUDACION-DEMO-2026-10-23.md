# Reanudación de demo — 23/10/2026

Se restauró la sesión sintética R02 desde `.local/r02-review/saved-1792709614698`, seleccionada al apagar el 22 de octubre. Se verificaron los siete archivos contra el manifiesto de apagado antes de iniciar. No se regeneraron fixtures ni se inició la recuperación histórica.

Servicios activos en loopback: Auth 19099, Firestore 18080, Functions 15001, Storage 19199, hub 14400, control 14310 y pasarela 4206. El supervisor guarda Auth/Firestore/Storage cada cinco minutos y actualiza `.local/r02-review/latest.json`. Exporta mediante el hub verificado para evitar confundir sesiones del mismo proyecto.

Estado recuperado: cinco identidades Auth; ciclos 27-1 en **Captura cerrada** y 26-3 en **Cerrado**. Se conservó el cierre registrado el 22 de octubre; no se reabrió la captura.

Tareas de VS Code:
- `SPAI: Restaurar demo R02 guardada`: restaura la última exportación, sin fixtures.
- `SPAI: 3 Servir demo para tunel`: sirve la compilación existente en 4206.
- `SPAI: Guardar y detener demo R02`: exporta antes de detener sus emuladores.

Se protegió el arranque de fixtures frente a una exportación R02 existente. El lanzador PowerShell de revisión también prefiere la restauración cuando existe `latest.json`.

La URL confirmada por el propietario es https://q16qrh63-4206.usw3.devtunnels.ms/. Después de reactivar el reenvío respondió HTTP 200 y sirvió `tunnel-r02-two-cycles-20261022-01`, base `16671e2b5b9021fa2069e2b0587e595338f7fb29` con cambios locales. No se recompiló ni cambió la aplicación.

Comprobación técnica desde el anfitrión por HTTPS público: inicio de sesión Sistemas DEMO, modal con 27-1 / Captura cerrada, descarte, dos filas y Nuevo ciclo deshabilitado; cero errores de página y cero llamadas a cycleCommand. No equivale a prueba desde otra computadora. Evidencia local: `.local/r02-review/resume-ui-20261023.json` y `resume-20261023.png`. El primer ensayo por localhost agotó el plazo de cinco segundos al esperar el modal; el ensayo HTTPS posterior esperó la resolución del contexto y pasó.

Verificaciones adicionales: sintaxis de recover.mjs, restauración `--check`, pruebas unitarias del túnel (4/4) y exportación automática completada. No se modificaron datos académicos, delegaciones, respaldo privado ni selección histórica. Sin push, merge o despliegue. La reanudación no sustituye la validación completa pendiente de R02.
