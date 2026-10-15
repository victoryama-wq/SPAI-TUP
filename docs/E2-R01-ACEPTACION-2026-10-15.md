# E2-R01 — correcciones de la segunda prueba manual

Ejecución técnica: **2026-10-15**, responsable **Codex**, Windows/Node 22/Chromium, proyecto ficticio `demo-spai-tup`. Rama `codex/e2-r01-seguridad-permisos`; base comprobada y inicialmente limpia `96b4c991a3e04c61f09a75eeb478ae5730e666df`. Se conserva esa historia y se añade un commit local. El SHA de esta ejecución es el del commit que incorpora este archivo: `git log -1 --format=%H -- docs/E2-R01-ACEPTACION-2026-10-15.md`; el recibo posterior con SHA literal se guarda en `.local/acceptance-2/commit-validation.json`.

Contrato E2 v0.4 y contrato operativo conservados. No se inicia R02. Las secciones de ejecuciones anteriores siguen siendo históricas; esta ejecución y la nueva evidencia humana las actualizan sin borrarlas.

## Fuente humana y estados

Se conserva íntegro [el reporte recibido](evidence/r01-acceptance-2/reporte-recibido.md), SHA-256 `c39a82cfd2e459221bdb3fb396c82d6ce17af4761d5969060edb883be6182d87`. El archivo declara fecha 14/10/2026 y responsable «Codex»; las pruebas físicas son **resultados comunicados por la propietaria**, no presenciados ni ejecutados por el agente. La recepción/revisión técnica se registra el 15/10/2026. Las imágenes WhatsApp anteriores muestran Asignaciones; no se reutilizan como prueba del nuevo defecto del Dashboard. Este último se reprodujo desde sesión cerrada y se capturó antes de corregirlo.

| Caso | Último resultado humano conservado | Seguimiento |
|---|---|---|
| T01 | CORRECTA: otra laptop física, inicio/navegación/recarga | Confirmada; no vuelve a pendiente |
| T02 | CORRECTA: inactivo bloqueado | Conservada |
| T03 | CORRECTA CON HALLAZGO visual | H001 requiere confirmar el estilo corregido |
| T04 | CORRECTA: directorio/editor/modal | Conservada |
| T05 | CORRECTA: Consultar/Editar | Conservada |
| T06 | CORRECTA: guardar/cancelar | Conservada |
| T07 | CORRECTA CON HALLAZGO visual; funcionalidad móvil confirmada | Se conserva la accesibilidad humana; solo estilo por confirmar |
| T08 | CORRECTA: cambio de sesión reportado | Ampliado técnicamente para Sistemas → Consulta |
| T09 | FALLÓ en conjunto | T09a consulta ADM/27-1: correcta. T09b restricción de Dashboard: falló en la prueba humana; repetir tras corrección |
| T10 | PENDIENTE de confirmación humana | [Escenario y guion aislados](R01-T10-REVISION-AISLADA.md) |
| T11 | CORRECTA: revocación en otra laptop física | Conservada; no se sustituye por una simulación |

Totales humanos, contando una vez cada T01–T11: **11 = 7 correctas + 2 correctas con hallazgo + 1 fallida + 1 pendiente**. La diferencia frente al resumen recibido (7/3/0/1) es únicamente T09, que no cumplió el requisito de acceso. Los resultados técnicos no cambian retroactivamente esos resultados ni conceden aceptación humana.

## H002 — causa, datos observados y solución

Reproducción inicial: sesión de navegador nueva → Consulta R01 DEMO → `/` → Dashboard visible, aunque el único enlace del menú era Asignaciones. La ruta no tenía guard; el efecto del shell comprobaba permisos al cambiar la sesión, pero enviaba toda denegación a `/`, el mismo Dashboard no permitido. Además `router.url` no era una dependencia reactiva de ese efecto. La prueba anterior navegaba manualmente a Asignaciones después del login, omitiendo el recorrido inicial defectuoso.

No se atribuye la reproducción inicial a caché de otra cuenta: ocurrió en un contexto nuevo. Sí se encontró una ventana de conservación de datos al cambiar identidad/permisos, que se elimina y se prueba separadamente.

| Tarjeta observada antes | Origen real de la lectura | Clasificación |
|---|---|---|
| 1 Usuarios activos | `UsersRepository`, consulta limitada por ID al perfil propio | Etiqueta engañosa para un perfil propio; no directorio global leído |
| 4 Ciclos registrados / 27-1 activo | `CyclesRepository`; Rules admite ciclos como dependencia de Asignaciones | Lectura admitida por el contrato implementado, mostrada en un módulo no permitido |
| 0 Roles personalizados | `CustomRolesRepository`; consulta anulada sin permiso | Cero local; no lectura de roles confirmada |
| 1 Asignaciones registradas / «Catálogo global» | `AssignmentsRepository`, filtro ADM AND 27-1 | Ámbito correcto, etiqueta global inadecuada en el Dashboard indebido |

La reproducción también detectó un intento innecesario de `solicitudes_sistemas` sin permiso. Su repositorio ahora exige `hasAccess(..., 'solicitudes')` antes de suscribirse. La consulta de usuarios sin filtro devolvía `permission-denied` acompañado de **Null value** en la regla de listado; ese error no acreditaba una denegación válida. Se cambia **list** a Administración General exclusivamente; **get** del perfil propio permanece. `UsersRepository` reutiliza el perfil propio resuelto para las dependencias legítimas, sin consultar el directorio. No se concede acceso a otros usuarios ni se amplía ninguna Rules.

Correcciones:

- `module-route-access.ts` y `app.routes.ts`: guard por módulo, primer destino autorizado, alias `/dashboard` protegido por la ruta destino, y estado `/acceso-restringido` sin bucle para perfiles sin módulos.
- `UserSessionService`: la identidad Auth debe coincidir con el propietario del perfil; la autorización inicial espera snapshot de servidor, no caché ni escrituras optimistas pendientes de confirmación (`hasPendingWrites`). Salida, cambio, error de perfil y revocación retiran el contenido correspondiente. Una prueba del servicio real compilado acredita que un perfil optimista con facultades aumentadas no sustituye el perfil confirmado.
- Un navegador confirmado sin sesión reconoce la versión actual antes de su primer ingreso. Las pruebas anteriores precargaban esa marca; la nueva regresión no lo hace y exige un solo ingreso. Una sesión autenticada persistida con versión antigua conserva la invalidación forzosa, comprobada por otra regresión.
- `AppComponent`: navegación reactiva y outlet condicionado por autorización vigente; no se construye Dashboard mientras se resuelve o deniega el perfil.
- Repositorio base, Solicitudes, Agenda y Notificaciones: invalidación síncrona de datos por propietario de sesión, cleanup de listeners y rechazo de respuestas atrasadas.

Severidad **media**, con **prioridad de seguridad R01**: se confirmó exposición visual de un módulo no concedido y un rechazo de Rules defectuoso; no se confirmó lectura exitosa de perfiles ajenos, roles ni asignaciones fuera del ámbito. La clasificación no convierte el fallo en aceptable. La prueba nueva exige `permission-denied` y una decisión final `false` en la misma línea/operación de cada allow que el emulador haya informado inicialmente como `evaluation error`; no acepta un error aislado ni el false del catch-all. Se rechazan siempre `Null value`, límites de expresiones y errores de servicio. Se conserva el criterio documentado de la integración R01; no se afirma que los logs carezcan de diagnósticos preliminares. El JSON conserva los mensajes exactos. Una primera expectativa de ausencia absoluta de preevaluaciones resultó incompatible con este emulador; se sustituyó por la comprobación de su decisión final aplicable, sin cambiar los permisos ni los 18 contratos objetivo.

## H001 y H003 — solución acotada

**H001:** se compararon `users-page.component.css`, `role-manager.component.css` y los patrones existentes: azul institucional `#071d4f`/`#0b357f`, encabezados, tipografía Inter/Roboto/Arial, campos `#f9fbff` con borde `#c9d9ef`, botones de 48 px, tarjetas y espaciado. Los ajustes viven en la consola administrativa. Se conservan fieldsets, modal nativo sobre navegación, directorio → editor, Escape/foco, encabezado/acciones, una columna hasta 800 px y dependencias Consultar/Editar. No se modifica el diseño general ni Asignaciones.

**H003:** el CSS acumulado del panel de bienvenida imponía dimensiones/composición que no crecían con el saludo. El panel ahora tiene altura intrínseca; el nombre completo admite saltos y los metadatos siguen en flujo normal. Se ensaya con una cuenta **Sistemas autorizada** y un nombre ficticio largo, restaurado al terminar. No se concede Dashboard a Consulta para la prueba y no se reduce excesivamente el texto: tamaño medido mínimo 21 px en los viewports ensayados.

Capturas comparables de Usuarios/Roles: mismas dimensiones 1366×900, 768×1024, 1032×1376 y 390×844 que la ejecución anterior. Las anteriores se conservan en `evidence/r01-acceptance`; las nuevas en [el índice de evidencia](evidence/r01-acceptance-2/README.md). Automatización: geometría, foco, scroll, acciones y dependencias; inspección visual: Codex. Ninguna equivale a aceptación del propietario. La cabecera global conserva su comportamiento previo en móvil; el alcance visual aquí es Usuarios/Roles y el panel de bienvenida, no una certificación responsive de toda SPAI.

## Cobertura y verificación

Los resultados finales, comandos y limitaciones de esta ejecución se añaden a `E2-R01-VALIDACION.md` y `E2-R01-RESULTADOS.json`. H001/H002/H003 se cierran técnicamente solo con sus comprobaciones posteriores; la confirmación humana de los ajustes y T10 se registra por separado.

| Requisito | Implementación | Prueba / evidencia |
|---|---|---|
| CO-02 VIEW ADM/27-1 y primera ruta | Guard, shell, sesión, consultas autorizadas | `navigation.spec.mjs`: login real, URL `/` y `/dashboard`, recarga, historial, cero inserciones protegidas |
| CO-02 perfil pendiente, cambio de cuenta y revocación | Propietario de sesión y cleanup | Perfil servidor retenido, Sistemas→Consulta, revocación abierta, estado sin módulos; `session-lifecycle.test.mjs` callbacks atrasados/unsubscribe |
| CO-02 servidor | Rules list administrativo, get propio | Denegación final explícita de directorios/agenda/solicitudes/asignaciones sin filtro y perfil ajeno; positivos de perfil propio/ciclos; T09 conserva escrituras negativas |
| CO-02 excepción de CA | Lógica y Rules de matrícula existentes | T10 SDK + guardado UI ajeno en Captura; campos protegidos sin cambio |
| CO-02 CUSTOM y auxiliar | Permisos/delegación explícitos | T10 niega lectura/escritura ajena; T11 conserva revocación y revisión del destinatario |
| CO-11 presentación institucional | CSS/encabezado de consola, estructura conservada | Cuatro tamaños, campos accesibles, dos pasos, dependencias, capturas comparables |
| H003 panel autorizado | Flujo normal y altura intrínseca | Nombre completo, sin solapamiento ni overflow del panel, escritorio/tabletas/móvil |

## Repetición breve para aceptar

1. Recargar la demo LAN y cerrar sesión. Entrar con Consulta: debe ir directamente a Asignaciones ADM/27-1. Probar `/dashboard`, recarga, atrás/adelante y Sistemas → salir → Consulta; no debe verse Dashboard ni datos de Sistemas.
2. Como Sistemas, revisar Nuevo perfil y Administrar roles en escritorio/tableta/móvil. Confirmar la apariencia institucional y que los controles ya accesibles siguen funcionando.
3. Revisar el saludo con un nombre largo en una cuenta autorizada para Dashboard. La prueba técnica y sus capturas ya usan uno; para repetir sin alterar la LAN, usar la sesión aislada del guion T10 y cambiar allí el nombre ficticio desde Usuarios.
4. Ejecutar el [guion T10](R01-T10-REVISION-AISLADA.md) y enviar el resultado humano. T01, adaptación funcional de T07 y revocación física de T11 **ya están confirmados** y se conservan.

## Límites que permanecen

El límite combinado de **200 documentos** en las seis colecciones de seguridad sigue siendo impedimento de producción; superar 200 bloquea también operaciones administrativas críticas antes de escribir. La regresión conserva umbrales 199/200/201 y ausencia de cambios parciales. No se amplía escala en esta revisión.

Los **18 incumplimientos contractuales R02/R03** siguen abiertos, con gate estricto en salida 1; sus expectativas no se rebajan. Permanecen migración/rollback, CI y validación remota/producción pendientes, además del defecto previo de Asignaciones R05/R07. Ligas Meet es R05; SAEKO R08. Solo emuladores/datos ficticios; sin push, merge, despliegues, producción, Moodle, SAEKO ni correos reales. Respaldo privado y selección se conservan.
