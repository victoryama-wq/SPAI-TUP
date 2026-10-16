import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {root} from '../local/config.mjs';

function harness(path,name,args=[]){
 let session=null,cleanup=[];const effects=[],listeners=[];
 const signal=initial=>{let value=initial;const read=()=>value;read.set=v=>value=v;read.asReadonly=()=>read;return read;};
 const core={signal,computed:f=>f,Injectable:()=>c=>c,effect:f=>effects.push(f),inject:t=>t==='session'?{session:()=>session}:t==='auth'?{isAuthenticated:()=>Boolean(session)}:{}};
 const firestore=new Proxy({onSnapshot:(...args)=>{const callbacks=args.filter(a=>typeof a==='function');const item={callback:callbacks[0],error:callbacks[1],stopped:false};listeners.push(item);return()=>item.stopped=true;}},{get:(target,key)=>target[key]??((...args)=>({kind:key,args}))});
 const compile=(file,dependencies)=>{const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(resolve(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require:dependencies,console,setTimeout,clearTimeout});return exports;};
 const permissions=compile('src/app/features/users/data/module-permission.service.ts',()=>core);
 const exports=compile(path,id=>id==='@angular/core'?core:id==='firebase/firestore'?firestore:id.endsWith('/user-session.service')?{UserSessionService:'session'}:id.endsWith('/auth.service')?{AuthService:'auth'}:id.endsWith('/module-permission.service')?permissions:id==='./authorized-query'?{authorizedQuery:(_db,_path,_constraints,u)=>permissions.hasAccess(u,'asignaciones')?{}:null}:{});
 const repo=new exports[name](...args);
 return {repo,listeners,setSession:s=>session=s,flush(){cleanup.forEach(f=>f());cleanup=[];effects.forEach(f=>f(c=>cleanup.push(c)));},emit(listener,data){listener.callback({metadata:{fromCache:false,hasPendingWrites:false},docs:[{id:'fictional',data:()=>data}]});}};
}
const actor=(uid,permissions,baseRole='CUSTOM')=>({authUid:uid,email:`${uid}@example.invalid`,appUser:{id:uid,name:uid,status:'Activo',permissionSchemaVersion:2,baseRole,permissions,scope:{programs:['ADM'],cycles:['27-1']}}});

test('Consulta vacía confirmada, carga, denegación y fallo técnico no se confunden',()=>{
 const h=harness('src/app/core/data/firestore.repository.ts','FirestoreRepository',[{},'asignaciones']);
 h.setSession(actor('a',{asignaciones:'VIEW'}));h.flush();assert.equal(h.repo.readState(),'loading');
 h.listeners[0].callback({metadata:{fromCache:true},docs:[]});assert.equal(h.repo.readState(),'loading');
 h.listeners[0].callback({metadata:{fromCache:false,hasPendingWrites:false},docs:[]});assert.equal(h.repo.ready(),true);assert.equal(h.repo.items().length,0);
 h.listeners[0].error({code:'permission-denied',message:'Null value diagnostic'});assert.equal(h.repo.readState(),'denied');assert.ok(!h.repo.readError().includes('Null value'));assert.equal(h.repo.ready(),false);
 h.listeners[0].error({code:'unavailable',message:'technical diagnostic'});assert.equal(h.repo.readState(),'error');assert.match(h.repo.readMessage(),/Reintenta/);
 h.setSession(null);h.flush();assert.equal(h.repo.readState(),'restricted');
});

test('Perfil vigente ignora caché y escrituras optimistas no confirmadas; una identidad nueva no hereda autorización',()=>{
 let authUser={uid:'consulta',email:'consulta@example.invalid'},callback,cleanup;const effects=[];
 const signal=initial=>{let value=initial;const read=()=>value;read.set=v=>value=v;return read;};
 const core={signal,computed:f=>f,Injectable:()=>c=>c,effect:f=>effects.push(f),inject:t=>t==='auth'?{user:()=>authUser,loading:()=>false}:t==='router'?{navigate:()=>Promise.resolve()}: {}};
 const exports={};const source=readFileSync(resolve(root,'src/app/core/auth/user-session.service.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require:id=>id==='@angular/core'?core:id==='@angular/router'?{Router:'router'}:id==='./auth.service'?{AuthService:'auth'}:id==='firebase/firestore'?{doc:()=>({}),onSnapshot:(_ref,_options,cb)=>{callback=cb;return()=>{};}}:id==='firebase/functions'?{httpsCallable:()=>async()=>({data:{synced:true}})}:id.endsWith('/environment')?{environment:{mode:'local'}}:{},window:{localStorage:{getItem:()=> '2026-08-03-operational-dashboard'}},console,setTimeout,clearTimeout});
 const service=new exports.UserSessionService();const flush=()=>{cleanup?.();effects[0](f=>cleanup=f);};flush();
 const profile=actor('consulta',{asignaciones:'VIEW'}).appUser;
 const emit=(data,fromCache,hasPendingWrites)=>callback({id:'consulta',exists:()=>true,data:()=>data,metadata:{fromCache,hasPendingWrites}});
 emit(profile,true,false);assert.equal(service.session(),null);emit(profile,false,true);assert.equal(service.session(),null);
 emit(profile,false,false);assert.equal(service.session().appUser.permissions.asignaciones,'VIEW');
 emit({...profile,permissions:{asignaciones:'EDIT',dashboard:'VIEW'}},false,true);assert.equal(service.session().appUser.permissions.asignaciones,'VIEW');assert.equal(service.session().appUser.permissions.dashboard,undefined);
 const oldCallback=callback;authUser={uid:'other',email:'other@example.invalid'};assert.equal(service.session(),null);flush();oldCallback({id:'consulta',exists:()=>true,data:()=>profile,metadata:{fromCache:false,hasPendingWrites:false}});assert.equal(service.session(),null);cleanup();
});

test('Repositorio base borra datos al cambiar identidad antes de cleanup y descarta callbacks atrasados tras revocación',async()=>{
 const h=harness('src/app/core/data/firestore.repository.ts','FirestoreRepository',[{},'asignaciones']);
 h.setSession(actor('a',{asignaciones:'VIEW'}));h.flush();h.emit(h.listeners[0],{program:'ADM'});assert.equal(h.repo.items().length,1);
 h.setSession(actor('b',{asignaciones:'VIEW'}));assert.equal(h.repo.items().length,0);h.flush();assert.equal(h.listeners[0].stopped,true);
 h.emit(h.listeners[0],{program:'DER'});assert.equal(h.repo.items().length,0);h.emit(h.listeners[1],{program:'ADM'});assert.equal(h.repo.items().length,1);
 h.setSession(actor('b',{asignaciones:'NONE'}));assert.equal(h.repo.items().length,0);h.flush();assert.equal(h.listeners[1].stopped,true);h.emit(h.listeners[1],{program:'ADM'});assert.equal(h.repo.items().length,0);
 await assert.rejects(()=>h.repo.refreshFromServer(),/PERMISO_REVOCADO/);h.setSession(null);h.flush();
});

test('Solicitudes no inicia lectura sin módulo y cancela/limpia la sesión anterior',()=>{
 const h=harness('src/app/features/system-requests/data/system-requests.repository.ts','SystemRequestsRepository');
 h.setSession(actor('consulta',{asignaciones:'VIEW'}));h.flush();assert.equal(h.listeners.length,0);
 h.setSession(actor('admin',{},'ADMIN_GENERAL'));h.flush();h.emit(h.listeners[0],{createdAt:'2026-10-15'});assert.equal(h.repo.requests().length,1);
 h.setSession(actor('consulta',{asignaciones:'VIEW'}));assert.equal(h.repo.requests().length,0);h.flush();assert.equal(h.listeners[0].stopped,true);h.emit(h.listeners[0],{createdAt:'2026-10-15'});assert.equal(h.repo.requests().length,0);
});

test('Agenda y notificaciones retiran datos al salir y descartan entregas de la identidad anterior',()=>{
 for(const [path,name,property] of [['src/app/features/dashboard/data/operational-agenda.repository.ts','OperationalAgendaRepository','items'],['src/app/core/data/system-notifications.repository.ts','SystemNotificationsRepository','notifications']]){
  const h=harness(path,name);h.setSession(actor('admin',{},'ADMIN_GENERAL'));h.flush();assert.equal(h.listeners.length,2);
  h.emit(h.listeners[1],{updatedAt:'2026-10-15',createdAt:'2026-10-15',target:'SISTEMAS'});assert.equal(h.repo[property]().length,1);
  h.setSession(null);assert.equal(h.repo[property]().length,0);h.flush();assert.ok(h.listeners.every(x=>x.stopped));h.emit(h.listeners[1],{updatedAt:'2026-10-15',createdAt:'2026-10-15',target:'SISTEMAS'});assert.equal(h.repo[property]().length,0);
 }
});
