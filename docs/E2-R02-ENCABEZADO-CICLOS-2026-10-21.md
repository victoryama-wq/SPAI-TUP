# R02 — Encabezado operativo y aviso de cierre

Fecha: 21 de octubre de 2026. Base: 2cb790a1f323685c00dfe984914515ae781ada69. Responsable de comprobación técnica: Codex. Aceptación humana pendiente.

Se ajustan exclusivamente la tarjeta operativa de Ciclos (azul marino, acento cian, sobretexto, título blanco y botón institucional con icono) y el aviso de Cerrar captura. La descripción de captura habilitada solo se renderiza para Captura. Se elimina el texto técnico permanente; se conserva el aviso existente de Especiales cuando corresponde.

El modal muestra exactamente: “Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.” Las condiciones de autorización, preparación del comando, versión, confirmación y tratamiento de errores no cambian. Rules, Functions, contratos, datos y delegaciones no se modifican.

## Evidencia

- [Capturas escritorio/móvil](evidence/e2-r02/header-review/capturas.html), inspeccionadas por el agente a 1280, 390 y 320 px; tarjeta y modal legibles sin recortes.
- [Resultados dirigidos](evidence/e2-r02/header-review/resultados.json): cancelación en los tres anchos sin enviar comandos y comparación de ciclos antes/después idéntica.
- Rechazo real del servidor: la prueba intercepta exclusivamente el comando de cierre y envía expectedRevision=-1. Respuesta 409, alerta contextual con “el ciclo cambió”, estado Captura conservado y documentos de ciclos idénticos. No se confirma ninguna transición ni se ejecutan fixtures/reset. Solo entorno sintético aislado de R02.
- Preparación, Captura cerrada y Cerrado se comprueban sobre el template Angular real con sustitución temporal del estado en memoria del navegador, sin escrituras; no muestran la descripción de captura habilitada. Es evidencia de presentación, no una nueva prueba de autorización.
- Reutilizados harness/servidor aislado y selectores de R02. Regresión requests-cycle.test.mjs y config.test.mjs: 8/8 aprobadas. Compilación LAN correcta. Logs conservados en .local/r02-header-unit.log y .local/r02-header-build.log.

## Archivos y disponibilidad

Cambios de producto: src/app/features/cycles/pages/cycles-page.component.html, .css y .ts. Prueba dirigida reproducible: tools/e2-r02/header-review.mjs (SPAI_LOCAL_TEST_ISOLATED=true y SPAI_LOCAL_SYNTHETIC=true, frontend 127.0.0.1:4202 y emuladores aislados activos).

Se actualiza únicamente el frontend estático R02 servido en http://192.168.42.1:4203/. Servicios y datos se conservan. La demo R01 en 4201, su respaldo privado y selección permanecen intactos. Comprobación desde anfitrión; no se acredita segunda computadora.

Los seis casos contractuales R02 inconclusos por evaluación de Rules, diez incumplimientos R03, límite administrativo de 200 documentos y preparación productiva continúan abiertos. Este ajuste no cambia la calificación NO_VALIDADA_LOCAL de R02. Sin push, merge ni despliegue remoto.
