# Complemento de Usuarios: baja recuperable — 21/10/2026

Responsable técnico: Codex. Autorización: solicitud del propietario adjunta el 21/10/2026. **Implementación local; validación de seguridad incompleta; aceptación humana pendiente; producción pendiente.** No pertenece a las transiciones de R02.

Base conservada: `59a114dade3d7f3152ce3ae270948455ce510006`. Rama de revisión: `codex/usuarios-baja-complemento`, checkout `SPAI-TUP-BAJA-20261021`. El ajuste de Ciclos tiene su commit separado `775dc7e661e08442de9f57ce37b567b33f1d285b` y su ficha `E2-R02-TARJETA-SIMPLIFICADA-2026-10-21.md`. La implementación de baja corresponde al commit que incorpora esta ficha, posterior a ese commit de Ciclos.

## Comportamiento implementado

- Papelera compacta junto a Ver acceso/Editar. Solo Administración General; identidad única del directorio vigente, nombre y correo confirmados. Las filas incompletas o ambiguas siguen visibles y no habilitan esta acción.
- Un modal institucional identifica al destinatario, muestra el aviso literal aprobado y exige motivo de 4–1000 caracteres. Cancelar y Escape no guardan. Se conserva el foco y se limpia la selección y el motivo entre operaciones.
- `userDeletionCommand.prepare`: lectura administrativa acotada, comprobación de identidad en Authentication y confirmación firmada HMAC de cinco minutos. No crea documentos ni altera la cuenta. La firma incluye actor, destinatario, versiones del perfil e identidad de Authentication.
- `confirm`: revalida autoridad actual, firma/caducidad, identidad y versión en una transacción. El control `seguridad/control` compartido con los comandos administrativos serializa las carreras que podrían eliminar al último ADMIN_GENERAL activo y vinculado.
- La transacción conserva `usuarios/{id}` con `status: Inactivo`, `deletedAt`, revisión incrementada e identificador de operación. Crea conjuntamente `bajas_usuarios` (perfil anterior e identidad histórica), `bajas_correo`, `bloqueos_identidad`, bitácora, `eventos_baja` y `operaciones_baja`. No elimina referencias, asignaciones, revisiones ni historia.
- Después de confirmar Firestore se revocan tokens de actualización y se elimina **solo la cuenta de Firebase Authentication**. Se verifica su ausencia antes de registrar `COMPLETED`. No se llama a Google Workspace ni se modifica la cuenta institucional de Google.
- Los intentos quedan en `intentos_baja`, con actor, fecha de servidor y resultado. Un arrendamiento de 30 segundos impide procesadores simultáneos normales. Si el proceso se interrumpe, otro administrador puede recuperar la operación; una respuesta perdida o una cuenta ya ausente no duplica la baja.
- Un fallo de Authentication deja `PENDING_AUTH`, conserva el bloqueo y registra el código del fallo. El seguimiento permite consulta y reintento administrativo. Una identidad de Authentication recreada/cambiada no se elimina a ciegas: queda pendiente de revisión.
- La política efectiva, los guards y el directorio excluyen perfiles dados de baja. Se conserva la lectura de la propia ficha para reflejar el bloqueo de la sesión; no concede módulos. La pantalla de entrada distingue «Acceso dado de baja» de una cuenta pendiente de autorización.
- Aprovisionamiento por correo/UID, edición ordinaria, nuevas concesiones, migración y herencia no reincorporan una baja. El historial no se reutiliza como identidad nueva. **No se implementa reincorporación automática**: requiere un procedimiento administrativo explícito independiente.

## Límite administrativo, sin ampliarlo

El inicio y la preparación leen como máximo 201 documentos por colección y comprueban el total combinado de **usuarios, roles_personalizados, delegaciones, asignaciones_roles, revisiones_roles y mapeos_permisos**. Se admite 200; se rechaza 201 con `resource-exhausted`:

> Requiere migración administrativa por lotes: límite local de 200 documentos de seguridad.

La baja conserva el documento de usuario: no libera artificialmente espacio ni elimina historia para sortear el límite. Un rechazo inicial no escribe permisos, delegaciones, revisiones, bitácora, eventos ni operación de baja. Las colecciones nuevas registran el proceso; no sustituyen ni fragmentan la lectura de autorización inicial.

Un reintento **ya iniciado** comprueba por referencias puntuales al administrador vigente, operación y baja; vuelve a comprobar al actor al adquirir el procesamiento. No vuelve a iniciar la concesión ni depende de repetir la lectura de seis colecciones. Conserva actor original, motivo y trazabilidad del administrador que reintenta. Las pruebas acreditan recuperación sobre 201 documentos. La lista de pendientes también rechaza más de 200 en vez de truncar silenciosamente.

El impedimento administrativo para producción continúa abierto. Criterio de salida: solución de consulta/transacción por lotes con autorización completa, atomicidad y revocación probadas al superar 200, sin recortar resultados.

## Evidencia y límites

| Comprobación | Resultado y alcance |
|---|---|
| Pruebas unitarias de configuración, política, autenticación, sesión y directorio | 31/31; incluye baja histórica que no recupera autoridad aunque su estado se alterase a Activo |
| Suite histórica R01 en el tercer entorno, con ciclo preparado | 37/37 según sus aserciones existentes. Algunos negativos admiten diagnósticos de preevaluación con `false` posterior; **no se usa ese resultado para dar por resuelto el evaluador de Rules** |
| Suite específica de bajas | 8 grupos aprobados y 2 pruebas estrictas inconclusas; archivo `server-results.json` |
| Confirmación, cancelación y reintento reales en navegador | Aprobados; llamada real al emulador, motivo obligatorio, foco devuelto, borrador limpio, fila retirada e indicador disminuido en uno |
| Sesión de otra cuenta abierta antes de la baja | Retira Asignaciones y muestra acceso dado de baja; captura incluida |
| Interfaz | 1280, 768, 390 y 320 px; capturas inspeccionadas por el agente, sin aceptación del propietario |
| Compilaciones | Producción y complement correctas. Producción avisa 781,85 kB iniciales frente a presupuesto de 750 kB; no se relajó el presupuesto |
| Ciclos | Evidencia separada: cancelación sin comandos, conflicto real 409 conservando Captura, modal con consecuencias y tarjeta sin los dos mensajes permanentes |

Los grupos específicos comprueban: preparación sin escrituras; baja real y referencias preservadas; autoridad/firma/revisión/caducidad; identidad incompleta/ambigua; doble confirmación; fallo Auth y recuperación por otro administrador; colisión de evento sin cambios parciales; baja en 200 y rechazo íntegro en 201; recuperación iniciada sobre el límite; carrera entre los dos últimos administradores. La llamada con token anterior a `cycleCommand` devuelve rechazo y `syncUserProfileByEmail` rechaza un reingreso simulado con nuevo UID y el correo dado de baja.

**Dos pruebas no acreditadas:** lectura directa Firestore con token anterior y bootstrap directo tras el reingreso. Ambas devuelven `permission-denied` acompañado de `evaluation error`; se clasifican `INCONCLUSIVE_EVALUATOR`, nunca como denegación contractual aprobada. La suite específica termina con código 1 por estas dos condiciones. Hace falta obtener rechazos limpios y reproducibles antes de cerrar la validación de seguridad del complemento. No hubo lectura o escritura autorizada observada en esos intentos, pero el error del evaluador impide acreditar la causa contractual del rechazo.

Durante la regresión, una comprobación redundante de bloqueo en `signedIn()` provocó el límite de 1000 expresiones en una edición legítima del auxiliar. Se retiró; se mantiene el control de baja en el perfil efectivo. El mismo caso positivo pasa con Rules del commit `775dc7e` y con las finales (`rules-regression.json`), y después se repitió la suite histórica completa. No se modificaron expectativas para ocultar ese fallo.

Evidencia inicial y final conservada en `docs/evidence/users-deletion/`; `r01-regression.json` conserva el resultado bruto y esta ficha delimita su interpretación. Los logs de ejecución y compilaciones están en `.local/deletion-*`, sin credenciales.

## Archivos de producto y pruebas

- `functions/security/user-deletion.js`: preparación firmada, transacción, coordinación Auth, recuperación, seguimiento.
- `functions/index.js`: callable y secreto dedicado; bloqueo del aprovisionamiento de bajas.
- `functions/security/policy.js`, `functions/security/service.js`, `firestore.rules`: baja sin acceso efectivo, sin reincorporación ordinaria y conservación del historial.
- `src/app/features/users/components/security-console.component.{ts,html,css}`: acción, modal y seguimiento; selección y autorización de sesión.
- `src/app/features/users/data/{security.service,module-permission.service,users.repository}.ts`: contrato del callable, guard y metadatos de baja.
- `src/app/features/auth/pages/login-page/login-page.component.{ts,html}`: mensaje contextual de baja, sin cambiar el acceso institucional Google.
- `tools/users-deletion/{integration,ui-review,rules-regression}.mjs`, prueba de política y adaptación del mock local de Functions en `tools/local/tests/config.test.mjs`.

## Revisión local, servicios y conservación

Abrir **http://127.0.0.1:4204/** en este equipo, seleccionar **Sistemas DEMO**. La LAN compartida **http://192.168.42.1:4203/** conserva su versión `59a114d` y sus servicios; no se sustituyó su frontend ni se escribieron sus datos. No se hizo una prueba física desde otra computadora. El tercer entorno usa únicamente `demo-spai-tup`, Auth29099, Firestore28080, Functions25001 y Storage29199 en loopback. Su clave local de firma está en `functions/.secret.local`, ignorada por Git; no se publica.

1. Ciclos → verificar tarjeta Captura sin mensajes permanentes; abrir Cerrar captura y cancelar.
2. Usuarios → en **Persona ficticia del-stale**, abrir Eliminar usuario; verificar nombre, correo, aviso y motivo. Cancelar: debe seguir en la tabla.
3. Volver a abrir, escribir un motivo y confirmar: se retira la fila y cambia el indicador. Solo usar las cuentas ficticias del entorno 4204.
4. Abrir Seguimiento de bajas de usuarios → Consultar bajas pendientes. Los fallos Auth se ensayaron con un adaptador ficticio; no hay un fallo real provocado en la demo compartida.
5. Revisar las capturas de móvil y de la sesión bloqueada. Las cuentas de Coordinación utilizadas por la prueba aislada pueden haber sido dadas de baja; eso no afecta sus homónimas en LAN.

Para reproducir pruebas, desde este checkout y con Node 22: fijar `SPAI_LOCAL_TEST_ISOLATED=true`, `SPAI_LOCAL_SYNTHETIC=true`, `SPAI_LOCAL_TEST_SLOT=complement`. `node tools/users-deletion/integration.mjs` **restablece únicamente el tercer entorno** tras verificar su hub y puertos; después `node tools/e2-r02/prepare-review.mjs` y `node tools/users-deletion/ui-review.mjs`. No ejecutar esos comandos sobre los checkouts compartidos. Frontend aislado: `node node_modules/@angular/cli/bin/ng.js serve --configuration complement --host 127.0.0.1 --port 4204`. Los servicios ya están activos al entregar.

## Pendientes conservados

- Resolver las dos comprobaciones estrictas de Rules antes de validar seguridad o desplegar este complemento.
- Límite administrativo de 200; no declarar capacidad productiva por estas pruebas.
- Gate contractual R02/R03 sin cambios: se conserva el registro histórico de 18 incumplimientos y la evidencia posterior R02 (56 aprobados, 10 pendientes R03 y 6 inconclusos del evaluador, sin convertirlos en aprobados). Consultar sus fichas vigentes; este complemento no modifica sus casos ni expectativas.
- Validaciones remotas, migración y reversión de producción pendientes. Provisionamiento y custodia del secreto `SPAI_USER_DELETION_PREVIEW_KEY`, permisos mínimos para administrar Firebase Auth y procedimiento explícito de reincorporación deberán revisarse antes de cualquier despliegue autorizado.
- Aceptación humana del complemento y del ajuste de Ciclos pendiente. La aceptación previa de los cambios R01 permanece como evidencia histórica y no se extiende automáticamente a esta acción nueva.

Sin push, merge, despliegue, SMTP real, Moodle, SAEKO ni acceso a la copia privada de la BD. D1 y las transiciones R02 no se alteran.
