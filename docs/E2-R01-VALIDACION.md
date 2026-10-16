# E2-R01 — Ficha y evidencia local

> Ejecución complementaria vigente: [correcciones del 15/10/2026](E2-R01-ACEPTACION-2026-10-15.md), añadida al final. Se preservan los resultados históricos; T01 físico, T07 funcional y T11 físico quedan confirmados por el nuevo reporte humano, sin atribuir su ejecución a Codex.

Fecha inicial: 2026-10-12. Revisión: 2026-10-13. Estado: **VALIDADA_LOCAL**.

Alcance aprobado: C01, C01.1, C01.2, C09 administrativo y C11 aplicable de [v0.4](ETAPA-2-CONTRATOS-ESTABILIZACION.md). [Matriz, modelo, mapeo y límites](E2-R01-SEGURIDAD-PERMISOS.md).

## Criterios de aceptación

| Criterio | Evidencia |
|---|---|
| Autoridad explícita; NONE/VIEW/EDIT; nombre sin privilegios | Política ejecutable, Rules y pruebas SDK; helper UI ejecutado desde su fuente |
| Autoservicio sin modificación, adición ni eliminación de privilegios | Casos integrados y caracterizaciones PROFILE-* |
| AG administra; auxiliar solo asigna/retira bajo techo | Casos positivos y negativos en `tools/e2-r01/integration.mjs` |
| Revocación vigente, asignaciones activas revisables y nueva identidad | SDK abierto; carrera asignar/revocar; reintento y colisión de ID |
| Revisiones concurrentes y último administrador | Transacciones concurrentes reales contra Firestore Emulator; un ganador |
| Transición heredada sin inferencia ni restauración obsoleta | Mapeo versionado, caducidad y hash/revisión; preview obsoleta aborta |
| Cambio/bitácora/evento atómicos; actor y área reales | Colisión de almacenamiento inyectada: no queda cambio, evento ni operación; dos áreas sintéticas distintas |
| Avisos idempotentes y correo simulado | Reintentos concurrentes del consumidor; conserva marca de lectura |
| Interfaz legítima y revocación visible | Chromium: Consultar/Editar, guardar rol, consulta académica, directorio retirado con sesión abierta |
| Regresión y aislamiento | 52 casos Rules y 20 lógica E1; reset y SDKs sin emuladores; conexiones observadas exclusivamente loopback |

## Evidencia inicial del commit 7b22264 (histórica)

Entorno: Node **22.23.2**, Microsoft OpenJDK **25.0.2**, Firebase CLI **15.30.0**, proyecto exclusivo `demo-spai-tup`. Se antepuso al PATH el directorio del Node 22 disponible localmente. Los comandos siguientes se ejecutaron desde la raíz de SPAI-TUP; `npm run test:r01:full` queda como alias reproducible de la ejecución completa.

| Comando ejecutado | Resultado |
|---|---|
| `node --test tools/e2-r01/policy.test.mjs` | 8/8: política y método real de UI para EDIT personalizado, VIEW, programa/ciclo y corrección sensible |
| `node tools/local/run.mjs --test --r01 --stage1 --ui` | Exit 0: 8/8 pruebas locales originales; 32/32 escenarios R01; 52/52 Rules + 20/20 lógica E1; 3/3 Chromium; reset/offline aprobados |
| `node tools/local/run.mjs --test --ui` | Comprobación de la ruta absoluta del informe JSON de navegador |
| `node --check functions/index.js` | Sintaxis válida |
| `node --check functions/local-runtime.js` | Sintaxis válida |
| `node --check functions/security/policy.js` | Sintaxis válida |
| `node --check functions/security/service.js` | Sintaxis válida |
| `node node_modules/@angular/cli/bin/ng.js build --configuration local` | Compila |
| `node node_modules/@angular/cli/bin/ng.js build` | Compila; inicial 766.94 kB frente a presupuesto de advertencia 750 kB, sin cambiar el umbral |
| `.local/actionlint/actionlint.exe .github/workflows/stage1.yml` | Sin diagnósticos |
| `node tools/stage1/contracts.mjs` | **Exit 1 esperado:** 18 incumplimientos funcionales posteriores, todos `stage:3`; no se suavizó el gate |
| `git diff --check` | Sin errores de whitespace |

Logs detallados, cobertura Rules y capturas ficticias se mantienen en `.local/`, ignorados por Git. Los últimos logs se llaman `r01-release-validation.log`, `r01-release-unit.log`, `r01-release-build-local.log` y `r01-release-build-production.log`. Se conserva un resumen versionado sin datos institucionales en `E2-R01-RESULTADOS.json`.

El emulador puede informar errores durante la preevaluación de `setDoc` como create/update. Las pruebas R01 exigen denegación explícita en la misma regla de la operación efectiva; para creación se verifica primero que el documento no existe. Un error por límite de expresiones, `INTERNAL` o indisponibilidad no acredita denegación. Los `UNAVAILABLE` del ensayo **offline**, con emuladores intencionalmente detenidos, comprueban ausencia de fallback; no son pruebas de permisos.

Se corrigieron fallos reales encontrados durante la ejecución: sobreescritura de identificadores, ampliación por unión de ámbitos, estado recibido por consultas de sesiones anteriores, controles heredados por nombre/booleano y selector ambiguo del ensayo UI. La prueba E1 del error al guardar ciclo proporciona ahora un actor autorizado, para seguir probando el rechazo de persistencia y no el nuevo guard de permisos.

## Demo reproducible sin cambiar la selección privada

Usar Node 22 en dos terminales. La variable siguiente dura únicamente en esa terminal y fuerza fixtures; **no modifica** `.local/data-source.json`:

```powershell
Set-Location 'C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP'
$env:SPAI_LOCAL_SYNTHETIC = 'true'
npm run local:emulators
```

En la segunda terminal, misma carpeta y Node 22: `npm start`. Abrir `http://127.0.0.1:4200/` y seleccionar **Sistemas DEMO** en el inicio local. Si ocurre el cierre de sesión único ya documentado en E1, ingresar nuevamente; ese comportamiento previo queda fuera de esta entrega.

1. Usuarios → Administrar roles personalizados → Crear rol; probar Editar/Consultar y quitar Consultar. Preparar un rol con grupos VIEW, programa ADM y sin módulos reservados; indicar motivo y confirmar.
2. Crear un perfil CUSTOM ficticio, área real de prueba, programa ADM, módulos vacíos. No se crea una cuenta Auth desde ese formulario.
3. Editar Auxiliar DEMO para confirmar su ámbito institucional ADM; otorgar delegación nueva con grupos VIEW y MANAGE_CUSTOM_ROLES, programa ADM. Como auxiliar, asignar el rol preaprobado al perfil ficticio.
4. Mantener esa sesión auxiliar abierta. En otra sesión de Sistemas DEMO revocar la delegación: desaparece la administración del auxiliar; el rol del destinatario permanece ACTIVE con revisión pendiente. Como AG conservar, retirar o sustituir con motivo.
5. La suite automática ensaya los casos de migración y carreras con perfiles ficticios adicionales. Para repetirlos y limpiar al terminar, detener la demo y ejecutar `npm run test:r01:full`. No ejecutar pruebas contra el snapshot privado.

Detener con `npm run local:stop`; cerrar Angular con Ctrl+C. Quitar la variable de esa terminal con `Remove-Item Env:SPAI_LOCAL_SYNTHETIC` o cerrarla. No se ejecutó `local:data:synthetic`, exportación online ni migración sobre datos reales.

## Git, archivos y reversión

Rama: `codex/e2-r01-seguridad-permisos`. Base previa a la entrega: `894be730cd96c94b15b8077c53ed55ccc9610550`. `main` y la referencia local `origin/main` permanecen en `6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2`. El commit de implementación es el que introduce esta ficha; se entrega su SHA al cerrar el trabajo. No hubo fetch, push, merge ni despliegue en R01.

El árbol inicial contenía el borrador R01 y el contrato sin versionar: no se descartaron. Se preservaron patch, estado y copias de cada archivo en `.local/r01-resume-20261012/`. El commit integra y corrige ese borrador junto con los cambios de esta ejecución.

| Grupo de archivos | Cambio |
|---|---|
| `firestore.rules`, `functions/index.js`, `functions/security/*` | Autorización, servicio transaccional, identidad, eventos y consumidor |
| `src/app/features/users/components/security-console.*`, `users/data/*`, rutas | Consola administrativa, niveles, delegaciones, revisiones y transición |
| `src/app/core/auth/*`, `core/data/*`, `app.component.ts` | Perfil canónico, consultas autorizadas, descarte de datos de sesión anterior y avisos |
| Páginas existentes de asignaciones, docentes, ciclos, solicitudes, dashboard, catálogos, Meet, Moodle y bitácora | Correcciones acotadas de autorización/controles; no nuevos flujos de R02–R08 |
| `tools/e2-r01/*`, `tools/local/*`, `tools/stage1/*`, `package*.json`, `.github/workflows/stage1.yml` | Pruebas sintéticas, Chromium, regresión y preparación CI |
| `docs/ETAPA-2-CONTRATOS-ESTABILIZACION.md`, `docs/E2-R01-*`, avisos en documentos E1 | Contrato completo v0.4, matriz, ficha, evidencia y trazabilidad |

Para revertir **el código local**, primero detener Angular y emuladores, conservar cualquier trabajo posterior y ejecutar `git revert <SHA-del-commit-R01>` en esta rama, con árbol limpio. Esto conserva historia y no modifica main ni datos privados. El punto anterior es Etapa 1 y vuelve a tener sus fallos conocidos; no es un rollback seguro para producción. No ejecutar reset/clean para recuperar el borrador: consultar primero el checkpoint local citado.

Para deshacer experimentos de datos ficticios, reiniciar emuladores con `SPAI_LOCAL_SYNTHETIC=true`. No restaurar snapshots ni tocar la selección privada. Los hashes SHA-256 del respaldo original y selección coinciden antes/después; solo se versionan comprobaciones agregadas.

## Pendientes separados

- **R02:** 8 fallos E1 de ciclo (escrituras/altas fuera de captura, más de un ciclo operativo y selección por orden). D1 sigue siendo requisito de esa entrega; R01 no declara corregido el cierre funcional.
- **R03:** 10 fallos de solicitudes/compartición (reapertura de terminal, promesas no esperadas, duplicación, éxito prematuro, escritura parcial, concurrencia y conservación de estado Moodle). C08 ya está definido en v0.4, pendiente de implementar.
- **R04:** recuperación/depuración. **R05:** paginación/importadores/catálogos y Ligas Meet. **R06:** docentes e identidad. **R07:** calidad transversal. **R08:** SAEKO. Conciliación operativa permanece en R03.
- **CI remota:** workflow preparado y validado estáticamente; no ejecutado en GitHub porque no se publicó la rama. El job estricto de contratos seguirá rojo por los 18 casos posteriores.
- **Producción:** no probada, migrada ni desplegada. Límite administrativo local de 200 documentos y límites de consultas descritos en la matriz. El presupuesto del bundle genera advertencia. La prueba UI automatizada y la inspección de su captura no equivalen a aceptación manual del propietario.


## Revisión complementaria sobre 7b22264

Esta revisión se limita a R01 y deja un commit local adicional, sin amend. Árbol inicial limpio; rama y SHA base verificados. `main` y la referencia local `origin/main` no cambian. El SHA adicional se obtiene con `git log -1` y se entrega en el cierre; no se incorpora un hash autorreferente a estos documentos.

- [Comportamiento exacto del límite, transición y criterio de producción](E2-R01-REVISION-COMPLEMENTARIA.md).
- [Inventario operativo y tabla requisito → implementación → prueba → estado](CO-INVENTARIO-R01.md).
- Contrato operativo v1.0 incorporado desde el archivo proporcionado: solo se normalizaron dos finales de línea Markdown para pasar el control de whitespace. Contenido y adjunto original intactos; v0.4 permanece intacto.
- Correcciones: eliminación de asignaciones exige EDIT para auxiliares; lectura sin filtros se deniega por política explícita; mapeo vigente vinculado por revisión; preview preparada no confirma después de vencer; mensaje de caducidad; modal CO-11, directorio/editor, saludo y disposición adaptable.
- Se corrigió además la carrera de la consola que permitía reabrir un perfil con el directorio anterior mientras terminaba la recarga: ahora la confirmación visible espera la recarga y los botones de edición permanecen deshabilitados mientras está ocupada. La traza mostró que el saludo sí se persistía; el dato obsoleto estaba en la vista.

Las capturas `.local/test-results/r01-review-desktop.png` (1366×900), `r01-review-mobile.png` (390×844) y `r01-review-view.png` contienen exclusivamente fixtures. Inspección del agente: modal sobre navegación, títulos y acciones legibles, cuerpo desplazable y una columna móvil. La geometría, foco, permisos y flujo se comprueban también automáticamente. **La aceptación manual del propietario sigue pendiente.**

La evidencia inicial anterior se conserva como histórica. Las ejecuciones complementarias y sus resultados definitivos se detallan en el bloque siguiente y en el JSON; no se sustituyen fallos anteriores por afirmaciones de éxito sin repetir la comprobación afectada.


### Resultados complementarios ejecutados

Mismo entorno Node 22.23.2 / emuladores `demo-spai-tup`; ningún dato privado importado.

| Comprobación | Resultado real |
|---|---|
| `node --test tools/e2-r01/policy.test.mjs` | **9/9**. Incluye frontera temporal determinista y dashboard real por módulos concedidos |
| `node tools/local/run.mjs --test --r01 --stage1 --ui` | **37/37 integración R01**, **52/52 Rules + 20/20 lógica E1**, reset correcto. Esa ejecución terminó exit 1 por una prueba UI; se conserva ese resultado, no se presenta como full verde |
| `node tools/local/run.mjs --test --ui` (repetición final) | **Exit 0**, **6/6 Chromium**, **8/8 unitarias locales originales**, integración local, reset y offline aprobados. Corrige y vuelve a ensayar la interacción que falló |
| Gate `node tools/stage1/contracts.mjs` | **Exit 1 esperado: los mismos 18 IDs**, 8 de Rules y 10 de lógica; 0 decisiones pendientes. No cambiaron casos, expectativas ni código de E1 |
| `node --check` sobre los 4 archivos Functions y `review.mjs` | PASS |
| `ng build --configuration local` con Node 22 | PASS después de la corrección final de consola |
| `ng build` con Node 22 | PASS; bundle inicial **768.85 kB**, advertencia de **750 kB** intacta |
| `.local/actionlint/actionlint.exe .github/workflows/stage1.yml` | Exit 0; validación estática local, no ejecución de CI remota |
| `git diff --check` | PASS |
| Copia privada, selección y contrato v0.4 | SHA-256 idénticos antes/después; contrato operativo con contenido equivalente línea por línea, salvo dos espacios Markdown finales normalizados |

R01 pasa de 32 a 37 escenarios integrados por cinco casos nuevos: CUSTOM VIEW en Asignaciones; auxiliar VIEW y excepción académica; reloj/preview vencida; Rules/callables y mapeo; límites 199/200/201 con atomicidad. Unitarias de 8 a 9 por dashboard. Chromium de 3 a 6 por CO-11, CUSTOM VIEW y caducidad/mapeo con sesión abierta. Estos aumentos no reducen ninguno de los 18 incumplimientos de R02/R03.

Historial de diagnóstico conservado en `.local/`: `r01-review-full.log` agotó el plazo de arranque antes de R01; `full-2` detectó una comprobación inferior de tiempo innecesaria para listeners y se retiró conservando la caducidad superior; `full-3` detectó la evaluación de campo ausente en consulta sin filtros; `full-4` completó servidor/E1 pero falló un selector UI. `r01-review-ui-2.log` identificó lectura obsoleta del directorio al reabrir; `r01-review-ui-3.log` pasó completo después de corregirla. No se ocultaron esos intentos ni se debilitaron expectativas.

Logs finales: `.local/r01-review-unit.log`, `.local/r01-review-full-4.log`, `.local/r01-review-ui-3.log`, `.local/r01-review-build-local-final.log`, `.local/r01-review-build-production.log`, `.local/r01-review-contracts.log`. Reportes detallados: `.local/test-results/e2-r01.json`, `r01-ui.json`, `stage1-rules.json`, `stage1-logic.json`. Resumen público sin datos reales: `E2-R01-RESULTADOS.json`.

Estado mantenido: **VALIDADA_LOCAL**, exclusivamente para el alcance R01 ensayado. **Producción impedida por el límite administrativo** y los demás requisitos de la revisión complementaria. CI remota, despliegue y aceptación manual del propietario: **no realizados / pendientes**. La inspección visual del agente no es una aprobación del propietario. En la captura CO-02 se aprecia una columna de ID Moodle larga con poco espacio respecto a Materia; su ajuste general de tabla queda en R05/R07, sin rediseñar Asignaciones en R01.

La reversión de esta revisión es un `git revert` del nuevo SHA local, después de conservar cualquier trabajo posterior y detener servicios. No revierte datos reales ni restaura el respaldo privado. Los mapeos temporales emitidos por el commit anterior carecen de los nuevos vínculos de revisión: requieren revisión/aprobación explícita de AG antes de usarse con este código; no hay renovación ni migración automática. No se aplicó este cambio a ningún perfil real.

## Revisión de hallazgos de aceptación — 2026-10-14

Base `ef82fc60d02a2eee8e158f04e1104b8110a4b9a5`; se conserva el trabajo LAN no confirmado existente. Corrección en un commit adicional local, sin reescribir la base ni modificar main. SHA probado y verificación posterior en `.local/acceptance/commit-validation.json`; el commit del informe se identifica con `git log -1 --format=%H -- docs/HALLAZGOS-PRUEBA-MANUAL-E2-R01.md`. [Reporte manual corregido y guion de repetición](HALLAZGOS-PRUEBA-MANUAL-E2-R01.md), [matriz CO](CO-INVENTARIO-R01.md), [capturas y evidencia sintética](evidence/r01-acceptance/README.md).

| Comprobación ejecutada | Resultado | Evidencia |
|---|---|---|
| Unitarias locales + política R01 + autenticación | 22/22 (10 + 9 + 3) | `.local/acceptance/unit-final.log` |
| Integración R01 de servidor | 37/37 | `.local/acceptance/isolated-regression-4.log`, `.local/test-results/e2-r01.json` |
| Caracterizaciones E1 | 72/72: 52 Rules + 20 lógica | `stage1-rules.json`, `stage1-logic.json` |
| Gate contractual estricto | Salida 1: mismos 18 incumplimientos, sin omitir ni alterar expectativas | `.local/acceptance/contracts.log`; lista íntegra en RESULTADOS.json |
| Chromium: 6 regresiones + T09/T10/T11 + 4 viewports | 13/13 | `.local/acceptance/isolated-ui-4.log`, `r01-ui.json` |
| SDKs, reinicio y ausencia de fallback sin emuladores | PASS, 7 intentos exclusivamente loopback en prueba offline | Runner aislado; no reinició la demo compartida |
| LAN desde navegador del anfitrión | PASS, Sistemas y Consulta: inicio/navegación/recarga; 154 solicitudes, un origen LAN, sin errores de página | `evidence/r01-acceptance/lan-smoke.json` |
| Compilaciones local, LAN y production | PASS; production advierte 768.66 kB / presupuesto 750 kB | Logs build-* en `.local/acceptance` |
| Sintaxis Functions y herramientas modificadas | PASS | `node --check` |
| Aislamiento de identidad DEMO en production | PASS de guard/configuración; lista de correos DEMO ausente del bundle production | `auth-config.test.mjs`; inspección local del artefacto |
| Respaldo privado, selección y contrato v0.4 | SHA-256 idénticos a la base registrada | Recibo local; no importación ni migración |
| Segunda computadora física: recorrido completo T01 | PENDIENTE | No sustituido por navegador emulado |
| Aceptación manual del propietario | PENDIENTE | No concedida por Codex |

Entorno: Node 22.23.2, Chromium 153.0.8010.12, proyecto demo-spai-tup, fixtures ficticios. Pruebas de servidor/UI en puertos separados 18080/19099/15001/19199 y web 4202; demo compartida conservada en 192.168.41.254:4201 con emuladores en loopback. Inspección visual del agente: Usuarios en 1366×900, 768×1024, 1032×1376 y 390×844; Roles en escritorio y móvil. Las cuatro pruebas automatizadas comprueban acceso por foco a cada campo, tamaño, columnas, scroll, encabezado/acciones, Escape y retorno del foco; las regresiones originales comprueban modal sobre navegación, guardado y las cuatro dependencias Consultar/Editar.

T09 usa identidad Auth real del emulador y permisos obtenidos por callable auditado, no una sesión simulada en interfaz. T10 registra primero cada actor: CA EDIT (ciclos `*`, afiliación ADM), CUSTOM VIEW ADM/27-1 y auxiliar delegado EDIT ADM/27-1 sin capacidades/campos. Se permite solo a CA la matrícula ajena y se rechaza alterar docente ajeno; CUSTOM/auxiliar no heredan la excepción. T11 confirma rechazos de lectura, escritura, directorio y retirada de rol después de revocar; conserva ACTIVE la asignación con revisión pendiente AG y procedencia de delegación.

**Diagnósticos y correcciones de los ensayos:** los primeros arranques aislados fallaron por rutas de configuración del CLI y porque su worker de descubrimiento no hereda variables SPAI arbitrarias. Se corrigió la configuración raíz ignorada y se admiten únicamente dos ternas completas de emuladores loopback; puertos mezclados/proyecto real siguen rechazados. La primera UI falló por fixture de ID Moodle inconsistente, revisión obsoleta de destinatario y selector ambiguo de combobox; la segunda detectó afiliación institucional omitida en el destinatario ficticio. Se corrigieron los fixtures/selectores, manteniendo las reglas y exigencias. La limpieza de delegación se ejecuta en finally para no contaminar pruebas siguientes.

El intento UI 3 añadió una comprobación diagnóstica REST que suponía que Commit no emitía preevaluación: esa suposición resultó falsa. El emulador devuelve tanto `evaluation error at L138...` preliminar como **`false for 'update' @ L138`** en la misma regla aplicable. SDK y REST muestran ese formato. El intento final conserva el criterio ya usado por la integración histórica: exige `permission-denied` y un `false` explícito en la **misma línea y operación** por cada diagnóstico preliminar; un error de evaluación aislado o el `false` del catch-all no basta. Se rechazan límites de expresiones, Null value, INTERNAL y UNAVAILABLE; en create se comprueba previamente que el documento no exista y se considera la evaluación create aplicable. No se presenta el texto de error por sí solo como prueba de seguridad ni se declara que los logs carezcan de diagnósticos preliminares. Los positivos de lectura y matrícula y la ausencia de mutación también se verifican. No se modificó Firestore Rules ni se debilitó el gate de los 18 contratos.

El build production conserva el literal ficticio histórico dentro del método protegido, pero no la lista de personas DEMO. Se verificó el bloqueo antes de cualquier llamada para production, proyecto real o SDK sin emulador, incluso con parámetros de URL que pidan DEMO. Google institucional se comprobó mediante mocks y comparación histórica; no se inició una sesión real ni se contactó producción. CI remota, producción, Moodle, SAEKO y correos reales: NO ejecutados.

**Estado: VALIDADA_LOCAL para el alcance técnico R01 ensayado; aceptación manual PENDIENTE.** Se mantienen el impedimento administrativo >200, los 18 contratos de R02/R03, el defecto previo responsive de Asignaciones R05/R07, migración/rollback y validación remota pendiente. Ningún resultado local acredita capacidad productiva.

## Segunda ejecución de hallazgos — 2026-10-15

Responsable técnico: **Codex**. Base comprobada `96b4c991a3e04c61f09a75eeb478ae5730e666df`, misma rama R01, un commit local adicional identificado por `git log -1 --format=%H -- docs/E2-R01-ACEPTACION-2026-10-15.md`. [Causas, solución, severidad y tabla humana](E2-R01-ACEPTACION-2026-10-15.md). [Capturas comparables y resultados ficticios](evidence/r01-acceptance-2/README.md).

| Comprobación ejecutada | Resultado | Evidencia |
|---|---|---|
| Unitarias locales/política/autenticación/ciclo de suscripciones | **26/26**, 10+9+3+4 | `tools/e2-r01/run-acceptance.mjs`; `.local/acceptance-2/full-tests-final.log` y `session-lifecycle-final.log` |
| Integración R01 de servidor | **37/37** | Mismo log y `.local/test-results/e2-r01.json`; umbrales 199/200/201, atomicidad, caducidad heredada conservados |
| Caracterizaciones E1 | **72/72**, 52 Rules + 20 lógica | Mismo log; no equivalen a cumplimiento del objetivo |
| Gate estricto de contratos objetivo | **Salida 1, los mismos 18 incumplimientos** | `.local/acceptance-2/contracts.log`; lista comparada exactamente con ejecución anterior, sin diferencias ni expectativas modificadas |
| Chromium original y aceptación ampliada | **20/20** | `.local/acceptance-2/ui-final.log`, `.local/test-results/r01-ui.json` |
| H002 recorrido inicial real | PASS sin precargar marca de sesión: Consulta → Asignaciones; `/`, `/dashboard`, recarga, historial, cambio Sistemas→Consulta | `navigation.spec.mjs`, observador de inserciones DOM y consultas Firestore; cero inserciones del contenido protegido |
| H002 perfil pendiente / revocación / sin módulos | PASS: ningún componente ni consulta derivada mientras se retiene el perfil; caché y escrituras optimistas pendientes no autorizan; retiro al revocar y estado restringido sin bucle | Navegador y unitarias del servicio compilado/cleanup/callbacks atrasados; una sesión persistida antigua se invalida, el primer login nuevo no requiere doble ingreso |
| H002 lecturas directas de servidor | PASS con criterio explícito documentado abajo | `h002-server-reads.json`: directorios, solicitudes, agenda y asignaciones sin filtro denegados, perfil ajeno denegado; perfil propio/ciclos admitidos |
| T10 aislado, matrícula ajena | PASS **SDK y guardado desde UI**; CA permitida, CUSTOM/auxiliar rechazados fuera de ámbito | `t10.json`, `t10-actors-before.json`, capturas; campos protegidos sin cambio |
| Preparación humana T10 | Arrancó y mostró «T10 listo»; detenida al terminar la comprobación | `.local/acceptance-2/t10-review-start.log`, `run.mjs --review`; no cambió la LAN |
| H001 visual / H003 nombre largo autorizado | PASS técnico en 1366×900, 768×1024, 1032×1376, 390×844 | Capturas y mediciones; inspección visual Codex, no aceptación del propietario |
| Compilaciones local, LAN, production | PASS; production advierte **774,83 kB / 750 kB** | `.local/acceptance-2/build-{local,lan,production}.log`; no despliegue |
| Sintaxis Functions/herramientas y diff | PASS en código y documentos generados; excepción de formato de la fuente recibida | `node --check`, `.local/acceptance-2/syntax.log`; `git diff --cached --check -- . ':(exclude)docs/evidence/r01-acceptance-2/reporte-recibido.md'`. La copia íntegra recibida conserva ocho finales de línea con doble espacio Markdown, señalados por el chequeo sin exclusión; no se altera su hash |
| LAN actualizada, emuladores compartidos conservados | PASS anfitrión: login real Sistemas/Consulta, recarga, URL Dashboard, un origen LAN, sin errores de página | `lan-smoke.json`, `.local/acceptance-2/lan-install.json`; frontend reemplazado conservando chunks anteriores; no reset/seed compartido |
| SDKs sin emuladores | PASS: fallan/no confirman, siete intentos solo loopback | Final del runner; no fallback a producción |
| Respaldo privado, selección y v0.4 | SHA-256 conservados | `manualFindingsReview.preserved` en RESULTADOS.json |

**Diagnósticos de la revisión:** el primer ensayo tuvo 15/19 UI: límite de 30 s de un caso extenso, consultas duplicadas al perfil propio desde `UsersRepository`, y rechazo del listado con `Null value`. Se amplió el tiempo total del caso a 60 s sin relajar aserciones; el perfil propio ahora se reutiliza y el listado es administrativo. El siguiente ensayo tuvo 17/19: el fixture de matrícula UI esperaba minúsculas, aunque el formulario ya normaliza a mayúsculas; se usa un identificador ficticio en mayúsculas y se conserva esa política. La otra expectativa exigía ausencia absoluta de preevaluaciones. Una simplificación experimental de `general()` no eliminó esos diagnósticos y se descartó: esa función conserva su implementación previa. La suite completa siguiente pasó 19/19. Finalmente se retiró la precarga artificial de versión de los nuevos recorridos, se corrigió el primer ingreso y se añadió la regresión de sesión antigua: **20/20** sobre el código final.

**Criterio de denegación:** los mensajes del emulador pueden incluir `evaluation error` preliminar junto a `false` final. La prueba exige `permission-denied` y, para cada preevaluación, `false` explícito en la **misma línea y operación de la regla aplicable**; el catch-all o un error aislado no bastan. `Null value`, límites de expresiones, INTERNAL y UNAVAILABLE se rechazan. Los mensajes se conservan en JSON y se comprueban positivos legítimos. No se declara que los logs estén libres de errores preliminares. Los UNAVAILABLE del ensayo offline son esperados al apagar únicamente sus emuladores, y no se cuentan como pruebas negativas de permisos.

**Estado técnico: VALIDADA_LOCAL.** H001/H002/H003 corregidos y verificados técnicamente; confirmación humana de ajustes pendiente. T10 técnico PASS / humano PENDIENTE. T01 físico, T07 funcional y T11 físico están confirmados por el reporte de la propietaria. Totales humanos: 7 correctas, 2 con hallazgo, 1 fallida, 1 pendiente; T09b debe repetirse. No se declara aceptación del propietario, CI remota, validación remota ni productiva. Permanecen el límite administrativo de 200, los 18 incumplimientos R02/R03 y los demás impedimentos documentados.


## Revisión Auxiliar — 2026-10-16

Responsable técnico: Codex; base `ce8590df65e0aad93df67477bf000053676d2b09`. [Informe y matriz de hallazgos](E2-R01-AUXILIAR-2026-10-16.md), [evidencia versionada](evidence/r01-auxiliary/results.json). **27/27 unitarias, 37/37 servidor R01 + 9/9 Auxiliar, 26/26 Chromium, 72/72 caracterizaciones**. Gate estricto: salida 1, mismos 18 IDs abiertos. Builds local/LAN/production PASS, advertencia de presupuesto 778,03/750 kB; sintaxis y diff comprobados. Ejecución íntegra: `.local/aux-review/full-verified.log`.

Se comprueban positivos limitados, denegaciones finales sin Null/1000, campos nulos, VIEW/EDIT/capacidades, grant más estrecho que la proyección, delete ajeno, recarga, cambio Sistemas→Auxiliar, revocación directa y estados distintos de consulta. Compartida sin reset/reinicio ni cambios de datos; frontend local actualizado y Rules cargadas verificadas, respaldo privado/selección intactos. La inspección desde el anfitrión y las capturas del agente no sustituyen la aceptación humana. Estado **VALIDADA_LOCAL / aceptación PENDIENTE**. Se conservan T01/T07 funcional/T11 físicos; T10 humano, 18 contratos R02/R03, límite administrativo de 200 y demás impedimentos siguen abiertos.


## Bitácora, Solicitudes y Control de accesos — 2026-10-16

Responsable técnico: Codex; base 4c52777024b5f7ca7e3a2b9d91ee7e05b704caaa. [Informe y recorrido manual](E2-R01-CONTROL-ACCESOS-2026-10-16.md), [resultados con fecha y hashes](evidence/r01-access/results.json). **28/28 unitarias; 37/37 servidor R01, 9/9 Auxiliar y 8/8 dirigidas** (estas últimas separan siete comprobaciones de seguridad y una reproducción del defecto anterior). **33/33 Chromium; 72/72 caracterizaciones**. Gate contractual salida 1: mismos 18 IDs abiertos. Builds local/LAN/production PASS; advertencia 779,10/750 kB. Sintaxis comprobada. Ensayo offline: siete intentos solo loopback, sin fallback.

La revisión reproduce errores de complejidad en ambas lecturas y un falso vacío en Solicitudes. Se preservan autoridad y ámbito explícitos, con estados distintos de carga/vacío/ámbito/denegación/error. La configuración compartida actual es una nueva delegación institucional emitida por el propietario; no el ámbito vacío de la inspección anterior. Frontend LAN actualizado sin reset/reinicio; registros, delegación y hashes privados conservados. Evidencia completa en el manifiesto.

Se mantiene **VALIDADA_LOCAL / aceptación humana PENDIENTE**. No se repiten T01 físico, T07 funcional ni T11 físico; T10 humano sigue pendiente. No se inicia R02/R03 ni se cierra el impedimento administrativo de 200 documentos.
