import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {execFileSync} from 'node:child_process';
const compile=(source,require)=>{const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require,console});return exports;};
const signal=value=>Object.assign(()=>value,{set:next=>{value=next;}});
function repo(source=fs.readFileSync('src/app/features/cycles/data/cycles.repository.ts','utf8')) {
 const calls=[];let rejectMutation=false,failRead=false;let stored='Captura',displayed='Captura';
 class Base {async refreshFromServer(){calls.push('query');if(failRead)throw Error('read unavailable');displayed=stored;}}
 const {CyclesRepository:C}=compile(source,name=>name==='@angular/core'?{Injectable:()=>c=>c}:name==='firebase/functions'?{httpsCallable:()=>async command=>{calls.push(['mutation',command]);if(rejectMutation)throw Error('VERSION_CONFLICT');stored='Captura cerrada';return {data:{status:stored,revision:2}};}}:name.endsWith('firestore.repository')?{FirestoreRepository:Base}:{});
 const h=Object.create(C.prototype);Object.assign(h,{functions:{},refreshing:signal(false),refreshError:signal(''),confirmedPendingRefresh:signal(false)});
 return {h,calls,setReadFailure:v=>failRead=v,setRejected:v=>rejectMutation=v,state:()=>({stored,displayed})};
}
test('baseline delayed listener: acknowledged operation did not refresh; candidate reads confirmed state without waiting for listener',async()=>{
 const old=repo(execFileSync('git',['show','aa532cbef655c9decf7ee0865b82db9f665de5cf:src/app/features/cycles/data/cycles.repository.ts'],{encoding:'utf8'}));
 await old.h.confirm({action:'closeCapture',operationId:'same-command'});assert.equal(old.state().displayed,'Captura');assert.equal(old.state().stored,'Captura cerrada');
 const current=repo();await current.h.confirm({action:'closeCapture',operationId:'same-command'});assert.equal(current.state().displayed,'Captura cerrada');assert.deepEqual(current.calls.map(c=>Array.isArray(c)?c[0]:c),['mutation','query']);
});
test('confirmed mutation plus read failure is not a failed mutation; retry queries only, preserving idempotency identity',async()=>{
 const {h,calls,setReadFailure,state}=repo();setReadFailure(true);await h.confirm({action:'closeCapture',operationId:'stable-id',expectedRevision:1});assert.equal(state().stored,'Captura cerrada');assert.equal(h.confirmedPendingRefresh(),true);assert.match(h.refreshError(),/fue confirmada/);assert.equal(h.refreshing(),false);
 setReadFailure(false);await h.refreshFromServer();assert.equal(h.confirmedPendingRefresh(),false);assert.equal(h.refreshError(),'');assert.equal(calls.filter(Array.isArray).length,1);assert.equal(state().displayed,'Captura cerrada');
});
test('server rejection remains rejection even when refresh also fails; no false completion',async()=>{
 const {h,calls,setRejected,setReadFailure,state}=repo();setRejected(true);setReadFailure(true);await assert.rejects(h.confirm({operationId:'rejected'}),/VERSION_CONFLICT/);assert.equal(h.confirmedPendingRefresh(),false);assert.doesNotMatch(h.refreshError(),/fue confirmada/);assert.equal(state().stored,'Captura');assert.equal(calls.filter(Array.isArray).length,1);
});
test('reopening text and transition come only from authorized record; no inferred historical motive',()=>{
 const {auditReopenReason:reason,auditCycleTransition:transition,auditPresentation}=compile(fs.readFileSync('src/app/core/data/audit-display.ts','utf8'),()=>({}));
 const row={action:'reopen',module:'Ciclos',reason:'  Motivo completo '.repeat(30).trim(),previous:{status:'Captura cerrada'},next:{status:'Captura'},actorName:'Actor histórico'};const saved=JSON.stringify(row);
 assert.equal(reason(row),row.reason);assert.equal(transition(row),'Captura cerrada → Captura');assert.equal(reason({action:'reopen',module:'Ciclos',reason:null}),'Motivo no disponible en el registro histórico');assert.equal(reason({...row,action:'close'}),null);assert.equal(auditPresentation(row,[]).user,'Actor histórico');assert.equal(JSON.stringify(row),saved);
});
test('profile-driven component recreation is not a new visit; navigation and actor changes reset presentation only',()=>{
 const {CycleVisitService:C}=compile(fs.readFileSync('src/app/features/cycles/data/cycle-visit.service.ts','utf8'),()=>({Injectable:()=>c=>c,signal}));const visit=new C();
 visit.enter('first',7);visit.dismissed.set(true);visit.resolved=true;visit.cycleId='cycle';visit.enter('first',7);assert.equal(visit.dismissed(),true);assert.equal(visit.cycleId,'cycle');
 visit.enter('first',9);assert.equal(visit.dismissed(),false);assert.equal(visit.resolved,false);visit.dismissed.set(true);visit.enter('second',9);assert.equal(visit.dismissed(),false);assert.equal(visit.cycleId,null);
});
test('creation and purge refresh the authorized list; consultation keeps valid choice and replaces deleted choice without a listener',async()=>{
 let rows=[{id:'old',status:'Cerrado'},{id:'recent',status:'Cerrado'}],shown=rows;
 class Base {async refreshFromServer(){shown=rows;}}
 const {CyclesRepository:C}=compile(fs.readFileSync('src/app/features/cycles/data/cycles.repository.ts','utf8'),name=>name==='@angular/core'?{Injectable:()=>c=>c}:name==='firebase/functions'?{httpsCallable:()=>async command=>{rows=command.action==='purge'?rows.filter(c=>c.id!==command.cycleId):[...rows,{id:'new',status:'Preparacion'}];}}:name.endsWith('firestore.repository')?{FirestoreRepository:Base}:{});
 const h=Object.create(C.prototype);Object.assign(h,{functions:{},refreshing:signal(false),refreshError:signal(''),confirmedPendingRefresh:signal(false)});
 // Evaluate the existing selector computation, rather than copying its policy.
 const source=fs.readFileSync('src/app/features/assignments/data/assignments.repository.ts','utf8');
 const ast=ts.createSourceFile('selection.ts',source,ts.ScriptTarget.Latest,true);let selector;
 function find(node){if(ts.isPropertyDeclaration(node)&&node.name?.getText(ast)==='selectedCycleId')selector=node;ts.forEachChild(node,find);}find(ast);
 const compute=selector.initializer.arguments[0].properties.find(p=>p.name.getText(ast)==='computation').initializer.getText(ast);
 const select=compile(`export function select(source:any,previous:any){return (${compute})(source,previous);}`,()=>({})).select;
 const ctx={rememberChoice:true},initial={uid:'demo',requested:'old',ready:true,ids:['old','recent'],operativeId:undefined};
 await h.confirm({action:'purge',cycleId:'old',operationId:'purge'});
 assert.deepEqual(shown.map(c=>c.id),['recent']);
 const afterPurge={...initial,ids:shown.map(c=>c.id)};assert.equal(select.call(ctx,afterPurge,{source:initial,value:'old'}),'recent');
 await h.confirm({action:'create',operationId:'create'});assert.deepEqual(shown.map(c=>c.id),['recent','new']);
 const afterCreate={...afterPurge,ids:shown.map(c=>c.id),operativeId:'new'};
 assert.equal(select.call(ctx,afterCreate,{source:afterPurge,value:'recent'}),'recent');
 assert.equal(select.call(ctx,{...afterCreate,requested:null},undefined),'new');
});
