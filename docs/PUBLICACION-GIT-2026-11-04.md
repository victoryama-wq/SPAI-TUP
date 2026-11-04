# Conservación y publicación Git — 4 de noviembre de 2026

Responsable: Codex, por solicitud expresa del propietario de realizar los commits y push pendientes y entregar un documento de continuidad. Destino: repositorio **público** [victoryama-wq/SPAI-TUP](https://github.com/victoryama-wq/SPAI-TUP).

## Alcance

- Publicación de once ramas `codex/*` con su historia local. Sin force-push, merge, cambio de `main` ni envío a `upstream`.
- Commit de evidencia histórica que estaba sin seguimiento en `SPAI-TUP-BAJA-20261021`, junto con los dos preparadores históricos y exclusiones de exportaciones.
- Reunión de sus 83 documentos y artefactos en la rama de cierre, sin sobrescribir archivos existentes ni incorporar cambios de código de otra rama.
- [Documento de continuidad](CONTINUIDAD-SPAI-2026-11-04.md) y enlace desde README, con versiones aceptadas, pruebas existentes, pendientes y recuperación de emuladores.
- Sin modificaciones de aplicación, Rules, Functions, permisos, datos ni instancias aceptadas. Sin despliegues, conexiones a producción o nuevas pruebas destructivas.

## Inventario de ramas preservadas

Puntas existentes antes del commit documental de continuidad. La punta final de la rama de cierre incluye este documento y se obtiene de Git; el SHA de aplicación aceptada continúa siendo `819e80b3bbcef27279c69608b89f5de8f685ccd0`.

| Rama | SHA preservado |
| --- | --- |
| codex/etapa-0-entorno-local | 3a93ea66e399478cc2d54f2fd2f1b0c387a9c0bc |
| codex/etapa-1-contratos-pruebas | 894be730cd96c94b15b8077c53ed55ccc9610550 |
| codex/e2-r01-seguridad-permisos | 94eeffa90bdb97886f05a88127d3abc59cbcac80 |
| codex/e2-r02-ciclos | ef82fc60d02a2eee8e158f04e1104b8110a4b9a5 |
| codex/e2-r02-captura-especiales | 59a114dade3d7f3152ce3ae270948455ce510006 |
| codex/usuarios-baja-complemento | e8a58b25e73e33eff0be0dfce492cdc5d2ad8b0a |
| codex/e2-r02-preproduccion | 0ead245f2cbb534c5eec8748e4ea8c3af7bebd20 |
| codex/e2-r02-rules-diagnostico | 8ff17862d2ed71758c6c008823e1c87cccf68c3f |
| codex/e2-r02-actualizacion-bitacora | 99903b5d0d9e9b493d24fc7dcd0409b24a4f135b |
| codex/e2-r02-refresco-autorizado | d7bdaf3f325da713a7bbac62a33965d49977ea02 |
| codex/e2-r02-cierre-rules-20261030 | edb1828a6bcaaffa53a4d2e7a8ba47025cef5182 + documentación de continuidad |

`main` se conserva en `6e40eb988f5a9f2d6cb9471595f7383acc3fb5e2`; no se usa como base actual de SPAI estabilización.

## Revisión previa y límites

- Revisión de objetos salientes y de archivos nuevos: patrones de claves privadas, tokens GitHub/Google, JWT, credenciales literales y rutas de exportación privada; revisión de evidencia comprimida gzip. No se detectaron coincidencias en el barrido. Es una revisión acotada, no una certificación universal de ausencia de secretos.
- Los archivos de cuentas de evidencia contienen identidades ficticias, no exportaciones de Authentication. Los emuladores y capturas usan `demo-spai-tup`.
- Se conservaron localmente seis directorios `firebase-export-*` sin seguimiento; se añadieron exclusiones para exportaciones Auth/Firestore/Storage y configuración local de recuperación. No se borraron ni publicaron esos datos.
- `.local`, respaldos privados, selecciones de copia, tokens de sesión, dependencias y configuraciones personales de VS Code permanecen fuera de Git.
- Sintaxis del preparador histórico Node y análisis sintáctico PowerShell: correctos. Revisión de whitespace y enlaces del documento de continuidad. No se repiten suites funcionales aceptadas por un cambio exclusivamente documental.
- El workflow existente de GitHub Actions escucha pushes a `codex/**`; ejecuta compilaciones y pruebas, **no despliega**. La evidencia local anterior no equivale a un resultado nuevo de CI. Su gate contractual general conserva pendientes R03 y no debe debilitarse para obtener verde.

## Comprobación de recepción

La publicación se verifica comparando cada referencia remota con su punta local, además del estado limpio de los worktrees y de `main` sin cambios. Consultar el resultado final de la ejecución y las acciones de GitHub; no inferir éxito de CI a partir de un push exitoso.

```powershell
git fetch origin --prune
git branch -vv
git ls-remote --heads origin
git status --short
```

Para una nueva cuenta de Codex, usar la rama de cierre indicada en el documento de continuidad. Los enlaces locales históricos y exports no se transfieren automáticamente al clonar.
