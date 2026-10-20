# E2-R01 · Franja y botones de Usuarios

Ejecución: 19 de octubre de 2026, America/Cancun (20 de octubre UTC). Responsable: Codex, validación técnica local. Base conservada: `2383d96d3ba1d38303f343e893e398cc21bb7e66`, rama `codex/e2-r01-seguridad-permisos`, árbol inicialmente limpio. La aceptación visual del propietario permanece pendiente.

## Ajuste acotado

Solo se modificaron la plantilla y los estilos encapsulados de `security-console.component`. El encabezado del directorio dejó el fondo blanco/gris y ahora reutiliza el degradado `135deg, #071d4f → #0b357f` de `.table-panel > .panel-title` de Nomenclaturas, su línea superior de 4 px `#1d4ed8 → #0ea5e9 → transparent`, título blanco `clamp(22px, 2.4vw, 30px)` y relleno de escritorio de 18 × 30 px. El sobretexto es blanco. El botón de revisiones conserva su contador, condición y acción; aparece como control blanco y se reorganiza debajo del título en móvil.

Los tres botones superiores reutilizan la tipografía de la etiqueta de alta de Nomenclaturas (14 px, peso 800, espaciado .08em, mayúsculas), altura mínima de 40 px, radio de 8 px, iconos de 22 px y separación de 10 px. Los secundarios usan el azul `#244a9b`, borde blanco al 34 % y hover `#1e3a8a` de Cargar archivo / Plantilla. Nuevo usuario conserva el cian solicitado. El signo + pasa de texto generado a SVG decorativo como Nomenclatura, conservando el nombre accesible.

La adaptación deliberada consiste en botones horizontales de altura automática para etiquetas extensas, en lugar de los controles CSV verticales de 94 × 58 px con letra de 8 px. A 320 px, Roles personalizados y Revisiones pendientes se muestran completos en dos líneas. Usuarios conserva buscador, filtros y tabla sobre blanco; Nomenclaturas tiene su buscador dentro de la franja. No se pretende copiar esa estructura diferente.

## Comprobaciones

- [Comparación Nomenclaturas / Usuarios](evidence/r01-users-header/comparacion.html): capturas reales a 1280, 768, 390 y 320 px, con encabezado y franja separados; inspeccionadas por Codex.
- [Resultados y contraste](evidence/r01-users-header/results.json), [estilos calculados](evidence/r01-users-header/computed-styles.json).
- Suite existente `visual-refine.spec.mjs`: **4/4 aprobadas**. Conservación del borrador, guía, dependencias de módulos, directorio/editor, herencia, cancelación, foco y ausencia de escrituras de seguridad.
- Comprobación complementaria aislada: ocho combinaciones módulo/tamaño sin desbordamiento general; controles sin recorte; título y revisiones sin intersección; 16 aperturas/cierres con Escape y devolución de foco, sin `securityCommand`.
- Contraste de texto calculado con luminancia sRGB para los colores efectivos, incluyendo ambos extremos del degradado: todas las combinaciones verificadas superan 4.5:1. El anillo de foco existente se conserva visible.
- `ng build --configuration lan --output-path .local/users-header/build-lan`: correcto. `git diff --check`: correcto.
- El primer ensayo del script temporal comprobaba la apertura antes de la actualización asíncrona del diálogo y falló; se corrigió la espera del ensayo y su ejecución completa pasó. No fue necesario cambiar los modales ni el código funcional.

Las pruebas usaron emuladores sintéticos aislados (14310/18080/19099/15001/19199) y frontend 4202. No se ejecutaron pruebas destructivas sobre la demo LAN ni una validación integral de contratos futuros.

## Preservación y revisión LAN

Las capturas Firestore de comprobación antes/después tienen el mismo SHA-256 `cfd37e58a04ac36d585440cfb76e4bf50313ac34e287fcbc489b1f7591e7a6c3`; incluyen las dos delegaciones compartidas sin cambios de estado/revisión. La selección privada conserva SHA-256 `9550d3a37a5b783eb274daf3289dd3c9d94ea7f3ed1ba343e4119bb33f2bdc09`, y el respaldo privado `b3ddfc0d73a8b6c2e0415cb171456843c0d76bb84009b8562da66744321492ed`.

La interfaz vigente de la demo es Wi-Fi, IPv4 `192.168.42.1`, frontend `http://192.168.42.1:4201/usuarios`. Ethernet tiene `192.168.0.49`; el servidor de demo sigue enlazado a Wi-Fi. Se actualizan solo los archivos compilados del frontend, índice al final, sin reiniciar los servicios. La versión concreta se publica en `/demo-version.json` y la comprobación HTTP desde el anfitrión se guarda en `.local/users-header/served-verification.json`. Esto no acredita acceso desde otra computadora.

Recorrido pendiente del propietario: recargar Usuarios, comparar botones y franja con Nomenclaturas, reducir a móvil y comprobar la lectura completa de Revisiones pendientes. No es necesario repetir las pruebas físicas ya aceptadas.

Sin cambios a TypeScript, Rules, permisos, contratos, datos, columnas, modales ni herencia. Sin push, merge, despliegue remoto ni conexiones a producción. Permanecen visibles el impedimento administrativo de **200 documentos** y los **18 incumplimientos R02/R03**; no se implementaron ni revalidaron estas entregas. La aceptación humana de R01 permanece pendiente.
