# E2-R02 — Propuesta de alcance: Ciclo y Especiales

Fecha: 2026-10-21. Estado: **PROPUESTA / SIN IMPLEMENTAR EN ESTA ENTREGA**. Punto funcional de partida: R01 `8ae650b8c3c59390a2290bf819d61d195710c35a`, con [aceptación humana registrada](E2-R01-CIERRE-2026-10-21.md). Antes de iniciar se verificará el checkout real y cualquier trabajo posterior; una rama o inspección histórica de R02 no acredita implementación ni permite reemplazar esta base.

Fuentes normativas sin modificar: [Etapa 2 v0.4](ETAPA-2-CONTRATOS-ESTABILIZACION.md), **E2-C02**, autorización por ciclo de **E2-C03**, matriz **E2-C01**, pruebas aplicables **E2-C11** y **CO-01** del [contrato operativo](CONTRATO-CAMBIOS-OPERATIVOS-SPAI.md). Esta propuesta no cambia decisiones de negocio.

## Incluido

| Frente | Resultado objetivo | Comprobación propuesta, todavía no ejecutada |
|---|---|---|
| Unicidad y selección | Como máximo un ciclo actual entre Preparacion, Captura y Captura cerrada. Informar inconsistencias sin elegir por orden; no tomar Cerrado como actual. | Cero/uno/varios candidatos, orden invertido y creación/inicio concurrentes; código único y fechas coherentes. |
| Transiciones | Crear en Preparacion; iniciar Captura; cerrar captura; reabrir con motivo; cierre final desde Captura cerrada. Autoridad, `MANAGE_CYCLES` y ámbito vigentes en servidor. | Positivos y negativos por actor, estado y ámbito; llamadas directas; revocación y concurrencia; rechazo sin cambios parciales. |
| D1 y autorización académica | Fuera de Captura se bloquean las correcciones académicas ordinarias hasta reapertura, incluso docente, grupos y matrículas de CARGADO_MOODLE. UI y servidor deben coincidir. | Formulario preparado antes de cerrar y guardado después; acceso directo; CUSTOM EDIT y VIEW; CA y auxiliar con facultades distintas. Seleccionar un histórico nunca reabre captura. |
| Especiales | En Captura cerrada, habilitación expresa permite solo operaciones autorizadas de asignaciones ESPECIAL y grupos admitidos. Excluir Escolarizado/Ejecutivo. En Cerrado la marca no habilita captura. | Habilitado/deshabilitado, grupo no admitido, asignación ordinaria manipulada, marca residual en Cerrado; ninguna ampliación por pestaña, etiqueta o reclasificación. |
| CO-01: consulta histórica | Selector separa actual e históricos; carga datos del ciclo elegido dentro del ámbito autorizado y conserva consulta/reporte. Aviso bajo filtros sin superposición; histórico sin alta/edición/eliminación/captura académica. | Sin actual, cambio actual/histórico, permisos insuficientes, retirada de datos de selección anterior y regresión móvil. No reconstruir exportadores de R05. |
| Excepciones institucionales | Conservar correcciones extraordinarias de Sistemas/auxiliar solo con capacidad, ámbito, motivo y trazabilidad previstos. No confundirlas con facultades académicas o con seleccionar histórico. | Probar el límite de autorización por ciclo de operaciones existentes. Si requiere un nuevo flujo de conciliación/recuperación, mantenerlo bloqueado y documentar dependencia R03/R04. |

**D1:** Captura cerrada bloquea las correcciones académicas hasta reapertura. La excepción acotada de Especiales definida expresamente en E2-C02/E2-C03 permanece, sin habilitar asignaciones ordinarias. La excepción de matrícula ajena de Coordinación Académica no se extiende a CUSTOM ni auxiliares y también respeta el estado del ciclo. No se cambian datos ni permisos para aparentar cumplimiento.

## Base de incumplimientos que no debe perderse

Fuente: [gate registrado el 20/10](evidence/r01-scope-selector/results.json), salida 1, 18 IDs. Sin nueva ejecución en esta propuesta.

| R02: 8 casos abiertos | Objetivo |
|---|---|
| `CYCLE-WRITE-Preparacion` / `CYCLE-CREATE-Preparacion` | Bloquear captura académica en preparación. |
| `CYCLE-WRITE-Captura cerrada` / `CYCLE-CREATE-Captura cerrada` | Bloquear operación ordinaria; probar Especiales aparte. |
| `CYCLE-WRITE-Cerrado` / `CYCLE-CREATE-Cerrado` | Bloquear captura académica definitiva, incluso con marca especial. |
| `CYCLE-MULTIPLE-OPERATIVE` | Impedir coexistencia y detectar datos inconsistentes. |
| `CYCLE-SELECTION-ORDER` | No seleccionar arbitrariamente por orden. |

R03 conserva sus **10 casos abiertos**: `REQUEST-TERMINAL-REWRITE`, `MOODLE-STATUS-RESET-ALLOWED`, `REQUEST-CREATE-AWAITS`, `REQUEST-RESOLVE-AWAITS`, `REQUEST-DUPLICATE-CREATE`, `UI-PREMATURE-SUCCESS`, `SHARE-PRESERVES-MOODLE`, `SHARE-PARTIAL-AND-SUCCESS`, `REQUEST-DOUBLE-ACCEPT`, `SHARE-CONCURRENT-LOST-GROUP`.

Si una implementación futura acredita los ocho de R02, el gate global deberá seguir fallando por los diez de R03. Cualquier cambio de conteo debe explicar cada ID con evidencia; nunca rebajar expectativas ni borrar casos. Caracterización del comportamiento actual y cumplimiento del contrato se reportan por separado.

## Exclusiones y dependencias

- No rediseñar Usuarios ni repetir recorridos R01 aceptados, salvo regresión concreta. Conservar herencia, previews, idempotencia, permisos y delegaciones.
- R03: flujos de solicitudes, estados terminales, compartición, efectos atómicos y conciliación Moodle. R02 solo incorpora sus restricciones de ciclo, sin rehacer esos flujos.
- R04/E2-C04/C05: recuperación, respaldo verificado y depuración. La retención objetivo de actual + último cerrado **no autoriza borrar ciclos**. Conservar datos adicionales si falta respaldo verificable; sin depuración automática en R02.
- R05: catálogos, importadores, rendimiento y Ligas Meet. R06: identidad docente. R08: SAEKO. Sin conexiones reales.
- El impedimento administrativo de 200 documentos, diagnósticos pendientes de Rules y requisitos de CI remota/migración/reversión siguen abiertos y separados; no se resuelven al aceptar o iniciar R02.

## Secuencia propuesta y criterio de entrega

1. Verificar rama/base/cambios posteriores y trazar operaciones de ciclo en repositorio, UI, Rules y Functions. Reutilizar las pruebas y el modelo R01; no partir de una copia antigua ni tocar la demo compartida.
2. Implementar unicidad y transiciones con validación de servidor y pruebas aisladas de concurrencia.
3. Aplicar D1 y Especiales a todas las rutas existentes de escritura pertinentes; comprobar validación al confirmar, no solo al abrir el formulario.
4. Incorporar CO-01 y la presentación coherente de consulta histórica sin cambiar ámbitos autorizados.
5. Ejecutar pruebas dirigidas, regresiones R01 afectadas, caracterizaciones y gate estricto; compilar y documentar resultados reales, archivos, SHA y limitaciones. Un error del evaluador de Rules no cuenta como denegación válida.
6. Entregar capturas y un recorrido humano limitado a R02. Separar validación local, aceptación humana y producción; preparar reversión local sin alterar datos ni declarar una reversión productiva ensayada.

Solo emuladores y datos ficticios aislados para las escrituras y revocaciones. Demo LAN, sus datos, delegación del propietario, respaldo privado y su selección deben conservarse. Sin reset compartido, push, merge, despliegues ni correos reales. **Ninguno de estos pasos de implementación se ejecuta con esta propuesta.**
