'use strict';
const P = require('../security/policy');
// All mutable institutional collections in the current schema. Audit/event/
// idempotency records are retained outside deletion, not cascaded dependencies.
const COLLECTIONS = ['grupos','asignaciones','solicitudes_compartidas','solicitudes_sistemas','ligas_meet','notificaciones','agenda_operativa_equipo','docentes','asignaturas','programas','nomenclaturas_programas','moodle_categorias','moodle_plantillas','configuracion'];
function references(value, cycle) {
  if (typeof value === 'string') return value === cycle.id || value === cycle.code || value.includes(`ciclos/${cycle.id}`) || new RegExp(`(^|[^0-9])${cycle.code}([^0-9]|$)`).test(value);
  if (Array.isArray(value)) return value.some(v=>references(v,cycle));
  if (value && typeof value === 'object') return typeof value.path === 'string' ? references(value.path,cycle) : Object.values(value).some(v=>references(v,cycle));
  return false;
}
async function assertNoDependencies(tx, db, cycle) {
  P.assert((await db.doc(`ciclos/${cycle.id}`).listCollections()).length===0,'CICLO_CON_DEPENDENCIAS: existen subcolecciones del histórico; requiere depuración R04.','failed-precondition');
  const queries=[...COLLECTIONS.map(name=>[name,db.collection(name)]),['agenda privada',db.collectionGroup('actividades')]];
  // Query reads participate in the deletion transaction; errors are not emptiness.
  const matches=[];
  for(const [name,query] of queries) {
    const snapshot=await tx.get(query);
    if(snapshot.docs.some(d=>references(d.data(),cycle))) matches.push(name);
  }
  P.assert(!matches.length,`CICLO_CON_DEPENDENCIAS: conserva datos o referencias en ${matches.join(', ')}. La depuración con respaldo y recuperación corresponde a R04; no se eliminó nada.`,'failed-precondition');
}
module.exports={COLLECTIONS,references,assertNoDependencies};
