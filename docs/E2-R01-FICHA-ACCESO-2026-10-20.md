# E2-R01 — Ficha de acceso institucional, 20 de octubre de 2026

Responsable técnico: Codex. Base limpia comprobada `e8b79bd6d8839ff23f0f63fdfb3cf09d069d8f8b`, rama `codex/e2-r01-seguridad-permisos`. Se conserva todo el trabajo anterior. El commit adicional se identifica con `git log -1 --format=%H -- docs/E2-R01-FICHA-ACCESO-2026-10-20.md`. Alcance: ficha y navegación al editor de Usuarios. Contrato E2 v0.4 y contrato operativo conservados. Aceptación humana y visual **PENDIENTE**.

## Causa comprobada y solución

La ficha ofrecía un editor general mediante `saveUser` y, aparte, un selector `assignRole`. El primero estaba reservado a Administración General. Borrar el segundo sin integrarlo habría quitado al auxiliar una operación legítima. La ficha también mostraba renglones de ámbito concatenados, daba demasiado protagonismo al historial y no distinguía claramente configuración conservada de autorización efectiva.

Ahora la única entrada de edición de la ficha es **Editar perfil**. Para Administración General, el editor permite elegir entre modificar el perfil e incorporar una definición preaprobada en personas compatibles. Para el auxiliar, solo está disponible esta última operación: identidad, niveles, ámbitos y facultades de la definición son de consulta. La lista procede del directorio filtrado por servidor; se excluyen definiciones sin aprobación y roles ya asignados activamente. No hay autoasignación, asignación a administradores ni edición de definiciones por el auxiliar.

No se fusionan operaciones de servidor ni se guardan implícitamente borradores: se siguen enviando `saveUser`, `assignRole` o `grantDelegation` según el caso. La incorporación conserva revisión, confirmación, destinatario, motivo e idempotencia. El servidor vuelve a validar versiones, capacidades, ámbito y vigencia. La herencia, su preview y sus políticas no cambian.

**Otorgar delegación nueva** continúa disponible para Administración General, dentro de Facultades especiales al editar un auxiliar. Un aviso explica que cambiar a esa operación descarta el borrador del perfil sin guardarlo. La revocación y suspensión permanecen en el historial de la ficha. La regularización heredada y sus previews se conservan.

## Presentación y semántica

- Encabezado claro con sobretexto azul, título marino, subtítulo gris azulado y acento turquesa; reutiliza `.profile-dialog`, `.form-section`, `.section-number`, `.editor-guide` y `.editor-actions` del módulo.
- Sección 1: **Perfil y permisos vigentes**, badge de perfil, estado de cuenta e indicador de revisiones. Cada módulo diferencia Configurado / Acceso efectivo. Las facultades configuradas y efectivas aparecen separadas. No se infiere ausencia de permisos por no tener asignaciones.
- Sección 2: **Alcances institucionales**, con Programas, Ciclos, Docentes y Campos extraordinarios en bloques adaptables. Se conservan las claves institucionales recibidas; no se inventan nombres ni se consultan catálogos adicionales. `*` se representa como **Todos** solo cuando aparece explícitamente en la fuente mostrada. No cambia el valor persistido.
- Una cuenta inactiva o delegación no vigente muestra configuración conservada y **No habilitado**, nunca autorización activa. Sin proyección efectiva se muestra un aviso, sin simular éxito. Vacíos, ausentes y nulos muestran **Sin alcance concedido**; Campos extraordinarios vacío explícito y sin la facultad correspondiente indica **No aplica: sin facultad extraordinaria**.
- Sección 3: **Historial y revisiones**, plegada inicialmente. Conserva asignaciones activas/retiradas, estados de revisión, delegaciones y acciones existentes. El contador contempla tanto revisiones del directorio como asignaciones marcadas, sin duplicar la misma revisión.
- Un único diálogo, navegación interna y cuerpo desplazable; pie fuera de la zona de desplazamiento, Cancelar y acción primaria visibles. Escape y Cancelar no guardan y devuelven el foco al control de origen.

## Comprobaciones

| Comprobación | Evidencia / resultado |
|---|---|
| Ficha activa con permiso explícito sin asignación; nombre largo, revisión pendiente e historial retirado | Cuatro casos nuevos en `access-sheet.spec.mjs`, 320/390/768/1280 px; permiso visible independiente del historial |
| Alcance global, limitado, vacío/nulo e inactividad | Caso de estados de `access-sheet.spec.mjs`; Todos solo con comodín explícito, configuración VIEW conservada y acceso no habilitado en inactiva |
| Delegación revocada | Ficha distingue configuración del grant y ausencia de efecto; revocación durante operación cierra el diálogo y bloquea URL posterior |
| Auxiliar desde Editar perfil | Asignación real aislada de rol VIEW en ADM / 27-1, con `assignedByDelegationId`, auditoría y actualización efectiva; definición EDIT fuera del techo no aparece |
| Versión obsoleta | Se cambia la revisión del rol después de preparar la operación; el callable rechaza y no cambia perfil, asignaciones, bitácora, eventos ni idempotencia |
| Cancelación y limpieza | Cancelar borrador y motivo no escribe; al reabrir se restablece persona/configuración y se vacía rol/motivo; foco devuelto |
| Teclado y adaptación | Navegación de secciones con conservación del borrador, foco visible, Escape, pie accesible, desplazamiento hasta campos finales y sin desbordamiento general |
| Administración exclusiva y rechazos directos | 37 casos de servidor R01: auxiliar no administra definiciones/usuarios/delegaciones, techo de módulos/capacidades/ámbito, autoasignación y atómica/idempotencia |
| Regresiones completas de interfaz | 53/53 Chromium; incluye los 46 previos y 7 nuevos. Tras completar las etiquetas de campos extraordinarios se repitieron los 7 casos de ficha: 7/7. Se actualizaron recorridos, sin relajar expectativas funcionales |
| Política, sesión y configuración | 28/28 unitarias; servidor: 37 R01 + 9 Auxiliar + 8 Control de accesos + 21 Herencia |
| Caracterización y contrato objetivo | 72/72 caracterizaciones; gate estricto salida 1 con los mismos 18 IDs de incumplimientos R02/R03 |
| Compilación | Angular aislado, LAN y producción correctos; producción conserva aviso de bundle inicial 779,82 kB frente a 750 kB |

[Resultados verificables](evidence/r01-access-sheet/results.json), [casos UI](evidence/r01-access-sheet/ui.json) y [galería](evidence/r01-access-sheet/capturas.html). Las capturas se inspeccionaron visualmente por Codex; no equivalen a aceptación del propietario. La captura del editor con «Borrador cancelado» forma parte del ensayo que verifica que ese nombre no se persiste.

Ejecuciones intermedias conservadas en `.local/access-sheet`: dos selectores `getByLabel` exactos no encontraban el select anidado; se sustituyeron por su rol accesible combobox, y ambos escenarios auxiliares pasaron. La primera suite completa terminó 52/53: una prueba anterior seguía buscando el selector en la ficha. Se añadió la navegación por Editar perfil antes de comprobar el mismo rol. Se repitió la interfaz completa desde emuladores aislados limpios. No se ocultaron casos ni se modificó el gate estricto.

Durante el diagnóstico intermedio del auxiliar se observó en consola un error de complejidad `maximum of 1000 expressions` en la consulta de notificaciones (Rules L242). No se considera una denegación válida ni un éxito de autorización; esa consulta no es objeto de la unificación de la ficha. Queda como diagnóstico pendiente de R01, sin atribuir su origen a este ajuste sin comparar la base. No se modificaron Rules para ocultarlo. Las comprobaciones de asignación y rechazo de esta entrega se acreditan por la respuesta del callable y el estado persistido, no por ese error de notificaciones.

## Conservación y demo

No se modifican Functions, Rules, contratos, permisos persistidos de la LAN, delegaciones compartidas, selección ni respaldo privado. Hash compartido idéntico antes/después: `7762bebccbc2b89c234745407662140e1b483654e21c4b6a05d5fdde23243393`; delegación del propietario `333bbac4-82c6-4dec-a116-53ae8d31bfd1`, ACTIVE, revisión 1, intacta. Las escrituras de prueba usaron exclusivamente Firestore 18080 / Auth 19099 / Functions 15001. Los servicios compartidos permanecen en 8080 / 9099 / 5001, supervisor 4310 y frontend 4201, sin reinicio, reset ni recarga de fixtures.

IPv4 comprobada: **192.168.42.1, Wi-Fi, Preferred**; Ethernet 192.168.0.49 figura Deprecated y no se usa para la URL. Frontend: `http://192.168.42.1:4201/usuarios`. El recibo posterior al commit se guarda en `.local/access-sheet/served-verification.json`; `/demo-version.json` identifica el SHA y hashes de los archivos servidos. La comprobación HTTP se realiza desde el anfitrión; no se presenta como una nueva prueba física desde otro equipo.

Se conserva por hash el respaldo privado y su selección; la comparación de la base compartida se registra en `results.json`. Sin push, merge, despliegue remoto ni llamadas a producción, Moodle o SAEKO. Google institucional y separación DEMO/LAN no cambian.

## Recorrido breve de revisión humana

1. Recargar Usuarios con Ctrl+F5. Como Sistemas, abrir Ver acceso en una cuenta activa y una inactiva; comprobar perfil/estado, configuración frente a efecto, los cuatro alcances y el pie.
2. Desplegar Historial y revisiones: comprobar estados y acciones; cerrar sin ejecutar cambios. Revisar también a Sistemas para comprobar Todos explícito.
3. Abrir Editar perfil, recorrer secciones, cambiar un dato de borrador y cancelar. Reabrir para comprobar que no se guardó. Con persona no administrativa, elegir Incorporar un rol preaprobado, revisar sus módulos/ámbitos y cancelar.
4. Como Auxiliar, abrir la ficha de una persona dentro de su delegación y Editar perfil: debe ofrecer únicamente roles permitidos, con identidad y definición no editables. Revisar y cancelar; no modificar delegaciones para hacer aparecer opciones. Si no hay definiciones disponibles, el editor lo informa.
5. Repetir la inspección visual en tableta y móvil, incluidos el desplazamiento interno y las acciones inferiores. La confirmación real de asignación y la revocación destructiva ya se ensayaron técnicamente en aislamiento; no es necesario alterar los datos compartidos para esta revisión visual.

Se conservan las evidencias humanas anteriores (T01 físico, T07 funcional y T11 físico). T10 humano y aceptación visual permanecen pendientes. Continúan abiertos el impedimento administrativo combinado de **200 documentos**, los **18 incumplimientos R02/R03**, la incidencia de notificaciones indicada y los demás requisitos antes de producción. No se inicia R02 ni se declara validación remota o productiva.

## Archivos modificados

- `src/app/features/users/components/security-console.component.ts`: navegación unificada, elección de operación, presentación de permisos/alcances y contador de revisiones.
- `src/app/features/users/components/security-console.component.html` y `.css`: ficha, editor restringido, historial desplegable y estilos locales; se conserva la distribución superior y el directorio.
- `src/app/features/users/data/security.service.ts`: tipado opcional de `approvedBy` que ya devuelve el directorio; no añade llamadas.
- `tools/e2-r01/access-sheet.spec.mjs`: siete casos nuevos aislados. `ui.spec.mjs`, `acceptance.spec.mjs` y `access.spec.mjs`: navegación actualizada, mismas expectativas; `playwright.config.mjs`: incorpora la nueva suite.
- Este informe, `E2-R01-VALIDACION.md`, `E2-R01-RESULTADOS.json` y `docs/evidence/r01-access-sheet/`: evidencia complementaria, sin sobrescribir la aceptación histórica.
