# Corrección puntual de Nuevo ciclo

21 octubre 2026 · Codex · Base `b738d17be44195ae86d40eeafc500b7b3ec28108`. Aceptación humana pendiente.

La regla del encabezado `.cycles-overview .cycles-header .primary-action` prevalecía sobre `.primary-action:disabled`: el control desactivado parecía habilitado. Además, la condición dependía de `contextReady` y `activeCycle`, sin exigir `ready()` de la colección: al vaciarse los elementos durante una recarga podía quedar transitoriamente el contexto anterior listo y ningún ciclo visible.

Se añade una única condición de creación: lectura confirmada, contexto/autorización vigentes y cero ciclos operativos. Se usa en botón, apertura y guardado; `isSaving` también bloquea. El modal informativo no interviene en esa condición. No cambian la política ni el servicio de servidor.

El botón conserva su ubicación y desactivación HTML nativa. Una envoltura enfocable permite consultar por teclado la ayuda vinculada mediante `aria-describedby`, sin activar el botón. Se restituye la paleta desactivada institucional y se evita el recorte del tooltip. El texto exacto es «Ya existe un ciclo operativo. Debes cerrarlo definitivamente para crear otro.»; en carga, error o ambigüedad se comunica su estado correspondiente. Sin tarjeta ni alerta permanente nueva.

## Resultados

- PASS en 1280/768/390/320: botón desactivado, ayuda con cursor/foco, Enter/Espacio no abren formulario ni emiten creación, ayuda completa sin recorte.
- PASS: Preparación, Captura, Captura cerrada, múltiples y error bloquean. Solo Cerrado permite abrir/cancelar. Son escenarios de presentación en memoria; no modifican ciclos persistidos.
- PASS: lectura pendiente con contexto previo listo permanece bloqueada; observador del botón no detecta activación durante una recarga real. Descartar el aviso no lo habilita.
- PASS de concurrencia: servicio real `functions/cycles/service.js` y transacciones del emulador, en una **base nombrada nueva y separada de `(default)`**. A prepara con solo históricos; B crea; A confirma después y recibe `failed-precondition: Ya existe un ciclo operativo.`. Sin cambios parciales en ciclos, control, auditoría, eventos ni idempotencia tras el rechazo. Es prueba del servicio por Admin SDK, no una nueva prueba HTTP/Rules.
- Regresión del recorrido de iconos/aviso, cancelación y rechazo real 409 conservada. Compilaciones producción y LAN aprobadas; persiste advertencia del bundle inicial de 783,56 kB frente a 750 kB.

Evidencia: [UI](evidence/new-cycle-disabled/ui.json), [servidor aislado](evidence/new-cycle-disabled/server.json), [escritorio](evidence/new-cycle-disabled/bloqueado-1280.png), [tableta](evidence/new-cycle-disabled/bloqueado-768.png), [móvil](evidence/new-cycle-disabled/bloqueado-320.png).

Archivos de aplicación: `cycles-page.component.ts`, `.html` y `.css`. Prueba reproducible: `tools/e2-r02/new-cycle-review.mjs` con slot complement sintético. No se ejecutan fixtures/reset en la base compartida; la base nombrada contiene únicamente datos ficticios de este ensayo.

Actualización de frontend en 4205 sin reiniciar servicios. Conservados respaldo privado y datos de las demos. Sin push/merge/despliegue remoto. Siguen abiertos los gates previamente documentados: 200 documentos, pendientes R02/R03, Rules inconclusas, validaciones remotas y migración/reversión. D1 permanece vigente.
