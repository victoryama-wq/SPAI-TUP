import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSnapshot, sourcePrefix, targetPrefix, validateSnapshot, canonical } from '../snapshot.mjs';

const string = (value) => ({ stringValue: value });
const user = (id, role, status = 'Activo') => ({ name: `${sourcePrefix}usuarios/${id}`, fields: { name: string(`Nombre ${id}`), email: string(`${id}@example.invalid`), role: string(role), status: string(status), assignedPrograms: { arrayValue: { values: [string('TEST')] } }, access: { mapValue: { fields: { dashboard: { booleanValue: true } } } } } });
function sample() {
  return { format: 'spai-firestore-rest-v1', sourceProject: 'spai-6ef68', databaseId: '(default)', readTime: '2026-09-11T00:00:00.000Z', documents: [
    user('sistemas', 'Coordinación de Sistemas'), user('coordinador-a', 'Coordinación Académica'), user('coordinador-b', 'Coordinación Académica'),
    { name: `${sourcePrefix}docentes/docente-a`, fields: { owner: string('coordinador-a'), largeInteger: { integerValue: '9223372036854775806' }, when: { timestampValue: '2026-09-11T00:00:00.123456789Z' }, nested: { mapValue: { fields: { refs: { arrayValue: { values: [{ referenceValue: `${sourcePrefix}usuarios/coordinador-a` }] } } } } } } },
  ] };
}
test('Snapshot retains IDs and academic values; only session fields change on selected profiles', () => {
  const source = sample();
  const before = structuredClone(source);
  const plan = prepareSnapshot(source);
  assert.deepEqual(source, before);
  const coordinator = plan.documents.find((doc) => doc.name === `${targetPrefix}usuarios/coordinador-a`);
  const { email, authUid, ...actual } = coordinator.fields;
  const { email: oldEmail, ...expected } = source.documents[1].fields;
  assert.deepEqual(actual, expected);
  assert.equal(authUid.stringValue, 'coordinador-a');
  assert.match(email.stringValue, /^demo\.coordinacion\./);
  const teacher = plan.documents.find((doc) => doc.name === `${targetPrefix}docentes/docente-a`);
  assert.equal(teacher.fields.owner.stringValue, 'coordinador-a');
  assert.equal(teacher.fields.largeInteger.integerValue, '9223372036854775806');
  assert.equal(teacher.fields.when.timestampValue, '2026-09-11T00:00:00.123456789Z');
  assert.equal(teacher.fields.nested.mapValue.fields.refs.arrayValue.values[0].referenceValue, `${targetPrefix}usuarios/coordinador-a`);
  assert.equal(plan.mappings.length, 5);
  assert.equal(new Set(plan.mappings.map((a) => a.uid)).size, 5);
  assert.equal(plan.mappings.filter((a) => !a.copiedProfile).length, 2);
});
test('Snapshot refuses wrong origin, duplicate paths, external references and missing Systems profile', () => {
  const data = sample();
  assert.throws(() => validateSnapshot({ ...data, sourceProject: 'otro' }));
  assert.throws(() => validateSnapshot({ ...data, documents: [...data.documents, data.documents[0]] }));
  assert.throws(() => prepareSnapshot({ ...data, documents: data.documents.slice(1) }));
  data.documents[3].fields.external = { referenceValue: 'projects/otro/databases/(default)/documents/a/b' };
  assert.throws(() => prepareSnapshot(data));
});
test('Verification normalizes REST representations without losing integer or timestamp precision', () => {
  assert.deepEqual(canonical({ timestampValue: '2026-09-11T00:00:00Z' }), canonical({ timestampValue: '2026-09-11T00:00:00.000000Z' }));
  assert.deepEqual(canonical({ arrayValue: {} }), canonical({ arrayValue: { values: [] } }));
  assert.deepEqual(canonical({ mapValue: {} }), canonical({ mapValue: { fields: {} } }));
  assert.notDeepEqual(canonical({ integerValue: '9223372036854775806' }), canonical({ integerValue: '9223372036854775807' }));
  assert.notDeepEqual(canonical({ timestampValue: '2026-09-11T00:00:00.123456789Z' }), canonical({ timestampValue: '2026-09-11T00:00:00.123456780Z' }));
});
