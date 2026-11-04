# SPAI-TUP — Continuidad, avances y pendientes de estabilización

**Corte: 4 de noviembre de 2026, America/Cancun.** Preparado por Codex para continuar desde otra cuenta, a petición del propietario. Este documento reúne el estado comprobado en Git y la evidencia existente; no constituye una nueva aceptación, ejecución completa de pruebas o autorización de producción.

## 1. Punto exacto de continuidad

**Continuar en `codex/e2-r02-cierre-rules-20261030`. No partir de `main`.**

| Referencia | Estado comprobado |
| --- | --- |
| Repositorio personal | [victoryama-wq/SPAI-TUP](https://github.com/victoryama-wq/SPAI-TUP), público |
| Origen del proyecto | [lizyoymendez-lab/SPAI-TUP](https://github.com/lizyoymendez-lab/SPAI-TUP), remoto `upstream`; no se publica allí |
| Base técnica del cierre de Rules | `edb1828a6bcaaffa53a4d2e7a8ba47025cef5182` |
| Aplicación aceptada el 30/10 | `819e80b3bbcef27279c69608b89f5de8f685ccd0` |
| Compilación aceptada | `r02-refresh-819e80b3bbce`, instancia independiente 4211 |
| A/B aceptados el 29/10 | `aa532cbef655c9decf7ee0865b82db9f665de5cf` |
| R01: código aceptado / registro | `8ae650b8c3c59390a2290bf819d61d195710c35a` / `94eeffa90bdb97886f05a88127d3abc59cbcac80` |
| `main`, conservado sin merge | `6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2` |

El HEAD documental posterior a edb1828 añade conservación de evidencia y este relevo. No cambia `src`, Functions, Rules ni la aplicación aceptada. Consultar `git rev-parse HEAD` para identificar el commit documental recibido; no confundirlo con el SHA de compilación servido por una instancia congelada.

Estado de entregas:

| Entrega / control | Validación técnica | Aceptación humana | Producción |
| --- | --- | --- | --- |
| R01 Seguridad y permisos | VALIDADA_LOCAL según fichas | APROBADA el 21/10 para los cambios revisados | Pendiente / bloqueada |
| R02 Ciclo, captura y Especiales | Gate específico local: 23 PASS, 0 FAIL, 0 inconclusos, salida 0 | A/B 29/10 y corrección de refresco/Bitácora 30/10 aprobadas expresamente | Pendiente / bloqueada |
| Complemento Eliminar usuario | 2 Rules PASS y 10 comprobaciones Functions previas conservadas | Separada; no incluida automáticamente en la aceptación R02 | Pendiente |
| R03 | 10 incumplimientos contractuales abiertos | No aceptada | No preparada |
| R04–R08 | Pendientes según contrato; no inferir cumplimiento por existir pantallas | No aceptadas por este cierre | No preparadas |

No se declara cierre administrativo general de SPAI. Los ocho incumplimientos históricos R02 tienen evidencia de resolución local; los diez R03 continúan abiertos. El antiguo total de 18 es histórico, no un conteo vigente de 18 defectos R02 sin resolver.

## 2. Cómo retomar desde otra cuenta de Codex

En una carpeta nueva, sin sobrescribir los worktrees existentes:

```powershell
git clone --branch codex/e2-r02-cierre-rules-20261030 https://github.com/victoryama-wq/SPAI-TUP.git SPAI-TUP-CONTINUIDAD
cd SPAI-TUP-CONTINUIDAD
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
```

Leer en este orden:

1. Este documento y el [registro de publicación](PUBLICACION-GIT-2026-11-04.md).
2. [Contrato v0.4 y complemento vigente](ETAPA-2-CONTRATOS-ESTABILIZACION.md), [contrato operativo](CONTRATO-CAMBIOS-OPERATIVOS-SPAI.md) y [especificación](SPAI-TUP-SPEC-v2.md).
3. [Cierre R01](E2-R01-CIERRE-2026-10-21.md) y [cierre técnico/aceptación R02](E2-R02-CIERRE-RULES-2026-10-30.md).
4. [Matriz final de Rules](evidence/r02-rules-close-20261030/MATRIZ.md), [gate estructurado](evidence/r02-rules-close-20261030/gate.json) y [guía de reproducción](../tools/e2-r02/rules-diagnostic/README-CIERRE.md).
5. [Complemento de ciclos del 23/10](E2-R02-COMPLEMENTO-2026-10-23.md), [validación R02](E2-R02-VALIDACION.md), [resultados R02](E2-R02-RESULTADOS.json).

Instrucción sugerida para la siguiente cuenta:

> Continúa SPAI-TUP leyendo docs/CONTINUIDAD-SPAI-2026-11-04.md. Verifica rama, HEAD y cambios locales. Conserva la aceptación R01 y R02 y sus instancias congeladas; no reconstruyas sus datos con fixtures. Distingue evidencia histórica, pruebas nuevas y aceptación humana. Propón la siguiente entrega según contratos y solicita autorización de alcance antes de implementar R03 u otra entrega. No hagas merge, despliegue ni conexiones reales. El push del 04/11 fue una autorización puntual de conservación, no una autorización permanente de publicación o producción.

**Git no transporta los datos de los emuladores ni la copia privada.** Si se cambia sólo de cuenta en esta laptop, las carpetas locales pueden reutilizarse después de verificar sus hashes y permisos del sistema. Si se cambia de equipo, deberá transferirse por un medio privado autorizado la exportación que corresponda, o crear una instancia ficticia nueva identificada como tal. No presentar una instancia regenerada como la sesión aceptada.

## 3. Qué se implementó y corrigió

### Base local y contratos

- Entorno local Angular 20/TypeScript, Firebase Auth, Firestore, Storage y Cloud Functions; proyecto ficticio `demo-spai-tup` con servicios en loopback.
- Separación de configuración institucional Google, DEMO/LAN, pasarela HTTPS y pruebas aisladas. Los adaptadores de copia privada no autorizan consultar producción.
- Fixtures, emuladores, caracterizaciones, matriz contractual y CI. Las caracterizaciones del comportamiento existente nunca equivalen por sí solas a cumplimiento del contrato objetivo.
- Conservación de evidencia visual, JSON, logs sanitizados, hashes y declaraciones del propietario.

### E2-R01 — Seguridad, Usuarios y Control de accesos

- Permisos por módulos, capacidades y ámbitos; VIEW no concede escritura. Denegaciones explícitas `NONE`, sesión vigente y autorización en servidor.
- Roles personalizados administrados por ADMIN_GENERAL; auxiliares limitados a roles preaprobados y facultades de una delegación vigente. Revocación, revisiones, caducidad e idempotencia conservadas.
- Transición heredada temporal de siete días mediante correspondencia verificada, con caducidad en servidor; no restaura permisos revocados ni elimina concesiones explícitas válidas.
- Corrección de la llegada al primer módulo autorizado, protección de Dashboard, retiro de datos/suscripciones al cambiar sesión o revocar acceso.
- Bitácora y Solicitudes distinguen carga, vacío, falta de ámbito, denegación y error; no usan ceros para simular consultas fallidas.
- Directorio de Usuarios, ficha y editor institucionales, roles en dos pasos, alcances comprensibles, selección de ciclos y herencia controlada de acceso con vista previa obligatoria. La persona origen conserva su acceso.
- Directorio sin buscador ni filtro de estado residual; ambos estados aparecen dentro del ámbito autorizado. Alcance global explícito se presenta como “Todos”; vacío nunca significa global.
- Acciones compactas con iconos, tooltip, nombres accesibles y foco; modales adaptables, cancelación sin guardar y limpieza de identidad/motivo entre operaciones.

La evolución visual y sus aceptaciones se conservan en las fichas R01; no repetir recorridos físicos ya aprobados sin una regresión concreta. Ver [inventario CO-01 a CO-12 y trazabilidad R01](CO-INVENTARIO-R01.md), [revisión complementaria](E2-R01-REVISION-COMPLEMENTARIA.md) y [validación](E2-R01-VALIDACION.md).

### E2-R02 — Ciclos, captura, Especiales y consulta histórica

- Un único ciclo operativo: PREPARACIÓN, CAPTURA o CAPTURA_CERRADA. CERRADO es histórico. Ambigüedad real bloquea operaciones; no se elige arbitrariamente un ciclo.
- Transiciones autorizadas: iniciar captura; cerrar captura; reabrir con motivo; cerrar definitivamente. Controles de versión, concurrencia, idempotencia y atomicidad de cambio/bitácora/evento en servidor.
- D1: captura cerrada bloquea correcciones académicas ordinarias hasta reapertura. Especiales conserva únicamente la excepción contractual, habilitada para su ficha y con permiso vigente; no habilita captura general.
- Botón Nuevo ciclo visible para quien puede crear, pero deshabilitado con un operativo, carga, error o ambigüedad. Descartar el modal no altera su disponibilidad.
- Máximo dos ciclos según complemento aprobado. Con dos históricos puede abrirse el formulario, pero no crearse un tercero. El histórico inmediato se conserva; el anterior sólo es eliminable cuando es elegible y no tiene dependencias.
- Consulta histórica de Asignaciones de sólo lectura; selector **CICLO DE CONSULTA dentro del panel azul, a la derecha de ESTADO**. El ciclo consultado no cambia el operativo. Se conservan selección válida, ámbito, filtros aplicables y protección contra respuestas tardías.
- Sin tarjeta fija de ciclo operativo. Modal informativo descartable exclusivamente al entrar con CAPTURA; fecha real de cierre de captura o “Sin fecha definida”. No reaparece por refrescos. Las acciones contextuales permanecen en la tabla.
- Confirmación de cierre: “Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.”
- Refresco después de mutación confirmada: nueva consulta autorizada sin vaciar temporalmente el ciclo ni mostrar “Solo consulta” falsamente; bloqueo discreto durante verificación y descarte de respuestas atrasadas.
- Si falla esa consulta: “La operación se confirmó; no pudimos actualizar la vista.” Reintentar actualización consulta únicamente; no repite transición, Especiales ni auditoría.
- Bitácora de operaciones nuevas conserva identidad histórica del actor validado en servidor y datos de operación. La presentación no atribuye el hecho a quien consulta. No se inventaron actores ni descripciones ausentes en registros históricos.

Ver [refresco y evidencia dirigida](E2-R02-REFRESCO-2026-10-30.md), [preproducción local](E2-R02-PREPRODUCCION-2026-10-28.md) y [verificación funcional previa](E2-R02-VERIFICACION-FUNCIONAL-2026-10-26.md). Los documentos anteriores con pendientes reflejan su fecha; el cierre del 30/10 es el registro posterior que resuelve el gate específico.

### Complemento separado — Eliminar usuario

- Confirmación con identidad y motivo, comprobación previa cancelable y con error/reintento; se descartan respuestas tardías y no se habilita la baja tras una verificación fallida.
- Baja en SPAI y eliminación en Authentication, con bloqueo de acceso, protección del último ADMIN_GENERAL, referencias institucionales e historial preservados.
- Recuperación ante fallo parcial y reintentos sin duplicar eventos. La finalización de Authentication se registra después de su resultado, vinculada a la operación y solicitante original; no se sustituye por el usuario que consulta.
- No modifica ni elimina la cuenta institucional Google.

Evidencia Rules separada de R02; diez comprobaciones Functions previas conservadas en el [cierre técnico](E2-R02-CIERRE-RULES-2026-10-30.md). La aceptación humana de este complemento sigue separada y pendiente; no inferirla de las aceptaciones A/B o refresco.

## 4. Evidencia técnica y ocho incumplimientos históricos R02

Se reutilizó evidencia compatible por hash de política, petición e identidad. No se repitieron A/B por el cierre documental/técnico ni se sustituyó aceptación humana por pruebas automáticas.

| ID histórico R02 | Estado al cierre local 30/10 | Evidencia |
| --- | --- | --- |
| CYCLE-MULTIPLE-OPERATIVE | PASS | Lógica de selección, gate histórico 28/10 |
| CYCLE-SELECTION-ORDER | PASS | Rechazo de ambigüedad, misma evidencia |
| CYCLE-WRITE-Preparacion | PASS, antes inconcluso | Matriz final y traza específica |
| CYCLE-CREATE-Preparacion | PASS, antes inconcluso | Matriz final y traza específica |
| CYCLE-WRITE-Captura cerrada | PASS, antes inconcluso | Matriz final y traza específica |
| CYCLE-CREATE-Captura cerrada | PASS, antes inconcluso | Matriz final y traza específica |
| CYCLE-WRITE-Cerrado | PASS, antes inconcluso | Matriz final y traza específica |
| CYCLE-CREATE-Cerrado | PASS, antes inconcluso | Matriz final y traza específica |

Inventario final: 30 observaciones originales, cinco duplicados documentados, 25 casos únicos: **23 R02 + 2 baja**. Los dos casos de lógica no se suman otra vez a los 23 Rules. Se conservaron veinte trazas suficientes y se ejecutaron cinco casos completos adicionales, catorce controles mínimos y ocho pruebas del nuevo gate.

Los seis `INCONCLUSIVE_EVALUATOR` históricos están resueltos en el gate específico con evidencia vinculada; no por recibir HTTP 403. Se exige control positivo, cobertura raíz false de la petición exacta, identidad/política coincidentes, ausencia de cambios indebidos y ausencia de causas de ejecución sin explicar. Los controles deliberadamente inválidos conservan FAIL; el lote mínimo diagnóstico sigue inconcluso bajo el clasificador individual, sin convertirse en un pendiente contractual adicional. D1-BATCH cuenta con sus pruebas constituyentes exactas.

- [Matriz de 25 casos](evidence/r02-rules-close-20261030/MATRIZ.md).
- [Resultados estructurados](evidence/r02-rules-close-20261030/gate.json) y [códigos de salida](evidence/r02-rules-close-20261030/exit-codes.json).
- [Versiones y hashes](evidence/r02-rules-close-20261030/versions.json).
- [Declaración A/B](ACEPTACION-FUNCIONAL-E2-R02-2026-10-29.txt) y [declaración de refresco/Bitácora](ACEPTACION-FUNCIONAL-E2-R02-2026-10-30.txt).

Rules completas cargadas en Windows: SHA-256 `81fe03609738b95902fb54d906d63b408f9017acbab6ba804b2cafb878e045a9`. Git almacena LF; su hash de blob textual difiere del CRLF cargado. El arnés controla esa diferencia de finales de línea sin modificar expresiones de autorización.

Comprobación offline de evidencia, desde un checkout de trabajo nuevo, Node 22:

```powershell
node --test tools/e2-r02/rules-diagnostic/close-gate.test.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs
node tools/e2-r02/rules-diagnostic/close-gate.mjs --user-deletion
```

Estos comandos verifican/recalculan evidencia local, no ejecutan una validación remota de Firebase. Seguir [README-CIERRE](../tools/e2-r02/rules-diagnostic/README-CIERRE.md) para repetir casos en emuladores nuevos. No usar el antiguo `gate.mjs`, atado a otra candidata, como sustituto del cierre vigente. No ejecutar suites sobre instancias aceptadas.

Dependencias reproducibles: Node 22.23.2, Java Microsoft OpenJDK 25.0.2, Firebase Tools 15.30.0, Firestore Emulator 1.22.0, Storage Rules runtime 1.1.3. Instalar con los locks de frontend, Functions y diagnóstico. Ejemplo en un clon nuevo:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/e2-r02/rules-diagnostic --ignore-scripts --no-audit --no-fund
```

Revisar la guía antes de lanzar los emuladores. `local:reset`, `local:seed`, `local:r01:prepare`, los preparadores históricos y `local:data:export --read-online` **no son comandos de reanudación de aceptación**. No ejecutarlos sobre las demos ni contra producción.

## 5. Qué falta para estabilizar SPAI

### Impedimento administrativo de 200 documentos

Las seis colecciones son `usuarios`, `roles_personalizados`, `delegaciones`, `asignaciones_roles`, `revisiones_roles` y `mapeos_permisos`. Cuenta también historia: inactivos, retirados, revocados y revisiones resueltas.

Cada intento de transacción administrativa lee con centinela 201 por colección y rechaza si la suma inicial supera 200, antes de validar la acción o recuperar idempotencia. A 200 puede aceptar una operación que deje más de 200; la siguiente queda bloqueada. El exceso puede impedir **revocar, inactivar o resolver revisiones**. Error: `functions/resource-exhausted`, “Requiere migración administrativa por lotes: límite local de 200 documentos de seguridad.” No produce escrituras parciales.

El directorio tiene otro límite: 200 por cada una de las primeras cinco colecciones, sin suma. Puede fallar incluso para un auxiliar por documentos fuera de su ámbito. No hay paginación institucional completa. Ver detalle y pruebas 199/200/201 en [revisión R01](E2-R01-REVISION-COMPLEMENTARIA.md).

**Pendiente obligatorio de producción:** lecturas dirigidas o procesamiento acotado seguro, revocación disponible a volumen institucional, directorio completo paginado, concurrencia, idempotencia y cero efectos parciales. No aumentar arbitrariamente el límite, truncar resultados o borrar historia para superar el gate.

### R03: diez incumplimientos abiertos

Estos IDs se conservan sin debilitar expectativas, según el [gate histórico](evidence/r02-hallazgos-20261026/contract-gate-final.log):

| ID | Pendiente a tratar en R03 |
| --- | --- |
| REQUEST-TERMINAL-REWRITE | Protección de solicitudes en estado terminal |
| MOODLE-STATUS-RESET-ALLOWED | Conservación del estado de carga Moodle |
| REQUEST-CREATE-AWAITS | Esperar confirmación al crear solicitud |
| REQUEST-RESOLVE-AWAITS | Esperar confirmación al resolver solicitud |
| REQUEST-DUPLICATE-CREATE | Evitar duplicación al crear |
| UI-PREMATURE-SUCCESS | No presentar éxito antes de persistencia |
| SHARE-PRESERVES-MOODLE | Conservar estado Moodle al compartir |
| SHARE-PARTIAL-AND-SUCCESS | No declarar éxito con efectos parciales |
| REQUEST-DOUBLE-ACCEPT | Resolver doble aceptación/concurrencia |
| SHARE-CONCURRENT-LOST-GROUP | Evitar pérdida de grupos por concurrencia |

No se implementa R03 en esta entrega de conservación. La próxima intervención debe partir de sus contratos de asignaciones, solicitudes, efectos y concurrencia; reproducir cada ID, corregir dentro de la entrega y documentar su evidencia. Los seis UNRESOLVED del log antiguo no prevalecen sobre su cierre posterior específico de Rules del 30/10.

### R04 y renovación con datos académicos reales

La renovación funciona localmente cuando el histórico anterior es elegible y está vacío. Si tiene referencias académicas, la eliminación se rechaza y conserva íntegramente sus datos. **Ese bloqueo deja pendiente el flujo completo de renovación cuando sea necesario depurar históricos con datos reales.**

Corresponde a R04 definir/implementar depuración controlada, respaldo externo verificable, restauración probada y reversión conforme a E2-C04/E2-C05. No hay autorización de borrados en cascada ni de eliminar dependencias para volver elegible un ciclo. La bitácora de una eliminación ficticia no sustituye el respaldo externo/restauración de R04.

### Entregas posteriores y producción

| Área | Trabajo pendiente |
| --- | --- |
| R05 | Catálogos/importaciones/Ligas Meet y requisitos de rendimiento aplicables; Ligas Meet corresponde a R05, no R08 |
| R06 | Identidad canónica de docentes, migración y conservación histórica según contrato |
| R07 | Validación transversal, concurrencia, CI y controles de rendimiento; no posponer controles críticos hasta el final |
| R08 | SAEKO, después de las condiciones previas; credenciales sólo en servidor |
| Eliminar usuario | Aceptación humana propia, además de evidencia técnica; recuperación y observación operativa en entorno autorizado |
| Datos históricos | Registros sin identidad/descripcion recuperable conservan su limitación; no inventar ni atribuir al consultante |
| Producción | Validación remota autorizada de Rules/Functions, migración, restauración/reversión, capacidad, configuración institucional y smoke de versión desplegada |

Ningún PASS de emuladores acredita escala productiva, validación del proyecto real ni integraciones reales Moodle/SAEKO. Un push a GitHub tampoco constituye despliegue o aceptación.

## 6. Entornos y preservación de datos

Los worktrees viven en `C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle`. La carpeta de cierre/documentación es `SPAI-TUP-R02-CIERRE-20261030`; las instancias congeladas de aceptación están bajo `SPAI-TUP-R02-RULES-20261028\.local`.

| Instancia | Carpeta local congelada | Pasarela | Slot |
| --- | --- | --- | --- |
| A aceptado | `.local/review-a` | 4208 | acceptance-a |
| B aceptado | `.local/review-b` | 4209 | acceptance-b |
| C, observaciones anteriores | `.local/review-c` | 4210 | acceptance-c |
| D, refresco aceptado | `.local/review-refresh` | 4211 | acceptance-refresh |

La demo antigua 4206 y los entornos anteriores son independientes; no redirigirlos ni asumir que tienen la candidata 4211. El documento histórico de preparación 4204/4206 describe su fecha, no una instrucción para sustituir A/B/D.

**Estado observado el 04/11:** sin listeners de 4211 y de sus emuladores/control consultados; no se inició ni modificó ningún servicio para esta publicación. El enlace HTTPS histórico de 4211 depende de VS Code y de la laptop encendida; no se declara disponible por existir el enlace.

Para D, la exportación local más reciente verificada por el puntero es:

```text
C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-R02-RULES-20261028\
  .local\review-refresh\.local\acceptance-saved\latest.json
  -> saved-1793728963211
  fecha: 2026-11-03T18:02:43.266Z (13:02:43 America/Cancun)
```

Contiene manifestación de siete archivos Auth/Firestore/Storage. Los datos y hashes se conservan localmente; no se incluyen exportaciones en Git. Un `latest.json` posterior prevalecerá tras comprobar su integridad. No restaurar automáticamente el respaldo más antiguo del 30/10 ni la captura histórica del 16/10 sobre esta instancia.

### Reanudación conservadora de D en esta laptop

Estos pasos son una guía para la siguiente sesión, **no se ejecutaron el 04/11**. Confirmar primero que no hay una instancia propia ya activa y usar Node 22. No ejecutar desde el worktree de cierre ni desde otra demo.

```powershell
cd C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-R02-RULES-20261028\.local\review-refresh
$env:SPAI_LOCAL_TEST_ISOLATED='true'
$env:SPAI_LOCAL_SYNTHETIC='true'
$env:SPAI_LOCAL_TEST_SLOT='acceptance-refresh'
node tools/local/acceptance-supervisor.mjs --check
```

El chequeo debe validar la exportación propia y terminar sin iniciar servicios. Si falta exportación o falla un hash, detenerse: no usar seed/reset como alternativa. Después ejecutar el supervisor en una terminal dedicada y conservarla abierta:

```powershell
node tools/local/acceptance-supervisor.mjs
```

Esperar disponibilidad. En otra terminal, misma carpeta y las mismas tres variables:

```powershell
node tools/local/acceptance-gateway.mjs
```

Esperar `PASARELA LISTA 4211`. Verificar `http://127.0.0.1:4211/demo-version.json`: SHA `819e80b3bbcef27279c69608b89f5de8f685ccd0` y compilación aceptada. Los servicios de D son Auth40099, Firestore39080, Functions36001, Storage40199, hub35400, UI35000 y control35310, todos en loopback.

En VS Code, abrir **Puertos → Agregar puerto → 4211**. Para revisión remota se había autorizado visibilidad Pública, exclusivamente para la demo ficticia. Configurar el origen HTTPS exacto en `.local/acceptance-origin.json` de esa instancia; verificar la URL reenviada y `demo-version.json` desde HTTPS. Publicar sólo la pasarela, nunca los puertos de control, hub o administración. La antigua URL `https://q16qrh63-4211.usw3.devtunnels.ms/` debe comprobarse de nuevo; puede cambiar.

### Guardado antes de apagar

El supervisor mantiene exportación propia y acepta `/save` y `/stop` en el control local, autenticados con el token de `.local/session-complement.json`. No copiar ese token a documentos o chat ni exponer el control por túnel. Desde la carpeta D, después de verificar que la sesión es propia:

```powershell
$demoSession = Get-Content .local/session-complement.json -Raw | ConvertFrom-Json
if ($demoSession.projectId -ne 'demo-spai-tup' -or $demoSession.scenario -ne 'acceptance-refresh') { throw 'Instancia incorrecta' }
$demoHeaders = @{ Authorization = 'Bearer ' + $demoSession.token }
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:35310/stop -Headers $demoHeaders
```

Exigir `exported: true` y `stopped: true`, y comprobar el nuevo `latest.json` antes de apagar. Un error no equivale a guardado; conservar los servicios hasta resolverlo. Después detener la terminal de pasarela y el túnel. Para A/B/C usar su propio control/sesión: nunca reutilizar el token o puerto de D. `tools/local/control.mjs` no implementa `save`; no inventar ese comando.

## 7. Documentación recuperada y ramas conservadas

La publicación conserva las once ramas de trabajo por separado; no las mezcla en `main`. [Registro de publicación](PUBLICACION-GIT-2026-11-04.md) identifica sus puntas y comprobaciones. Las ramas iniciales son antecedentes; no asumir que la numeración de un worktree determina cuál es el más reciente.

Se recuperaron 83 documentos/artefactos históricos pendientes desde BAJA, sin sobrescribir archivos de cierre. Su procedencia es el commit `e8a58b25e73e33eff0be0dfce492cdc5d2ad8b0a` de `codex/usuarios-baja-complemento`. Los dos preparadores históricos quedaron en esa rama y no sustituyen los scripts actuales de aceptación.

- [Demo/túnel 22/10](DEMO-TUNEL-2026-10-22.md), [escenario dos ciclos](E2-R02-DEMO-DOS-CICLOS-2026-10-22.md).
- [Selector de consulta 23/10](E2-R02-SELECTOR-CONSULTA-2026-10-23.md), [capturas de posición definitiva](evidence/assignment-cycle-inline/index.html).
- [Aceptación aislada preparada 28/10](E2-R02-ACEPTACION-AISLADA-2026-10-28.md), [evidencia](evidence/r02-acceptance-20261028/index.html).
- [Guardado 22/10](GUARDADO-APAGADO-2026-10-22.md), [23/10](GUARDADO-APAGADO-2026-10-23.md), [26/10](GUARDADO-APAGADO-2026-10-26.md), [reanudación histórica](REANUDACION-DEMO-2026-10-23.md).

Esos documentos preservan errores, limitaciones y resultados de su fecha. No borrarlos para aparentar una historia sin fallos. Capturas HTML se pueden abrir localmente; GitHub puede mostrar su código en vez de renderizarlas.

## 8. Próximo trabajo recomendado

1. Verificar este checkout, SHA y recepción de todas las ramas; conservar las exportaciones fuera de Git. Confirmar qué instancia se necesita antes de iniciar procesos.
2. Revisar/aceptar por separado Eliminar usuario si el propietario lo requiere. No repetir A/B ni refresco aceptados sin regresión.
3. Acordar alcance de R03 con sus diez IDs y contratos, antes de implementarlo. Mantener el gate estricto y pruebas de servidor; UI correcta no prueba autorización.
4. Planificar R04 y resolver el impedimento administrativo de 200 documentos antes de autorizar producción. Preservar D1 y todas las decisiones de ámbitos/delegación.
5. Preparar validaciones remotas, migración/reversión y capacidad sólo con autorización específica. Mantener separados resultados locales, CI, despliegue, smoke y aceptación humana.

La tarea del 04/11 es guardar y publicar trabajo existente y documentación. No introduce funcionalidades, rediseño, cambios de permisos ni nueva entrega académica.
