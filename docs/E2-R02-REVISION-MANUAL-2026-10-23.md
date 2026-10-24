# Informe de validación funcional — E2-R02

**Fecha:** 23 de octubre de 2026. **Procedencia:** informe corregido entregado por el propietario en este chat; incorporado por Codex conservando su alcance y estados. **Entorno:** DEMO R02 · TÚNEL, escenario r02-two-cycles-v1. **Perfil:** Sistemas DEMO / Coordinación de Sistemas.

**Resultado de aceptación: no procede todavía el cierre formal de E2-R02.** Esta incorporación no implica aceptación funcional ni sustituye las pruebas técnicas. La revisión observó la versión `tunnel-r02-consulta-inline-20261023-02`: base `16671e2b5b9021fa2069e2b0587e595338f7fb29` más cambios locales, sin un commit exclusivo de esa compilación. Referencia técnica: `evidence/assignment-cycle-inline/tunnel.json`. No se atribuye al propietario la evaluación de un SHA posterior.

## Alcance y método

Revisión funcional no destructiva desde la interfaz. No se confirmó creación, cierre ni eliminación de registros. No se ejecutaron concurrencia, solicitudes directas a Firebase ni cambios que borraran datos o cuentas. **No comprobable** significa ausencia de evidencia en esa sesión; no constituye por sí solo un incumplimiento.

## Evidencia observada

Dos ciclos CERRADOS: 27-1, último histórico de consulta; 26-3, histórico anterior susceptible de eliminación. NUEVO CICLO informa el límite de dos y bloquea GUARDAR CICLO hasta eliminar el anterior. Solo 26-3 muestra Eliminar ciclo histórico; 27-1 indica Solo consulta. Elegibilidad visual no acredita ausencia de dependencias.

En Asignaciones, cambiar 27-1 a 26-3 actualizó tabla, contadores y seguimiento; creación, edición y eliminación permanecieron bloqueadas. CICLO DE CONSULTA está dentro del encabezado azul, a la derecha de ESTADO; no debe volver a una franja independiente.

En Usuarios, Eliminar usuario abre confirmación con identidad, motivo obligatorio y efecto declarado: retirar SPAI y Firebase Authentication, conservar historial y referencias y no modificar Google institucional. El botón final permanece deshabilitado sin motivo. No se confirmó ninguna baja.

## Matriz de revisión humana

| Criterio | Estado comunicado | Evidencia / límite |
|---|---|---|
| Máximo de dos ciclos | Parcialmente comprobado | Dos registros; tercer alta bloqueada en formulario. Falta servidor y concurrencia. |
| Eliminación controlada del anterior | Parcialmente comprobado | Solo 26-3 muestra acción; motivo 4–1000 caracteres y aviso de dependencias. Falta rechazo conservando datos y eliminación positiva ficticia sin dependencias. |
| Históricos de solo lectura | Comprobado en interfaz | Cambio de ciclo sin mezcla de datos; acciones académicas deshabilitadas. |
| Ubicación del selector | Comprobado | Dentro del azul, derecha de ESTADO. |
| Captura bloqueada fuera de CAPTURA | Parcialmente comprobado | Históricos bloqueados; no había CAPTURA_CERRADA. |
| Modal de entrada en Ciclos | No comprobable | No había CAPTURA para verificar apertura ni contraste con CAPTURA_CERRADA/CERRADO. |
| Reabrir, Especiales y cierre definitivo | No comprobable | Sin operativo; requiere transiciones consecutivas o escenarios aislados. |
| Especiales en su ficha y habilitación vigente | No comprobable | Sin CAPTURA_CERRADA/Especiales. Ese estado nunca coexistirá con otro operativo. |
| Bitácora atómica | No comprobable | Ninguna transición/eliminación ejecutada. |
| Rules/Functions contra solicitudes directas | No comprobable | La interfaz no certifica backend. |
| Concurrencia e idempotencia | No comprobable | Requiere sesiones o pruebas sobre la misma versión. |

## Complemento separado: Eliminar usuario

Apariencia y preconfirmación presentes. Sigue pendiente certificar eliminación real de Authentication y revocación; preservación del historial y referencias; protección del último ADMIN_GENERAL; bitácora con actor, fecha, hora y motivo. No inferir estos efectos del texto del modal.

## Pendientes y condición de aceptación

No se confirmó un incumplimiento funcional nuevo. Falta evidencia suficiente para cerrar transiciones reales, CAPTURA_CERRADA, Especiales, bitácora, Rules/Functions, concurrencia e idempotencia. **R02 no está aceptado.**

Los ocho incumplimientos históricos R02 quedan pendientes de revalidación individual, sin reducción por esta revisión. Los diez R03 no se revisaron y permanecen sin actualización.

Antes de aceptar: revisar evidencia técnica vigente; disponer de CAPTURA y CAPTURA_CERRADA mediante escenarios aislados o transiciones del mismo ciclo; probar Especiales, doble envío/reintento, cierre simultáneo y revocación; comprobar Rules y transacciones con versión/bitácora; separar rechazo por dependencias y eliminación elegible; comprobar baja real ficticia y último ADMIN_GENERAL. Nunca coexistirán dos operativos en un escenario válido. Puede prepararse trabajo posterior, pero no declararse cierre funcional de R02 ni implementarse R03 por esta revisión.
