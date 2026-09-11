import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './config.mjs';

// This is the only local-data tool that reads the online project. No write API.
const sourceProject = 'spai-6ef68';
const accountEmail = 'victor.yama@tecplayacar.edu.mx';
const prefix = `projects/${sourceProject}/databases/(default)/documents`;
if (process.argv[2] !== '--read-online') throw new Error('La exportacion requiere --read-online y autorizacion del propietario.');
const require = createRequire(import.meta.url);
const auth = require('../../node_modules/firebase-tools/lib/auth.js');
const account = [auth.getGlobalDefaultAccount(), ...auth.getAdditionalAccounts()].find((a) => a?.user?.email === accountEmail);
if (!account) throw new Error('La cuenta autorizada no tiene sesion Firebase.');
const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
const readTime = new Date(Date.now() - 10000).toISOString();
const documents = [];
const counts = {};
let requests = 0;

async function read(resource, query, body) {
  if (!resource.startsWith(prefix) || (body && !resource.endsWith(':listCollectionIds'))) throw new Error('Lectura fuera del alcance permitido.');
  const encoded = resource.split('/').map(encodeURIComponent).join('/').replace(/%3AlistCollectionIds$/, ':listCollectionIds');
  const url = new URL(`https://firestore.googleapis.com/v1/${encoded}`);
  for (const [key, value] of Object.entries(query || {})) if (value) url.searchParams.set(key, value);
  requests++;
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(60000),
    headers: { authorization: `Bearer ${token.access_token}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`Firestore lectura HTTP ${response.status}; no se publica una copia incompleta.`);
  return response.json();
}

async function collectionIds(parent) {
  const result = [];
  let pageToken;
  do {
    const page = await read(`${parent}:listCollectionIds`, null, { pageSize: 1000, readTime, ...(pageToken ? { pageToken } : {}) });
    result.push(...(page.collectionIds || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return result;
}

async function readCollection(parent, id) {
  const parents = [];
  let pageToken;
  do {
    const page = await read(`${parent}/${id}`, { pageSize: '1000', showMissing: 'true', readTime, pageToken });
    for (const doc of page.documents || []) {
      parents.push(doc.name);
      if (!doc.createTime && !doc.updateTime) continue; // Missing parent: still discover subcollections.
      documents.push(doc);
      const top = doc.name.slice(prefix.length + 1).split('/')[0];
      counts[top] = (counts[top] || 0) + 1;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return parents;
}

let parents = [prefix];
while (parents.length) {
  const next = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, parents.length) }, async () => {
    while (cursor < parents.length) {
      const parent = parents[cursor++];
      for (const id of await collectionIds(parent)) next.push(...await readCollection(parent, id));
    }
  }));
  parents = next;
  console.log(`Lectura: ${documents.length} documentos; ${parents.length} rutas por revisar.`);
}
documents.sort((a, b) => a.name.localeCompare(b.name));
const snapshot = { format: 'spai-firestore-rest-v1', sourceProject, databaseId: '(default)', readTime, exportedAt: new Date().toISOString(), counts, documents };
const directory = resolve(root, '.local/source-data');
mkdirSync(directory, { recursive: true });
const file = `firestore-${readTime.replace(/[:.]/g, '-')}.json`;
const bytes = JSON.stringify(snapshot);
writeFileSync(resolve(directory, file), bytes, { flag: 'wx' });
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(resolve(directory, 'latest.json'), JSON.stringify({ file, sha256, readTime, count: documents.length, counts, requests }, null, 2));
console.log(JSON.stringify({ file: `.local/source-data/${file}`, sha256, readTime, count: documents.length, counts, requests }, null, 2));
