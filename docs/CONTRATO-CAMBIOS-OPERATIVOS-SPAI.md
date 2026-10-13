# Contrato de cambios operativos vigentes — SPAI TUP

Versión: **v1.0**
Fecha: **2026-10-09**
Proyecto: **SPAI TUP — Sistema de Planeación Académica Institucional**

## 1. Propósito y relación documental

Este documento concentra los cambios funcionales y de interfaz ya incorporados
en SPAI para la operación académica del ciclo. Su objetivo es que Sistemas,
Coordinaciones y revisión institucional puedan identificar el comportamiento
vigente sin confundirlo con la hoja de ruta de estabilización.

No sustituye la especificación base
[`SPAI-TUP-SPEC-v2.md`](SPAI-TUP-SPEC-v2.md). Tampoco declara terminados los
controles de servidor, recuperación, depuración, delegaciones o conciliación
versionada definidos en
[`ETAPA-2-CONTRATOS-ESTABILIZACION.md`](ETAPA-2-CONTRATOS-ESTABILIZACION.md).
Cuando exista una contradicción, Etapa 2 prevalece para las entregas futuras de
seguridad y estabilización.

| Alcance | Documento rector |
|---|---|
| Operación que ya puede usarse en SPAI | Este contrato y la especificación base. |
| Seguridad, permisos efectivos en servidor y migraciones | Etapa 2. |
| Diseño técnico, colecciones y comportamiento general | Especificación base. |
| Cursos, participantes y contenido real de Moodle | Moodle; SPAI solo conserva su planeación, estado y exportaciones. |

## 2. Convenciones

- **Vigente**: comportamiento operativo disponible en la interfaz actual.
- **Restringido**: el comportamiento está disponible solo para el rol o ámbito
  indicado; ocultar un botón no reemplaza las validaciones de servidor futuras.
- **Solo consulta**: muestra información sin alta, edición, eliminación ni
  exportación no autorizada.
- **Cargado en Moodle**: estado operativo confirmado desde el flujo Moodle de
  SPAI; no es una prueba automática de que Moodle ya contenga cada cambio
  posterior.
- **Cambio posterior a carga**: modificación de docente, grupo, grupos
  compartidos o matrículas después de que una asignación está cargada.

## 3. Cambios operativos vigentes

### CO-01 — Consulta histórica de asignaciones por ciclo

El módulo **Asignaciones** distingue la captura del ciclo operativo de la
consulta de ciclos cerrados.

| Regla | Comportamiento vigente |
|---|---|
| Selector | Presenta el ciclo actual cuando exista y los ciclos cerrados como opciones históricas separadas. |
| Inicio | No presupone que el último ciclo cerrado sea el actual ni muestra “Consulta histórica” antes de seleccionar un histórico. |
| Histórico seleccionado | Carga las asignaciones, grupos, docentes y matrículas vinculadas a ese ciclo en modo solo consulta y reporte. |
| Encabezado | Muestra el aviso de consulta cerrada debajo de los filtros, sin superponerse con el selector ni con las pestañas de modalidad. |
| Edición | La consulta histórica no habilita alta, edición, eliminación ni captura. |

### CO-02 — Permisos de consulta sobre el catálogo global de asignaciones

Un rol personalizado con acceso de **solo consulta** a Asignaciones puede ver
el catálogo global dentro del alcance que le corresponda.

- No muestra el botón **Nueva asignación**.
- No muestra botones de editar, eliminar ni acciones operativas.
- No obtiene capacidades adicionales por ver el estado, los grupos o el
  docente de una asignación.
- El dashboard y el menú solo presentan los módulos que le fueron otorgados.

### CO-03 — Edición limitada por Coordinación Académica

Durante el periodo de captura autorizado, una Coordinación Académica puede
corregir las asignaciones de sus programas en los campos operativos permitidos:

| Campo | Regla vigente |
|---|---|
| Docente | Puede actualizarse. |
| Grupo base | Puede actualizarse. |
| Grupos compartidos | Pueden agregarse, retirarse o ajustarse conforme al flujo de clases compartidas. |
| Matrículas adicionales | Pueden registrarse y actualizarse. |
| Materia | Protegida; no se edita desde esta facultad. |
| ID Moodle | Protegido; no se edita desde esta facultad. |
| Estado Moodle | Protegido; se opera desde Moodle por Sistemas. |

Las Coordinaciones también pueden registrar **matrículas adicionales** desde
el catálogo global en una asignación ajena cuando sea un caso especial. Esa
excepción no les permite editar docente, grupo, grupos compartidos, materia,
ID Moodle ni estado de la asignación ajena.

### CO-04 — Advertencia de cambios en cursos cargados en Moodle

Antes de que una Coordinación Académica guarde un cambio permitido sobre una
asignación con estado **Cargado en Moodle**, SPAI muestra una advertencia que
requiere aceptación explícita.

La advertencia comunica que:

1. El curso ya fue revisado previamente por Sistemas.
2. El cambio se guarda en SPAI solo si la persona confirma.
3. La actualización correspondiente puede reflejarse en Moodle en un plazo
   máximo operativo de 24 horas.

Al cancelar, no se escribe el cambio. Al aceptar, SPAI conserva los campos
protegidos y registra la edición conforme al flujo actual de bitácora y
notificación.

### CO-05 — Estados Moodle visibles para Coordinaciones

Las asignaciones de Escolarizado, Ejecutivo, Virtual y Salud que Sistemas haya
marcado como cargadas muestran el estado **Cargado en Moodle** también a la
Coordinación Académica que puede consultarlas. La visibilidad del estado no
autoriza a cambiarlo ni otorga facultades de Moodle a la coordinación.

Las pestañas y contadores del módulo Moodle se actualizan al confirmar un lote
de estado, sin requerir que la persona recargue la página manualmente.

### CO-06 — Matriculación Moodle por grupo

El módulo Moodle genera el CSV de cohortes únicamente con asignaciones
vigentes, activas y existentes en Firestore.

| Regla | Resultado |
|---|---|
| Asignación eliminada en SPAI | Se excluye aunque hubiese tenido estado Cargado en Moodle. |
| Clase compartida | Produce una fila por grupo base y una fila por cada grupo compartido. |
| Duplicados idénticos | Se eliminan antes de descargar. |
| Encabezados | `shortname,enrolment_1,enrolment_1_cohortidnumber,enrolment_1_role`. |
| Valores fijos | `enrolment_1=cohort` y `enrolment_1_role=student`. |
| Todos | Exporta las asignaciones vigentes cargadas del ciclo seleccionado. |
| Selección | Exporta exclusivamente las asignaciones marcadas y vuelve a confirmarlas contra Firestore antes de generar el archivo. |

### CO-07 — Matriculación Moodle individual

El CSV individual usa los encabezados `username,course1,role1` y confirma la
lista efectiva de asignaciones en Firestore antes de generar el archivo.

- Excluye asignaciones eliminadas, inexistentes o fuera del estado operativo
  permitido.
- Incluye cada matrícula adicional normalizada; antepone `tup` si la matrícula
  no contiene ya ese prefijo.
- Incluye al docente con rol `editingteacher` solo cuando existe un usuario
  Moodle válido y el docente no es **TEMPORALMENTE SIN DOCENTE**.
- Una asignación sin docente válido ni matrículas adicionales no genera una
  fila vacía.
- Sistemas puede escoger entre exportar todas las asignaciones elegibles o
  solamente las que tengan cambios recientes dentro de las últimas 24 horas.

### CO-08 — Auditoría y trazabilidad de cambios de asignación

Los cambios operativos relevantes sobre asignaciones conservan trazabilidad
para Sistemas. Esto cubre, según el flujo disponible, cambios de docente,
grupo base, grupos compartidos, matrículas adicionales, estatus y eliminación.

Las alertas operativas deben identificar a la persona y el área que realizó el
cambio. Un aviso generado por Sistemas o por un Auxiliar de Sistemas no debe
atribuir la acción a una Coordinación Académica.

> La persistencia atómica de cambio, bitácora y evento de correo, así como la
> conciliación por versión, forman parte de `E2-C03`, `E2-C08` y `E2-C09`; no
> se consideran certificadas únicamente por esta sección operativa.

### CO-09 — Docentes y reportes por coordinación

El catálogo de Docentes incluye exportación del reporte por coordinación y se
normalizan sus valores para que el CSV descargado no quede vacío ni falle por
valores no textuales.

La descarga se inicia mediante un mecanismo compatible con navegador y se
mantiene disponible hasta que este confirme el inicio. Un éxito visual no debe
mostrarse si no se logró generar el archivo.

La corrección de identidad Moodle de un docente —usuario Moodle y correo
institucional derivado— queda reservada para el proceso administrativo que
defina Etapa 2; no debe confundirse con la edición ordinaria de la ficha.

### CO-10 — Dashboard de acceso personalizado y Coordinación de Investigación

Los perfiles de consulta disponen de un dashboard institucional simplificado
que evita repetir tarjetas sin contexto y concentra la información útil para
consulta.

Para Coordinación de Investigación, el panel puede mostrar:

- total de asignaciones de materias de investigación del ciclo;
- total de carreras con registros y desglose por carrera;
- mensaje visible de que el acceso es personalizado y sus módulos son de
  consulta;
- módulos habilitados para consulta;
- recurso gráfico institucional como apoyo visual, sin ocupar espacio
  innecesario ni desplazar las tarjetas principales.

Los datos visibles respetan los módulos y el ámbito concedidos al perfil.

### CO-11 — Administración visual de usuarios y roles personalizados

El alta y la edición de usuarios institucionales se organizan en tres bloques:

1. **Datos de acceso:** nombre, usuario institucional, rol, saludo y estado.
2. **Alcance académico:** programas o nomenclaturas asignadas.
3. **Módulos disponibles:** módulos otorgados y sus permisos visibles.

El administrador de roles personalizados usa un flujo en dos pasos para evitar
formularios saturados:

1. Al abrirlo muestra el directorio de roles existentes y el botón
   **Crear rol**.
2. Al elegir **Editar** o **Crear rol**, muestra solo el editor del rol.

En el editor, cada módulo cuenta con dos controles claros:

| Control | Efecto de interfaz |
|---|---|
| Consultar | Permite dejar habilitada la consulta del módulo. |
| Editar | Activa edición y conserva también Consultar. |
| Quitar Consultar | Retira también Editar en ese módulo. |
| Quitar Editar | Mantiene Consultar si continúa seleccionada. |

El modal se muestra sobre la navegación institucional, conserva encabezado y
acciones visibles, y pasa a una columna en pantalla pequeña. Esta organización
no amplía permisos: el control efectivo de capacidades se implementará y
validará conforme a `E2-C01`.

### CO-12 — Identidad visual y navegación institucional

SPAI conserva la identidad institucional TUP en el acceso, navegación y
favicon del navegador. Los ajustes visuales de navegación no modifican roles,
datos Firestore ni reglas de acceso.

## 4. Restricciones que se mantienen

| Tema | Restricción vigente |
|---|---|
| Asignaciones eliminadas | No deben aparecer en vistas operativas, reportes ni CSV de Moodle. La recuperación privada y la conciliación Moodle se rigen por Etapa 2. |
| Confirmación de guardado | Los avisos de éxito se muestran después de que Firestore confirme la escritura esperada. |
| Materia e ID Moodle | No se cambian por la edición limitada de Coordinación Académica. |
| Estado Moodle | Se actualiza desde el flujo Moodle autorizado, no desde el formulario ordinario de asignaciones. |
| Roles de consulta | No obtienen creación, edición, eliminación ni acciones sensibles por tener visibilidad del módulo. |
| Ciclos cerrados | Se consultan en modo histórico; no habilitan captura por seleccionarlos. |
| Especiales | Su operación y sus límites de ciclo se regirán por `E2-C02` y `E2-C03`; no se infieren por una pestaña visible. |

## 5. Criterios mínimos de comprobación operativa

Antes de declarar una modificación como lista para uso institucional se debe
comprobar, como mínimo:

1. La aplicación compila sin errores bloqueantes.
2. La operación consulta Firestore o confirma la escritura antes de informar
   éxito.
3. Los archivos CSV pueden abrirse y sus encabezados corresponden al tipo de
   exportación seleccionado.
4. Una asignación eliminada no reaparece por datos conservados en memoria.
5. Un rol de solo consulta no muestra ni consigue ejecutar acciones de edición.
6. La vista histórica coincide con el ciclo elegido y no con un ciclo fijado en
   código.
7. Hosting se publica únicamente después de validar el cambio que se pretende
   liberar.

## 6. Exclusiones y siguiente paso

Este contrato registra cambios de operación e interfaz. No certifica todavía:

- reglas Firestore finales por capacidad y ámbito;
- delegaciones de Auxiliares de Sistemas y prevención de autoescalamiento;
- migración segura de permisos heredados;
- papelera privada, restauración y depuración de históricos;
- confirmación Moodle por versión concreta;
- actualización de identidad docente por lotes reanudables;
- integración SAEKO;
- pruebas automatizadas, CI y entorno Firebase separado de producción.

Estos puntos quedan formalmente en la Etapa 2 y deben implementarse en
entregas pequeñas, con evidencia de pruebas y despliegue controlado.
