# E2-R02 — Entrega local de Ciclo, captura y Especiales

**Revalidación vigente (23/10/2026):** [matriz final, escenarios y limitaciones](E2-R02-REVISION-TECNICA-FINAL-2026-10-23.md). Código evaluado `6b67bd9fb6edd7982f24d40f48863a17b441a092`. Gate 72 = 56 acreditados / 10 R03 abiertos / 6 R02 inconclusos, salida 1. Los ocho históricos R02 se contrastaron individualmente: dos PASS y seis INCONCLUSIVE_EVALUATOR. Complemento Eliminar usuario: 8 PASS y 2 inconclusos, separado. [Informe manual](E2-R02-REVISION-MANUAL-2026-10-23.md) incorporado sin aceptación funcional. **NO VALIDADA LOCALMENTE como entrega completa; aceptación humana pendiente; producción bloqueada.** Se preserva el historial de evidencia debajo.

Fecha: 21/10/2026 (America/Cancun). Implementación y comprobaciones: Codex. Autorización: encargo del propietario `b83232d7-1880-412c-953c-5fc10d816863/Texto pegado.txt`.

**Estado: IMPLEMENTACIÓN LOCAL CON PENDIENTES / NO VALIDADA LOCALMENTE.** La aceptación humana y la preparación para producción permanecen pendientes. Los errores del evaluador de Rules impiden acreditar seis contratos necesarios de R02. No se atribuye aceptación a capturas ni ensayos automatizados.

**Actualización 23/10/2026:** implementado el [complemento de Ciclos y Asignaciones](E2-R02-COMPLEMENTO-2026-10-23.md): máximo dos, histórico inmediato protegido, eliminación explícita del anterior vacío con `PURGE_CYCLE`, modal solo al entrar en Captura y acciones compactas. Siete grupos de servidor y seis UI pasan; 14/14 unitarias pasan. El ensayo estricto de Rules conserva salida 1 por ocho diagnósticos inconclusos de esta nueva muestra. No cambia el estado global, los seis IDs inconclusos históricos ni los diez pendientes de R03. Evidencia nueva separada en `evidence/r02-complement/`; las ejecuciones anteriores se conservan.

## Base y conservación

- Rama: `codex/e2-r02-captura-especiales`, checkout independiente `SPAI-TUP-R02-20261021`.
- Base: `94eeffa90bdb97886f05a88127d3abc59cbcac80`, posterior a la versión R01 aceptada `8ae650b8c3c59390a2290bf819d61d195710c35a`.
- El commit local que incorpora este informe identifica la entrega. `E2-R02-RESULTADOS.json` registra la base, fuentes comprobadas y resultados por ejecución.
- La rama original R01 y su checkout se conservaron. No se reemplazó el frontend LAN, no se reiniciaron sus servicios y no se escribieron sus datos, delegaciones, respaldo privado ni selección.
- Todas las escrituras, preparación de escenarios y reinicios de pruebas se ejecutaron en `demo-spai-tup` aislado, con puertos 18080/19099/15001/19199. No hubo push, merge, despliegue, correo real ni conexión a producción, Moodle o SAEKO.
- La [aceptación R01](E2-R01-CIERRE-2026-10-21.md) no se reabre ni se extiende a R02.

## Comportamiento y archivos

| Frente | Implementación |
|---|---|
| Operaciones privilegiadas | `functions/cycles/service.js`, exportaciones `cycleCommand` y `cycleContext` en `functions/index.js` |
| Autoridad y periodo de escritura | `firestore.rules`; se conserva el modelo efectivo R01, capacidades, ámbitos, delegaciones y caducidad |
| Ciclos y confirmación | `cycles.repository.ts`, página de Ciclos: motivo, versión esperada, avisos, controles accesibles fuera de la tabla histórica |
| Captura y Especiales | Páginas de Asignaciones, Grupos y Docentes; formularios se bloquean al cambiar el periodo; Especiales exige un grupo del catálogo admitido |
| CO-01 | Repositorio de Asignaciones, repositorio Firestore base y consulta autorizada: selección por ciclo, retiro inmediato de datos anteriores, limpieza de listeners y rechazo de entregas tardías |
| Ruta de reapertura desde Solicitudes | Se espera el comando de ciclo, se envía el motivo y se conserva el error sin anunciar éxito si el servidor rechaza. El resto del flujo de Solicitudes permanece en R03 |
| Índices | Dos índices declarativos para consultas de Asignaciones por ciclo y por programa/ciclo, ordenadas por actualización; no desplegados ni validados remotamente |
| Evidencia | `tools/e2-r02/`, regresiones R01 afectadas, gate `tools/stage1/`, [capturas](evidence/e2-r02/capturas.html) y resultados JSON |

### Unicidad y consistencia del servidor

Operativo significa Preparacion, Captura o Captura cerrada. `cycleCommand` lee los ciclos y el documento servidor `ciclo_control/operativo` dentro de una transacción. Todas las operaciones compiten sobre esa barrera, incluso cuando inicialmente no existen ciclos. Dos creaciones simultáneas no pueden confirmar dos operativos.

`cycleContext` verifica la autorización de consulta y deriva únicamente metadatos de control: READY, NONE o INCONSISTENT. No modifica ni elimina ciclos ni escoge uno si hay varios. Sin metadatos verificados, las escrituras académicas quedan bloqueadas. La UI informa ausencia e inconsistencia; los históricos autorizados permanecen seleccionables. El índice de grupos especiales en la barrera es interno: el callable no entrega ese catálogo al cliente.

El cliente no escribe ciclos ni el control directamente. Cada confirmación administrativa revalida permiso EDIT en Ciclos, `MANAGE_CYCLES`, ámbito de ciclo y vigencia del perfil/delegación; no se usa la etiqueta del rol como autoridad. Se vuelven a evaluar las fechas de caducidad después de las lecturas asíncronas.

Se conserva el ajuste existente de fecha tentativa mediante `schedule`, con las mismas validaciones de capacidad/ámbito, versión y atomicidad. No constituye una transición adicional. Se rechazan fechas inválidas y anteriores al inicio/creación.

### Matriz de estados y operaciones

| Estado actual | Crear otro | Transición permitida | Captura académica ordinaria | ESPECIAL |
|---|---|---|---|---|
| Sin operativo | Crear → Preparacion | No hay transición de un histórico | No | No |
| Preparacion | No | Iniciar → Captura | No | No |
| Captura | No | Cerrar captura → Captura cerrada | Sí, según módulo, capacidad, campos y ámbito | Sí, con grupo admitido y autorización |
| Captura cerrada | No | Reabrir → Captura, con motivo; cerrar → Cerrado | **No: D1** | Solo cuando se habilita expresamente y se conserva la autorización de la persona |
| Cerrado | Solo si no existe otro operativo | Ninguna | No | No, incluso con marca residual |
| Varios operativos | No | Bloqueadas por inconsistencia | No | No |

`expectedRevision` es obligatorio para modificar un ciclo. Una operación distinta preparada sobre una revisión antigua responde `aborted / CONFLICTO_VERSION`; no deja efectos parciales. `operationId` identifica reintentos y doble envío. Reutilizarlo con contenido diferente se rechaza. La transacción guarda juntos ciclo, control, bitácora, evento e idempotencia. Una colisión provocada de bitácora o evento revierte todo el comando. Los eventos se registran `PENDIENTE / SIMULATED_ONLY`; registrarlos no equivale a enviar una notificación.

### Operaciones académicas concretas

- Docentes: altas manuales, cambios ordinarios de ficha y eliminaciones permitidas por R01 requieren Captura y ámbito del ciclo. La validación, inactivación y vinculaciones administrativas de identidad conservan su política previa; no se implementó R06.
- Grupos: altas, actualizaciones, eliminaciones individuales y los pasos de importación/borrado masivo usan las mismas Rules por documento. Cada escritura se evalúa al confirmar; un lote Firestore rechazado no cambia sus documentos. No se reconstruyó el importador ni se promete atomicidad de un importador que use varias peticiones independientes.
- Asignaciones/matrículas: altas, cambios académicos y eliminaciones existentes comprueban ciclo vigente, también en CARGADO_MOODLE. No se permite cambiar `cycle`, `assignmentType` o `special` para eludir el cierre. Las operaciones administrativas de estado/observaciones conservan las facultades previas de Sistemas; no conceden cambios académicos fuera de periodo.
- Solicitudes existentes: la escritura académica derivada está sujeta a las mismas Rules. Las peticiones de reapertura y los rechazos/cancelaciones sin efecto académico no se confunden con captura. Estados terminales, doble aceptación, conciliación y efectos completos de solicitudes siguen pendientes en R03.

La barrera del ciclo se lee durante la evaluación de Rules de la escritura, no solo al abrir el formulario. Cierre/habilitación actualizan esa barrera en la transacción del comando. Los ensayos observaron rechazo de escrituras posteriores y ausencia de cambios en lotes rechazados, pero **los diagnósticos ambiguos del evaluador impiden certificar esa protección**. Las carreras ejecutadas no sustituyen una prueba concluyente de todos los órdenes de confirmación.

### Correspondencia exacta de Especiales

Fuentes: E2-C02 y tabla E2-C03 v0.4; no se añaden tipos de operación por el nombre de una pestaña.

| Operación contractual | Tratamiento en R02 / límite |
|---|---|
| Crear ESPECIAL propio | EDIT Asignaciones, programa/ciclo concedidos, grupo real admitido; Captura o Captura cerrada habilitada |
| Editar docente, grupo base, programas y grupos compartidos propios | Allowlist y ámbito R01 más el periodo y clasificación de R02; los efectos y compatibilidad de compartición continúan en R03 |
| Eliminar ESPECIAL propio | Coordinación Académica dentro de su ámbito y periodo; Sistemas según capacidad existente. Usa la ruta de eliminación existente y su auditoría. Recuperación privada integral sigue pendiente de R04 y bloquea producción |
| Matrícula ajena | Solo Coordinación Académica; ciclo autorizado y periodo vigente; en captura cerrada solo ESPECIAL admitido. No concede otros campos ni se extiende a CUSTOM/Auxiliar |
| Vincular/retirar grupo propio en asignación ajena | El periodo de las rutas existentes queda limitado; el flujo directo completo de E2-C08 no se implementa aquí: R03 |
| Reclasificación ordinaria → ESPECIAL | Rechazada por escritura directa. No se implementa una operación excepcional nueva de reclasificación |

La clasificación del catálogo existente es sección terminada en `C.A` (o `C.A.`), ciclo coincidente y grupo Activo; Escolarizado y Ejecutivo se excluyen incluso si la sección indica C.A. Se reutiliza esa clasificación, no se crea una modalidad nueva. Rules comprueba el documento real del grupo y, durante captura cerrada, la lista de grupos admitidos derivada por servidor. Ninguna marca residual habilita Cerrado. Los registros heredados `CURSO_ESPECIAL` o `PROPEDEUTICO` no se convierten silenciosamente a ESPECIAL.

CUSTOM mantiene sus módulos y ámbitos expresos, sin matrícula ajena por excepción. Auxiliar utiliza únicamente la delegación vigente, capacidades y campos autorizados. Revocación, caducidad o cambio de ámbito invalidan las siguientes confirmaciones. Los nombres de personas y roles de los fixtures no conceden autoridad.

## Evidencia y limitaciones

Consultar [resultados por ejecución](E2-R02-RESULTADOS.json), [matriz de pruebas](E2-R02-MATRIZ-PRUEBAS.md) y [galería](evidence/e2-r02/capturas.html). Las ejecuciones fallidas intermedias se conservan en `.local/r02-*.log`; no se presentan como resultados finales. Se corrigieron el harness de configuración para cargar el nuevo servicio, la preparación de fixtures y selectores de prueba ambiguos; no se relajaron expectativas contractuales.

El error observado de Rules contiene `PERMISSION_DENIED` y `evaluation error at L...`, aun cuando también incluye `false` en la misma regla. Se reprodujo con una comparación mínima de estado contra un documento fijo. El [reporte público Firebase #11283](https://github.com/firebase/firebase-tools/issues/11283) describe ese diagnóstico; **no prueba la corrección de estas reglas**. No se acredita una denegación a partir de él. Las pruebas estrictas R02 conservan salida 1 y estado INCONCLUSIVE_EVALUATOR. No se instaló ni desplegó una solución remota.

Las capturas se inspeccionaron por el agente. Los controles de Ciclos y el aviso histórico no se superponen; los controles actuales permanecen fuera del desplazamiento horizontal de la tabla histórica. El encabezado global conserva su comportamiento previo en móvil y la tabla histórica conserva desplazamiento horizontal interno. Esto no constituye una aceptación visual del propietario ni una revisión global de otras pantallas.

## Pendientes obligatorios

1. Obtener denegaciones concluyentes para las rutas necesarias de Rules, repetir los seis contratos R02 inconclusos y sus carreras, sin aceptar errores del evaluador como política válida. Hasta entonces **R02 no está validada**.
2. Mantener abiertos los **diez incumplimientos R03** y sus expectativas. Los ocho objetivos originales R02 se desglosan en la matriz; no se ocultan los seis pendientes bajo un gate verde.
3. Mantener el impedimento administrativo combinado de **200 documentos** y los diagnósticos R01 previos, incluida la sonda histórica `evaluation error at L70` y las limitaciones registradas en su cierre.
4. Validación remota autorizada, comprobación de índices y escala, plan de inicialización/migración del control, respaldo y reversión productivos. La inicialización aquí probada usa datos ficticios, no migra ciclos reales.
5. Recuperación privada y depuración R04, importadores/rendimiento R05 y restantes entregas no se certifican por este trabajo. El catálogo derivado de grupos del control tampoco tiene acreditación de escala productiva.
6. Aceptación humana de R02 y evaluación visual del propietario. No se solicita repetir los recorridos R01 ya aceptados.
7. [Eliminar usuario](DECISION-BAJA-USUARIO-PENDIENTE.md): decisión registrada como entrega independiente, sin implementación.

## Revisión humana aislada y reversión

Usar exclusivamente el checkout `SPAI-TUP-R02-20261021`, no la tarea Compartir DEMO LAN. El script `tools/e2-r02/review.ps1` fija el preset aislado y el servidor frontend en loopback 4202.

En PowerShell, establecer un Node **22** disponible mediante `SPAI_NODE22` o `-NodePath`. Runtime comprobado en este equipo:

```powershell
$env:SPAI_NODE22 = 'C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-R02-20261021
.\tools\e2-r02\review.ps1 emulators
```

Solo si los emuladores aislados no están ya activos. En otra terminal, con el mismo `SPAI_NODE22` y directorio:

```powershell
.\tools\e2-r02\review.ps1 prepare   # Primera preparación: cambia solo fixtures aislados
.\tools\e2-r02\review.ps1 frontend
```

No repetir `prepare` durante la prueba humana: restablece intencionalmente el escenario aislado 27-1/Captura. Si el entorno ya está listo, abrir directamente `http://127.0.0.1:4202/`. No está publicado en LAN ni acredita una prueba desde otra computadora.

Recorrido breve, pendiente del propietario:

1. Sistemas DEMO → Ciclos. Revisar operativo único, controles, históricos y rechazo de Nuevo ciclo mientras existe uno operativo.
2. Cerrar captura. Coordinación A DEMO → Asignaciones: confirmar consulta y bloqueo de escritura ordinaria, incluida una asignación cargada en Moodle.
3. Sistemas habilita Especiales. Coordinación opera solo un grupo C.A admitido y dentro de su autorización. Abrir formulario; Sistemas deshabilita Especiales; comprobar bloqueo de guardar. No usar esta revisión visual para dar por aprobadas las pruebas de Rules inconclusas.
4. Reabrir: exigir motivo. Cerrar captura otra vez y cerrar definitivamente. Crear el siguiente ciclo en Preparación e iniciarlo; no intentar reabrir un histórico.
5. Seleccionar histórico y alternar rápidamente con operativo: datos separados, aviso de consulta, sin escritura; reporte existente limitado a la vista autorizada.
6. Revisar 320/390/768/1280 px y acceso por teclado a motivo, confirmación y selector. No repetir aceptación de Usuarios R01.

Reversión de esta revisión: Ctrl+C en el frontend y `review.ps1 stop` para la sesión de emuladores de **este checkout**, o Ctrl+C en su terminal. No hace falta resetear Git ni borrar datos compartidos. La LAN continúa con R01. El descarte/restauración de estos fixtures aislados no equivale a una reversión de producción ensayada.

## Corrección posterior del escenario — 22/10/2026

El procedimiento de revisión del 21/10 anterior queda como histórico. Para el escenario de **exactamente dos ciclos**, usar el checkout actual `SPAI-TUP-BAJA-20261021` y el arranque descrito en [Corrección DEMO de dos ciclos](E2-R02-DEMO-DOS-CICLOS-2026-10-22.md). La preparación ya no sobreescribe ciclos ni resembrará una sesión existente. No modifica la copia importada del túnel.

La evidencia dirigida está en [resultados](evidence/r02-two-cycles/results.json) y [capturas](evidence/r02-two-cycles/index.html). Acredita la corrección del escenario sintético y los comportamientos especificados, **no la validación completa ni la aceptación humana de R02**. Se conservan los pendientes y resultados anteriores de esta ficha.


## Revisión vigente — 26/10/2026

Código evaluado `7c475f7892cdeb50d21743b6c8b5426b93dd810b`. [Matriz, causas, evidencia y guion actualizado](E2-R02-HALLAZGOS-2026-10-26.md). H-01 y H-02 corregidos y verificados localmente con los límites descritos. **Entrega R02 no validada como completa; aceptación humana pendiente; producción bloqueada.** Gate: 56 PASS, 10 R03 pendientes, 6 R02 inconclusos de 72. Eliminar usuario: 9 PASS, 2 inconclusos, complemento separado. Revisión actual en 4204; las direcciones y estados anteriores se conservan como historia. Continúan el límite de 200 documentos y R04 para renovación con dependencias.
