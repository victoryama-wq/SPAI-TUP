# Etapa 1 — Contratos funcionales y operaciones

Fecha: 2026-09-12. Base revisada: `3a93ea6`, descendiente de `146cf9f`.
Esta etapa documenta y reproduce; no modifica reglas, componentes ni repositorios
funcionales. La [matriz](ETAPA-1-MATRIZ-PERMISOS.md) distingue interfaz y servidor.
La fuente es [SPEC v2](SPAI-TUP-SPEC-v2.md), especialmente §§6, 10, 12, 14,
24 y 25. La sección 25 prevalece donde contradice las anteriores.

## Decisiones y límites del contrato

| ID | Definición | Estado y efecto |
|---|---|---|
| D1 | Al cerrar captura se bloquean **todas las correcciones académicas**, también docente, grupos/programas y matrículas de una asignación cargada en Moodle. Requieren reapertura. | **Confirmada por el propietario:** «Bloquearlas hasta reabrir captura». Resuelve §§10/25.4. No limita por sí sola las tareas posteriores de Sistemas. |
| D2 | §12 y §24.8 admiten vincular grupos directamente desde Asignaciones; §14 exige solicitud y aceptación de origen para compartir entre coordinaciones. | **Pendiente:** ¿debe exigirse siempre aceptación de origen o se conserva la vinculación directa? Afecta solo el canal de autorización de compartir; conservación del estado, atomicidad y ámbito siguen exigibles. |
| D3 | §6 preserva módulos académicos base incluso con flags heredados incompletos; §25.10 exige permiso correspondiente. Las plantillas personalizadas permiten `edit`, pero varios módulos se describen exclusivos de Sistemas. | **Pendiente de política compatible:** distinguir flag ausente heredado de revocación explícita y definir si `edit` personalizado puede administrar catálogos exclusivos. No convertir nombre de rol en autoridad. Las dos sondas con esperado `null` caracterizan sin resolver este conflicto. |

Las siguientes garantías de idempotencia, atomicidad y manejo de errores son
contratos técnicos de esta estabilización, solicitados por el propietario.
La prohibición de autoescalamiento y la edición académica limitada al docente
pendiente propio son propuestas de seguridad para Etapa 2: el SPEC no define
una lista exhaustiva de campos para esa edición y §6 condiciona la protección
del auxiliar a su implementación en reglas. No se presentan como funciones ya
implementadas ni como una decisión sobre ampliar privilegios de roles nuevos.

## C01 — Identidad, módulos y alcance

Una sesión autenticada no concede privilegios. Un perfil inactivo puede leer
su propio perfil y sincronizar la vinculación de identidad sin activarse, pero
no operar datos académicos. El servidor debe evaluar perfil activo, capacidad,
ámbito y campos; ocultar controles o filtrar listas no es autorización.

Los campos `role`, `status`, `access`, `assignedPrograms`, identificadores y
vinculaciones de identidad no son campos de autoservicio. Vincular un perfil
heredado a Auth no debe permitir agregar ni retirar campos de autorización.
El auxiliar delegado para gestionar Usuarios no debería elevar sus propios
privilegios ni otorgar capacidades superiores a su delegación. Las modificaciones
de terceros requieren política explícita, no inferencias por texto del nombre.
La normalización de perfiles existentes y reparación de referencias es Etapa 4;
Etapa 2 deberá preservar compatibilidad sin migrar datos en esta intervención.

Evidencia: `AUTH-*`, `FUNCTION-*`, `INACTIVE-OWN-PROFILE`, `OFF-*`,
`UI-AUX-OFF`, `UI-CUSTOM-VIEW`, `PROFILE-*`; hallazgos F01/F10.

## C02 — Ciclo operativo

| Origen | Acción y destino | Actor/condiciones esperadas | Actual |
|---|---|---|---|
| Sin ciclo | Crear → `Preparacion` | Sistemas autorizado; código único, fechas coherentes; no implica activar | Formulario espera guardado; reglas no validan esquema completo |
| `Preparacion` | Iniciar → `Captura` | Sistemas autorizado; ningún otro ciclo operativo | `startCapture` actualiza solo el elegido; no exclusión global |
| `Captura` | Cerrar captura → `Captura cerrada` | Sistemas autorizado; conservar histórico y ciclo operativo | Actualización independiente sin máquina de estados en reglas |
| `Captura cerrada` | Reabrir → `Captura` | Sistemas autorizado; reapertura institucional o solicitud aprobada; mantener unicidad | Repositorio actualiza un documento sin operación conjunta con solicitud |
| `Captura cerrada` | Cierre final → `Cerrado` | Sistemas autorizado; retira ciclo operativo, conserva consulta histórica | No se protege transición previa en servidor |
| `Cerrado` | Reapertura histórica extraordinaria | §10 conserva potestad de reapertura de Sistemas, pero solo detalla Captura cerrada→Captura; procedimiento histórico pendiente, no habilitar como transición normal | Repositorio permite actualizar, botón normal no ofrece reapertura desde Cerrado |
| Cualquier estado | Consultar | Perfil con consulta según matriz; no habilita escritura | `activeCycle` elige primer `Captura` o `Captura cerrada` |

Contrato de selección: cero operativos → sin ciclo; uno → ese ciclo, incluida
`Captura cerrada`; más de uno → informar inconsistencia y no escoger uno por
orden de la lista. La prueba utiliza `ERROR_AMBIGUOUS_CYCLE` como resultado
semántico esperado, sin imponer una nueva API. Dos activaciones concurrentes
deben competir por una exclusión compartida: como máximo una puede confirmar.
No se resuelve la inconsistencia cambiando silenciosamente el ciclo del usuario.

El fixture histórico contiene dos candidatos deliberadamente; los tests de
Etapa 1 hacen explícita la ambigüedad que Etapa 0 ya documentaba.
Evidencia: `CYCLE-CLOSED-CAPTURE-ACTIVE`, `CYCLE-MULTIPLE-OPERATIVE`,
`CYCLE-SELECTION-ORDER`; F05, Etapa 3. La carrera de activación en servidor
queda como prueba de integración pendiente cuando exista operación atómica.

## C03 — Escrituras académicas frente a trabajo de Sistemas

| Operación | Académica en Captura | Académica fuera de Captura | Sistemas autorizado |
|---|---|---|---|
| Crear asignación | Programa autorizado, materias/docentes/grupos válidos del ciclo; caso inglés y especiales según catálogo | Bloqueada | Captura y correcciones operativas conforme §10; no permiso ilimitado para alterar identidad cargada |
| Editar docente/grupo/programas/compartidos | Base propia; proteger campos de identidad cuando cargada; D2 para vinculación entre coordinaciones | Bloqueada, incluso `CARGADO_MOODLE` (D1) | Revisión y corrección operativa posteriores permitidas; respetar identidad cargada |
| Editar solo `studentEnrollments` | Excepción global explícita de §25.4; no autoriza cambiar docente, materia o base ajena | Bloqueada (D1) | Permitida en operación autorizada |
| Quitar participación compartida | Solo grupos propios del destino; no borrar base ni grupos de origen | Bloqueada (D1) | Gestionar con trazabilidad y referencias coherentes |
| Eliminar base | Solo ámbito autorizado, sin borrar base ajena compartida | Bloqueada (D1) | Borrado operativo autorizado, validar referencias; contrato exacto de recuperación Etapas 4/5 |
| Revisar/observar/exportar/marcar cargado | No concede operaciones Moodle | Consulta | Sistemas conserva tareas de revisión/corrección/Moodle tras cierre de captura |

Los catálogos globales de docentes/asignaturas/nomenclaturas no son por sí mismos
captura de un ciclo. D1 no se usa para inventar una prohibición de mantenerlos.
F04 reproduce autorización del servidor en los cuatro estados; la comprobación
UI solo verifica `canCaptureAssignments`, no todos los caminos de guardado.

## C04 — Estados de asignaciones y conservación Moodle

| Origen/acción | Destino esperado | Restricciones |
|---|---|---|
| Alta de captura | `EN_CAPTURA` | ID determinista; creación confirmada antes de anunciar éxito |
| Exportación CSV de selección válida | `EN_REVISION` | Sistemas autorizado, esperar escritura según §25.6; CSV no acredita importación real |
| Confirmar carga manual de lote | `CARGADO_MOODLE` | Confirmación expresa de Sistemas; no se invoca Moodle en estas pruebas |
| Editar o compartir cualquier estado existente | **Conservar estado anterior** | Compartir una cargada conserva `CARGADO_MOODLE`; no reinicia captura |
| Editar identidad cargada | Rechazar | Conservar `moodleId`, `normalizedMoodleId`, `subjectId`, `subjectName`; incluye Sistemas |
| Estados heredados `VALIDADO` / `CON_OBSERVACION` | Preservar al editar | §25 sustituye flujo anterior; su conversión o retiro exige diseño Etapas 3/4, sin migración ahora |

Estado de carga no equivale a estado del ciclo. D1 se aplica aun si la asignación
está cargada. F08: `SHARE-PRESERVES-MOODLE`, `MOODLE-IDENTITY-PROTECTED`,
`MOODLE-STATUS-RESET-ALLOWED`. La última sonda caracteriza exactamente el
payload de compartir; no prueba que toda transición a `EN_CAPTURA` sea ilícita
en cualquier operación futura.

## C05 — Solicitudes compartidas y operativas

Colección `solicitudes_compartidas`, tipos `COMPARTIR_CLASE`, `REABRIR_CAPTURA`,
`ALTA_GRUPO`, `ASIGNACION_ESPECIAL`. No confundir con la segunda colección.

| Estado/acción | Destino | Actor, campos y efecto esperado |
|---|---|---|
| Crear | `PENDIENTE` | Académica involucrada o Sistemas; identidad del solicitante real, ciclo en Captura para compartir; datos origen/destino y motivo válidos; bloquear duplicado pendiente |
| Consultar | Sin cambio | Sistemas o coordinación origen/destino/solicitante; tercera coordinación excluida |
| Aceptar compartida | `ACEPTADA` | Coordinación del programa origen o Sistemas; `respondedBy/At`, observaciones, vínculo de asignación; añadir destino sin duplicar ni perder grupos |
| Aceptar reapertura/alta/especial | `ACEPTADA` | Sistemas; cambio relacionado de ciclo/grupo/asignación y resolución conjuntos |
| Rechazar pendiente | `RECHAZADA` | Mismo responsable de resolver; motivo obligatorio; no modificar asignación |
| Cancelar pendiente | `CANCELADA` | Solicitante, coordinación destino o Sistemas; no ejecutar efecto relacionado |
| Repetir resolución terminal | Sin cambio | Devolver resultado previo para misma intención o conflicto para otra; no reabrir ni ejecutar de nuevo |

La solicitud de **reapertura** debe poder formularse con captura cerrada: es una
excepción al requisito de captura abierta para compartir, no autoriza capturar
antes de la aprobación. Leer la solicitud ajena no habilita resolverla.

Colección `solicitudes_sistemas`, tipos `REABRIR_CAPTURA`, `ALTA_GRUPO`,
`CAMBIAR_ID_ASIGNATURA`, `DOCENTE_NUEVO` (§14/24). Estados:

| Transición | Actor/contrato |
|---|---|
| Crear → `PENDIENTE` | Usuario activo con necesidad operativa; `requestedBy == auth.uid`, tipo/ciclo/programa/motivo válidos |
| `PENDIENTE` → `EN_PROCESO` | Sistemas autorizado, preservar creador/fecha |
| `PENDIENTE` o `EN_PROCESO` → `ATENDIDA` | Sistemas, confirmar primero y conjuntamente el efecto requerido; en `DOCENTE_NUEVO` validar docente |
| `PENDIENTE` o `EN_PROCESO` → `RECHAZADA` | Sistemas, motivo; no ejecutar efecto |
| Terminal → nueva resolución | Rechazar conflicto o devolver resultado previo; no repetir efectos |
| Borrar/archivar | Gestión de Sistemas según SPEC; el fallback actual ante cualquier error no prueba borrado confirmado. No otorgar borrado ajeno por solo tener módulo Solicitudes |

No existe estado `CANCELADA` en este segundo modelo: no trasladar estados entre
colecciones. Lectura: solicitante y Sistemas; la UI puede agrupar por programa,
pero eso no amplía por sí solo el contrato de las reglas.

## C06 — Confirmación, atomicidad, repetición y concurrencia

| Situación | Contrato esperado | Reproducción actual |
|---|---|---|
| Guardado pendiente | Mantener formulario y estado ocupado; no éxito ni exportación definitiva hasta confirmación del servidor | `REQUEST-CREATE-AWAITS`, `REQUEST-RESOLVE-AWAITS`, `UI-PREMATURE-SUCCESS` (F06) |
| Sin conexión | Mostrar pendiente/error recuperable; conservar datos; no confundir caché con confirmación | Suite offline Etapa 0 + rechazo diferido `unavailable` en UI; no fallback online |
| Permiso rechazado | Error explícito, sin cierre ni éxito; no degradar automáticamente a otro tipo de escritura | `SHARE-FIRST-WRITE-FAILS`, `UI-CYCLE-SAVE-ERROR`; llamada `saveResponse` aún descarta promesa |
| Cambio relacionado falla | Solicitud permanece pendiente; no evento de aceptación | Primera escritura rechaza en prueba UI; validación integral futura |
| Resolución falla tras modificar asignación | **Ambos cambios o ninguno**; informar rechazo | `SHARE-PARTIAL-AND-SUCCESS` reproduce modificación parcial y cierre incorrecto (F07) |
| Doble clic / repetir misma aceptación | Una sola resolución y efecto lógico; retorno idempotente | `REQUEST-DOUBLE-ACCEPT`: dos llamadas, dos escrituras y dos resoluciones |
| Dos solicitudes distintas sobre misma clase | Conservar unión de destinos y evitar duplicados; revalidar origen y permisos en commit | `SHARE-CONCURRENT-LOST-GROUP`: última escritura pierde grupo previo |
| Aceptar y cancelar/rechazar simultáneamente | Una transición terminal gana, otra informa conflicto; no efectos si gana cancelación | `REQUEST-TERMINAL-REWRITE` muestra servidor sin FSM; carrera integrada pendiente |
| Crear dos solicitudes equivalentes | Una pendiente por intención estable (tipo/ciclo/origen/destino), sin depender del milisegundo | `REQUEST-DUPLICATE-CREATE`: misma intención en dos milisegundos controlados produce dos documentos |
| Se pierde respuesta después del commit | Reconsultar por clave de operación y mostrar resultado confirmado; no repetir efectos a ciegas | Contrato técnico, prueba de transporte posterior pendiente |
| Aviso/correo falla | No revertir operación ya confirmada; reintento deduplicado del aviso, con estado distinguible | Correo simulado verificado; deduplicación futura Etapa 5 |

Atomicidad se exige para la resolución y su modificación relacionada, incluso
si en el futuro se usa transacción, batch con precondiciones o callable. Esta
etapa no selecciona ni implementa ese mecanismo. La evidencia de concurrencia
es una intercalación controlada de los métodos TypeScript reales con persistencia
sustituida; **no acredita una transacción Firestore que todavía no existe**.

## Revisión y siguiente etapa

Ver [pruebas y hallazgos](ETAPA-1-PRUEBAS.md). Antes de implementar Etapa 2,
resolver D2/D3 según el alcance que afecten, acordar política de delegación y
campos de docentes pendientes, y convertir las sondas F01/F02/F03/F09/F10 en
pruebas de autorización esperada. F04–F08 permanecen en Etapa 3; no corregirlos
como efecto lateral de esta entrega.
