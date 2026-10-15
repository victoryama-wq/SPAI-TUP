# Inventario operativo y cobertura R01

> Seguimiento vigente de aceptación: [15/10/2026](E2-R01-ACEPTACION-2026-10-15.md). El inventario CO-01 a CO-12 y las ejecuciones previas se conservan. T01 físico, T07 funcional y T11 físico están confirmados por la propietaria; los pendientes históricos no sustituyen ese nuevo resultado.

Revisión complementaria del 2026-10-13, sobre `7b22264d06c1d2925bf7c3c97058ad06112d9b39`.
Fuentes: [contrato operativo v1.0](CONTRATO-CAMBIOS-OPERATIVOS-SPAI.md) y [Etapa 2 v0.4](ETAPA-2-CONTRATOS-ESTABILIZACION.md), que prevalece en seguridad.
No existía un inventario CO-01–CO-12 versionado. Se incorpora mediante inspección de código; únicamente CO-02/CO-11 reciben implementación y pruebas de esta revisión. «Existente» no certifica producción ni las etapas futuras.

## Inventario CO-01–CO-12

Rutas de implementación relativas a la raíz. `pages` indica el componente `.ts` y su plantilla `.html` del módulo citado.

| ID | Estado de inventario | Implementación / evidencia inspeccionada | Pendiente y entrega responsable |
|---|---|---|---|
| CO-01 | Pendiente de implementación | `src/app/features/assignments/pages/assignments-page.component.ts`: `catalogAssignmentsForActiveCycle` usa `activeCycle`; no se localizó selector histórico separado en su plantilla | Selector, consulta y reporte históricos coherentes; R02 ciclo y R03 asignaciones. No ensayado aquí |
| CO-02 | Existente verificado, con corrección R01 | `firestore.rules:assignmentRead`, `assignmentUpdate`; `src/app/core/data/authorized-query.ts`; controles `canManageAssignments`, `canEditAssignment`; escenarios CO-02 de `tools/e2-r01/review.mjs` y `ui.spec.mjs` | R01; eliminar como auxiliar exige ahora EDIT además de capacidad/ámbito. Matriz detallada abajo |
| CO-03 | Existente con pendientes | Asignaciones: `saveOperationalAssignmentEdit`, `saveAcademicCoordinatorEnrollmentOnlyEdit`; Rules limita campos e identidad. Integración R01 acredita excepción de matrícula y rechazo ajeno | Bloqueo por estado de captura en servidor (D1), atomicidad y Especiales: R02/R03. Los fallos E1 siguen abiertos |
| CO-04 | Existente con pendientes | Asignaciones: confirmación antes de guardar, mensaje de revisión previa y hasta 24 horas (`requiresMoodleLoadedChangeConfirmation`) | Verificación integral cancelar/confirmar y transacción de conciliación: R03. No se certifica plazo real de Moodle |
| CO-05 | Existente con pendientes | Asignaciones: `canShowMoodleLoadedStatus` reconoce coordinación; Moodle: `markSelectedAsLoaded` y señales del repositorio | Ensayo de todas las modalidades, contadores y confirmación versionada: R03. No implementado aquí |
| CO-06 | Existente con pendientes | `src/app/features/moodle/pages/moodle-page.component.ts`: `exportGroupEnrollmentCsv`/selección, Map para deduplicar, encabezados cohort; `assignments.repository.ts:getActiveLoadedAssignmentsForMoodle` consulta servidor | Validación de CSV, compartidas, borrados y alcance delegado en exportación: R03/R05. Inspección estática, sin ejecutar exportadores |
| CO-07 | Existente con pendientes | Moodle: `exportStudentEnrollmentCsv`, `moodleStudentEnrollmentTargets`, `moodleTeacherEnrollmentTarget`, ventana 24 h; consulta servidor anterior | Ensayos de usuario válido, matrícula como texto y referencias reales: R03/R05. No se llamó Moodle |
| CO-08 | Existente con pendientes | `functions/index.js`: triggers de auditoría de asignaciones; usa campos de actor del documento. `functions/security/service.js` sí obtiene actor/área del perfil para administración R01 | Atomicidad operativa y atribución confiable de asignaciones: R03/C09. No confundir auditoría administrativa R01 verificada con auditoría académica pendiente |
| CO-09 | Existente con pendientes | `teachers-page.component.ts:downloadTeachersByCoordinatorCsv`, `escapeCsvValue(value: string)`; revoca ObjectURL inmediatamente tras click | Normalización de valores no textuales y comienzo verificable de descarga: R05; identidad docente R06. No corregido en R01 |
| CO-10 | Existente con pendientes | Dashboard: `isResearchCoordinationRole`, cómputos de investigación y módulos; datos proceden de repositorios autorizados | Ensayo visual/funcional integral de indicadores y ámbito: R05/R07. R01 comprueba permisos y navegación CO-02, sin rediseñar dashboard |
| CO-11 | Existente verificado, corregido en esta revisión | `security-console.component.{ts,html,css}`; pruebas de controles, persistencia, dos pasos, modal y viewport en `ui.spec.mjs` | R01, cobertura abajo; aceptación del propietario pendiente |
| CO-12 | Existente verificado por inspección estática | `src/index.html` favicon TUP; `app.component.html` y `login-page.component.html` imágenes institucionales locales | Sin cambios de identidad; revisión visual integral institucional pertenece a R07 y aceptación del propietario |

## Matriz CO-02 / CO-11

Los estados siguientes corresponden a la evidencia ejecutada de [la ficha](E2-R01-VALIDACION.md); no son aceptación manual del propietario.

| Requisito aplicable | Implementación | Prueba / evidencia | Estado |
|---|---|---|---|
| CO-02 CUSTOM VIEW: lectura limitada a programas **y ciclos** concedidos | `assignmentRead`, `authorizedQuery` | `review.mjs`: consulta acotada positiva; documento ajeno, histórico ajeno y colección sin filtro denegados. Chromium ejecuta consultas reales de la página | Verificado |
| CO-02 CUSTOM VIEW: no altas, edición, eliminación ni acciones operativas | Rules EDIT; controles y rutas por `hasAccess` | `review.mjs`: SDK create/update/delete, matrícula, grupos y estado rechazados; callable administrativo rechazado; Chromium sin botones operativos y ruta Usuarios bloqueada | Verificado |
| Excepción diferenciada: CA puede leer catálogo institucional y modificar **solo matrícula** ajena con EDIT y ciclo autorizado | `assignmentRead` / `enrollmentsOnly` | Integración previa «Asignaciones propias y excepción global de matrículas»; negativas propias/ajenas | Verificado en R01; cierre de captura pendiente R02/R03 |
| Auxiliar: lectura por programa/ciclo delegado; VIEW no elimina aunque tenga capacidad extraordinaria | Rules exige `module('asignaciones', true)` además de capacidad y ámbito al eliminar | Nuevo caso CO-02 auxiliar VIEW; consultas y matrícula ajena rechazadas, eliminación propia rechazada | Corregido en esta revisión |
| Menú, ruta, consultas, controles y etiqueta de ámbito coherentes | `authorizedQuery`, `hasAccess`, consola Asignaciones | Chromium CUSTOM con solo Asignaciones, sin fuga DER ni acciones; unitaria del cómputo real de módulos del dashboard; etiquetas «ámbito concedido» / «ámbito delegado» | Corregido en esta revisión |
| CO-11 Datos de acceso, Alcance académico y Módulos disponibles | Fieldsets; nombre, correo institucional, perfil, saludo y estado; área real conservada | Chromium verifica bloques y saludo; compilación Angular | Corregido en esta revisión |
| CO-11 Directorio → Crear/Editar → solo editor | Modal con estados `roleDirectory` / `mode` | Chromium: entrada sin formulario, Crear, editar definición existente, volver al directorio | Corregido en esta revisión |
| CO-11 Consultar/Editar y las cuatro dependencias | `setPermission` conserva lógica aprobada | Prueba Chromium original ampliada: EDIT activa VIEW, quitar EDIT conserva VIEW, quitar VIEW retira EDIT, guardar rol | Verificado |
| CO-11 Modal sobre navegación; encabezado/acciones accesibles; móvil una columna | `dialog.showModal()` en top layer, foco nativo, cuerpo con scroll y cabecera/acciones fuera del scroll | Chromium 1366×900 y 390×844: `:modal`, geometría, columna, sin overflow horizontal, Escape y retorno del foco; capturas inspeccionadas por agente | Corregido en esta revisión |
| Aceptación institucional de CO-02/CO-11 | Revisión del propietario | No sustituida por automatización ni inspección del agente | Pendiente |

«Catálogo global» es una etiqueta de presentación, no un permiso institucional. CUSTOM nunca hereda la excepción de CA. AUX sigue su delegación incluso cuando la UI presenta el catálogo completo dentro de ese ámbito. No se amplió el acceso de ninguno de estos actores.

Corrección de trazabilidad: **Ligas Meet pertenece a R05; R08 es SAEKO**. Ambas funcionalidades siguen fuera de esta revisión.

## Seguimiento de aceptación 2026-10-14

Se conserva el inventario anterior. Esta revisión modifica únicamente el ajuste visual CO-11 y el soporte DEMO necesario para acreditar CO-02/R01; no implementa los CO de otras entregas.

| Requisito | Implementación / cambio | Evidencia nueva | Estado técnico |
|---|---|---|---|
| CO-02 identidad CUSTOM auténtica en emulador | `local-review-accounts.json`, `prepare-demo.mjs`, selector por environment | `acceptance.spec.mjs` T09: inicio, ADM/27-1, lecturas ajenas/sin filtro, escrituras SDK/REST y rutas; `t09.json` | Verificado local |
| CO-02 excepción de matrícula global de CA | Rules sin cambios; ciclo ficticio en Captura | T10: perfiles y delegación efectiva registrados antes; matrícula ajena admitida, docente ajeno denegado | Verificado local, cierre sigue R02 |
| CO-02 auxiliar limitado por delegación | Sin ampliar capacidades ni ámbito | T10: auxiliar EDIT ADM/27-1 sin campos extraordinarios no hereda matrícula global; T11: revocación y siguientes operaciones | Verificado local |
| CO-11 estilo institucional y campos completos | CSS propio de `security-console.component`, controles 44 px y una columna hasta 800 px | Cuatro pruebas de viewport: 1366×900, 768×1024, 1032×1376, 390×844; foco a todos los campos y geometría | Corregido en esta revisión |
| CO-11 dos pasos, Consultar/Editar, modal sobre navegación | Lógica conservada | Regresiones originales más capturas de Usuarios/Roles inspeccionadas por Codex; Escape/foco/cancelación | Verificado local |
| Aceptación humana | [Reporte y guion](HALLAZGOS-PRUEBA-MANUAL-E2-R01.md) | T01 requiere segunda computadora física; propietario debe repetir revisión de ajustes | Pendiente |

Las imágenes originales de Asignaciones se clasifican separadamente como defecto previo R05/R07. No son evidencia del formulario de Usuarios. No se ejecutó validación integral de funcionalidades futuras.

## Segunda revisión de aceptación — 2026-10-15

| Requisito aplicable | Implementación | Prueba posterior | Estado |
|---|---|---|---|
| CO-02 VIEW Asignaciones ADM/27-1 | `module-route-access.ts`, guard, shell, perfil resuelto desde servidor | `navigation.spec.mjs`: ingreso real sin precargar versión, URL Dashboard, recarga, historial, cero inserciones protegidas | Corregido en esta revisión; confirmación humana T09b pendiente |
| CO-02 retiro de facultades/datos | Repositorios asociados al propietario de sesión; cleanup y respuesta atrasada descartada | Navegador Sistemas→Consulta y revocación; `session-lifecycle.test.mjs` | Verificado local |
| CO-02 directorio reservado / perfil propio | Rules `list` administrativo; `get` propio; UsersRepository reutiliza la sesión | Lecturas negativas directas y positivas propias; negativos exigen false final de la regla aplicable, no errores aislados | Corregido en esta revisión |
| CO-02 matrícula global solo CA | Operación de matrícula existente, sin ampliar autoridad | T10 SDK y UI ajena DER/27-1 Captura, campos protegidos intactos | Verificado local; T10 humano pendiente |
| CO-02 auxiliar según delegación | EDIT Asignaciones ADM/27-1, sin capacidades adicionales | T10 niega matrícula/lectura ajena; T11 revoca y conserva revisión | Verificado local; T11 físico ya confirmado |
| CO-11 estilo Usuarios/Roles | Patrones institucionales de campos, botones, tarjetas, encabezados y espaciado | Capturas comparables en cuatro tamaños e inspección visual Codex | Corregido en esta revisión; confirmación visual humana pendiente |
| CO-11 estructura/modal/accesibilidad/dependencias | Sin cambio de flujo | Regresiones de foco, encabezado/acciones, columnas, dos pasos y Consultar/Editar | Verificado local; T07 funcional humano conservado |
| H003 nombre largo en Dashboard autorizado | Altura intrínseca y metadatos en flujo normal | Geometría y capturas con Sistemas autorizado, cuatro tamaños | Corregido en esta revisión; confirmación humana pendiente |

No se implementan CO de otras entregas. El Dashboard personalizado sigue exigiendo permiso explícito: CO-10 no concede acceso implícito a Consulta. Los 18 incumplimientos R02/R03 y el impedimento de 200 documentos permanecen. Ligas Meet R05; SAEKO R08.
