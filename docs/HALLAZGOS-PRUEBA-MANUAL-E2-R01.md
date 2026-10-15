# Seguimiento de aceptación E2-R01 — 14 de octubre de 2026

> **Actualización vigente: 15/10/2026.** La sección inicial conserva la ejecución histórica. El nuevo reporte humano confirma **T01 físico, T07 funcional y T11 físico**; no están pendientes. T09 se separa en consulta limitada correcta y Dashboard fallido; T10 humano sigue pendiente. Véase [la nueva ejecución, causas, totales y guion](E2-R01-ACEPTACION-2026-10-15.md). Total humano vigente: **7 correctas, 2 con hallazgo, 1 fallida, 1 pendiente**. La validación técnica no firma aceptación del propietario.

Estado técnico y aceptación del propietario se registran por separado. Este documento corrige la trazabilidad del reporte recibido; no firma ni concede aceptación en nombre del propietario.

## Fuente y conservación

Fuente: `Downloads/HALLAZGOS-PRUEBA-MANUAL-E2-R01.md`, SHA-256 `448ca346d99538e5a6be434f3fd8510dda8bb0db819fa6ce51e5b52289ed7da6`. El original no se sobrescribe. Base de trabajo: `ef82fc60d02a2eee8e158f04e1104b8110a4b9a5`, rama `codex/e2-r01-seguridad-permisos`. Se conserva y completa el trabajo LAN previo sin reset/clean. El commit que incorpora este informe es el commit de corrección; su SHA se obtiene con `git log -1 --format=%H -- docs/HALLAZGOS-PRUEBA-MANUAL-E2-R01.md`. El recibo posterior con SHA probado se guarda en `.local/acceptance/commit-validation.json`.

El reporte recibido contiene **6 correctas, 1 correcta con hallazgo (T03), 1 fallida (T07) y 3 pendientes (T01/T09/T10): 11 filas**. Agrupar T03 entre las correctas explica el total 7, pero oculta su hallazgo. La conclusión original omite la revocación ya reportada como correcta en T11; aquí se conserva esa evidencia. La atribución «Codex» del encabezado original no convierte las pruebas físicas reportadas por el usuario en pruebas presenciadas por el agente.

## Matriz de seguimiento

| Caso | Resultado recibido | Seguimiento técnico local de Codex | Aceptación del propietario |
|---|---|---|---|
| T01 Inicio/navegación/recarga desde otra computadora | Pendiente | Chromium por IP LAN en el anfitrión: Sistemas y Consulta; no constituye otro equipo físico | Pendiente recorrido completo en segunda computadora |
| T02 Usuario inactivo | Correcto reportado | Regresión de rechazo servidor R01 conservada | Evidencia recibida conservada |
| T03 Crear perfil institucional | Correcto con hallazgo visual | Estilos de Usuarios corregidos; campos y acciones accesibles en cuatro tamaños | Repetir revisión visual |
| T04 Directorio de roles | Correcto reportado | Directorio y editor separados, navegación conservada | Evidencia recibida conservada |
| T05 Consultar/Editar | Correcto reportado | Dependencias y persistencia cubiertas por regresión UI | Evidencia recibida conservada |
| T06 Guardar/cancelar rol | Correcto reportado | Rol original PRUEBA-R01-Consulta conservado y cuenta vinculada explícitamente | Evidencia recibida conservada |
| T07 Pantalla pequeña | Fallido reportado | Usuarios/Roles: 1366×900, 768×1024, 1032×1376, 390×844; comprobar campos mediante foco y desplazamiento | Repetir con propietario |
| T08 Cambio de cuenta | Correcto reportado | Inicio de cuentas Sistemas, CA, CUSTOM y auxiliar en pruebas aisladas | Evidencia recibida conservada |
| T09 Rol personalizado VIEW | Pendiente | Identidad Auth ficticia y pruebas UI/servidor con ADM / 27-1 | Repetir con nueva cuenta |
| T10 Excepción global matrícula | Pendiente | CA frente a CUSTOM y auxiliar en Captura, permisos efectivos registrados antes del ensayo | Repetir escenario y confirmar resultado |
| T11 Revocación | Correcto reportado desde dos laptops | Se amplía con lectura/escritura/callables posteriores y asignación conservada ACTIVE con revisión pendiente | Se conserva la prueba física reportada; ampliación técnica no es firma del propietario |

No se suman pruebas automatizadas y pruebas humanas como si fueran una única ejecución. Los resultados ejecutados y sus limitaciones están en [la ficha de validación](E2-R01-VALIDACION.md) y [el resumen JSON](E2-R01-RESULTADOS.json).

## Hallazgos y alcance

**R01-H001 — Usuarios y Roles.** Se confirmó una presentación genérica de controles, distinta a la apariencia institucional. Se aplican estilos propios del componente: encabezado azul, etiquetas legibles, campos/acciones de al menos 44 px, tarjetas y bordes coherentes, dos columnas en escritorio y una hasta 800 px. Se mantienen campos, permisos, validaciones, confirmación, modal nativo y lógica de negocio. La inspección previa no reprodujo pérdida de campos; la verificación nueva exige acceder por foco a todos ellos, además de comprobar encabezado, acciones, Escape y retorno del foco. No se afirma haber reproducido un campo oculto que no se observó.

**VIS-ASIGNACIONES-H001 — disposición previa de Asignaciones, R05/R07.** Las dos imágenes WhatsApp recibidas muestran Asignaciones, no Usuarios/Roles. La compresión/superposición se reproduce en la tabla y cabecera; no cierra ni acredita R01-H001. El CSS de Asignaciones tiene el mismo blob Git `c350dbe3fc4c31b89124a0d0c6a8989bd708699d` antes de R01 (`894be73`) y en la base actual; su último cambio previo es `b154b28`. La comparación entre esas bases de la plantilla de Asignaciones, `app.component.css` y `styles.css` también está vacía. No hay evidencia de una regresión de estilos compartidos causada por R01. Se registra como defecto previo independiente de composición responsive, pendiente R05/R07; no se modifican estos archivos.

**R02-R03-H001 — captura cerrada.** El propietario abrió un modal editable; **no intentó guardar**. Esa observación no demuestra una escritura aceptada por servidor. Se conserva como pendiente R02/R03 junto a los 18 incumplimientos contractuales existentes. Captura cerrada debe bloquear operaciones ordinarias; Especiales exige habilitación expresa y operaciones/grupos admitidos; Cerrado no admite captura aunque conserve marca de Especiales; excepciones de Sistemas requieren capacidades y trazabilidad específicas. No se implementan esos flujos aquí. Ligas Meet corresponde a R05 y SAEKO a R08.

## Identidad y escenarios

La cuenta **Consulta R01 DEMO**, `demo.r01.consulta@tecplayacar.edu.mx`, UID `demo-r01-consulta`, está en Authentication Emulator y vinculada al rol **PRUEBA-R01-Consulta**, solo VIEW Asignaciones, programa ADM, ciclo 27-1. Los permisos base son NONE; la autoridad procede de la asignación auditada del rol. La preparación explícita se ejecuta con `npm run local:r01:prepare`; no convierte otros roles en cuentas. Rechaza duplicados ambiguos, perfiles inactivos o asignaciones retiradas, sin restaurarlas silenciosamente.

El rol manual tenía ciclos vacíos y no estaba asignado; se acotó expresamente a 27-1 mediante `securityCommand`. Para repetir T10, `--capture-fixture` guarda el estado anterior del ciclo ficticio `demo-27-1` antes de dejarlo en Captura. Es preparación de un escenario sintético, no implementación de reapertura R02. Los perfiles, roles y delegaciones manuales restantes se conservan. Las delegaciones revocadas del auxiliar original no se reactivaron.

T10 registra perfiles/delegaciones/permisos efectivos antes de actuar: CA con EDIT conserva excepción de matrícula ajena dentro del ciclo; no puede alterar docente ajeno. CUSTOM VIEW permanece en ADM/27-1. El auxiliar recibe en el ensayo aislado EDIT Asignaciones, ADM/27-1, sin capacidades ni campos extraordinarios: no lee ni modifica matrícula ajena. Al terminar se revoca esa delegación aislada. La palabra «global» no otorga permisos.

T11 usa otro ensayo aislado: auxiliar VIEW y MANAGE_CUSTOM_ROLES en ADM/27-1, destinatario con afiliación ADM confirmada, asignación de rol preaprobado y revocación por AG. La asignación del destinatario permanece ACTIVE con `REQUIERE_REVISION_ADMIN_GENERAL`, vinculada a la delegación revocada. El auxiliar pierde acceso servidor, aunque la asignación del destinatario no se borra. El registro de la prueba humana de dos laptops se conserva sin atribuirlo a Codex.

## Guion breve para propietario y compañeros

1. En una **segunda computadora física** de la misma red, abrir `http://192.168.41.254:4201/`. Registrar equipo, navegador/versión, fecha/hora y tamaño de pantalla. Debe aparecer DEMO LAN y datos sintéticos.
2. Entrar con Sistemas DEMO, abrir Usuarios, navegar a otro módulo y recargar. Confirmar sesión y carga; capturar URL y resultado. Esto completa T01, que sigue pendiente.
3. En Usuarios, abrir Nuevo perfil y recorrer Datos de acceso, Alcance académico y Módulos. Probar desplazamiento y teclado a 1366×900, 768×1024, 1032×1376 y 390×844. Confirmar que encabezado y acciones siguen accesibles. Cancelar; entrar a Administrar roles → Crear rol; comprobar Consultar/Editar y cancelar. No usar capturas de Asignaciones como evidencia de este formulario.
4. Cerrar sesión y elegir **Consulta R01 DEMO**. Entrar a Asignaciones: solo ADM/27-1, sin Crear/Editar/Eliminar. Recargar y probar `/usuarios`, `/ciclos`, `/moodle`: deben redirigir/bloquear. Guardar resultado T09.
5. Para T10 usar **27-1 en Captura**, comparar Coordinación A con Consulta. CA puede acceder a matrícula global autorizada; Consulta no hereda esa excepción. El ensayo reproducible de servidor/auxiliar está en `npm run test:r01:acceptance`; no reactivar una delegación revocada del demo compartido para simular éxito. Si se quiere repetir humanamente el auxiliar, AG debe emitir una nueva delegación acotada y registrar su ID; nunca reutilizar la revocada.
6. T11 ya fue reportado correcto en dos laptops. Para repetirlo, AG y auxiliar abren sesiones separadas con una nueva delegación identificada; después de asignar un rol, AG revoca; el auxiliar pierde las siguientes operaciones y AG ve la asignación ACTIVE con revisión pendiente. Registrar IDs/resultados, sin resolver la revisión hasta completar la comprobación.
7. Anotar cada resultado, evidencia y hallazgo; el propietario decide aceptación. No marcar aceptación por el solo éxito de la suite automática.

## Acceso definitivo y límites

DEMO/LAN usa identidades ficticias y Auth Emulator. Producción conserva Google institucional, dominio `tecplayacar.edu.mx`, persistencia, popup y respaldo redirect. La comparación histórica `944d93a` → `146cf9f` identifica la adición del acceso DEMO; no se sustituyó el flujo institucional. La compilación production usa reemplazo fijo de environment y lista DEMO vacía. Un parámetro de URL no cambia ese reemplazo; `signInWithLocalAccount` exige además proyecto `demo-spai-tup` y SDK conectado al emulador. Las pruebas de ese guard usan mocks, sin iniciar sesión real en Google. El literal de contraseña ficticia existente puede permanecer en el código compilado, pero el guard bloquea su ejecución en production; no es una credencial institucional.

**Antes de producción:** resolver el límite administrativo >200 y acreditar escala/atomicidad de operaciones críticas; cerrar los incumplimientos de las entregas responsables; validar CI remota, migración y rollback; comprobar acceso institucional real en una ventana autorizada; completar T01 y aceptación del propietario. No hubo push, merge, despliegue, llamadas a producción/Moodle/SAEKO ni correos reales. [Inicio y parada de la demo](DEMO-LAN.md).
