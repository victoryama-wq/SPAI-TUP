# Ciclos: tarjeta operativa simplificada — 21/10/2026

Autorización posterior del propietario: retirar ambos mensajes permanentes y conservar el aviso de consecuencias únicamente en el modal. Cambio visual R02 separado de Eliminar usuario.

La tarjeta en Captura contiene sobretexto con código real, título y acción autorizada. Se retira el párrafo sin altura ni margen residual. No se alteran validaciones ni transiciones. Capturas: docs/evidence/e2-r02/header-simplified (1280, 390, 320 px). Inspección del agente, aceptación humana pendiente.

Prueba dirigida reutilizada: cancelación sin comandos, rechazo real 409 por revisión obsoleta con estado Captura conservado; 8 regresiones aprobadas y compilación complement correcta. Evidencia JSON junto a las capturas; logs .local/cycles-simplified-*.

Se añade un tercer preset estrictamente aislado para conservar la LAN: SPAI_LOCAL_TEST_ISOLATED=true, SPAI_LOCAL_SYNTHETIC=true, SPAI_LOCAL_TEST_SLOT=complement; Auth29099/Firestore28080/Functions25001/Storage29199, todos loopback. Frontend: ng serve --configuration complement --host 127.0.0.1 --port 4204. No sustituye 4201/4203 ni sus datos. El validador servidor solo admite tuplas completas declaradas, sin mezclar puertos. Los presets previos conservan sus valores.

Base: 59a114dade3d7f3152ce3ae270948455ce510006. Rama codex/usuarios-baja-complemento, checkout SPAI-TUP-BAJA-20261021. R02 conserva sus comprobaciones inconclusas y producción pendiente. Sin push, merge ni despliegue.
