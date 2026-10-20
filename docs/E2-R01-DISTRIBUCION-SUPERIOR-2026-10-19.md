# E2-R01 · Distribución superior de Usuarios

Fecha: 19 de octubre de 2026, America/Cancun. Responsable: Codex, comprobación técnica local. Base: `896edc1dc0ff878d928fbc9a41e2022b4307b861`, rama `codex/e2-r01-seguridad-permisos`; árbol limpio al comenzar. Aceptación visual y humana pendiente del propietario.

## Cambio acotado

La plantilla añade un contenedor exclusivamente alrededor de la tarjeta operativa y las cuatro métricas. Los estilos encapsulados organizan la tarjeta a la izquierda y las métricas 2 × 2 a la derecha, con iguales bordes superior e inferior. Título y descripción preceden a la fila de tres botones. Se conservan colores, iconos, texto de 14 px, peso 800 y espaciado .08em del ajuste anterior basado en Nomenclaturas.

La distribución responde al ancho real del contenedor: desde 1192 px reserva al menos 816 px a la tarjeta y 360 px a las métricas, con 16 px de separación. Por debajo se apilan tarjeta e indicadores; los botones pueden pasar a otras filas sin reducir su tipografía. Las métricas mantienen dos columnas en todos los tamaños comprobados.

No se modificaron bindings, condiciones de visibilidad, cálculo de indicadores, acciones, modales, TypeScript, Rules ni lógica de herencia. La franja azul marino, línea superior, revisiones, filtros y tabla conservan su implementación.

## Evidencia

- [Capturas de escritorio, tableta y móvil](evidence/r01-users-top/capturas.html), inspeccionadas por Codex; no constituyen aceptación del propietario.
- [Resultados](evidence/r01-users-top/results.json): geometría comprobada a 1440, 1280, 1240, 1200, 1024, 768, 390 y 320 px. Sin desbordamiento general ni botones recortados. Tres botones en una fila y bloques alineados donde se activan las dos columnas. Cuatro métricas en 2 × 2 en todos los casos.
- Suite existente `visual-refine.spec.mjs`: **4/4 aprobadas**, conservando pruebas de borrador, navegación, permisos de módulos, directorio/editor, herencia, cancelación y foco, sin escrituras `securityCommand`.
- `ng build --configuration lan --output-path .local/users-top/build-lan`: correcto. `git diff --check`: correcto.
- Ensayos con emuladores sintéticos aislados y frontend 4202. No se restableció la demo compartida.

## Preservación y entrega

Firestore compartido antes/después mantiene SHA-256 `cfd37e58a04ac36d585440cfb76e4bf50313ac34e287fcbc489b1f7591e7a6c3`, incluidas ambas delegaciones y sus revisiones. Los hashes del respaldo privado y su selección coinciden con los de la entrega anterior. Se actualiza solo el frontend compilado, índice al final, conservando servicios y datos.

URL vigente comprobada en el anfitrión: `http://192.168.42.1:4201/usuarios`, interfaz Wi-Fi. Versión servida en `/demo-version.json`; comprobación HTTP de archivos en `.local/users-top/served-verification.json`. No se atribuye una prueba desde otro equipo.

Recorrido visual pendiente: recargar Usuarios; comprobar tarjeta y métricas alineadas en escritorio, tres botones completos en una fila, y apilamiento en tableta/móvil. Confirmar que la franja inferior conserva su aspecto.

Sin push, merge ni despliegue remoto. Sin conexiones a producción, Moodle o SAEKO. Permanecen el límite administrativo de **200 documentos** y los **18 incumplimientos R02/R03**, fuera de este cambio. No se avanza a R02 ni se declara aceptación humana.
