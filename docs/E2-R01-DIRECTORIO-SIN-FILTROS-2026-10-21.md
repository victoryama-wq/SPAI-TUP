# E2-R01 — Directorio sin fila de filtros

21 de octubre de 2026 · Responsable técnico: Codex. Base `ff931937c867e4bb26e113421a709a8cbd2bbdb1`, rama `codex/e2-r01-seguridad-permisos`. Aceptación visual/humana pendiente.

Se retiraron el selector Estado de la cuenta, su etiqueta, el contenedor y todas sus reglas CSS. Se eliminaron `statusFilter` y `filteredProfiles()`: la tabla recorre directamente `profiles()`, que conserva la selección de perfiles canónicos del directorio autorizado. No existía persistencia de ese filtro; no se modifica almacenamiento ni preferencias ajenas. Activos e inactivos se presentan juntos dentro del ámbito autorizado.

Se conserva el margen institucional del contenedor: 20 px en escritorio/tableta y 16 px hasta 480 px. La tabla comienza inmediatamente dentro del borde azul claro, sin fila ni espacio de filtros. Permanecen las esquinas redondeadas, el encabezado gris azulado, los badges de estado, las acciones autorizadas y Revisiones pendientes en la banda. Se eliminó también el borde superior duplicado que separaba los filtros de la tabla. No hay cambios de permisos, consultas, activación/inactivación, modales o herencia.

Archivos de aplicación: `security-console.component.html`, `.css` y `.ts` en `src/app/features/users/components/`. Se adaptaron los selectores de espera de las pruebas de ficha, directorio, composición y ámbitos. El recorrido existente de ámbitos ahora exige ausencia del filtro, número de filas igual al directorio canónico autorizado, presencia de ambos estados y distancia banda/tabla acotada al margen institucional más el borde.

Evidencia: [galería](evidence/r01-directory-gap/capturas.html) y `evidence/r01-directory-gap/results.json`. Capturas inspeccionadas a 320, 390, 768 y 1280 px, mostrando la banda completa, las cabeceras y las primeras filas. En móvil se conserva el desplazamiento horizontal de la tabla, sin ampliar el ancho de la página. Son comprobaciones técnicas de Codex, no aceptación del propietario.

Validación dirigida: 19 recorridos de interfaz en emuladores aislados, compilaciones LAN y producción. La advertencia de presupuesto inicial 779,99/750 kB permanece. La sonda auxiliar de Rules continúa separada e inconclusa por error del evaluador; no acredita denegación por política ni se oculta con esta modificación. No se repite ni altera el gate contractual: permanecen los 18 incumplimientos R02/R03 y el impedimento administrativo de 200 documentos.

Demo compartida, delegaciones, respaldo privado y selección conservados; solo se actualizan archivos compilados del frontend local. Sin reiniciar servicios compartidos ni hacer push, merge o despliegue remoto. El commit exacto se obtiene con `git log -1 --format=%H -- docs/E2-R01-DIRECTORIO-SIN-FILTROS-2026-10-21.md`; la versión servida está en `demo-version.json` y el recibo en `.local/directory-gap/served-verification.json`.

Revisión del propietario: recargar Usuarios con Ctrl+F5, comprobar la transición directa de la banda a la tabla y confirmar que aparecen tanto usuarios activos como inactivos. En móvil, desplazar horizontalmente la tabla para consultar Estado y Acciones. No hace falta modificar ningún perfil para aceptar este ajuste.
