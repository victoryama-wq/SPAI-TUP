import assert from 'node:assert/strict';
import {isolatedTest,verifyHub} from '../local/config.mjs';

export async function auxiliaryFixture(db, {level='EDIT',empty=false,capabilities=[],fields=['*']}={}) {
 assert.equal(isolatedTest,true);await verifyHub();
 const backups=new Map();
 async function put(path,value){if(!backups.has(path))backups.set(path,(await db.doc(path).get()).data());await db.doc(path).set(value);}
 const original=(await db.doc('usuarios/demo-auxiliar').get()).data();
 const scope={programs:empty?[]:['ADM'],cycles:['27-1'],teachers:empty?[]:['demo-docente-1'],fields:empty?[]:fields};
 const permissions=Object.fromEntries(['docentes','asignaciones','moodle','nomenclaturas','grupos','asignaturas'].map(k=>[k,level]));
 const grant={userId:'demo-auxiliar',status:'ACTIVE',revision:1,permissions,scope,capabilities};
 await put('delegaciones/aux-regression',grant);
 // Deliberately retain a broader stale projection. Authority is the live grant.
 await put('usuarios/demo-auxiliar',{...original,delegationId:'aux-regression',baseRole:'ADMIN_OPERATIVO',status:'Activo',permissionSchemaVersion:2,permissions:{...permissions,dashboard:'EDIT'},scope:{programs:['*'],cycles:['*'],teachers:['*'],fields:['*']},capabilities:['MANAGE_MOODLE_TEMPLATES','VALIDATE_TEACHERS','CONFIRM_MOODLE_UPDATE']});
 const teacher=(await db.doc('docentes/demo-docente-1').get()).data();
 assert.ok(teacher,'Synthetic teacher required');
 await put('docentes/demo-docente-1',{...teacher,assignedCoordinatorIds:null});
 for(const program of ['ADM','DER']){
  await put(`moodle_categorias/aux-${program}`,{categoryNumber:program==='ADM'?'991':'992',programCode:program,programName:`Programa ${program} ficticio`,status:'Activo',createdAt:'2026-10-16',updatedAt:'2026-10-16'});
  await put(`moodle_plantillas/aux-${program}`,{templateCourse:`AUX-${program}`,name:`AUX-${program}`,programCode:program,modality:'Escolarizado',status:'Activo',createdAt:'2026-10-16',updatedAt:'2026-10-16'});
 }
 return {grant,scope,put,async restore(){for(const [path,data] of [...backups].reverse())if(data)await db.doc(path).set(data);else await db.doc(path).delete();}};
}
