import { createSign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const COLLECTION = 'docentes';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const MAX_BATCH_WRITES = 450;

main().catch((error) => {
  console.error('\nMigracion detenida:', error.message);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.mode ?? 'preview';

  if (!['preview', 'copy'].includes(mode)) {
    throw new Error('Usa --mode preview o --mode copy.');
  }

  if (!args.sourceKey || !args.targetKey) {
    printUsage();
    throw new Error('Faltan --source-key y --target-key.');
  }

  const sourceKey = await readServiceAccount(args.sourceKey);
  const targetKey = await readServiceAccount(args.targetKey);
  const sourceProject = args.sourceProject ?? sourceKey.project_id;
  const targetProject = args.targetProject ?? targetKey.project_id;

  if (!sourceProject || !targetProject) {
    throw new Error('No se pudo detectar project_id en una de las llaves. Usa --source-project y --target-project.');
  }

  if (sourceProject === targetProject) {
    throw new Error('El proyecto origen y destino son iguales. Revisa las llaves antes de copiar.');
  }

  console.log('Coleccion:', COLLECTION);
  console.log('Origen:', sourceProject, `(${basename(args.sourceKey)})`);
  console.log('Destino:', targetProject, `(${basename(args.targetKey)})`);
  console.log('Modo:', mode);

  const sourceToken = await getAccessToken(sourceKey);
  const targetToken = await getAccessToken(targetKey);
  const sourceDocs = await listCollection(sourceProject, sourceToken, COLLECTION);
  const targetDocs = await listCollection(targetProject, targetToken, COLLECTION);
  const targetIds = new Set(targetDocs.map((doc) => doc.id));
  const existing = sourceDocs.filter((doc) => targetIds.has(doc.id));
  const missing = sourceDocs.filter((doc) => !targetIds.has(doc.id));
  const overwrite = args.overwrite === true;
  const toCopy = overwrite ? sourceDocs : missing;

  console.log('\nResumen');
  console.log('- Docentes en base anterior:', sourceDocs.length);
  console.log('- Docentes en base nueva:', targetDocs.length);
  console.log('- Ya existen en nueva:', existing.length);
  console.log('- Faltan por copiar:', missing.length);
  console.log('- Se copiarian:', toCopy.length, overwrite ? '(sobrescribiendo existentes)' : '(sin sobrescribir)');

  const backupPath = await writeBackup(sourceProject, targetProject, sourceDocs, targetDocs);
  console.log('- Respaldo local:', backupPath);

  if (mode === 'preview') {
    console.log('\nVista previa lista. Para copiar, ejecuta el mismo comando con --mode copy.');
    return;
  }

  if (toCopy.length === 0) {
    console.log('\nNo hay docentes por copiar.');
    return;
  }

  await copyDocuments(targetProject, targetToken, COLLECTION, toCopy);
  console.log('\nMigracion terminada. Docentes copiados:', toCopy.length);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (!item.startsWith('--')) {
      continue;
    }

    const key = item.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      args[toCamelCase(key)] = true;
      continue;
    }

    args[toCamelCase(key)] = next;
    index += 1;
  }

  return args;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function readServiceAccount(path) {
  const raw = await readFile(path, 'utf8');
  const key = JSON.parse(raw);

  if (!key.client_email || !key.private_key) {
    throw new Error(`La llave ${path} no parece ser una cuenta de servicio valida.`);
  }

  return key;
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(serviceAccount.private_key, 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error(`No se pudo autenticar ${serviceAccount.client_email}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

async function listCollection(projectId, token, collection) {
  const docs = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({ pageSize: '300' });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/${collection}?${params}`;
    const response = await firestoreFetch(url, token);
    const data = await response.json();

    for (const document of data.documents ?? []) {
      docs.push({
        id: document.name.split('/').pop(),
        name: document.name,
        fields: document.fields ?? {},
        createTime: document.createTime ?? '',
        updateTime: document.updateTime ?? '',
      });
    }

    pageToken = data.nextPageToken ?? '';
  } while (pageToken);

  return docs;
}

async function copyDocuments(projectId, token, collection, docs) {
  for (let index = 0; index < docs.length; index += MAX_BATCH_WRITES) {
    const chunk = docs.slice(index, index + MAX_BATCH_WRITES);
    const writes = chunk.map((doc) => ({
      update: {
        name: `projects/${projectId}/databases/(default)/documents/${collection}/${doc.id}`,
        fields: doc.fields,
      },
    }));
    const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents:commit`;
    const response = await firestoreFetch(url, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }),
    });

    await response.json();
    console.log(`Copiados ${Math.min(index + chunk.length, docs.length)} / ${docs.length}`);
  }
}

async function firestoreFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return response;
}

async function writeBackup(sourceProject, targetProject, sourceDocs, targetDocs) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await mkdir('tmp', { recursive: true });
  const path = join('tmp', `docentes-migration-${timestamp}.json`);

  await writeFile(path, JSON.stringify({
    sourceProject,
    targetProject,
    createdAt: new Date().toISOString(),
    sourceCount: sourceDocs.length,
    targetCount: targetDocs.length,
    sourceDocs,
    targetDocs,
  }, null, 2));

  return path;
}

function printUsage() {
  console.log(`
Uso:
  node tools/migrate-docentes.mjs --mode preview --source-key "C:\\ruta\\spai-anterior-service-account.json" --target-key "C:\\ruta\\spai-nuevo-service-account.json"

  node tools/migrate-docentes.mjs --mode copy --source-key "C:\\ruta\\spai-anterior-service-account.json" --target-key "C:\\ruta\\spai-nuevo-service-account.json"

Opcional:
  --overwrite         Sobrescribe docentes existentes en la base nueva.
  --source-project    Fuerza ID del proyecto origen.
  --target-project    Fuerza ID del proyecto destino.
`);
}
