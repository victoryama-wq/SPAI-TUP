# Hallazgos de prueba manual — E2-R01

**Proyecto:** SPAI TUP  
**Entrega evaluada:** E2-R01 — Seguridad, permisos y administración de usuarios  
**Fecha de ejecución:** 14 / 10 / 2026  
**Responsable de la prueba:** Codex, con navegador integrado y datos DEMO  
**Entorno:** DEMO LAN — `http://192.168.41.254:4201/`  
**Datos usados:** Exclusivamente datos ficticios  
**Estado general:** `EN EJECUCIÓN`

> Este reporte parte del guion de prueba recibido. Los resultados deben
> registrarse con evidencia; una prueba pendiente no debe considerarse
> correcta ni fallida.

---

## 1. Resumen ejecutivo

| Indicador | Cantidad |
|---|---:|
| Pruebas planificadas | 11 |
| Correctas | 7 |
| Con hallazgos | 3 |
| Fallidas | 0 |
| Pendientes | 1 |
| Hallazgos críticos | 0 |
| Hallazgos altos | 1 |
| Hallazgos medios | 2 |
| Hallazgos bajos | 1 |

### Conclusión preliminar

La prueba confirma que la demo LAN funciona desde otra laptop, conserva la
sesión al recargar, adapta Usuarios y Roles a pantalla pequeña, aísla las
vistas por perfil y aplica revocaciones en una sesión abierta. La cuenta
`Consulta R01 DEMO` ya se autentica y conserva la consulta restringida. Aún no
se puede aceptar E2-R01: falta corregir los hallazgos de estilo y el dashboard
que se muestra indebidamente al rol de consulta, además de comprobar T10.

No se recomienda autorizar producción hasta completar los escenarios de acceso,
roles, sesión y revocación, documentar sus evidencias y resolver los fallos que
se identifiquen.

---

## 2. Alcance evaluado

La validación cubre los siguientes comportamientos:

- acceso a SPAI desde otra computadora conectada a la LAN;
- bloqueo de usuarios inactivos;
- comprensión y accesibilidad del formulario de usuarios;
- directorio, edición y persistencia de roles personalizados;
- relación entre permisos **Consultar** y **Editar**;
- adaptación del formulario a pantalla pequeña;
- aislamiento de información y menús al cambiar de sesión;
- acceso de consulta por ámbito para un rol personalizado;
- flujos propios de Coordinación Académica;
- revocación de facultades de un Auxiliar de Sistemas con sesión abierta.

---

## 3. Registro de ejecución de pruebas

Usar uno de estos estados por prueba: `CORRECTA`, `FALLÓ` o `PENDIENTE`.

| ID | Prueba | Cuenta / equipo usado | Resultado esperado | Estado | Resultado observado y evidencia |
|---|---|---|---|---|---|
| R01-T01 | Acceso desde otra computadora | Laptop física conectada a LAN | Inicia sesión, permite navegar por Usuarios y Asignaciones, y recargar sin errores ni espera indefinida. | CORRECTA | Prueba ejecutada por usuaria desde otra laptop LAN: el acceso, navegación y recarga funcionaron sin espera indefinida. |
| R01-T02 | Usuario inactivo | Usuario inactivo DEMO | No puede operar ni consultar información protegida. | CORRECTA | Mostró “Acceso pendiente”; indicó que Sistemas debe activar el usuario y no expuso navegación ni datos institucionales. |
| R01-T03 | Formulario de usuarios | Sistemas DEMO | Se distinguen Datos de acceso, Alcance académico y Módulos; campos, mensajes y acciones son comprensibles. | CORRECTA CON HALLAZGO | La estructura funcional mostró los tres bloques, explicación, motivo y acciones Revisar/Cancelar. La presentación visual de las vistas de perfil no conserva los estilos institucionales esperados; ver R01-H001. |
| R01-T04 | Directorio y editor de roles | Sistemas DEMO | Primero se ve el directorio; Crear rol o Editar abre el editor. El modal queda sobre la navegación y permite llegar a sus acciones. | CORRECTA | Se abrió el directorio; Crear rol mostró el editor. El modal quedó por encima de la navegación y conservó sus acciones visibles. |
| R01-T05 | Relación Consultar / Editar | Sistemas DEMO | Activar Editar activa Consultar; quitar Consultar también quita Editar. | CORRECTA | En Asignaciones, activar Editar dejó Consultar=1 y Editar=1; al quitar Consultar ambos regresaron a 0. |
| R01-T06 | Guardado y cancelación | Sistemas DEMO | El rol ficticio `PRUEBA-R01-Consulta` persiste. Al cancelar una edición, conserva los valores anteriores. No hay mensaje falso de éxito. | CORRECTA | Se creó `PRUEBA-R01-Consulta` con ámbito ADM y consulta en Asignaciones; apareció “Operación confirmada y auditada”. Tras cambiar ADM a ADM,DER y cancelar, al reabrir persistió ADM. |
| R01-T07 | Vista móvil y pantallas pequeñas | Validación reportada por usuaria | La vista pasa a una columna y encabezado, campos y acciones continúan accesibles. | CORRECTA CON HALLAZGO | Los campos, encabezados y botones ya son accesibles en pantallas pequeñas. Persisten diferencias de estilo entre Usuarios/Roles y el resto de SPAI; ver R01-H001. |
| R01-T08 | Cambio de sesión | Sistemas, Auxiliar, Coordinación A/B e Inactivo DEMO | Cada cuenta ve solo sus facultades y no conserva menús ni datos de la sesión anterior. | CORRECTA | Se alternó entre las cinco cuentas. Sistemas mostró navegación completa; Coordinaciones solo módulos académicos y su programa ADM/DER; Inactivo quedó bloqueado; Auxiliar no tuvo directorio autorizado. |
| R01-T09 | Rol personalizado de consulta | Consulta R01 DEMO | Solo consulta el ámbito concedido; no crea, edita, elimina ni accede a rutas de módulos no concedidos. | CORRECTA CON HALLAZGOS | La consulta limitada funcionó como se esperaba. Sin embargo, el inicio muestra un Dashboard no autorizado con métricas generales y el nombre largo se sale de proporción; ver R01-H002 y R01-H003. |
| R01-T10 | Coordinación Académica | Coordinación A y Consulta R01 DEMO | Puede realizar sus flujos permitidos y la consulta global de matrícula aprobada, sin trasladar esta excepción a otros roles. | PENDIENTE | Coordinación A mostró “Catálogo global” y la asignación ADM con matrícula demo. Falta contrastar el mismo escenario con Consulta R01 DEMO y confirmar que no obtiene la excepción de matrícula global. |
| R01-T11 | Revocación del auxiliar | Sistemas DEMO + Auxiliar DEMO en otra laptop LAN | Al revocar la delegación, el auxiliar pierde las facultades retiradas aun con sesión abierta. Los roles previos permanecen con revisión pendiente para Administración General. | CORRECTA | Validada en tiempo real desde otra laptop conectada a la LAN: tras la revocación, la sesión abierta actualizó su panel y dejó visibles únicamente los módulos autorizados por el rol efectivo. |

---

## 4. Hallazgos confirmados

Los tres primeros hallazgos corresponden a la experiencia de E2-R01. El cuarto
corresponde a R02/R03 y define una regla operativa obligatoria del ciclo; se
comprobó sin guardar cambios, pero debe corregirse antes de habilitar la
operación del ciclo.

| ID | Severidad | Prueba relacionada | Hallazgo comprobado | Impacto | Evidencia | Estado / responsable |
|---|---|---|---|---|---|---|
| R01-H001 | Media | R01-T03, R01-T07 | Usuarios y Roles ya se adaptan a pantallas pequeñas, pero sus estilos visuales no son consistentes con el resto de SPAI. | Reduce consistencia institucional y comprensión de la interfaz administrativa. | Validación reportada por usuaria en escritorio y pantalla pequeña. | Abierto; homologar estilos de Usuarios y Roles con el diseño institucional de SPAI. |
| R01-H002 | Media | R01-T09 | `Consulta R01 DEMO` inicia en un Dashboard, aunque ese módulo no forma parte de su acceso personalizado. El dashboard muestra métricas generales de usuarios, ciclos y asignaciones. | Expone información agregada fuera del módulo autorizado y contradice el principio de mínimo privilegio. | Captura proporcionada por usuaria: después de iniciar sesión como Consulta R01 DEMO se muestran tarjetas de métricas y el panel operativo. | Abierto; redirigir al primer módulo autorizado (Asignaciones) y bloquear Dashboard para roles sin permiso explícito. |
| R01-H003 | Baja | R01-T09 | En el Dashboard mostrado a `Consulta R01 DEMO`, el nombre largo desborda y se sobrepone con los datos del panel operativo. | Afecta legibilidad y presentación institucional. | Captura proporcionada por usuaria, panel “Bienvenida, Consulta R01 DEMO”. | Abierto; aplicar truncado, ajuste de línea o diseño responsivo al nombre de perfil. |
| R02-R03-H001 | Alta — fuera de alcance R01 | R01-T10 / E2-R02-R03 | Con el ciclo `26-3` en **Captura cerrada**, Coordinación A DEMO pudo abrir **Editar asignación** de una asignación ordinaria `EN REVISION`; el modal mostró campos editables y el botón Guardar cambios activo. Además, Sistemas no cuenta en Ciclos con la opción para habilitar explícitamente la captura de **Especiales**. No se intentó guardar. | Se rompe la regla de cierre: las asignaciones ordinarias deberían quedar solo consulta. La única excepción debe ser Especiales, habilitada expresamente por Sistemas desde Ciclos. | Ruta Asignaciones → Coordinación A DEMO → asignación `demo-asignacion-cerrada` → Editar; se cerró con Cancelar sin persistir. Hallazgo adicional reportado por usuaria: falta el control de habilitación de Especiales en Ciclos. | Abierto; corregir E2-R02/R03 y verificar cliente y servidor. |

### Formato detallado por hallazgo

Copiar este bloque por cada hallazgo confirmado:

```md
### R01-HXXX — Título breve del problema

- **Severidad:** Crítica / Alta / Media / Baja
- **Prueba relacionada:** R01-T__
- **Cuenta utilizada:**
- **Equipo o navegador:**
- **Precondición:**
- **Pasos para reproducir:**
  1.
  2.
  3.
- **Resultado observado:**
- **Resultado esperado:**
- **Impacto operativo o de seguridad:**
- **Evidencia:** captura, video, mensaje de error, hora y URL/ruta.
- **Reproducibilidad:** Siempre / Intermitente / Una vez
- **Estado:** Abierto / En análisis / Corregido / Verificado
- **Responsable sugerido:**
- **Criterio para cerrar:**
```

---

## 5. Riesgos y dependencias conocidos antes de concluir la prueba

Estos puntos provienen del guion de validación. No son defectos confirmados por
esta ejecución, pero condicionan la aceptación de la entrega.

| ID | Riesgo o dependencia | Efecto si no se atiende | Acción necesaria |
|---|---|---|---|
| R01-D01 | Cuenta autenticable de rol personalizado. | Riesgo mitigado: `Consulta R01 DEMO` existe y pudo iniciar sesión. | Conservar la cuenta en la demo para regresiones de R01-T09. |
| R01-D02 | Revocación en sesión abierta. | Riesgo mitigado: ya se validó desde dos equipos LAN. | Conservar la evidencia de la prueba y repetirla después de cambios en delegaciones o autenticación. |
| R01-D03 | Acceso LAN desde otra computadora. | Riesgo mitigado: R01-T01 se ejecutó correctamente desde otra laptop. | Repetir la prueba después de cambios en red, autenticación o despliegue de demo. |
| R01-D04 | El límite administrativo de 200 documentos continúa pendiente. | La aceptación de la demo no autoriza producción. | Resolver y probar ese límite antes de liberar producción. |
| R01-D05 | Hay 18 incumplimientos conocidos asociados a R02/R03. | Permanecen abiertos aunque R01 resulte correcto. | Mantenerlos fuera del cierre de R01 y programarlos en sus entregas correspondientes. |
| R01-D06 | Captura cerrada y reapertura pertenecen a otra entrega. | No deben evaluarse ni declararse resueltas mediante esta prueba. | Validarlas en la entrega que corresponda. |
| R01-D07 | Disponibilidad de emuladores DEMO. | Riesgo mitigado: T09 pudo realizarse posteriormente. | Mantener `npm run local:emulators` activo mientras continúen pruebas compartidas. |

---

## 6. Criterios de aceptación de E2-R01

La entrega puede pasar a revisión técnica solo cuando se cumpla todo lo
siguiente:

- [x] R01-T01 se ejecutó desde una segunda computadora LAN con evidencia.
- [x] R01-T02 comprobó el bloqueo efectivo de un usuario inactivo.
- [x] R01-T03 a R01-T08 cuentan con resultado y evidencia. T03/T07 conservan R01-H001 de consistencia visual.
- [x] R01-T09 se ejecutó con Consulta R01 DEMO; conserva R01-H002 y R01-H003 abiertos.
- [ ] R01-T10 confirmó que la excepción de matrícula global no se filtra a
      roles que no corresponden.
- [x] R01-T11 confirmó la revocación efectiva en una sesión abierta desde otra laptop LAN.
- [ ] Todos los hallazgos críticos y altos asignados a E2-R01 están corregidos y verificados.
- [ ] La conclusión indica claramente si la entrega queda `VALIDADA_LOCAL`,
      `PENDIENTE` o `RECHAZADA`.

## 7. Conclusión final de la prueba

**Resultado de la entrega:** `PENDIENTE`

**Decisión:**

- [ ] `VALIDADA_LOCAL` — Cumple los criterios definidos y no hay fallos
      críticos ni altos abiertos.
- [ ] `PENDIENTE` — Faltan escenarios, evidencias o dependencias por resolver.
- [ ] `RECHAZADA` — Existe un fallo crítico o alto que impide continuar.

**Resumen de la decisión:**

> T01, T03/T07, T09 y T11 ya cuentan con evidencia de aceptación manual. La
> entrega sigue pendiente por T10 y por los hallazgos abiertos de E2-R01:
> consistencia visual de Usuarios/Roles, Dashboard expuesto a un rol de consulta
> y desbordamiento del nombre de perfil. El rol ficticio
> `PRUEBA-R01-Consulta` se mantiene en la demo como evidencia de R01-T06. El
> defecto R02-R03-H001 permanece fuera de alcance de R01: se debe comprobar que
> servidor y cliente bloqueen asignaciones ordinarias con captura cerrada y
> permitan Especiales solo tras la habilitación expresa de Sistemas.

**Validó:** ____________________  
**Fecha:** ____ / ____ / 2026  
**Siguiente acción acordada:** ____________________
