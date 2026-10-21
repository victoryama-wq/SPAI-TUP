# Regresión puntual de Usuarios: filas incompletas

Fecha: 21 de octubre de 2026. Base: 3d072971265e2a602c7178ceb66337cc55a81d58. Corrección de Usuarios/R01, separada del alcance funcional R02. Validación técnica: Codex; aceptación humana pendiente.

## Causa comprobada

Reproducción en la demo LAN R02 (4203), con lectura del directorio autorizado y comparación de los documentos sintéticos del emulador aislado. Hay 19 registros canónicos, no placeholders de carga. El documento ficticio `usuarios/stage1-legacy` conserva únicamente `email` y `authUid`; faltan nombre (`name`), perfil (`role`/`baseRole`) y estado (`status`). El caso contractual de `tools/stage1/rules.mjs:138` prepara intencionalmente ese documento incompleto. La respuesta securityDirectory conserva esos campos, añade el ID real del documento y calcula effectiveAccess; no elimina la identidad de un registro completo.

`initials(user.name)` ejecutaba `trim()` sobre undefined. El TypeError interrumpía la actualización del template: la fila incompleta y la siguiente aparecían sin terminar, aunque sus botones ya existían. La siguiente corresponde a `stage1-systems` y sí tiene nombre, correo, perfil y estado. No es una segunda persona incompleta, ni un skeleton, ni una respuesta antigua comprobada como causa. [Evidencia de causa](evidence/r01-incomplete-directory/causa.json).

## Corrección

- Iniciales tolerantes a valores ausentes o inválidos; el render continúa para todas las filas.
- Mensaje «Registro de usuario incompleto» y detalle de campos faltantes; «Perfil no informado» y «Sin estado informado», sin identificadores técnicos en la tabla. Estado ausente no se presenta como cuenta inactiva ni como acceso habilitado.
- Ver acceso exige directorio confirmado, operador activo autorizado, fila perteneciente al resultado vigente, ID no vacío/único y correo no vacío/único. En el registro observado se permite consultar por su correo y documento inequívocos; no concede acceso al titular. Una fila sin identidad suficiente tiene el botón deshabilitado y también se rechaza en el manejador.
- La ficha se selecciona por el ID de la fila vigente. Un intento inválido limpia la ficha anterior. No se permiten editar perfiles incompletos con valores por defecto; no se rellenan ni modifican registros.
- La respuesta y las filas se asocian a la identidad de sesión que solicitó el directorio; una respuesta tardía de otra identidad se descarta. Recargar retira una ficha anterior.
- El total cuenta los 19 registros persistidos autorizados, incluido el incompleto; no se oculta ni elimina. Durante carga/error se muestran guiones y no hay filas/acciones ficticias.

## Pruebas y evidencia

20/20 pruebas unitarias y regresiones de permisos/sesión aprobadas: incomplete-directory.test.mjs, session-lifecycle.test.mjs y policy.test.mjs. Compilación LAN correcta.

[Comprobación en navegador](evidence/r01-incomplete-directory/resultados.json): render completo sin TypeError; tres fichas consecutivas corresponden a la fila seleccionada, incluida la incompleta; recarga; carga lenta; fallo de consulta y reintento; cambio real Sistemas → Consulta mientras hay una respuesta de directorio pendiente; sin ficha ni directorio de la sesión anterior. Se inyecta además una fila ficticia sin identidad solo en la respuesta del navegador, sin escribir en Firestore, y se verifica el bloqueo del botón. La comparación de todos los documentos de usuarios antes/después es idéntica. No se ejecutan reset ni fixtures de escritura.

[Captura del resultado](evidence/r01-incomplete-directory/directorio-corregido.png), inspeccionada por el agente. No equivale a aceptación del propietario. Logs locales: .local/users-incomplete-unit.log y .local/users-incomplete-build.log.

Archivos de producto: security-console.component.ts y security-console.component.html. Se añaden dos pruebas dirigidas en tools/e2-r01 y esta evidencia. No se cambian estilos, Rules, Functions, contratos, datos, delegaciones ni lógica de herencia. No se implementa Eliminar usuario.

La corrección se sirve en la demo R02 4203, preservando sus servicios y datos. La demo R01 4201 y su checkout permanecen intactos, al igual que el respaldo privado y su selección. Sin push, merge ni despliegue remoto. Se mantienen los pendientes de R02/Rules, los diez incumplimientos R03, el límite administrativo de 200 documentos y las validaciones productivas.

## Recorrido del propietario

Recargar Usuarios en 4203. Al final del directorio, comprobar el aviso del registro incompleto y la identidad visible de la fila posterior. Abrir y cerrar sus fichas consecutivamente y comprobar el correo del destinatario. No es necesario repetir los recorridos físicos R01 ya aceptados.
