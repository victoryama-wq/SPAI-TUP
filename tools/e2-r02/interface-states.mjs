// Angular presentation harness. Changes only in-memory signals, never Firestore.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {config,complementTest,verifyHub,password} from '../local/config.mjs';
assert.equal(complementTest,true);await verifyHub();
const browser=await chromium.launch({headless:true}),base='http://127.0.0.1:4204',results=[];
try{
 const page=await browser.newPage();page.setDefaultTimeout(20000);
 const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
 for(const scenario of ['Preparacion','Captura','Captura cerrada','Cerrado','none','multiple','no-date','read-only','no-permission','revoked']){
  await page.goto(base+'/ciclos');await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(scenario=>{
   const c=window.ng.getComponent(document.querySelector('spai-cycles-page')),repo=c.cyclesRepository,cycle=repo.activeCycle(),session=c.userSessionService.session();
   let user=session.appUser;
   if(['read-only','no-permission','revoked'].includes(scenario)){
    user={...user,baseRole:'CUSTOM',permissions:{...user.permissions,ciclos:scenario==='no-permission'?'NONE':'VIEW'},capabilities:[],...(scenario==='revoked'?{delegationActive:false}:{})};
    c.userSessionService={session:()=>({...session,appUser:user})};
   }
   const statuses=['Preparacion','Captura','Captura cerrada','Cerrado'];
   const rows=scenario==='none'?[]:scenario==='multiple'?[cycle,{...cycle,id:'fixture-second',code:'99-9'}]:[{...cycle,...(statuses.includes(scenario)?{status:scenario}:{}),...(scenario==='no-date'?{tentativeCaptureCloseAt:null,closedAt:'2099-12-31'}:{})}];
   repo.itemsSignal.set(rows);window.ng.applyChanges(c);
  },scenario);
  await page.waitForFunction(()=>window.ng.getComponent(document.querySelector('spai-cycles-page')).contextReady());
  // Start the presentation visit after the synthetic cache/context settles.
  // Actual once-per-visit behavior is tested without this harness in interface-review.
  await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));c.informationShown=false;c.informationDismissed.set(true);});
  await page.evaluate(()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));c.informationDismissed.set(false);});
  const dialog=page.getByRole('dialog');
  if(['Cerrado','none','multiple','no-permission','revoked'].includes(scenario))await expect(dialog).toHaveCount(0);
  else {await expect(dialog).toBeVisible();if(scenario==='no-date')await expect(dialog).toContainText('Sin fecha definida');if(['Preparacion','Captura cerrada','read-only'].includes(scenario))await expect(dialog.getByRole('button',{name:'Cerrar captura',exact:true})).toHaveCount(0);}
  if(scenario==='multiple'){await expect(page.locator('spai-cycles-page').getByRole('status')).toContainText('varios ciclos operativos');await expect(page.locator('.cycle-close-action')).toHaveCount(0);}
  if(scenario==='none')await expect(page.locator('spai-cycles-page').getByRole('status')).toContainText('No hay ciclo operativo');
  if(scenario==='Preparacion'){await dialog.getByRole('button',{name:'Entendido'}).click();await expect(page.getByRole('button',{name:'Iniciar captura',exact:true})).toBeEnabled();}
  if(scenario==='Captura cerrada'){await dialog.getByRole('button',{name:'Entendido'}).click();for(const name of ['Reabrir captura','Habilitar Especiales','Cerrar ciclo'])await expect(page.getByRole('button',{name,exact:true})).toBeEnabled();}
  if(scenario==='read-only'){await expect(dialog).toContainText('Captura');await dialog.getByRole('button',{name:'Entendido'}).click();await expect(page.locator('.cycle-close-action')).toHaveCount(0);}
  results.push({scenario,status:'PASS',kind:'in-memory presentation only'});
 }
 // A real low-privilege session cannot enter the module or execute a cycle command.
 const restricted=await browser.newPage();await restricted.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await restricted.goto(base);await restricted.getByLabel('Cuenta ficticia del emulador').selectOption('demo.coordinacion.a@tecplayacar.edu.mx');await restricted.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(restricted.locator('nav')).toBeVisible();await restricted.goto(base+'/ciclos');await expect(restricted.locator('spai-cycles-page')).toHaveCount(0);await expect(restricted.getByRole('dialog')).toHaveCount(0);
 const auth=await fetch(`http://127.0.0.1:${config.auth}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'demo.coordinacion.a@tecplayacar.edu.mx',password,returnSecureToken:true})});assert.equal(auth.status,200);const credentials=await auth.json();
 const denied=await fetch(`http://127.0.0.1:${config.functions}/demo-spai-tup/us-central1/cycleCommand`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+credentials.idToken},body:JSON.stringify({data:{action:'closeCapture',cycleId:'demo-27-1',expectedRevision:0,operationId:crypto.randomUUID()}})});assert.equal(denied.status,403);const response=await denied.json();assert.equal(response.error.status,'PERMISSION_DENIED');
 writeFileSync('docs/evidence/interface-actions-cycle/estados.json',JSON.stringify({at:new Date().toISOString(),status:'PASS',presentation:results,realRestrictedRoute:true,realServerPermissionDenial:403,remoteValidation:false},null,2));console.log('PASS: ten presentation cases; real restricted route and server permission denial.');
}finally{await browser.close();}
