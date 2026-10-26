import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=(path,globals={})=>{const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require:()=>({Component:()=>c=>c}),console,queueMicrotask,clearTimeout,...globals});return exports;};
test('H01: identidad persistida, formatos anteriores y ausencia real; nunca se consulta al actor actual',()=>{
 const {auditIdentity}=compile('src/app/core/data/audit-display.ts');
 for(const row of [{actorName:'Sistemas DEMO',actorId:'old',actorRole:'Sistemas'},{actor:{uid:'old',name:'Sistemas DEMO',role:'Sistemas'}},{user:'Sistemas DEMO',userRole:'Sistemas'}]) assert.equal(auditIdentity(row).user,'Sistemas DEMO');
 assert.equal(auditIdentity({actorEmail:'actor@example.invalid'}).user,'actor@example.invalid');
 assert.equal(auditIdentity({actorId:'unresolved'}).user,'');assert.equal(auditIdentity({actorName:null,user:42}).user,'');
});
function harness(){
 let expire;const requests=[];
 const {SecurityConsoleComponent:C}=compile('src/app/features/users/components/security-console.component.ts',{setTimeout:f=>{expire=f;return 1;},clearTimeout:()=>{}});
 const h=Object.create(C.prototype);Object.assign(h,{sessionGeneration:1,deletionPreparation:0,deletionRequest:null,cancelDeletionWait:null,mode:null,busy:false,error:'',reason:'',service:{deletion:data=>new Promise((resolve,reject)=>requests.push({data,resolve,reject}))},canDeletePerson:()=>true,general:()=>true,rememberOpener:()=>{},showDialog:()=>{},editorDialog:()=>({nativeElement:{close(){}}}),element:{nativeElement:{querySelector:()=>null}}});
 return {h,requests,expire:()=>expire()};
}
const preview=id=>({preview:{targetId:id,name:id,email:id+'@example.invalid',token:'opaque',expiresAt:Date.now()+60000}});
test('H02: cancelar pendiente, cambiar persona y descartar respuestas tardías sin arrastre',async()=>{
 const {h,requests}=harness();const first=h.openDeletion({id:'a'});assert.equal(h.busy,true);assert.equal(h.editorCloseBlocked,false);h.reason='motivo anterior';h.cancelEditor({preventDefault(){}});await first;
 assert.equal(h.mode,null);assert.equal(h.busy,false);assert.equal(h.reason,'');
 const next=h.openDeletion({id:'b'});requests[0].resolve(preview('a'));await Promise.resolve();assert.equal(h.deletionPreview,null);assert.equal(h.busy,true);
 requests[1].resolve(preview('b'));await next;assert.equal(h.deletionPreview.targetId,'b');assert.equal(h.reason,'');assert.equal(h.busy,false);
});
test('H02: timeout bloquea confirmar y permite reintento, sin aceptar respuesta vencida',async()=>{
 const {h,requests,expire}=harness();const first=h.openDeletion({id:'a'});expire();await first;assert.match(h.error,/tardó demasiado/);assert.equal(h.deletionPreview,null);assert.equal(h.busy,false);
 h.reason='motivo válido';await h.confirmDeletion();assert.equal(requests.length,1);
 const retry=h.prepareDeletion();requests[0].resolve(preview('a'));await Promise.resolve();assert.equal(h.deletionPreview,null);requests[1].resolve(preview('a'));await retry;assert.equal(h.deletionPreview.targetId,'a');assert.equal(h.reason,'');
});
test('H02: error, identidad distinta, cambio de sesión y destrucción no habilitan una baja',async()=>{
 for(const kind of ['failure','wrong-target','session','destroy']){
  const {h,requests}=harness();const task=h.openDeletion({id:'a'});
  if(kind==='failure') requests[0].reject(new Error('Authentication no disponible'));
  if(kind==='wrong-target')requests[0].resolve(preview('b'));
  if(kind==='session'){h.sessionGeneration++;h.closeEditor();requests[0].resolve(preview('a'));}
  if(kind==='destroy'){h.ngOnDestroy();requests[0].resolve(preview('a'));}
  await task;assert.equal(h.deletionPreview,null);h.reason='motivo válido';await h.confirmDeletion();assert.equal(requests.length,1);
 }
});
