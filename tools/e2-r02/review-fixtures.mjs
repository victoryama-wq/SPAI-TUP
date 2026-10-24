import assert from 'node:assert/strict';
import { fixtures, fixtureTime } from '../local/fixtures.mjs';

export const reviewScenario = 'r02-two-cycles-v1';
/** NEW synthetic scenario, never a migration of an imported/shared database.
 * Keep multi-operative fixtures for negative tests. Consolidate synthetic 26-2
 * assignment into the existing 26-3 DER group, without dropping assignments.
 */
export function reviewFixtures() {
  const docs = fixtures().filter(({path, data}) =>
    !(path.startsWith('ciclos/') && ['27-2', '26-2'].includes(data.code)) &&
    !(path.startsWith('grupos/') && data.cycleCode === '26-2'));
  for (const {path, data} of docs) {
    if (path.startsWith('ciclos/')) {
      data.revision = 1; data.specialsEnabled = false;
      if (data.code === '26-3') { data.status = 'Cerrado'; data.closedAt = fixtureTime; }
    }
    if (path.startsWith('asignaciones/') && data.cycle === '26-2') {
      data.cycle = '26-3'; data.group = data.group.replace(/^26-2 /, '26-3 ');
    }
  }
  validateReviewFixtures(docs);
  return docs;
}

export function validateReviewFixtures(docs) {
  const cycles = docs.filter(d => d.path.startsWith('ciclos/')).map(d => d.data);
  assert.deepEqual(cycles.map(c => [c.code, c.status]).sort(), [['26-3','Cerrado'],['27-1','Captura']]);
  const codes = new Set(cycles.map(c => c.code));
  const paths = new Set(docs.map(d => d.path));
  const groups = new Map(docs.filter(d => d.path.startsWith('grupos/')).map(d => [d.data.fullGroup,d.data]));
  assert.equal(paths.size, docs.length, 'No duplicate fixture paths');
  for (const {path, data} of docs) {
    for (const field of ['cycle', 'cycleCode']) if (data[field]) assert.ok(codes.has(data[field]), `${path}: unresolved ${field}`);
    for (const field of ['group','sourceGroup','destinationGroup']) if (data[field]) {
      assert.ok(groups.has(data[field]), `${path}: unresolved ${field}`);
      assert.equal(groups.get(data[field]).cycleCode, data.cycle, `${path}: inconsistent cycle/group`);
    }
    for (const field of ['sourceAssignmentId','destinationAssignmentId']) if (data[field]) assert.ok(paths.has('asignaciones/'+data[field]), `${path}: unresolved ${field}`);
    if (data.entity && data.entityId) assert.ok(paths.has(`${data.entity}/${data.entityId}`), `${path}: unresolved notification`);
  }
  return {scenario:reviewScenario, documents:docs.length, cycles:cycles.map(c=>({code:c.code,status:c.status,date:c.tentativeCaptureCloseAt})), groups:groups.size, assignments:docs.filter(d=>d.path.startsWith('asignaciones/')).length, references:'VALID'};
}
