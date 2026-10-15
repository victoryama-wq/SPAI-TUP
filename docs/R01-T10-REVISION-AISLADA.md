# T10 — confirmación humana aislada

Escenario exclusivamente ficticio de R01. No usa ni reinicia los emuladores compartidos en 8080/9099, no cambia `.local/data-source.json` y no importa el respaldo privado. No comprueba cierre de captura ni Especiales.

## Preparar

Desde PowerShell, en la carpeta SPAI-TUP, con Node 22 activo:

En este equipo las pruebas utilizaron Node 22 en `C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe`. Si la terminal usa otra versión, se puede sustituir `node` en los dos comandos siguientes por `& 'C:\Users\Admin\AppData\Local\npm-cache\_npx\5dad66f2cb301fc2\node_modules\node\bin\node.exe'`, sin cambiar la instalación global.

```powershell
$env:SPAI_LOCAL_TEST_ISOLATED = 'true'
$env:SPAI_LOCAL_SYNTHETIC = 'true'
node tools/local/run.mjs --review
```

Esperar **«T10 listo»**. En otra terminal, también con Node 22 y en la misma carpeta:

```powershell
node node_modules/@angular/cli/bin/ng.js serve --configuration isolated --host 127.0.0.1 --port 4202
```

Abrir `http://127.0.0.1:4202/`. Esta instancia es local al anfitrión; la demo de compañeros sigue en `http://192.168.41.254:4201/`. No ejecutar la suite automatizada simultáneamente con esta revisión: ambas usan los puertos aislados. Si el puerto está ocupado, detener la revisión anterior, no otros procesos.

La preparación crea el mismo documento de `t10-fixture.mjs` usado por la prueba automatizada: `acceptance-foreign`, DER, ciclo **27-1**, estado **Captura**, autor Coordinación B. La asignación ADM original permite contrastar los ámbitos. Si ya existe el escenario, el script se detiene sin sobrescribirlo.

## Repetir y registrar

1. Entrar como **Coordinación A DEMO**, ir a Asignaciones, ciclo 27-1 → Catálogo global. Abrir `acceptance-foreign` (DER). El formulario debe permitir **Matrículas adicionales**; no cambiar docente, materia, ID Moodle, grupos ni estado. Escribir `DEMO-HUMANO-001`, guardar y recargar. Comprobar que persiste el texto. Se conserva la normalización a mayúsculas ya existente de este formulario.
2. Salir y entrar como **Consulta R01 DEMO**. Debe llegar directamente a Asignaciones; solo ADM / 27-1, sin DER ni `acceptance-foreign`, ni acciones de escritura. Abrir `/dashboard`, recargar y usar atrás/adelante: debe conservar un módulo permitido, sin Dashboard.
3. Salir y entrar como **Auxiliar DEMO**. Su delegación de ensayo concede EDIT Asignaciones exclusivamente ADM / 27-1, sin capacidades extraordinarias. Debe ver ADM, sin DER ni matrícula ajena. La excepción académica no se transfiere al auxiliar.
4. Registrar fecha, persona, navegador, resultado observado y captura. **T10 sigue PENDIENTE de confirmación humana hasta recibir ese registro.** La prueba automatizada del servidor y navegador no sustituye la aceptación.

Para terminar, usar Ctrl+C en las dos terminales. Se detienen solo la web 4202 y su sesión aislada; la LAN compartida permanece activa. Los datos de esta revisión son desechables y no se exportan a producción.

## Evidencia técnica

`tools/e2-r01/acceptance.spec.mjs`, caso T10: permisos efectivos previos, lectura/matrícula ajena de CA admitidas, modificación de docente ajeno denegada, lectura/escritura ajena de CUSTOM y auxiliar denegadas, lectura propia del auxiliar admitida. Se confirma además guardado desde la interfaz de CA y conservación de los campos protegidos. `tools/e2-r01/prepare-t10.mjs` exige el supervisor aislado y datos sintéticos antes de preparar el escenario.
