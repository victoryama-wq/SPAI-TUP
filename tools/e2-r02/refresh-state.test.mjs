import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';

const baseFile='src/app/core/data/firestore.repository.ts';
function compile(source,require) {
  const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require,console:{error(){}},setTimeout,clearTimeout});
  return exports;
}
function harness(source=fs.readFileSync(baseFile,'utf8')) {
  let owner={authUid:'fictitious',appUser:{permissions:{ciclos:'VIEW'}}};
  const effects=[],listeners=[],reads=[];
  const signal=value=>{const s=()=>value;s.set=v=>value=v;s.asReadonly=()=>s;return s;};
  const core={signal,computed:fn=>fn,Injectable:()=>c=>c,effect:fn=>effects.push(fn),inject:key=>key==='session'?{session:()=>owner}:{isAuthenticated:()=>!!owner}};
  const firestore={getDocsFromServer:()=>new Promise((resolve,reject)=>reads.push({resolve,reject})),onSnapshot:(_query,_opts,success,error)=>{listeners.push({success,error});return()=>{};}};
  const deps=name=>name==='@angular/core'?core:name==='firebase/firestore'?firestore:name.endsWith('user-session.service')?{UserSessionService:'session'}:name.endsWith('auth.service')?{AuthService:'auth'}:name==='./authorized-query'?{authorizedQuery:()=>({})}:{};
  const {FirestoreRepository:Base}=compile(source,deps);
  const {CyclesRepository:Cycle}=compile(fs.readFileSync('src/app/features/cycles/data/cycles.repository.ts','utf8'),name=>name.endsWith('firestore.repository')?{FirestoreRepository:Base}:deps(name));
  class Retained extends Base {
    retainVerifiedRowsOnRefresh(){return true;}
    acceptsRefreshedRows(...args){return Cycle.prototype.acceptsRefreshedRows.apply(this,args);}
  }
  const repo=new Retained({},'ciclos');effects[0](()=>{});
  const snapshot=rows=>({metadata:{fromCache:false,hasPendingWrites:false},docs:rows.map(row=>({id:row.id,data:()=>row}))});
  const emit=rows=>listeners[0].success(snapshot(rows));
  emit([{id:'operative',code:'27-1',status:'Captura',revision:1}]);
  return {repo,reads,emit,snapshot,deny:()=>listeners[0].error({code:'permission-denied'}),changeOwner:()=>owner={authUid:'other',appUser:{}}};
}
const rows=(revision,status='Captura cerrada')=>[{id:'operative',code:'27-1',status,revision}];

test('reproduces previous empty cycles during refresh; candidate retains verified rows while request is pending',async()=>{
  const previous=harness(execFileSync('git',['show','d2f139dbd56d997815496036b1b95685bf9c05d2:'+baseFile],{encoding:'utf8'}));
  const old=previous.repo.refreshFromServer();assert.equal(previous.repo.items().length,0);assert.equal(previous.repo.ready(),false);previous.reads[0].resolve(previous.snapshot(rows(2)));await old;
  const h=harness(),pending=h.repo.refreshFromServer();assert.equal(h.repo.items()[0].code,'27-1');assert.equal(h.repo.ready(),true);h.reads[0].resolve(h.snapshot(rows(2)));await pending;assert.equal(h.repo.items()[0].status,'Captura cerrada');
});
test('query transport failure preserves verified selection; retry only rereads',async()=>{
  const h=harness(),pending=h.repo.refreshFromServer();h.reads[0].reject(Error('synthetic timeout'));await assert.rejects(pending,/timeout/);assert.equal(h.repo.items()[0].id,'operative');
  const retry=h.repo.refreshFromServer();h.reads[1].resolve(h.snapshot(rows(2)));await retry;assert.equal(h.repo.items()[0].revision,2);assert.equal(h.reads.length,2);
});
test('late query cannot overwrite a newer server snapshot or a newer query',async()=>{
  const h=harness(),first=h.repo.refreshFromServer();h.emit(rows(3));h.reads[0].resolve(h.snapshot(rows(2)));await first;assert.equal(h.repo.items()[0].revision,3);
  const old=h.repo.refreshFromServer(),newest=h.repo.refreshFromServer();h.reads[2].resolve(h.snapshot(rows(5)));await newest;h.reads[1].resolve(h.snapshot(rows(4)));await assert.rejects(old,/cambiaron/);assert.equal(h.repo.items()[0].revision,5);
  h.emit(rows(3,'Captura'));assert.equal(h.repo.items()[0].revision,5);
});
test('retained rows never survive a changed session or a permission denial; late response cannot restore them',async()=>{
  const h=harness(),pending=h.repo.refreshFromServer();h.changeOwner();assert.equal(h.repo.items().length,0);h.reads[0].resolve(h.snapshot(rows(2)));await assert.rejects(pending,/cambiaron/);assert.equal(h.repo.items().length,0);
  const denied=harness(),late=denied.repo.refreshFromServer();denied.deny();assert.equal(denied.repo.items().length,0);denied.reads[0].resolve(denied.snapshot(rows(2)));await assert.rejects(late,/cambiaron/);assert.equal(denied.repo.readState(),'denied');
});
