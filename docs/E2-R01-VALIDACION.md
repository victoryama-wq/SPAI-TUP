# E2-R01 — Ficha y evidencia local

Fecha: 2026-10-12. Estado: **VALIDADA_LOCAL**.

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

## Comandos y resultados

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

1. Usuarios → definir rol; probar Editar/Consultar y quitar Consultar. Preparar un rol con grupos VIEW, programa ADM y sin módulos reservados; indicar motivo y confirmar.
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
- **R04–R08:** recuperación/depuración, paginación/importadores/catálogos, flujos completos de docentes e identidad Moodle, conciliación y Meet. SAEKO pendiente.
- **CI remota:** workflow preparado y validado estáticamente; no ejecutado en GitHub porque no se publicó la rama. El job estricto de contratos seguirá rojo por los 18 casos posteriores.
- **Producción:** no probada, migrada ni desplegada. Límite administrativo local de 200 documentos y límites de consultas descritos en la matriz. El presupuesto del bundle genera advertencia. La prueba UI automatizada y la inspección de su captura no equivalen a aceptación manual del propietario.
