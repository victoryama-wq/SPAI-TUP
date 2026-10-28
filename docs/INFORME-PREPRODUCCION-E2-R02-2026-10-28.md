Informe de preproducción — E2-R02
Fecha: 28 de octubre de 2026
Entorno revisado: túnel aislado 4206, datos ficticios
Versión expuesta: 5ef70c31a44f
Decisión: no autorizar todavía el paso a producción.
Alcance de esta revisión
Se recorrió la interfaz con el perfil Sistemas ACEPTACIÓN R02 y se contrastó con las sesiones aisladas previas de Coordinación A, Coordinación B, Auxiliar e Inactivo. Se revisaron Dashboard, Usuarios, Ciclos, Nomenclaturas, Grupos, Docentes, Asignaturas, Asignaciones, Solicitudes, Ligas Meet, Moodle y Bitácora.

La revisión no modificó configuraciones ni realizó nuevas operaciones destructivas. La demo ya contenía una prueba autorizada de baja de usuario, cierre de captura y habilitación de Especiales; sus resultados se utilizaron como evidencia.
Resultado funcional visible de R02
Requisito	Resultado	Evidencia observada
Límite visible de dos ciclos	Conforme	Se muestran 2 ciclos: 27-1 operativo y 26-3 histórico. Nuevo ciclo permanece inhabilitado mientras existe el operativo.
Captura cerrada	Conforme	27-1 muestra Captura cerrada; no se abre el modal automático al entrar a Ciclos.
Controles operativos	Conforme	La columna Operación muestra iconos alineados para reabrir, Especiales y cerrar ciclo. Reabrir exige motivo.
Captura ordinaria bloqueada	Conforme	En Asignaciones, Nueva asignación, editar y eliminar ordinarios están inhabilitados con el aviso de captura cerrada.
Especiales	Conforme	El alta se habilita únicamente al seleccionar la ficha Especiales y con Especiales habilitado. Los registros ordinarios permanecen bloqueados.
Consulta histórica	Conforme	CICLO DE CONSULTA permanece dentro del panel azul, a la derecha de Estado, y ofrece 27-1 — Operativo y 26-3 — Histórico.
Históricos de solo lectura	Conforme en interfaz	El ciclo 26-3 se presenta como Solo consulta.
Bitácora de ciclos	Conforme en interfaz	Eventos Start, CloseCapture y Specials muestran actor identificable: Sistemas ACEPTACIÓN R02.
Perfiles	Conforme en la evidencia disponible	Sistemas tiene acceso total; Coordinación A/B quedan acotadas a ADM/DER y sin acceso a Ciclos; Auxiliar queda restringido sin módulos; el inactivo estaba bloqueado antes de la baja de prueba.
Heredar acceso	Conforme en interfaz	El flujo indica que copia configuración efectiva, no identidad/sesiones/historial, exige vista previa y protege a Sistemas como destino.


Hallazgos que impiden cerrar R02 para producción
P0-01 — Faltan pruebas técnicas de servidor
El túnel acredita la interfaz, pero no demuestra las garantías del contrato en servidor. Antes de producción deben ejecutarse y conservar evidencia de:
- concurrencia sobre la misma versión del ciclo;
- unicidad y máximo de dos ciclos con solicitudes simultáneas;
- idempotencia ante doble clic o reintento;
- rechazo de transiciones prohibidas;
- denegación de escrituras directas no autorizadas;
- atomicidad entre cambio de ciclo, bitácora y evento;
- revocación de autorización o deshabilitación de Especiales entre apertura y confirmación.
Estas verificaciones deben realizarse con emuladores o un entorno aislado controlado, nunca sobre datos institucionales.
P0-02 — Falta completar el caso de cierre total y renovación
La demo confirma CAPTURA_CERRADA, pero no se ejecutó el recorrido completo:

CAPTURA_CERRADA → CERRADO → Nuevo ciclo habilitado → creación del siguiente ciclo.

Debe probarse en un fixture aislado, validando también que no queden dos ciclos operativos ni datos mezclados.
P0-03 — Históricos con dependencias: falta evidencia de ambos desenlaces
El histórico actual está correctamente en solo consulta, pero el túnel no permite demostrar:
1. el rechazo de eliminar un histórico con dependencias y la conservación íntegra de sus datos; y
2. la eliminación exitosa de un histórico ficticio elegible, sin dependencias.
La depuración de dependencias pertenece a R04. Mientras ese procedimiento no exista, el rechazo debe ser explícito, seguro y auditado.
Hallazgo del complemento separado «Eliminar usuario»
U-01 — Actor ausente al completar la baja de Authentication
Tras la baja ficticia autorizada, Bitácora registra:
- BAJA USUARIO INICIADA: actor correcto, Sistemas ACEPTACIÓN R02.
- BAJA AUTH COMPLETADA: Usuario no identificado y texto genérico “Movimiento registrado sin descripción”.
La operación de eliminación de Firebase Authentication debe conservar en ambos eventos el actor auditado, su UID, fecha/hora de servidor, motivo y una descripción legible. Este defecto pertenece al complemento Eliminar usuario, pero debe corregirse antes de incluir dicho complemento en una liberación productiva.
Inconsistencias no bloqueantes de interfaz
ID	Hallazgo	Impacto
UI-01	Usuarios muestra 0 Roles disponibles, aunque el directorio de roles muestra la definición activa Consulta DEMO.	Métrica inconsistente; no altera permisos visibles.
UI-02	Algunos módulos muestran durante unos segundos tarjetas vacías o en cero mientras termina la consulta autorizada. Después presentan los datos correctos.	Calidad de carga; conviene usar un estado de carga inequívoco y no cifras provisionales.


Condiciones de salida para producción
R02 podrá proponerse para aceptación humana y liberación solo cuando se adjunte evidencia reproducible de P0-01, P0-02 y P0-03, y se confirme que las correcciones no alteran las protecciones ya aceptadas de E2-R01.

Si se decide incluir el botón Eliminar usuario en la misma liberación, U-01 también es condición de salida. Si no se incluye, debe quedar deshabilitado o excluido explícitamente del paquete de producción.
Conclusión
Los ajustes de interfaz acordados para Ciclos, captura, Especiales y consulta histórica están visibles y se comportan conforme al flujo revisado. Sin embargo, la evidencia actual es insuficiente para certificar las garantías de servidor y aún falta cubrir renovación completa e históricos. Por ello, E2-R02 permanece pendiente de validación técnica y aceptación humana; este informe no autoriza despliegue a producción.