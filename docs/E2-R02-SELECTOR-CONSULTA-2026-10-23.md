# E2-R02 — Selector de ciclo de consulta en Asignaciones

23 de octubre de 2026, America/Cancun. Responsable técnico: Codex. Rama `codex/usuarios-baja-complemento`, base `16671e2b5b9021fa2069e2b0587e595338f7fb29`, cambios locales posteriores conservados. Aceptación visual pendiente.

## Cambio acotado

Una franja clara inmediatamente anterior al encabezado azul contiene la única selección «Ciclo de consulta». Opciones agrupadas Operativo / Históricos, derivadas del catálogo existente y del ámbito vigente. Carga, error, ausencia de ciclos y consulta histórica tienen mensajes distintos. El encabezado conserva título, descripción, vista, catálogo, acciones, filtros y seguimiento; el indicador operativo sigue mostrando el ciclo determinado por el sistema.

El repositorio ya filtraba cada lectura por ciclo, retiraba datos de la selección anterior y cancelaba/descartaba respuestas obsoletas. Se conservan esas consultas y su autorización. Se corrigió la selección que antes se restablecía ante cualquier cambio de sesión: el shell recrea componentes al recibir un perfil actualizado. Solo Asignaciones conserva ahora una preferencia de ID por identidad autenticada; no se almacenan filas, permisos ni una segunda selección. Se revalida contra los ciclos consultables y se limpia al cambiar de identidad. Los demás consumidores del repositorio conservan su selección operativa independiente.

La vinculación Forms del desplegable evita que las opciones cargadas después del valor muestren visualmente la primera opción aunque el modelo consulte otra. La prueba de actualización real de perfil detectó y acreditó este caso.

Tabla, resumen, seguimiento, estados disponibles e indicador de vista dependen del ciclo consultado. Los conteos muestran «—» mientras faltan datos confirmados. Se conserva la búsqueda libre; el filtro de Estado solo se limpia si dejó de existir como opción aplicable. La página vuelve a la primera página al cambiar ciclo. La consulta histórica es de solo lectura, incluyendo Especiales. Un borrador se cierra al cambiar selección; las confirmaciones vuelven a verificar que la operación corresponda al ciclo visible y a los permisos actuales.

## Archivos de esta corrección

- `src/app/features/assignments/data/assignments.repository.ts`: selección autorizada, preferencia de consulta aislada de otros consumidores y validación de opciones.
- `src/app/features/assignments/pages/assignments-page.component.ts`: estados de consulta, filtros derivados, indicador operativo, cierre de borradores y revalidación tras confirmación.
- `src/app/features/assignments/pages/assignments-page.component.html`: franja única, grupos de opciones, etiqueta accesible y vinculación de controles dinámicos.
- `src/app/features/assignments/pages/assignments-page.component.css`: estilos locales de la franja a escritorio y móvil; sin cambios globales.
- `tools/e2-r02/assignment-cycle-selection.mjs`: recorrido de navegador con Firestore/Auth/Functions aislados y ficticios.
- `tools/e2-r02/assignment-cycle-tunnel.mjs`: comprobación de solo consulta sobre el frontend servido y snapshot anterior/posterior de datos compartidos.

## Comprobaciones

7 grupos de UI PASS: ubicación y unicidad; cambios de datos/filtros/conteos; selección preservada tras refresco de perfil; cambios rápidos con retirada inmediata de filas; borrador y restricciones de Captura cerrada/Especiales; escritorio 1280/tableta 768/móvil 390 y 320; estados vacíos/carga/error; sesión Consulta limitada a 27-1 sin seleccionar históricos fuera de ámbito. Los grupos reúnen estos recorridos, no representan aprobación humana.

La inyección de carga, error y vacío es una prueba de presentación identificada como tal en `ui.json`; los cambios de ciclo, actualización de perfil, consultas y sesiones usan emuladores reales. Las 17 regresiones de `policy.test.mjs` y `session-lifecycle.test.mjs` pasan, incluida entrega tardía de snapshots después del cambio de ciclo/sesión y limpieza antes de cancelar. No se ejecutaron escrituras de prueba en 18080 ni contra producción.

Compilaciones Angular de producción y túnel PASS. Permanece la advertencia de presupuesto inicial: 785,56 kB frente a 750 kB. No se modificaron Rules, Functions, contratos, delegaciones ni políticas de captura/Especiales. No se acredita de nuevo el gate integral: permanecen los pendientes históricos R02/R03, los diagnósticos inconclusos de Rules, el impedimento administrativo de 200 documentos y las validaciones remotas/productivas.

## Demo y revisión

Frontend local servido: `tunnel-r02-consulta-ciclo-20261023-01`, en https://q16qrh63-4206.usw3.devtunnels.ms/asignaciones. Recursos compilados aparte, conservando los servicios y datos de la demo. La comprobación actual encontró 27-1 y 26-3 en Cerrado (el estado compartido había cambiado desde la revisión anterior); se respetó ese estado y se adaptó el smoke a los datos leídos, sin alterarlos. Sin push, merge ni despliegue remoto. La prueba HTTPS se realiza desde el anfitrión; no acredita otra computadora física.

1. Recargar, entrar en Asignaciones y comprobar la franja sobre el encabezado.
2. Alternar 27-1 y 26-3: la vista y seguimiento cambian. En el entorno aislado con operativo 27-1, el indicador permanece en 27-1; en la demo compartida actual ambos están Cerrado y se muestra Sin ciclo activo.
3. Comprobar solo lectura de ambos históricos compartidos. No se abrió ni cambió el estado de ningún ciclo para esta revisión.
4. Revisar las capturas de escritorio y móvil en [la galería](evidence/assignment-cycle-selection/index.html).


## Ajuste posterior de ubicación — 23 de octubre de 2026

Por instrucción posterior del propietario, la franja externa descrita arriba queda sustituida por el mismo selector dentro de la fila de filtros del encabezado azul: Búsqueda / Estado / Ciclo de consulta. La evidencia anterior se conserva como historial; la composición vigente está en `evidence/assignment-cycle-inline/index.html`.

Código de aplicación modificado en este ajuste: exclusivamente `assignments-page.component.html` y `assignments-page.component.css`. Sin cambios adicionales en TypeScript, consultas, Rules, Functions ni datos. El control mantiene su vinculación y opciones existentes. Se retiraron el contenedor externo y sus estilos; el indicador compacto Solo lectura aparece junto al control. Alturas de los tres filtros: 44 px, separación 14 px. En pantallas estrechas se apilan sin recortar el selector. Se reutilizan las etiquetas y controles institucionales de `.filters`.

Se ajustó la expectativa de ubicación y cantidad de selects en `tools/e2-r02/assignment-cycle-selection.mjs` (suite aislada completa no repetida para esta modificación de plantilla). Se añadió `tools/e2-r02/assignment-cycle-inline.mjs`: comprobación de lectura sobre la demo, selección real, único control, ubicación, alineación y medidas a 1280/768/390/320 px, solo lectura, botón de creación bloqueado, cero comandos mutantes y snapshot compartido idéntico antes/después. Resultado PASS. Capturas de 1280 y 390 px inspeccionadas visualmente; el recorte horizontal previo de la navegación global en móvil no se modifica en este alcance.

17/17 regresiones de policy y session-lifecycle repetidas con éxito. Builds tunnel y production PASS; advertencia previa de presupuesto inicial 785,56 kB / 750 kB. Los dos ciclos compartidos siguen Cerrado; no se reabrió ninguno para fabricar evidencia de Operativo. Las pruebas previas de captura/Especiales y de ciclos operativos se conservan, no se presentan como repetidas en esta revisión.

Versión servida: `tunnel-r02-consulta-inline-20261023-02`, base `16671e2b5b9021fa2069e2b0587e595338f7fb29` más cambios locales conservados. Comprobado por HTTPS desde el anfitrión. Servicios 4206/18080/19099/15001/19199 conservados sin reiniciar. Aceptación visual pendiente; no cambia el estado de los pendientes contractuales o productivos. Sin push, merge ni despliegues remotos.
