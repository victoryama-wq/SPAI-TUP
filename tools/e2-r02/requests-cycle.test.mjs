import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceMembers,deferred} from '../stage1/source-harness.mjs';

test('La reapertura solicitada espera al servidor y no anuncia éxito si el comando se rechaza',async()=>{
 const pending=deferred();const calls=[];
 const ui=sourceMembers('src/app/features/requests/pages/requests-page.component.ts','RequestsPageComponent',['acceptOperationalRequest'],{
   requestActorData:()=>({userId:'synthetic'}),requestTypeFor:()=> 'REABRIR_CAPTURA',requestTypeLabel:()=> 'Reapertura',
   cycles:()=>[{id:'cycle',code:'27-1',status:'Captura cerrada'}],
   cyclesRepository:{reopenCapture:(id,reason)=>{calls.push([id,reason]);return pending.promise;}},
   sharedRequestsRepository:{acceptRequest:()=>calls.push('request accepted')},auditLogRepository:{register:()=>calls.push('audit')},
   responseObservations:'  Revisión autorizada ficticia  ',responseErrors:[],formMessage:'',closeResponseModal:()=>calls.push('closed')
 },{Error});
 const action=ui.acceptOperationalRequest({id:'request',cycle:'27-1'});
 assert.deepEqual(calls,[['cycle','Revisión autorizada ficticia']]);assert.equal(ui.formMessage,'');
 pending.reject(new Error('CONFLICTO_VERSION'));await action;
 assert.equal(calls.length,1);assert.equal(ui.formMessage,'');assert.ok(ui.responseErrors[0].includes('CONFLICTO_VERSION'));
});
