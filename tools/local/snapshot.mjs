import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { config, root, accounts } from './config.mjs';
import { fixtures } from './fixtures.mjs';

export const sourceSelection = resolve(root, '.local/data-source.json');
export const targetPrefix = `projects/${config.projectId}/databases/(default)/documents/`;
export const sourcePrefix = 'projects/spai-6ef68/databases/(default)/documents/';

export function loadSelectedSnapshot() {
  if (process.env.SPAI_LOCAL_SYNTHETIC === 'true' || !existsSync(sourceSelection)) return null;
  const selection = JSON.parse(readFileSync(sourceSelection, 'utf8'));
  if (selection.mode !== 'snapshot') throw new Error('Seleccion de datos local desconocida.');
  const base = resolve(root, '.local/source-data');
  const path = resolve(base, selection.file);
  const rel = relative(base, path);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('La copia debe estar en .local/source-data.');
  const bytes = readFileSync(path);
  if (createHash('sha256').update(bytes).digest('hex') !== selection.sha256) throw new Error('El hash de la copia no coincide.');
  const snapshot = JSON.parse(bytes);
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(snapshot) {
  if (snapshot.format !== 'spai-firestore-rest-v1' || snapshot.sourceProject !== 'spai-6ef68'
    || snapshot.databaseId !== '(default)' || !Array.isArray(snapshot.documents) || !snapshot.documents.length) {
    throw new Error('Formato u origen de copia incompatible.');
  }
  const paths = new Set();
  for (const doc of snapshot.documents) {
    const path = doc.name?.slice(sourcePrefix.length);
    if (!doc.name?.startsWith(sourcePrefix) || !path || path.split('/').length % 2 || path.split('/').some((s) => !s || s === '.' || s === '..') || paths.has(path)) throw new Error('Ruta duplicada o incompatible en la copia.');
    paths.add(path);
  }
}

export function localizeValue(value) {
  if (value.referenceValue) {
    if (!value.referenceValue.startsWith(sourcePrefix)) throw new Error('Referencia Firestore externa: requiere revision antes de importar.');
    return { referenceValue: targetPrefix + value.referenceValue.slice(sourcePrefix.length) };
  }
  if (value.mapValue) return { mapValue: { fields: localizeFields(value.mapValue.fields || {}) } };
  if (value.arrayValue) return { arrayValue: { values: (value.arrayValue.values || []).map(localizeValue) } };
  return structuredClone(value);
}

function localizeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, localizeValue(value)]));
}

function toValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toValue(child)])) } };
}

export function prepareSnapshot(snapshot) {
  validateSnapshot(snapshot);
  const documents = snapshot.documents.map((doc) => ({ name: targetPrefix + doc.name.slice(sourcePrefix.length), fields: localizeFields(doc.fields || {}) }));
  const users = documents.filter((doc) => doc.name.slice(targetPrefix.length).split('/').length === 2 && doc.name.startsWith(`${targetPrefix}usuarios/`));
  const used = new Set();
  const mappings = [];
  const string = (doc, key) => doc.fields[key]?.stringValue;
  for (const account of accounts) {
    const candidates = users.filter((doc) => !used.has(doc.name) && string(doc, 'role') === account.role
      && string(doc, 'status') === (account.uid === 'demo-inactivo' ? 'Inactivo' : 'Activo'));
    candidates.sort((a, b) => {
      const aPreferred = account.uid === 'demo-sistemas' && string(a, 'email') === 'victor.yama@tecplayacar.edu.mx';
      const bPreferred = account.uid === 'demo-sistemas' && string(b, 'email') === 'victor.yama@tecplayacar.edu.mx';
      return Number(bPreferred) - Number(aPreferred) || a.name.localeCompare(b.name);
    });
    let profile = candidates[0];
    const copiedProfile = Boolean(profile);
    if (!profile) {
      if (account.uid === 'demo-sistemas') throw new Error('No hay perfil activo de Sistemas para vincular el acceso DEMO.');
      const fixture = fixtures().find((doc) => doc.path === `usuarios/${account.uid}`);
      profile = { name: `${targetPrefix}${fixture.path}`, fields: toValue(fixture.data).mapValue.fields };
      if (documents.some((doc) => doc.name === profile.name)) throw new Error('Colision con un perfil DEMO preexistente.');
      documents.push(profile);
    }
    const uid = profile.name.slice(`${targetPrefix}usuarios/`.length);
    if (!uid || uid.length > 128) throw new Error('UID incompatible con Authentication Emulator.');
    if (users.some((doc) => doc !== profile && string(doc, 'email') === account.email)) throw new Error('Correo DEMO ya utilizado por otro perfil.');
    used.add(profile.name);
    // Only local session fields change. Preserve role, name, status, programs and IDs.
    profile.fields.email = { stringValue: account.email };
    profile.fields.authUid = { stringValue: uid };
    mappings.push({ slot: account.uid, uid, email: account.email, name: account.name, copiedProfile, profilePath: profile.name.slice(targetPrefix.length), role: string(profile, 'role'), programs: (profile.fields.assignedPrograms?.arrayValue?.values || []).map((v) => v.stringValue) });
  }
  return { documents, mappings, readTime: snapshot.readTime, sourceCount: snapshot.documents.length };
}

// Canonical Firestore values: preserve integer precision, timestamp nanoseconds,
// normalize equivalent empty maps/arrays and REST numeric encodings for verification.
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  if ('timestampValue' in value) {
    const match = value.timestampValue.match(/^(.*?)(?:\.(\d+))?Z$/);
    if (match) return { timestampValue: `${match[1]}.${(match[2] || '').padEnd(9, '0')}Z` };
  }
  if ('integerValue' in value) return { integerValue: String(value.integerValue) };
  if ('doubleValue' in value) return { doubleValue: String(value.doubleValue) };
  if ('arrayValue' in value) return { arrayValue: { values: canonical(value.arrayValue.values || []) } };
  if ('mapValue' in value) return { mapValue: { fields: canonical(value.mapValue.fields || {}) } };
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
