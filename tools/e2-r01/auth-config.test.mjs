import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {root} from '../local/config.mjs';

const code=ts.transpileModule(readFileSync(resolve(root,'src/app/core/auth/auth.service.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
function service(mode,{projectId='demo-spai-tup',emulator=true,popupError}={}){
 const calls=[];const exported={};
 const firebase={browserLocalPersistence:'local',setPersistence:async()=>calls.push('persistence'),signInWithEmailAndPassword:async()=>calls.push('demo'),signInWithPopup:async()=>{calls.push('popup');if(popupError)throw popupError;return {user:{email:'synthetic@tecplayacar.edu.mx'}};},signInWithRedirect:async()=>calls.push('redirect'),signOut:async()=>calls.push('signout'),GoogleAuthProvider:class{setCustomParameters(value){calls.push(value);}}};
 vm.runInNewContext(code,{exports:exported,require:(id)=>id==='@angular/core'?{Injectable:()=>c=>c}:id==='firebase/auth'?firebase:id.endsWith('/environment')?{environment:{mode}}:{},Error,window:{location:{search:'?mode=local&demo=true&SPAI_LOCAL_SYNTHETIC=true'}}});
 const instance=Object.create(exported.AuthService.prototype);instance.auth={app:{options:{projectId}},emulatorConfig:emulator?{host:'127.0.0.1'}:null};instance.redirectErrorSignal={set:()=>{}};
 return {instance,calls};
}
test('El acceso DEMO exige configuración local, proyecto ficticio y SDK conectado al emulador',async()=>{
 for(const [mode,options] of [['production',{}],['production',{projectId:'spai-6ef68',emulator:false}],['local',{projectId:'spai-6ef68'}],['local',{emulator:false}]]){
  const {instance,calls}=service(mode,options);await assert.rejects(()=>instance.signInWithLocalAccount('demo.r01.consulta@tecplayacar.edu.mx'),/solo esta disponible/);assert.deepEqual(calls,[]);
 }
 const {instance,calls}=service('local');await instance.signInWithLocalAccount('demo.r01.consulta@tecplayacar.edu.mx');assert.deepEqual(calls,['persistence','demo']);
});
test('Acceso institucional conserva Google popup, dominio y respaldo redirect; local no inicia Google',async()=>{
 const prod=service('production');await prod.instance.signInWithGoogle();assert.ok(prod.calls.includes('popup'));assert.ok(prod.calls.some(c=>c.hd==='tecplayacar.edu.mx'&&c.prompt==='select_account'));
 const fallback=service('production',{popupError:{code:'auth/popup-blocked'}});await fallback.instance.signInWithGoogle();assert.deepEqual(fallback.calls.filter(c=>typeof c==='string'),['persistence','popup','redirect']);
 const local=service('local');await assert.rejects(()=>local.instance.signInWithGoogle(),/Google real esta desactivado/);assert.deepEqual(local.calls,[]);
});
test('Producción no importa identidades DEMO y selecciona reemplazo fijo, sin parámetros de cliente',()=>{
 const prod=readFileSync(resolve(root,'src/environments/environment.prod.ts'),'utf8');
 assert.match(prod,/mode: 'production'/);assert.match(prod,/demoAccounts: \[\]/);assert.doesNotMatch(prod,/local-accounts|local-review-accounts|location|URLSearchParams|sessionStorage|localStorage/);
 const angular=JSON.parse(readFileSync(resolve(root,'angular.json'))).projects['spai-tup-angular'].architect;
 assert.equal(angular.build.defaultConfiguration,'production');
 assert.deepEqual(angular.build.configurations.production.fileReplacements,[{replace:'src/environments/environment.ts',with:'src/environments/environment.prod.ts'}]);
});
