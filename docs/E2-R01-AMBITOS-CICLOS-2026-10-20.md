# E2-R01 — Ámbitos legibles y selector de ciclos

Fecha: 20 de octubre de 2026. Responsable técnico: Codex. Base: `e24dbd23ccb2b6a283dfbb3db6d5a358005cfc9c`, rama `codex/e2-r01-seguridad-permisos`; árbol limpio al inicio. Commit de esta entrega: consultar `git log -1 --format=%H -- docs/E2-R01-AMBITOS-CICLOS-2026-10-20.md`.

La aceptación visual y humana sigue pendiente del propietario. Esta entrega complementa la ficha de acceso, exclusivamente en E2-R01. No modifica Rules, Cloud Functions, contratos ni la lógica de herencia. No implica capacidad productiva.

## Cambios

- `security-console.component.ts/html/css`: el directorio conserva únicamente Estado de la cuenta (Todos/Activo/Inactivo), alineado a la derecha. Se retiró el filtro textual local, sin ampliar la consulta administrativa ni retirar el aviso de directorio parcial. Se conserva la composición superior, franja institucional, columnas y acciones.
- La presentación de ámbitos traduce el token global explícito a **Todos**: tabla, ficha, editor, resumen de origen, comparación de herencia y preview heredada. Los campos de texto conservados usan un adaptador de presentación; no se sustituyen datos almacenados. Las listas vacías se muestran como **Sin ámbito**; se conserva **No aplica** para campos extraordinarios sin esa facultad. El estado de carga/error del directorio sigue separado del contenido.
- `cycle-scope-picker.component.ts`: desplegable nativo `details/summary` con casillas múltiples, grupos por estado, selecciones retirables, etiquetas y foco visible. Conserva el borrador, permite teclado y refluye en móvil. Utiliza `CyclesRepository`, incluidas su consulta autorizada, limpieza de suscripciones ante cambio de sesión y estados de carga, denegación y error con reintento.
- **Todos los ciclos** está disponible solo en edición de ámbitos autorizada a Administración General, excluyendo el propio perfil. El auxiliar continúa con el editor de asignación de definiciones preaprobadas, cuyos ámbitos son de consulta. Los perfiles administrativos conservan su derivación de alcance institucional/delegación; no se crea una facultad adicional.
- Marcar Todos deja únicamente el token global; marcar un ciclo individual retira el token. Retirar todas las selecciones conserva la lista vacía. Abrir un registro no normaliza ni elimina selecciones guardadas que no puedan resolverse; se muestran con aviso y solo se retiran mediante una acción expresa.

## Identificadores y estados

La representación contractual existente de `scope.cycles` utiliza **`ciclos.code`**. Rules compara `inCycle(resource.data.code)`, `cycleCode` o `cycle`; las consultas de asignaciones también filtran por ese código. Se guardan los códigos reales cargados del catálogo, no etiquetas ni IDs inventados. El ID del documento se utiliza para identificar la opción renderizada, sin migrar silenciosamente los ámbitos a IDs Firestore.

Los grupos proceden del estado real: Captura y Captura cerrada → Ciclo activo; Cerrado → Ciclos históricos; Preparacion → Ciclos en preparación. No se elige arbitrariamente un único ciclo cuando el catálogo contiene varios operativos; ese incumplimiento R02 sigue abierto. Seleccionar histórico no ejecuta transición, reapertura ni modificación de captura. Las selecciones no resueltas conservan su valor; durante carga/error se indica que el catálogo no está disponible, sin convertir ausencia de resultados en alcance global.

## Evidencia y límites

Resultados finales, capturas y diagnósticos: `docs/evidence/r01-scope-selector/`. El archivo `results.json` separa interfaz, servidor, caracterizaciones y gate contractual. La galería `capturas.html` contiene panel/directorio/selector a 320, 390, 768 y 1280 px, además del alcance global en tabla. Son inspecciones y pruebas de Codex con datos ficticios aislados; no sustituyen aceptación humana.

Ejecución final: `tools/e2-r01/run-acceptance.mjs`: **28 unitarias, 37 R01 + 9 Auxiliar + 8 Control de accesos + 21 Herencia, 72 caracterizaciones y 59/59 interfaz**. Sin omitidas ni reintentos. Se conserva la distinción: los 59 recorridos incluyen la comprobación de ausencia de cambios tras la sonda de Rules; **no acreditan como correcta esa evaluación de política**. El gate estricto continúa con salida 1 y exactamente los mismos 18 IDs. Las compilaciones LAN y producción pasaron; producción mantiene advertencia de bundle inicial 779,99/750 kB. La prueba con los emuladores aislados detenidos confirmó ausencia de fallback a producción.

La huella completa de Firestore compartido antes/después sigue siendo `7762bebccbc2b89c234745407662140e1b483654e21c4b6a05d5fdde23243393`; delegaciones y datos conservados. Los hashes de selección de datos y respaldo privado permanecen `9550d3a37a5b783eb274daf3289dd3c9d94ea7f3ed1ba343e4119bb33f2bdc09` y `b3ddfc0d73a8b6c2e0415cb171456843c0d76bb84009b8562da66744321492ed`. No se ingirió el respaldo privado. Servicios compartidos sin reinicio; solo se publican archivos compilados al servidor **local** ya activo. Dirección vigente verificada: Wi-Fi, `192.168.42.1:4201`. La versión exacta y los hashes servidos quedan en `demo-version.json`, con recibo local `.local/scope-selector/served-verification.json`.

Se verifican guardado sin cambios de ámbitos limitados con un ciclo no resuelto y de ámbitos globales; selección individual, múltiple, global excluyente y vacía; cancelación; filtro por estado; teclado y pie del modal. Se comprueban peticiones directas `assignRole` y `saveUser` de auxiliar con ámbito global fuera de su delegación: rechazo `functions/permission-denied`, sin cambios en usuarios, delegaciones, asignaciones, revisiones, auditoría, eventos ni idempotencia.

**Diagnóstico independiente de Rules:** la escritura directa de `scope.cycles` mediante SDK obtiene `PERMISSION_DENIED`, pero el emulador incluye `evaluation error at L70` además de `false` en la misma regla. La comprobación estricta que exigía ausencia de errores falló; se preserva en la evidencia. No se contabiliza ese error como validación de denegación por política. El resultado final de esta sonda se registra como `INCONCLUSIVE_EVALUATOR` en `direct-rules.json`. No se ha observado escritura ni cambio parcial. Se mantiene pendiente su diagnóstico R01; no se cambia Rules para cerrar un ajuste de presentación. Los rechazos limpios de los dos comandos administrativos se acreditan por separado.

Permanecen el límite combinado de **200 documentos** (impedimento administrativo de producción), los **18 incumplimientos R02/R03**, el diagnóstico previo de complejidad de notificaciones del auxiliar y las comprobaciones remotas/productivas pendientes. Se conservan T01 físico, T07 funcional y T11 físico; T10 humano continúa pendiente.

## Revisión breve del propietario

1. Abrir Usuarios con Sistemas en la demo LAN actualizada. Verificar que solo quede Estado de la cuenta y que la composición superior permanezca intacta.
2. Abrir la ficha de una persona con alcance global explícito: Programas debe decir Todos. Una lista vacía debe decir Sin ámbito.
3. Entrar en Editar perfil → Alcance académico y desplegar Ciclos. Revisar agrupación, selecciones existentes y avisos de valores no resueltos. Con teclado, usar Tab/Enter para abrir y Espacio para marcar.
4. Probar selección individual/múltiple y Todos los ciclos; comprobar exclusión y retirar selecciones. **Cancelar** para conservar los datos compartidos. Las pruebas de guardado ya se realizaron únicamente en el entorno aislado.
5. Con Auxiliar, comprobar que la asignación sigue limitada a roles preaprobados de su delegación y no ofrece edición libre de ciclos.

La comprobación de LAN se realiza desde el anfitrión. No se solicita repetir recorridos físicos ya aceptados ni se declara prueba desde otra computadora.
