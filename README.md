# SPAI TUP

Sistema de Planeacion Academica Institucional del Tecnologico Universitario Playacar.

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

- [Entorno local: cuentas ficticias, inicio, parada, restablecimiento y pruebas](docs/ENTORNO-LOCAL.md).
- [Seguimiento de estabilizacion por etapas](docs/ESTABILIZACION.md).

El spec actualizado del proyecto esta en:

```text
docs/SPAI-TUP-SPEC-v2.md
```

## Notas

No se versionan `node_modules`, `dist`, `.angular`, logs ni archivos temporales.

`npm run build` compila produccion, pero no despliega. `npm run build:local`
compila la version DEMO. La seleccion predeterminada del CLI Firebase es el
proyecto DEMO; el alias `production` conserva la referencia original.
