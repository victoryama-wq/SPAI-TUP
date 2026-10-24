import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewFixtures, validateReviewFixtures } from './review-fixtures.mjs';
import { fixtures } from '../local/fixtures.mjs';
test('Reproducible two-cycle scenario, academic and notification references resolve', () => {
  assert.deepEqual(reviewFixtures(), reviewFixtures());
  const report = validateReviewFixtures(reviewFixtures());
  assert.equal(report.groups,4); assert.equal(report.assignments,4); assert.equal(report.references,'VALID');
});
test('Negative multi-operative fixtures unchanged; no new capture date', () => {
  const generic = fixtures(); reviewFixtures(); assert.deepEqual(fixtures(),generic);
  assert.equal(generic.filter(d=>d.path.startsWith('ciclos/') && d.data.status!=='Cerrado').length,3);
  assert.equal(reviewFixtures().find(d=>d.path==='ciclos/demo-27-1').data.tentativeCaptureCloseAt,generic.find(d=>d.path==='ciclos/demo-27-1').data.tentativeCaptureCloseAt);
});
test('Broken references and extra operative cycles fail validation', () => {
  const broken = reviewFixtures(); broken.find(d=>d.path==='asignaciones/demo-asignacion-a').data.group='missing';
  assert.throws(()=>validateReviewFixtures(broken));
  assert.throws(()=>validateReviewFixtures([...reviewFixtures(),{path:'ciclos/extra',data:{code:'99-1',status:'Preparacion'}}]));
});
