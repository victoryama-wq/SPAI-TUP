# Usuarios: iconos; Ciclos: aviso descartable

Fecha local: 21 de octubre de 2026. Responsable técnico: Codex. Base preservada: `14912c83a1426e896b598464c6766a3ceb16fb8b`, rama `codex/usuarios-baja-complemento`. La instrucción del propietario sustituye expresamente las etiquetas visibles y la tarjeta fija anteriores. Aceptación visual de este ajuste: **pendiente**.

## Ajustes

- Directorio de Usuarios: ojo, lápiz y papelera SVG; botones de 44 × 44 px, separación de 8 px, centrados y sin salto. Nombres accesibles exactos, tooltips con cursor y foco, foco visible y colores azul/rojo. Se mantiene el desplazamiento horizontal del directorio en pantallas estrechas. No cambian condiciones de visibilidad, identidad, autorización ni los manejadores de cada acción.
- Ciclos: retirada la tarjeta independiente y su CSS/espacio. Aviso nativo `dialog`, con la identidad, el estado y `tentativeCaptureCloseAt` del ciclo único autorizado. No usa `closedAt` ni fecha inventada; si falta, muestra «Sin fecha definida».
- Un aviso por instancia/visita al módulo. Requiere lectura confirmada, permiso de consulta y contexto verificado. Entendido, × y Escape descartan; una recarga de datos dentro de la misma visita no lo reabre. Si se pierde el contexto consultable se retira el aviso; no se escoge un candidato ante ambigüedad.
- La confirmación usa el mismo servicio existente, con instancia local a Ciclos, dentro del mismo diálogo; conserva preparación del comando, revisión, idempotencia, confirmación y rechazo del servidor. Se contiene Tab/Shift+Tab y se devuelve el foco al control o al encabezado del directorio. No se alteran diálogos globales de otros módulos.
- Cerrar captura queda también en la fila, como icono con nombre accesible/tooltip. Las operaciones legítimas de Preparación y Captura cerrada antes alojadas en la tarjeta pasan a la fila: iniciar, motivo/reabrir, habilitar/deshabilitar Especiales y cerrar ciclo. Sus condiciones y llamadas existentes se conservan.

## Evidencia

[Galería](evidence/interface-actions-cycle/index.html), [recorrido real](evidence/interface-actions-cycle/resultados.json), [estados y permisos](evidence/interface-actions-cycle/estados.json).

| Comprobación | Resultado y límite |
|---|---|
| 1280, 768, 390 y 320 px | PASS: iconos cuadrados, misma fila, tooltips, aviso, vista descartada, sin desbordamiento general; inspección visual de capturas por el agente |
| Entendido, × y Escape | PASS: sin comandos de cierre y sin cambios en documentos |
| Recarga de datos durante la visita y nueva entrada | PASS: no reaparece al refrescar datos; vuelve a ofrecerse en una nueva entrada |
| Confirmar desde aviso y desde fila | PASS: un único diálogo, aviso contractual exacto, cancelación y retorno de foco |
| Versión obsoleta | Rechazo real 409 del emulador; alerta contextual, Captura permanece y documentos iguales |
| Cuenta real Coordinación A DEMO sin facultad de ciclo | Ruta rechazada; solicitud directa `cycleCommand` rechazada con 403/PERMISSION_DENIED |
| Preparación, Captura, Captura cerrada, Cerrado, ninguno, múltiples, sin fecha, consulta, sin permiso, revocación | Diez casos de **presentación en memoria** aprobados; sin modificar Firestore. No equivalen a diez ensayos de autorización del servidor |
| Eliminar usuario | Preview real, motivo obligatorio, destinatario correcto, cancelar y devolver foco; no se ejecutó una baja nueva |
| Pruebas unitarias pertinentes | 18/18: política R01, solicitudes/ciclo y configuración local |
| Compilaciones | Complement, producción y LAN aprobadas. Producción mantiene advertencia de presupuesto: 783,56 kB frente a 750 kB |

Los ensayos utilizan solo el slot complement ficticio y comparan usuarios, delegaciones, ciclos, bitácora y operaciones de ciclo antes/después del recorrido. No hay fixtures, reset, cambios de delegación ni escrituras académicas exitosas. La cuenta Consulta R01 no pudo iniciar sesión en los datos actuales de este slot; se conservó intacta y se utilizó Coordinación A existente para el ensayo real de rechazo.

`header-review.mjs` conserva su punto de entrada y ejecuta el recorrido que sustituye la antigua tarjeta. Se adaptaron los localizadores de `ui.spec.mjs` de tarjeta a fila, sin cambiar sus expectativas de transición. **No se ejecutó la suite destructiva completa** contra los servicios compartidos; los casos de presentación y el rechazo real se ejecutaron por separado sin cambiar datos. La evidencia histórica de la tarjeta anterior no se sobrescribe.

## Demo y revisión del propietario

Frontend en **http://192.168.42.1:4205/**, misma pasarela y emuladores. Las demos 4201/4203, el respaldo privado y su selección permanecen intactos. Prueba LAN desde el anfitrión; otra computadora física no verificada en esta ejecución. Sigue registrada la incidencia previa de permisos para configurar el firewall.

1. Recargar 4205 e ingresar como Sistemas DEMO. En Usuarios comprobar ojo/lápiz/papelera en una fila; recorrerlos con Tab y verificar tooltips.
2. Entrar a Ciclos: verificar código, estado y fecha reales. Descartar con Entendido, × o Escape; la tarjeta fija ya no existe.
3. En la fila del ciclo operativo, pulsar el candado; aparece la confirmación, no un cierre directo. Cancelar para conservar los datos compartidos.

Permanecen abiertos el impedimento administrativo de 200 documentos, los pendientes contractuales R02/R03 ya registrados (incluido el seguimiento histórico de 18), validaciones remotas, migración/reversión y las dos comprobaciones de Rules inconclusas de baja. Este ajuste no modifica gates ni declara preparación productiva. D1 sigue vigente: captura cerrada bloquea correcciones académicas hasta reapertura. Sin push, merge, despliegue remoto ni conexiones reales a Moodle/SAEKO.

## Archivos de aplicación

- `src/app/features/users/components/security-console.component.html` y `.css`.
- `src/app/features/cycles/pages/cycles-page.component.ts`, `.html` y `.css`.
- Pruebas: `tools/e2-r02/interface-review.mjs`, `interface-states.mjs`, entrada `header-review.mjs` y localizadores `ui.spec.mjs`.

No se modificaron Functions, Rules, consultas de autorización, contratos ni datos persistidos.
