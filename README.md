# SPAI TUP

Sistema de Planeacion Academica Institucional del Tecnologico Universitario Playacar.

## Continuidad del trabajo — 4 de noviembre de 2026

Leer primero [el documento de continuidad de SPAI](docs/CONTINUIDAD-SPAI-2026-11-04.md).
Contiene las versiones aceptadas, evidencia, ramas, pendientes y conservación de los
emuladores. La base de continuidad es `codex/e2-r02-cierre-rules-20261030`;
`main` conserva una versión anterior. La aceptación de R01/R02 no autoriza producción.
Las instrucciones de instalación que siguen preparan desarrollo local nuevo: no usarlas
para restablecer las instancias aceptadas, cuyos datos se recuperan de su propia exportación.

## Stack

- Angular 20
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting

## Instalacion local

El desarrollo usa exclusivamente el proyecto ficticio `demo-spai-tup`. Requiere
Node.js 22 (ver `.nvmrc`) y Java 21 o superior.

```powershell
npm ci
npm ci --prefix functions
npm run local:emulators
```

Espera el mensaje `DEMO listo`. En otra terminal:

```powershell
npm start
```

Servidor local:

```text
http://127.0.0.1:4200/
```

## Build

```powershell
npm run build
```

## Documentacion

- [Entorno local: sesiones DEMO, datos ficticios o copia, inicio y pruebas](docs/ENTORNO-LOCAL.md).
- [Seguimiento de estabilizacion por etapas](docs/ESTABILIZACION.md).
- [Copia de la BD online con inicio de sesion DEMO](docs/COPIA-BD-DEMO.md).
- [Etapa 1: matriz de permisos por acción y campo](docs/ETAPA-1-MATRIZ-PERMISOS.md).
- [Etapa 1: contratos y decisiones funcionales](docs/ETAPA-1-CONTRATOS.md).
- [Etapa 1: resultados, fallos conocidos y CI](docs/ETAPA-1-PRUEBAS.md).

El spec actualizado del proyecto esta en:

```text
docs/SPAI-TUP-SPEC-v2.md
```

## Notas

No se versionan `node_modules`, `dist`, `.angular`, logs ni archivos temporales.

`npm run build` compila produccion, pero no despliega. `npm run build:local`
compila la version DEMO. La seleccion predeterminada del CLI Firebase es el
proyecto DEMO; el alias `production` conserva la referencia original.
