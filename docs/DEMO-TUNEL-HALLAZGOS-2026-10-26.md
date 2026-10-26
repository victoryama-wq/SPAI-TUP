# Actualización del túnel — H-01 y H-02

26 de octubre de 2026, 14:09 America/Cancun. Responsable: Codex. Actualización del frontend local servido por la pasarela ya existente; sin despliegue remoto.

- URL verificada: https://q16qrh63-4206.usw3.devtunnels.ms/
- Puerto: 4206; revisión `tunnel-r02-139bf707a6e8-20261026190724`.
- Base: `139bf707a6e86629664781602c5e92eeddf377ad`, que incluye el código corregido `7c475f7892cdeb50d21743b6c8b5426b93dd810b`.
- Compilación `tools/local/build-tunnel.mjs --r02`: exit 0. El constructor ahora identifica las compilaciones R02 por commit y fecha, evitando volver a publicar una etiqueta fija antigua.
- Se compiló en un directorio temporal y se reemplazó el documento de entrada al terminar; se conservaron los recursos anteriores para pestañas abiertas.

Verificación mediante navegador desde el anfitrión, atravesando el enlace HTTPS público real (no una simulación DNS ni una prueba desde otra computadora): inicio de sesión Sistemas DEMO; Bitácora muestra Sistemas DEMO en eventos existentes de ciclos; durante una demora simulada exclusivamente en ese navegador, Cancelar permanece habilitado, la confirmación inhabilitada y Escape descarta el modal. Después se completó una preparación real de baja de Usuario inactivo DEMO, se verificó su disponibilidad con motivo y se canceló. No se confirmó ninguna baja ni transición.

[Resultado](evidence/r02-tunnel-hallazgos-20261026/result.json), [Bitácora](evidence/r02-tunnel-hallazgos-20261026/tunnel-audit.png), [modal durante preparación](evidence/r02-tunnel-hallazgos-20261026/tunnel-prepare.png). El primer arnés buscaba una tabla en Bitácora, que usa tarjetas; se corrigió exclusivamente ese localizador y la repetición pasó.

Se compararon documentos de todas las colecciones raíz enumeradas antes y después: hashes y conteos sin cambios. [Snapshot previo de hashes](evidence/r02-tunnel-hallazgos-20261026/before.json). No se ejecutaron reset, fixtures, importaciones ni cambios de delegación. PID de pasarela 24428, Firestore 10380 y Functions 28400 permanecieron iguales. El inicio de sesión puede actualizar los metadatos normales de acceso de Authentication; no crea ni elimina cuentas.

Este registro actualiza la disponibilidad descrita en el informe H-01/H-02: **4206 ya sirve las correcciones**, mientras 4204 continúa como entorno aislado. Recargar con Ctrl+F5 las pestañas abiertas para obtener la nueva compilación. El respaldo privado permanece intacto. No hubo push, merge ni conexiones a producción, Moodle o SAEKO.

E2-R02 sigue pendiente de aceptación. Esta comprobación del túnel no cierra los seis inconclusos R02, los diez incumplimientos R03, el límite administrativo de 200 documentos ni los pendientes remotos, de migración/reversión o R04.
