# E2-R01 · Tabla de Usuarios registrados

19 de octubre de 2026, America/Cancun. Responsable: Codex, validación técnica local. Base conservada `11e3bb2553f0f3bc22fb2078a75c8344c7c4d8b8`, rama `codex/e2-r01-seguridad-permisos`; árbol limpio al inicio. Aceptación visual del propietario pendiente.

## Cambios de presentación

Solo la plantilla y los estilos encapsulados de `security-console.component`: contenedor blanco independiente para filtros y tabla, borde azul claro y radio de 8 px; encabezados institucionales, celdas espaciosas, anchos estables con ajuste de texto, badges de rol/estado y acciones compactas. Se añaden encabezados semánticos `scope="col"`.

Se conservan las seis etiquetas USUARIO, ROL, ACCESOS, PROGRAMAS ASIGNADOS, ESTADO y ACCIONES. El rol sigue usando `roleLabels` y su fallback Perfil heredado; el estado sigue usando `statusLabel`. Activo permanece diferenciado de Requiere regularización. Los badges no conceden permisos y no convierten estados de revisión en estados de cuenta.

No cambian consultas, cálculos, condiciones, eventos, modales, datos ni herencia. El único binding nuevo selecciona el estilo de Activo, sin lógica de autorización. La franja azul marino, su línea superior, Revisiones pendientes y la distribución superior acordada se conservan.

## Patrones reales reutilizados

| Elemento | Origen inspeccionado | Valores aplicados solo a Usuarios |
| --- | --- | --- |
| Contenedor | Grupos/Nomenclaturas `.table-wrap` | Borde `#d7e4f8`, radio 8 px, superficie blanca |
| Encabezados y filas | Grupos/Nomenclaturas `th`, `th, td` | Fondo `#f8fbff`, texto `#40577a`, 13 px, peso 900, mayúsculas; celdas 16 × 14 px, alineación izquierda/centro vertical, separador `#d7e4f8` |
| Espaciado tipográfico | Sobretextos institucionales de Grupos/Nomenclaturas | `.08em` aplicado a las seis cabeceras |
| Badges | Grupos/Nomenclaturas `.status-badge` | Radio 999 px, peso 900, 13 px, padding 7 × 12 px; Activo `#e8f7ef / #137545` |
| Rol / estado neutro | Paletas institucionales existentes | Rol `#edf4ff / #1d4ed8`; neutro/inactivo `#f1f5f9 / #40577a`. Se usa el texto oscuro de Grupos en lugar de `#64748b` para mejorar contraste. El texto conserva el significado. |
| Acciones | Ciclos `.edit-action`, `.table-actions .icon-action`; Grupos `.table-danger-action.icon-action` | Altura 38 px, radio 8 px, padding horizontal 12 px, borde `#b7d2f7`, fondo `#eef6ff`, texto `#1457d6`, icono 18 px. Se conservan los nombres visibles y accesibles. |

Se reutilizan valores locales, sin importar estilos completos ni modificar CSS global. Los selectores nuevos `.directory-surface` y `.directory-table` no alcanzan las tablas de modales. El foco existente se conserva; el contenedor desplazable dibuja su foco hacia dentro para que el borde redondeado no lo recorte.

## Comprobación y capturas

- [Galería comparable de escritorio, tableta y móvil, más referencias reales](evidence/r01-users-table/capturas.html).
- [Resultados y estilos efectivos](evidence/r01-users-table/results.json).
- Datos: cuatro perfiles ficticios adicionales exclusivamente en el emulador aislado 18080. Incluyen nombre y correo extensos, seis programas, acceso personalizado, coordinación académica, alta de docentes, perfil heredado y estados Activo/Inactivo. Se filtraron esos perfiles para las capturas; no se insertaron en la demo compartida. Son ensayos visuales, no evidencia de nuevas reglas de autorización.
- Geometría comprobada a 1280, 768, 390 y 320 px: sin desbordamiento general ni contenido desbordado dentro de celdas, texto multilínea, botones de 38 px, filtros funcionales para Inactivo y sin coincidencias. Apertura por teclado de Ver acceso, Escape y devolución de foco correctos.
- En tableta/móvil permanece el desplazamiento horizontal de la tabla, con filtros fijos. Las capturas documentan ambos extremos; las columnas fuera del viewport se consultan desplazándose, no se ocultan mediante reglas adaptativas.
- Distribución superior comprobada otra vez a ocho anchos de 320 a 1440 px: métricas 2 × 2, alineación de bloques y botones en una fila cuando caben ambas columnas.
- Suite existente `visual-refine.spec.mjs`: **4/4 aprobadas**, sin escrituras `securityCommand`, conservando sus expectativas. Incluye borrador, módulos, directorio/editor, herencia, cancelación y foco.
- Build LAN final correcto; `git diff --check` correcto. No se alteraron expectativas del gate contractual ni se ejecutó una validación integral de otras entregas.
- Una captura intermedia falló por desprendimiento del elemento durante la actualización de la vista; el recorrido completo se repitió una vez estabilizada la compilación y pasó. Las imágenes entregadas pertenecen a la ejecución posterior completa y fueron inspeccionadas por Codex.

## Preservación y entrega

Firestore compartido mantiene el hash anterior/posterior `cfd37e58a04ac36d585440cfb76e4bf50313ac34e287fcbc489b1f7591e7a6c3`, incluidas las delegaciones. Respaldo privado y selección conservan los hashes documentados en entregas anteriores. Se actualizan únicamente archivos compilados del frontend; servicios compartidos sin reiniciar.

Demo: `http://192.168.42.1:4201/usuarios`; versión servida en `/demo-version.json`. Evidencia HTTP desde el anfitrión: `.local/users-table/served-verification.json`. No equivale a prueba desde otra computadora.

Revisión pendiente del propietario: recargar Usuarios, revisar franja y contenedor; leer roles/estados, filtrar, desplazar horizontalmente la tabla en móvil y comprobar Ver acceso/Editar. Los nombres extensos de las capturas pertenecen al ensayo aislado y no aparecerán como altas en la demo LAN.

Sin push, merge, despliegues remotos ni conexiones a producción, Moodle o SAEKO. No se avanza a R02. Permanecen el impedimento administrativo de **200 documentos**, los **18 incumplimientos R02/R03** y la aceptación humana pendiente.
