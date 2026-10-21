# Decisión: Eliminar usuario — entrega independiente

Autorizada como decisión funcional por el propietario el 21/10/2026; **NO IMPLEMENTAR EN R02**. No existe autorización de ejecución sobre personas reales.

- Acción compacta «Eliminar usuario», papelera y peligro institucional; exclusiva de ADMIN_GENERAL autorizado.
- Confirmación explícita de persona y motivo. Baja de SPAI y eliminación en Firebase Authentication; desaparece del directorio operativo y pierde acceso efectivo.
- Conservar historial, referencias y registro de baja con identificador histórico no reutilizable; no romper vínculos de bitácora.
- No eliminar ni modificar la cuenta institucional Google.
- Proteger al último ADMIN_GENERAL incluso ante concurrencia. Bloquear sesiones/tokens previos; no basta ocultar la interfaz.
- Bloquear la restitución por login Google o aprovisionamiento automático. Reincorporación solo mediante procedimiento administrativo explícito.
- Coordinar Firestore y Authentication con operación recuperable e idempotente; no existe transacción única entre ambos servicios.
- Si falla Authentication, SPAI permanece bloqueado, baja pendiente de reintento y trazabilidad; no informar eliminación completa hasta verificarla.

Estado: pendiente de entrega propia, diseño técnico y pruebas aisladas. Sin cambios en Usuarios, permisos, identidades o datos por este registro.
