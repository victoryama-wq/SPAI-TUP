# Evidencia sintética — 15 de octubre de 2026

Responsable técnico e inspección visual: Codex. Emuladores aislados, Chromium; ninguna captura acredita aceptación humana. [Informe y causas](../../E2-R01-ACEPTACION-2026-10-15.md).

| Vista | 1366×900 | 768×1024 | 1032×1376 | 390×844 |
|---|---|---|---|---|
| Usuarios, después | [Escritorio](usuarios-after-1366.png) | [Tableta](usuarios-after-768.png) | [Tableta grande](usuarios-after-1032.png) | [Móvil](usuarios-after-390.png) |
| Roles, después | [Escritorio](roles-after-1366.png) | [Tableta](roles-after-768.png) | [Tableta grande](roles-after-1032.png) | [Móvil](roles-after-390.png) |
| Dashboard autorizado, nombre largo | [Escritorio](dashboard-after-1366.png) | [Tableta](dashboard-after-768.png) | [Tableta grande](dashboard-after-1032.png) | [Móvil](dashboard-after-390.png) |

Antes de H001, mismas dimensiones: [Usuarios escritorio](../r01-acceptance/usuarios-after-1366.png), [tableta](../r01-acceptance/usuarios-after-768.png), [tableta grande](../r01-acceptance/usuarios-after-1032.png), [móvil](../r01-acceptance/usuarios-after-390.png); [Roles escritorio](../r01-acceptance/roles-after-1366.png), [móvil](../r01-acceptance/roles-after-390.png). El nombre histórico «after» identifica la primera corrección de 14/10, no esta revisión.

H002: [reproducción previa en LAN](h002-before.png), [resultado corregido](h002-consulta-after.png), [origen de las métricas previas](h002-before.json), [consultas efectivas e inserciones vigiladas](h002-targets.json), [denegaciones directas y diagnósticos completos](h002-server-reads.json).

H003: [mediciones de título y rol](h003-layouts.json); comparación título/cuerpo/metadatos, sin solapamiento ni overflow del panel. El tamaño mínimo medido es 21 px. La captura previa de H002 tiene la cuenta Consulta; las posteriores de H003 usan Sistemas autorizado con nombre largo. No se presentan como imágenes del mismo actor.

Directorios: [Usuarios escritorio](directorio-usuarios-after-1366.png), [móvil](directorio-usuarios-after-390.png); [Roles escritorio](directorio-roles-after-1366.png), [móvil](directorio-roles-after-390.png).

T10: [actores antes del ensayo](t10-actors-before.json), [resultado técnico](t10.json), [formulario de matrícula ajena de CA](t10-academic.png), [auxiliar limitado](t10-auxiliary.png). T11: [regresión técnica](t11.json). [Smoke LAN del anfitrión](lan-smoke.json) es distinto de T01 y T11 físicos ya confirmados por la propietaria.

[Reporte recibido](reporte-recibido.md) preservado como fuente, no como instrucciones de ejecución ni aceptación del agente. El resumen humano vigente es 7 correctas, 2 con hallazgo, 1 fallida (T09) y 1 pendiente (T10). No se suman esas 11 pruebas a las automatizadas.

Los logs completos, trazas y builds quedan en `.local/acceptance-2` y `.local/test-results`, ignorados. Aquí solo se versiona evidencia ficticia y los resultados seleccionados; no tokens, sesiones ni respaldos privados.
