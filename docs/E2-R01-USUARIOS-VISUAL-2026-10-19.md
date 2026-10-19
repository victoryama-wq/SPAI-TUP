# E2-R01 — Presentación de Usuarios y Control de accesos

Fecha: **2026-10-19** (America/Cancun). Responsable técnico: **Codex**. Estado: **VALIDADA_LOCAL; aceptación visual y humana PENDIENTE**.

## Base y alcance

Rama comprobada: `codex/e2-r01-seguridad-permisos`. HEAD inicial limpio: `ca6ec3687f0826ccf794ae362500c2187cfddae4`, sin commits posteriores al informado. Commit de esta entrega: el que incorpora este documento, consultable con `git log -1 --format=%H -- docs/E2-R01-USUARIOS-VISUAL-2026-10-19.md`. No se modifica el commit anterior. `main` permanece en `6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2`.

Se contrastaron el contrato E2 v0.4, el contrato operativo/CO-11, la matriz y evidencia R01, el informe Auxiliar y el complemento de Control de accesos con los componentes actuales. El documento recibido `HALLAZGOS-REDISENO-PANEL-USUARIOS.md` y la imagen del 19 de octubre orientan la composición; sus cifras, nombres y permisos ilustrativos no se incorporan a los datos. Se reutiliza el lenguaje de Ciclos académicos: azul marino, acento turquesa, tarjetas blancas, campos y botones institucionales.

Esta entrega solo reorganiza presentación y preparación de las operaciones existentes. No modifica Rules, Functions, repositorios de datos, autorización, contratos, configuración de autenticación o LAN. Las correcciones anteriores de Bitácora, Solicitudes, delegaciones, revocación y aislamiento de sesión permanecen y se regresan. No se implementa R02/R03.

## Cambios y causas

| Hallazgo o necesidad | Implementación | Comprobación posterior |
|---|---|---|
| Composición distinta de Ciclos/referencia | Tarjeta Usuarios y permisos, cuatro métricas, dos controles superiores, bloque Control operativo, indicadores y cuatro vistas autorizadas | Capturas y geometría en 1280, 768, 390 y 320 px |
| Panel de transición compite con el directorio | Tabla Persona/Perfil/Estado/Programas/Acciones y panel lateral en grid normal; bajo la tabla a 1000 px o menos | Posiciones medidas sin intersección; tabla con scroll propio y foco, sin desbordamiento general |
| Formularios y confirmación en superficies separadas | Un único dialog nativo con pasos de directorio, editor, preparación, confirmación y preview | Solo un modal abierto; cancelar no envía command; Volver conserva el borrador de esa operación |
| Motivo/destinatario de otra operación | Limpieza al cancelar/cambiar de contexto; captura inmutable de comando/destinatario al confirmar | Asignación a B → cancelar → revocación de Auxiliar: motivo vacío y destinatario correcto |
| Correspondencia heredada preseleccionada | Opción inicial vacía; nueva elección al cambiar persona o cancelar, sin cambiar roles almacenados | Registrar deshabilitado sin elección; reapertura limpia, cancelación sin escritura |
| Actualización manual permanente no requerida | Se retira Actualizar desde servidor; carga inicial, actualización tras operación/sesión y al recuperar foco fuera del modal; reintento solo ante error | Consulta retenida/error sin cifras confirmadas y reintento real satisfactorio |
| Adorno del encabezado intercepta clic | `pointer-events: none` exclusivamente en sus dos pseudoelementos decorativos | Clic real en Ocultar encabezado a 1280 px y navegación principal conservada |

La traducción de estados se hace en presentación. Activo/Inactivo permanece separado de Requiere revisión. El estado de revisión Sin revisión requerida no se usa como estado de persona o delegación. La zona sensible para retirar definiciones permanece separada; roles en uso no pueden retirarse, y se explica la conservación del historial.

## Fuentes y alcance de las métricas

Todas proceden de la respuesta autorizada existente de `SecurityService.directory()`; no se añaden lecturas directas ni se infieren privilegios por nombres. En carga/error se muestra **—** y el estado de consulta, nunca un cero confirmado. No hay paginación o recorte para aparentar éxito ante el límite administrativo.

| Indicador | Cálculo sobre el directorio autorizado |
|---|---|
| Usuarios registrados | Perfiles canónicos de usuarios, excluyendo alias `identityAliasOf` |
| Activos | Esos perfiles con estado `Activo` |
| Perfil heredado | Esos perfiles cuyo `permissionSchemaVersion` no es 2; no sustituye su estado activo/inactivo |
| Delegaciones vigentes | Delegaciones `ACTIVE` vinculadas mediante `delegationId` a un perfil activo del directorio y con destinatario coincidente; no equivale a tener todos los módulos |
| Accesos vigentes | Asignaciones de roles con estado `ACTIVE`, como explica el título del indicador; no es el total de usuarios |
| Revisión pendiente | Revisiones `REQUIERE_REVISION_ADMIN_GENERAL` |

ADMIN_GENERAL ve el directorio institucional autorizado, las cuatro vistas, métricas reservadas y ambos botones equivalentes de alta. El Auxiliar autorizado para administrar roles preaprobados ve únicamente Resumen y Roles asignados y las cifras de su directorio, rotuladas explícitamente como limitadas, no totales institucionales. Delegaciones y revisiones reservadas no se derivan de respuestas vacías del Auxiliar: se indica su reserva. No se amplían facultades de VIEW ni se interpreta un ámbito vacío como global. La tabla distingue Institucional, Todos (explícito) y Sin ámbito confirmado.

## Modal y seguridad conservada

Título accesible, foco inicial en el primer campo o encabezado, Tab dentro del dialog nativo, Escape/cancelación y devolución del foco al disparador; si este desaparece o queda deshabilitado se usa una acción autorizada disponible. Encabezado y acciones permanecen accesibles con desplazamiento interno a 320 px. No se duplicaron formularios ni servicio de comandos.

La confirmación indica acción, persona/rol, motivo y consecuencias. El comando conserva revisión esperada, revisión de rol, identificador de preview e idempotencia. Se verifica la generación de sesión antes de confirmar y al resolver respuestas; el cambio/revocación de sesión limpia el modal, directorio y borradores. La validación de autoridad, revisión, siete días de transición y caducidad de preview sigue en el servidor existente. Una preview preparada antes de un cambio de perfil se rechaza sin modificar ese perfil ni añadir auditoría de la operación rechazada. Cancelar la preparación tampoco envía comandos.

## Validación técnica

Ejecución en `demo-spai-tup`, emuladores aislados, fixtures ficticios y tráfico del navegador restringido a loopback. [Manifiesto con fechas, resultados, archivos y hashes](evidence/r01-users-visual/results.json).

| Comprobación | Resultado |
|---|---|
| Unitarias de entorno, política, autenticación y sesión | 28/28 |
| Servidor R01 | 37/37: incluidos límite 199/200/201, atomicidad, transición/caducidad, revisión e idempotencia |
| Servidor Auxiliar | 9/9 |
| Servidor Control de accesos | 8/8: siete comprobaciones actuales y una caracterización explícita del defecto previo |
| Caracterizaciones de etapa 1 | 72/72: 52 Rules y 20 lógica; no equivalen a cumplimiento contractual objetivo |
| Chromium R01 completo | 36/36: las 33 previas, un viewport adicional de consola y dos casos nuevos de métricas/transición |
| Gate contractual estricto R02/R03 | Salida 1: mismos 18 incumplimientos; lista comparada, sin cambios de expectativas |
| Build local, LAN y production | PASS; production advierte 779,19 kB frente a presupuesto de aviso 750 kB; no despliegue |
| Ensayo sin emuladores | PASS: siete intentos solo loopback, sin fallback a producción |
| Formato, sintaxis de herramientas y archivos protegidos | Comprobados al cierre; hashes en manifiesto |

Los primeros ensayos dirigidos detectaron el nombre accesible contaminado por un signo decorativo, el clic interceptado por el encabezado y un fixture Auxiliar sin su identificador de delegación requerido. Se corrigieron presentación y fixture, no la política; la ejecución dirigida posterior pasó 7/7. Tras añadir la limpieza de correspondencia, una ejecución completa quedó en 35/36 por un selector de prueba que incluía el texto de las opciones del select. Se usa su rol combobox y nombre accesible, manteniendo las aserciones; se repitió la suite completa. Las capturas de resumen se toman al inicio del scroll del contenido para poder comparar también el encabezado móvil. Las tres compilaciones corresponden al código final. No se ocultaron fallos ni se debilitaron expectativas del gate contractual.

Automatizadas: geometría, desbordamiento, cuatro vistas/autoridad, dos altas equivalentes, foco inicial/retorno/Tab/Escape, botones accesibles, limpieza, retiro bloqueado en uso, carga/error/reintento, conteos versus BD ficticia, Auxiliar limitado, cambio de sesión y rechazo de preview obsoleta. Inspección visual de Codex: composición institucional, contraste, espaciado y legibilidad en capturas. Esta inspección no es aceptación del propietario ni una nueva prueba física desde otro equipo.

## Capturas comparables

| Ancho | Resumen | Panel de transición | Modal de perfil | Preparación de operación |
|---|---|---|---|---|
| 1280 | [Ver](evidence/r01-users-visual/summary-1280.png) | [Ver](evidence/r01-users-visual/transition-1280.png) | [Ver](evidence/r01-users-visual/profile-1280.png) | [Ver](evidence/r01-users-visual/operation-1280.png) |
| 768 | [Ver](evidence/r01-users-visual/summary-768.png) | [Ver](evidence/r01-users-visual/transition-768.png) | [Ver](evidence/r01-users-visual/profile-768.png) | [Ver](evidence/r01-users-visual/operation-768.png) |
| 390 | [Ver](evidence/r01-users-visual/summary-390.png) | [Ver](evidence/r01-users-visual/transition-390.png) | [Ver](evidence/r01-users-visual/profile-390.png) | [Ver](evidence/r01-users-visual/operation-390.png) |
| 320 | [Ver](evidence/r01-users-visual/summary-320.png) | [Ver](evidence/r01-users-visual/transition-320.png) | [Ver](evidence/r01-users-visual/profile-320.png) | [Ver](evidence/r01-users-visual/operation-320.png) |

[Auxiliar con directorio limitado](evidence/r01-users-visual/auxiliary-scoped.png) y [preview heredada en el único modal](evidence/r01-users-visual/migration-preview.png). Datos exclusivamente ficticios. La página tiene scroll en su contenido: las capturas de transición se toman después de desplazarlo para mostrar el panel inferior; las de perfil muestran el final del formulario para acreditar acceso al motivo y acciones.

## Archivos modificados

- `security-console.component.html/.css/.ts`: composición, métricas, estados, modal único y borradores.
- `src/app/app.component.css`: interacción de los pseudoelementos decorativos.
- `tools/e2-r01/access.spec.mjs`: los recorridos existentes de consola en cuatro anchos.
- `tools/e2-r01/acceptance.spec.mjs` y `ui.spec.mjs`: selector del botón inferior de alta, conservando expectativas.
- `tools/e2-r01/users-layout.spec.mjs` y `playwright.config.mjs`: dos regresiones adicionales dirigidas.
- Este informe, matriz CO, ficha de validación, resultados, historial de hallazgos y capturas.

## Recorrido manual limitado

1. Cuando se inicie la demo mediante la tarea existente **SPAI: Compartir demo en LAN** (compila primero), entrar con Sistemas y abrir Usuarios. Revisar composición, cuatro vistas y panel heredado a la derecha en escritorio/debajo en tableta y móvil. Las cifras reales de la demo pueden diferir de las capturas aisladas.
2. Abrir y cancelar Nuevo perfil institucional desde ambos botones. Usar Tab, Shift+Tab y Escape; comprobar nombre vacío, mismo formulario, foco de retorno y acceso a motivo/acciones. Abrir Roles personalizados, pasar del directorio al editor y volver/cancelar; comprobar la zona sensible y el bloqueo de definiciones en uso.
3. Preparar una asignación o retiro sin confirmar, cancelar y preparar otra operación/persona: revisar destinatario, consecuencias y motivo limpio. En Perfiles heredados, cambiar persona y verificar que exige escoger la correspondencia de nuevo. No registrar ni aplicar una migración a datos compartidos solo para comprobar el diseño.
4. Entrar con el Auxiliar ya configurado por el propietario y comprobar únicamente sus vistas y operaciones actuales; no reconfigurar ni revocar su delegación. Confirmar o reportar diferencias visuales de estas pantallas.

T01 físico, T07 funcional y T11 físico ya confirmados se conservan; no se solicita repetirlos. T10 humano sigue pendiente. Los totales humanos históricos permanecen 7 correctas, 2 con hallazgo, 1 fallida y 1 pendiente: las pruebas técnicas de esta revisión no se suman a aceptación humana.

## Servicios, preservación y pendientes

La LAN estaba detenida al inicio y no tiene listeners al cierre. Esta revisión no inició ni restableció los emuladores compartidos, no leyó ni escribió su BD y no sustituyó sus artefactos servidos. Los emuladores aislados de prueba se detuvieron al terminar. Las compilaciones de verificación se guardan en `.local/users-layout/{local,lan,production}-next`; la tarea LAN recompila el código vigente cuando el propietario decida abrirla.

Se conservan byte a byte Rules, selección de datos privados y respaldo privado, comprobados por SHA-256. El cotejo detectó una variación del archivo local de metadatos `.local/lan-session.json` durante la sesión: únicamente host pasó de `192.168.41.254` a `192.168.42.1`; se comprobó reproduciendo el hash anterior al sustituir exclusivamente esa cadena en memoria. Su origen no está identificado y no se atribuye al propietario. No fue modificado ni restaurado por esta revisión; se preserva la versión actual. No se declara igualdad de ese hash. El PID registrado ya no está activo; la configuración versionada LAN permanece sin diff. La igualdad de los 39 documentos compartidos documentada en la ejecución anterior es evidencia histórica, no una nueva medición con servicios apagados. Google institucional permanece en la configuración definitiva; DEMO solo en configuraciones de prueba. No hubo push, merge, despliegue remoto, correos reales ni conexiones a producción/Moodle/SAEKO.

Siguen abiertos el impedimento administrativo de **200 documentos combinados** en las seis colecciones de seguridad, los **18 incumplimientos de R02/R03**, CI/validación remota, migración/rollback y aceptación del propietario. No se recortan resultados ni se amplía el límite. Esta entrega visual no acredita capacidad productiva ni cierra R01 humanamente.
