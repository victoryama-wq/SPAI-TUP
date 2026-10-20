# E2-R01 — Ajuste visual de Usuarios / Control de accesos

Fecha: 19 de octubre de 2026 (America/Cancun). Responsable técnico: Codex. Base: `f4f30453fac0e05f7650e2ef805ca4c34ed64a7c`; rama `codex/e2-r01-seguridad-permisos`, árbol limpio al inicio. Aceptación visual del propietario: **PENDIENTE**.

## Comparación concreta antes de implementar

Se contrastaron las tres referencias proporcionadas con la entrega anterior y sus capturas versionadas. Las diferencias no se reducían al desbordamiento:

| Zona | Diferencia observada | Ajuste implementado |
|---|---|---|
| Encabezado principal | Título de 24 px, acciones casi equivalentes, poca separación del resto | Título de 34 px en escritorio, bloque marino de 162 px mínimo, acento turquesa, Nuevo usuario destacado y acciones secundarias con iconos |
| Métricas | Cifras sin iconografía ni espacio suficiente | Iconos SVG visibles, tarjetas claras, cifra y etiqueta jerarquizadas; mismas fuentes y cálculos |
| Directorio | Filas planas, encabezados y buscador poco separados | Encabezado claro institucional, buscador separado, identidad con iniciales, filas alternadas, badges y acciones compactas |
| Edición | Dos fieldsets en paralelo, sin recorrido reconocible | Guía lateral numerada navegable, tarjetas en una columna, campos en dos columnas dentro de cada tarjeta y una en móvil |
| Módulos | Casillas básicas y poco alineadas | Controles con apariencia de interruptor, conservando semántica checkbox, etiquetas y dependencia Consultar/Editar |
| Herencia | Dos bloques de texto sin conexión ni identidad visual | Tarjetas diferenciadas, identidad, flecha de copia, resumen azul y resultado inferior con advertencias |
| Roles | Nombre y botones sin jerarquía común | Tarjetas institucionales, icono, descripción derivada de módulos reales y zona sensible separada; editor con la misma guía |

## Evidencia visual comparable

[Abrir galería comparativa](evidence/r01-visual-refine/comparacion.html): referencia/resultado o entrega anterior/resultado, con un ancho de lectura idéntico y proporción original, sin recorte ni deformación. Resultados capturados a 1280 px de ancho; las referencias tienen otras dimensiones originales. El panel completo puede ser más alto según sus filas y la navegación global. No se presenta la comparación como identidad píxel a píxel.

Comparaciones en una sola imagen: [panel](evidence/r01-visual-refine/comparison-panel.png), [edición](evidence/r01-visual-refine/comparison-edit.png), [herencia](evidence/r01-visual-refine/comparison-inherit.png). En cada pareja, ambos lados utilizan el mismo ancho; el resultado conserva los datos reales de la sesión ficticia.

| Ancho | Panel | Editar | Módulos | Herencia | Roles | Editor de roles |
|---|---|---|---|---|---|---|
| 1280 | [Ver](evidence/r01-visual-refine/panel-1280.png) | [Ver](evidence/r01-visual-refine/edit-1280.png) | [Ver](evidence/r01-visual-refine/modules-1280.png) | [Ver](evidence/r01-visual-refine/inherit-1280.png) | [Ver](evidence/r01-visual-refine/roles-1280.png) | [Ver](evidence/r01-visual-refine/role-editor-1280.png) |
| 768 | [Ver](evidence/r01-visual-refine/panel-768.png) | [Ver](evidence/r01-visual-refine/edit-768.png) | [Ver](evidence/r01-visual-refine/modules-768.png) | [Ver](evidence/r01-visual-refine/inherit-768.png) | [Ver](evidence/r01-visual-refine/roles-768.png) | [Ver](evidence/r01-visual-refine/role-editor-768.png) |
| 390 | [Ver](evidence/r01-visual-refine/panel-390.png) | [Ver](evidence/r01-visual-refine/edit-390.png) | [Ver](evidence/r01-visual-refine/modules-390.png) | [Ver](evidence/r01-visual-refine/inherit-390.png) | [Ver](evidence/r01-visual-refine/roles-390.png) | [Ver](evidence/r01-visual-refine/role-editor-390.png) |
| 320 | [Ver](evidence/r01-visual-refine/panel-320.png) | [Ver](evidence/r01-visual-refine/edit-320.png) | [Ver](evidence/r01-visual-refine/modules-320.png) | [Ver](evidence/r01-visual-refine/inherit-320.png) | [Ver](evidence/r01-visual-refine/roles-320.png) | [Ver](evidence/r01-visual-refine/role-editor-320.png) |

La inspección del agente incluyó escritorio, tableta y móvil. En la primera pasada se detectó y corrigió un trazado de escudo incorrecto y la deformación circular de los interruptores en móvil; también se ajustó el encabezado del editor a fondo claro/acento turquesa. La semejanza se revisó por jerarquía, distribución, color, iconografía y recorrido, además de comprobar geometría.

## Navegación y conservación funcional

La guía desplaza el contenedor interno hacia el fieldset solicitado, abre Facultades cuando corresponde y lleva el foco a la sección. El indicador sigue el desplazamiento. No cambia de formulario ni reconstruye los controles, por lo que conserva el borrador. La numeración decorativa no altera el nombre accesible de los grupos. En móvil, los cuatro pasos se sitúan encima del contenido; encabezado y acciones permanecen fuera del scroll interno.

La herencia conserva selectores, identidades, reemplazo explícito y comandos anteriores. Antes de la preview, el resultado indica que está pendiente de validación de servidor. El texto aclara que el origen conserva su acceso. Los ámbitos y capacidades de la preview se presentan con etiquetas legibles, sin JSON ni modificaciones del objeto recibido.

Los únicos cambios de aplicación están en `security-console.component.html`, `.css` y `.ts`: composición, estilos encapsulados y helpers de presentación/navegación. No se modifican servicios de datos, sesión, Rules, servidor, cálculos, contratos ni permisos. Ningún dato ilustrativo se incorpora a las fuentes. El directorio/editor de roles y sus confirmaciones continúan en un solo diálogo.

## Diferencias que permanecen respecto a las referencias

- Se conserva la navegación global de SPAI y su estado de presentación, no se redibuja como parte de Usuarios.
- El formulario real contiene área, saludo, ciclos, docentes, campos y doce módulos. No caben simultáneamente como los cuatro módulos ilustrativos de la referencia: se usa scroll interno y guía accesible.
- Los programas siguen siendo los campos existentes de claves; no se añade un catálogo, chips editables ni una acción Agregar programa nueva.
- No se inventan paginación, Último acceso, ciclo/fecha de cierre ni una acción Inactivar independiente del editor.
- El modelo de rol no tiene una descripción libre persistida: se muestra una descripción derivada de sus módulos, sin añadir campos ni funciones.
- En móvil la tabla mantiene sus columnas mediante desplazamiento horizontal propio; no se comprimen ni ocultan las acciones.

## Validación

Los resultados y hashes de esta ejecución se registran en [results.json](evidence/r01-visual-refine/results.json). Se añaden cuatro pruebas de composición/guía y se adaptan dos comprobaciones de estructura anteriores; no se debilitan expectativas de seguridad.

El primer ensayo sobre el entorno de revisión T10 produjo 39 aprobadas y siete fallos: cuatro dependían de que el auxiliar no tuviera una delegación previamente preparada; dos esperaban las dos columnas antiguas; uno buscaba un grupo cuyo nombre accesible incluía ahora el número. Se corrigió el marcado decorativo y las expectativas de composición. La repetición utiliza el ejecutor estándar de aceptación y su entorno sintético aislado, sin tocar la demo compartida. Los fallos iniciales se conservan en el manifiesto, no se cuentan como aprobaciones.

No se declara aceptación del propietario, validación remota ni capacidad productiva. Se conservan las comprobaciones humanas previas T01, T07 funcional y T11; T10 humano permanece pendiente. El límite de 200 documentos y los 18 incumplimientos de R02/R03 siguen abiertos.

## Recorrido manual breve

1. Recargar Usuarios con Ctrl+F5. Contrastar encabezado, métricas, buscador y tabla con la galería.
2. Editar una persona ficticia: cambiar un texto, navegar por los cuatro pasos y volver. El borrador debe permanecer; Cancelar no guarda.
3. Abrir Heredar acceso: elegir origen/destino y revisar flecha, identidad, resultado y advertencia de copia. La confirmación sigue requiriendo preview de servidor.
4. Abrir Roles personalizados → Crear rol o una definición editable. Revisar módulos y regresar al directorio; las restricciones de definiciones en uso permanecen.
5. Repetir a 320/390/768/1280 px y con Tab/Escape. No repetir revocaciones sobre la delegación compartida del propietario.

La demo LAN se actualiza únicamente con los archivos compilados verificados. No se reinician ni restablecen los servicios compartidos. URL, versión servida y comparación de hashes se verifican desde el anfitrión; no sustituyen la prueba física desde otra computadora.

## Resultado de esta ejecución

VALIDADA_LOCAL: 46/46 Chromium (42 regresiones y cuatro casos nuevos de presentación/guía), 28/28 unitarias; 37 R01 + 9 Auxiliar + 8 Control de accesos + 21 herencia en servidor; 72/72 caracterizaciones. La suite estándar terminó con código 0. El gate contractual terminó con código 1 y exactamente los mismos 18 IDs abiertos. Builds local/LAN/production correctos; advertencia de tamaño inicial 779,79/750 kB, sin errores de compilación. El ensayo offline conserva siete intentos exclusivamente loopback.

La instantánea completa compartida antes/después conserva el hash `cfd37e58a04ac36d585440cfb76e4bf50313ac34e287fcbc489b1f7591e7a6c3`, incluida la delegación del propietario ACTIVE revisión 1. La selección y el respaldo privado conservan sus hashes anteriores. La pasarela existente utiliza Wi-Fi `192.168.42.1/22`, URL `http://192.168.42.1:4201`; Ethernet también tiene `192.168.0.49/24`, sin cambiar la interfaz de la demo. La versión servida se identifica en `/demo-version.json`. Verificación desde el anfitrión; sin nueva prueba desde otra computadora.
