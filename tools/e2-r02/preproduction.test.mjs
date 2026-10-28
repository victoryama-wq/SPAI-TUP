import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>{const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require:()=>({Component:()=>c=>c}),console});return exports;};
const {auditPresentation}=compile('src/app/core/data/audit-display.ts');
test('U01: historical completion uses only matching authorized initiation evidence; no mutation',()=>{
 const initial={id:'baja_op',operationId:'op',actorId:'requester',user:'Solicitante histórico',entityId:'target',source:'SERVIDOR',action:'BAJA_USUARIO_INICIADA',reason:'Motivo registrado'};
 const final={id:'baja_auth_op',operationId:'op',actorId:'requester',entityId:'target',source:'SERVIDOR',action:'BAJA_AUTH_COMPLETADA'};
 const before=JSON.stringify([initial,final]);const result=auditPresentation(final,[initial,final]);assert.equal(result.user,'Solicitante histórico');assert.equal(result.metadata.Motivo,'Motivo registrado');assert.match(result.description,/histórico/);assert.equal(JSON.stringify([initial,final]),before);
 for(const patch of [{actorId:'viewer'},{entityId:'other'},{operationId:'other'},{source:'CLIENTE'},{id:'another'}])assert.equal(auditPresentation(final,[{...initial,...patch},final]).user,'');
 assert.equal(auditPresentation(final,[initial,initial,final]).user,'');assert.equal(auditPresentation(final,[final]).user,'');
 const current={...final,actor:{name:'Snapshot propio'},description:'Descripción completa'};assert.equal(auditPresentation(current,[initial,current]).user,'Snapshot propio');
});
test('UI02: only confirmed results render numeric metrics; load, denial, restriction and error stay explicit',()=>{
 const {confirmedMetric}=compile('src/app/core/data/confirmed-metric.ts');
 for(const message of ['Cargando datos autorizados…','Acceso denegado','Sin ámbito','No se pudo completar la consulta']){
  const result=confirmedMetric('0','Sin datos',{ready:()=>false,readMessage:()=>message});assert.equal(result.value,'—');assert.equal(result.hint,message);
 }
 assert.equal(confirmedMetric('0','Consulta vacía',{ready:()=>true,readMessage:()=>''}).value,'0');
 assert.equal(confirmedMetric('12','Total confirmado',{ready:()=>true,readMessage:()=>''}).value,'12');
 assert.equal(confirmedMetric('0','Sin ciclo',{ready:()=>true,readMessage:()=>''},{ready:()=>false,readMessage:()=> 'Consultando ciclo'}).hint,'Consultando ciclo');
});
test('UI01: role definition statuses never turn legacy account labels into assignable roles',()=>{
 const {SecurityConsoleComponent:C}=compile('src/app/features/users/components/security-console.component.ts'),h=Object.create(C.prototype);
 assert.equal(h.definitionStatus({status:'ACTIVE'}),'Activa');assert.equal(h.definitionStatus({status:'RETIRED'}),'Retirada');
 for(const status of ['Activo',undefined,'UNKNOWN'])assert.match(h.definitionStatus({status}),/heredado/);
});
