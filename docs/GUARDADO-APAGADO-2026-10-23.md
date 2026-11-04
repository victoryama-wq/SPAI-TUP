# Guardado y reanudación — 23 de octubre de 2026

Se preservan por separado la demo compartida del túnel y la revisión técnica aislada. No se regeneran fixtures ni se modifica el respaldo privado o su selección. No hay aceptación funcional nueva ni cierre de R02.

## Copias locales

- Código evaluado y evidencia: HEAD `6e237aa8c600b2d744f447c926ae94a1dadb8b0d`, rama `codex/usuarios-baja-complemento`. Los cambios no confirmados se conservan en sus archivos originales y en la copia del árbol de trabajo, sin incorporarlos indiscriminadamente a Git.
- Carpeta de resguardo: `.local/shutdown-20261023/`. Incluye `repository.bundle`, `working-tree.patch`, estado Git, `workspace-and-runtime.zip`, manifiestos SHA-256 y exportaciones referenciadas.
- Demo del túnel: `.local/r02-review/latest.json`; Auth, Firestore y Storage exportados desde su hub verificado 14400. Cinco identidades Auth. El supervisor vuelve a exportar al detenerse; el manifiesto de apagado registra esa copia final.
- Revisión aislada: `.local/r02-complement-20261023/.local/r02-review/latest.json`; exportación del hub verificado 24400, seis identidades Auth. Se conserva el escenario de revisión en Preparación. Los resultados de los ensayos sobre bases temporales permanecen en `docs/evidence/r02-final-review/`; no se presentan como escenarios de aceptación adicionales restaurados.
- Compilación conservada: `dist/spai-tup-r02-tunnel/browser`, versión `tunnel-r02-consulta-inline-20261023-02`. Su metadato de base es `16671e2b5b9021fa2069e2b0587e595338f7fb29` con cambios locales: se conserva literalmente, sin atribuirle artificialmente el SHA documental posterior.
- Configuración conservada: tareas VS Code, origen del túnel, configuraciones locales, código compilado de Functions y configuración sintética local. Las copias de ejecución permanecen ignoradas por Git y no deben publicarse.

La validación de guardado comprueba estructura Auth/Firestore/Storage, hashes, ZIP y comprobación de importación `--check` sin arrancar servicios. No equivale a un ensayo completo de restauración R04 ni a un respaldo externo frente a pérdida del disco.

## Retomar la demo compartida

1. Abrir en VS Code `C:\Users\Admin\Documents\ChatGPT\Api-Spai-Moodle\SPAI-TUP-BAJA-20261021`.
2. Terminal → Ejecutar tarea → **SPAI: Restaurar demo R02 guardada**. Esperar **DEMO R02 RESTAURADA**. Importa la última copia; no carga fixtures.
3. Ejecutar **SPAI: 3 Servir demo para tunel**. Esperar **PASARELA LISTA**. Sirve la compilación preservada en 4206; no es necesario recompilar para recuperar esta versión.
4. En **Puertos**, reenviar **4206** y comprobar visibilidad **Público**, según la configuración autorizada. No reenviar puertos de Firebase.
5. URL previa: `https://q16qrh63-4206.usw3.devtunnels.ms/`. Si VS Code asigna otra URL, ejecutar **SPAI: 4 Autorizar URL del tunel** con el nuevo origen HTTPS.

El túnel requiere VS Code, conexión a Internet y servicios activos. No permanece disponible con el equipo apagado. La sesión de autenticación de VS Code la conserva la aplicación; no se exportan sus credenciales.

## Retomar las pruebas aisladas, cuando se necesiten

Desde la misma carpeta ejecutar **SPAI: Restaurar revision R02 aislada guardada** y después **SPAI: Servir revision R02 aislada**. Acceso local: `http://127.0.0.1:4204/`. El supervisor privado de esta revisión importa su propia exportación y guarda periódicamente. No usar `run.mjs --review` para reanudar porque recrea fixtures.

Para otro apagado, cerrar primero el acceso web y ejecutar **SPAI: Guardar y detener demo R02** y, si está activa, **SPAI: Guardar y detener revision R02 aislada**. Esperar la confirmación de exportación antes de apagar.

Continúan abiertos el límite administrativo de 200 documentos, las limitaciones técnicas documentadas de R02, los pendientes de R03 y la preparación productiva, migración, restauración y reversión. Sin push, merge, despliegue ni conexiones reales.
