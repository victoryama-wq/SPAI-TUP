import assert from 'node:assert/strict';
import {isolatedTest,verifyHub} from '../local/config.mjs';

// Shared by the technical test and the explicitly launched human review.
export async function createT10Assignment(db) {
 assert.equal(isolatedTest,true,'T10 solo admite el entorno aislado');await verifyHub();
 assert.equal((await db.doc('ciclos/demo-27-1').get()).data().status,'Captura');
 const original=(await db.doc('asignaciones/demo-asignacion-a').get()).data();
 const ref=db.doc('asignaciones/acceptance-foreign');
 assert.equal((await ref.get()).exists,false,'No sobrescribir una prueba T10 existente');
 await ref.create({...original,program:'DER',group:'27-1 DER 11 01',moodleId:'acceptance-foreign',normalizedMoodleId:'acceptance-foreign',createdBy:'demo-coord-b',studentEnrollments:''});
 return ref;
}
