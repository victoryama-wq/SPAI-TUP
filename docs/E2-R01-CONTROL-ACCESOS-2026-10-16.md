# R01 — Bitácora, Solicitudes y Control de accesos

Revisión técnica local de Codex, 16 de octubre de 2026. Base comprobada: `4c52777024b5f7ca7e3a2b9d91ee7e05b704caaa`, rama `codex/e2-r01-seguridad-permisos`, árbol inicialmente limpio. Se conservan las correcciones anteriores. El commit adicional se identifica con `git log -1 --format=%H -- docs/E2-R01-CONTROL-ACCESOS-2026-10-16.md`. No se declara aceptada R01 ni se inicia R02.

Se contrastaron el contrato E2 v0.4, E2-C01/C01.1/C01.2/C08/C09, el contrato operativo CO-02/CO-11, la matriz histórica E1 y el informe Auxiliar anterior. La matriz E1 describe también déficits históricos; no sustituye el contrato vigente. Fuente recibida: `HALLAZGOS-CONTROL-ACCESOS-PROMPT.md`, SHA-256 `5d1dadb877d94344b1a8139ccb5540ea57d1abc1313692bc5da20411f859581e`. Las afirmaciones del adjunto se comprobaron; la captura vacía de Solicitudes por sí sola no acredita denegación.

## Identidad y autoridad reales

Inspección anterior a los cambios: **2026-10-16T18:34:08.695Z**. UID `demo-auxiliar`, perfil canónico del mismo ID, Activo, esquema 2, revisión 4. El propietario había sustituido la delegación de la revisión anterior: ahora referencia **`333bbac4-82c6-4dec-a116-53ae8d31bfd1`**, activa y dirigida al mismo UID, con programas/ciclos/docentes/campos `['*']`, EDIT en los doce módulos y las nueve capacidades ya registradas en el informe anterior. La delegación anterior permanece revocada. Se preservaron ambos documentos y la configuración del propietario.

No se reutilizó como supuesto el ámbito vacío observado a las 17:05Z. El nuevo estado está documentado en `evidence/r01-access/baseline.json`. La versión previa del frontend se identifica mediante el manifiesto LAN del commit base y el hash del HTML; la fuente de Rules cargada se obtuvo de `ruleCoverage`.

| Consulta/acción | Política conservada y comprobada |
|---|---|
| Bitácora institucional | ADMIN_GENERAL o Auxiliar con grant activo, VIEW/EDIT Bitácora y programas `*` explícito. No existe una capacidad sensible adicional de lectura en la matriz. No se infiere de MANAGE_CUSTOM_ROLES ni del nombre del perfil. |
| Bitácora con ámbito limitado/vacío | Estado de ausencia de ámbito institucional; no se consulta ni se amplía a global. El módulo concedido puede mostrar esa explicación; NONE/revocación bloquea ruta y datos. |
| Solicitudes a Sistemas institucionales | ADMIN_GENERAL o Auxiliar activo con VIEW/EDIT Solicitudes y programas `*`. |
| Solicitudes propias | VIEW/EDIT Solicitudes permite consulta `requestedBy == UID` según la regla existente, incluso sin ámbito institucional. No permite leer o atender solicitudes ajenas. Un ámbito vacío no se convierte en global. |
| Crear solicitud | EDIT, autor autenticado y estado inicial existente. No se altera el flujo académico en esta revisión. |
| Atender/eliminar solicitud a Sistemas | EDIT y autoridad institucional, además de las comprobaciones existentes. VIEW se rechaza también en servidor. El permiso de consulta nunca concede efectos sobre docentes u otros módulos. |
| Definiciones de rol | Crear/editar/retirar solo ADMIN_GENERAL. El servidor sigue rechazando modificaciones/retiro de definiciones con asignaciones vigentes. Auxiliar MANAGE_CUSTOM_ROLES solo asigna/retira roles preaprobados dentro de su ámbito. |

La lectura institucional de Bitácora es la política conservada de R01; **no se implementa una nueva bitácora parcial por programas** ni se atribuye un programa a eventos sin esa dimensión. Una ampliación de esa política necesita especificación y pruebas propias. Paginación general y filtros adicionales de servidor permanecen en su entrega responsable; no se amplía escala aquí.

## Hallazgos comprobados

| Caso | Evidencia y causa | Corrección |
|---|---|---|
| CA-01 Bitácora | Diez registros presentes. El Auxiliar con autoridad institucional recibía `maximum of 1000 expressions`: `general()`, `delegated()`, `module()` y `within()` recalculaban repetidamente usuario y grant. La UI mostraba ceros y ausencia pese al error. | Helper de Rules con un único usuario efectivo y la misma política. La UI solo muestra conteos y ausencia tras respuesta confirmada; carga, ámbito ausente, denegación y error se presentan por separado. |
| CA-02 Solicitudes | Existía `demo-reapertura` (autor Coordinación A, ciclo 26-3). La lectura institucional fallaba por la misma complejidad. El callback de error del repositorio reemplazaba silenciosamente el resultado por `[]`. La pantalla no muestra actualmente las dos solicitudes compartidas de otra colección; eso no se convierte aquí en un flujo nuevo. | Lectura y autorización institucional de escritura simplificadas sin cambiar facultades. Repositorio con estado explícito, respuesta de servidor, descarte de caché no confirmada, timeout/reintento y protección frente a callbacks de otra sesión. Contadores `—` hasta confirmar. |
| CA-03 Consulta auxiliar de programas | Al abrir Solicitudes se reproducía también `Null value` en el listado de programas por el ID de wildcard no ligado. | Lectura del ID del recurso con guarda nula, igual al criterio ya comprobado para Docentes. No se usa un campo editable del documento como identidad ni se amplía alcance. |
| CA-04 Organización de Control de accesos | Secciones extensas apiladas, estados técnicos, retiro junto a acciones ordinarias y un motivo compartido para múltiples acciones. | Cuatro secciones navegables, tarjetas compactas, estados traducidos por contexto, acciones primarias/secundarias/sensibles, disposición móvil. Directorio/editor de definiciones conservado. |
| CA-05 Contexto y confirmación | Motivo y rol de sustitución podían permanecer de una acción anterior; una confirmación pendiente no revalidaba generación de sesión antes de invocar el comando. | Modal de operación con destinatario y acción capturados; motivo nuevo, sustitución seleccionada para esa revisión, limpieza al cancelar/cambiar sección/sesión. Tras confirmar se comprueba la generación antes de llamar al servidor; idempotencia del reintento conservada. |

El caso base de ambas lecturas se reproduce cargando **únicamente en el emulador aislado** las Rules del commit anterior. Ese caso se registra como caracterización de un defecto, no como denegación de seguridad correcta. El ensayo vuelve a cargar las Rules corregidas incluso al fallar. La LAN no recibe esas Rules antiguas durante las pruebas.

## Cobertura y resultados

Los resultados finales, fecha y hashes de logs están en [evidencia de esta ejecución](evidence/r01-access/results.json). La suite dirigida está en `tools/e2-r01/access-server.mjs`, `access-fixture.mjs` y `access.spec.mjs`; `session-lifecycle.test.mjs` añade cache/vacío/error de Solicitudes.

- Servidor: positivo institucional sin capacidades sensibles inventadas; VIEW sin creación/resolución/borrado; EDIT legítimo; lectura propia limitada/vacía frente a ajena; módulo NONE; grant revocado; bitácora verificada inmutable; callable de definiciones exclusivo de AG y rechazo por rol en uso.
- Navegador: positivo con recarga; Sistemas→Auxiliar sin datos ajenos; ámbito vacío explícito donde corresponde; consulta vacía confirmada frente a rechazo real mediante consulta adulterada; URL directa sin módulo; revocación abierta; motivos sin arrastre, retiro protegido, estados y navegación en escritorio/tableta/móvil.
- Se mantienen los recorridos anteriores de R01, CUSTOM VIEW, T10, CO-11 y sesión. El cambio de los selectores de la prueba anterior únicamente navega a «Roles asignados», conservando sus comprobaciones de guardado y revocación.
- Las denegaciones requieren `permission-denied` y resultado final `false` en la regla/operación aplicable. Para create se comprueba inexistencia antes y después; la preevaluación de update no acredita ni invalida por sí sola esa operación. Null, límite de expresiones, INTERNAL y UNAVAILABLE no se cuentan como denegación válida. El fallo de complejidad antiguo se clasifica separadamente.

Las capturas y mediciones corresponden a inspección técnica del agente, **no a aceptación del propietario**. No se solicita repetir T01 físico, T07 funcional ni T11 físico, cuya evidencia permanece vigente.

## Recorrido manual limitado

1. Recargar la LAN y entrar con el Auxiliar configurado por el propietario. Bitácora debe recuperar movimientos; Solicitudes debe mostrar la solicitud ficticia conservada. No cambiar su delegación para probar esta corrección.
2. En Control de accesos, como Sistemas, recorrer Resumen, Roles asignados, Delegaciones y Revisiones. Comprobar estados en español y navegación en la pantalla disponible.
3. Preparar una acción, escribir un motivo y cancelar. Abrir otra acción: comprobar destinatario y motivo vacío. Cancelar sin alterar los datos de compañeros.
4. En Administrar roles, abrir la zona sensible de una definición: debe explicar el impacto y bloquear el retiro si está en uso. Cancelar; los retiros, cambios de grant y casos negativos ya se ensayan de forma aislada.
5. Registrar únicamente resultado, fecha y evidencia de estos ajustes. La aceptación humana de R01 continúa pendiente.

## Límites preservados

No se cambian estados terminales, reapertura, concurrencia, atomicidad ni efectos académicos de Solicitudes: corresponden a **R03**. No se implementan ciclos/cierre/Especiales de R02. Los **18 incumplimientos contractuales** deben conservar sus mismos IDs y salida 1 del gate estricto; las caracterizaciones no se presentan como cumplimiento objetivo.

Permanece el **impedimento administrativo de 200 documentos**, además de migración/rollback, CI/validación remota y aceptación pendientes. Google institucional y la separación DEMO/LAN se conservan. No hay push, merge, despliegue remoto, correos reales ni conexiones a Moodle/SAEKO/producción. Las pruebas destructivas y revocaciones solo afectan datos ficticios aislados; la demo compartida, el respaldo privado y su selección se verifican por comparación y hashes.

## Cierre técnico de esta ejecución

Ejecución final íntegra: 2026-10-16, responsable Codex, log .local/access-review/full-verified.log, salida 0. **28/28 unitarias (18 autorización/sesión + 10 infraestructura), 37/37 servidor R01, 9/9 Auxiliar, 8/8 dirigidas (siete seguridad y una caracterización del defecto previo), 33/33 Chromium, 72/72 caracterizaciones (52 Rules + 20 lógica)**. Gate contractual salida 1, mismos 18 IDs; no se cambiaron sus expectativas. Siete intentos offline exclusivamente loopback sin fallback. Builds local/LAN/production y sintaxis PASS; advertencia existente de presupuesto: paquete inicial 779,10/750 kB.

Los ensayos intermedios se conservan en los hashes del manifiesto: un create rechazado incluía preevaluación de update sobre documento inexistente; se ajustó el comprobador a la operación aplicable y se mantuvo la verificación de inexistencia antes/después. Las primeras pruebas de consola usaban una etiqueta envolvente ambigua; se usa el combobox accesible. La primera suite completa de UI terminó 31/33: T11 debía abrir Roles asignados, y el evento ficticio estaba en la segunda página tras los ensayos anteriores. Se añadió la navegación real y búsqueda por el filtro existente, sin cambiar el resultado esperado. La suite completa posterior pasó 33/33.

LAN comprobada a las **19:00:37Z**: http://192.168.41.254:4201/. Auxiliar y Sistemas leen diez movimientos y la solicitud existente sin errores de página. **39 documentos en 13 colecciones iguales antes y después** (marcas Timestamp comparadas por sus valores serializados); no se escribió en ellos. Hashes de respaldo/selección iguales. Gateway PID 3316 y emuladores PID 16224/26468 sin reinicio. Solo se sustituyó el artefacto web local y se comprobó la recarga automática de Rules; los chunks anteriores se conservaron para pestañas abiertas. El entorno de pruebas aislado quedó detenido.

Inspección visual de Codex: [consola escritorio](evidence/r01-access/console-desktop.png), [tableta](evidence/r01-access/console-tablet.png), [modal móvil](evidence/r01-access/console-mobile-operation.png), [Bitácora LAN](evidence/r01-access/auxiliar-bitacora-lan-after.png), [Solicitudes LAN](evidence/r01-access/auxiliar-solicitudes-lan-after.png). Se comprobaron controles, destinatario, motivo, foco visible, acciones y disposición de la consola. No equivale a aceptación humana. La cabecera global estrecha y la superposición del distintivo del ciclo en el título de Solicitudes son defectos de presentación existentes fuera de la consola; no se rediseñaron. La representación de algunos eventos antiguos como «Usuario no identificado»/acción técnica tampoco se presenta como resuelta por esta corrección de lectura; requiere revisar su adaptación de presentación sin reescribir el historial. No hay una contradicción funcional necesaria para completar las correcciones autorizadas.

Estado: **VALIDADA_LOCAL; aceptación humana PENDIENTE**. No se declara capacidad productiva ni cierre de R01.
