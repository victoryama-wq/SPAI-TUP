import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {deleteApp} from 'firebase/app';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {doc,collection,getDocFromServer,getDocsFromServer,terminate} from 'firebase/firestore';
import {config,root,isolatedTest,localEnvironment,verifyHub,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';

const evidence=resolve(root,'.local/acceptance-2');mkdirSync(evidence,{recursive:true});
const consulta='demo.r01.consulta@tecplayacar.edu.mx';
test.beforeEach(async({page})=>{
 assert.equal(isolatedTest,true);await verifyHub();
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.addInitScript(()=>{
  window.protectedInsertions=[];window.watchProtected=true;
  new MutationObserver(records=>{
   if(!window.watchProtected)return;
   for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType===1&&(node.matches('spai-dashboard-page,.dashboard-overview,.metric-card,.security-panel')||node.querySelector('.dashboard-overview,.metric-card,.security-panel')))window.protectedInsertions.push(node.className||node.tagName);
   }
  }).observe(document,{childList:true,subtree:true});
 });
});
async function login(page,email){await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(email);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();}
async function noDashboard(page){await expect(page).toHaveURL(/\/asignaciones$/);await expect(page.locator('.table-panel tbody')).toContainText('27-1 ADM');await expect(page.locator('.dashboard-overview,.metric-card,.security-panel')).toHaveCount(0);expect(await page.evaluate(()=>window.protectedInsertions)).toEqual([]);}
function trackTargets(page){const targets=[];page.on('request',r=>{if(r.url().includes('Firestore/Listen')&&r.postData())for(const [key,value] of new URLSearchParams(r.postData()))if(key.endsWith('__data__'))try{const d=JSON.parse(value);if(d.addTarget)targets.push(d.addTarget);}catch{}});return targets;}
function assertTargets(targets){
 const collections=targets.flatMap(t=>t.query?.structuredQuery?.from?.map(x=>x.collectionId)??[]);
 expect(collections).toContain('asignaciones');
 for(const collection of collections)expect(['asignaciones','ciclos','avisos_seguridad','notificaciones']).toContain(collection);
 for(const t of targets.filter(t=>t.query?.structuredQuery?.from?.[0]?.collectionId==='asignaciones')){const text=JSON.stringify(t);expect(text).toContain('ADM');expect(text).toContain('27-1');}
}
async function setup(work){
 Object.assign(process.env,localEnvironment());const require=createRequire(resolve(root,'functions/package.json'));
 const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
 const admin=initializeApp({projectId:config.projectId},crypto.randomUUID());const db=getFirestore(admin);const clients=[];
 const client=async(email)=>{const c=runtime.initializeFirebaseRuntime(localConfig,crypto.randomUUID());clients.push(c);await signInWithEmailAndPassword(c.auth,email,password);return c;};
 const command=async(c,data)=>(await httpsCallable(c.functions,'securityCommand')({operationId:crypto.randomUUID(),reason:'Regresión aislada de navegación R01',...data})).data;
 try{await work({db,client,command,P:require('./security/policy')});}finally{for(const c of clients){await terminate(c.db);await deleteApp(c.app);}await deleteAdmin(admin);}
}
// Same two-phase emulator diagnostic criterion as the R01 integration suite:
// an error alone or catch-all false cannot accredit a negative. Each preliminary
// error must have a final false at the SAME allow line and operation.
async function policyDenied(action){
 let message;
 await assert.rejects(action,e=>{
  message=e.message;
  if(e.code!=='permission-denied'||/Null value|maximum of|INTERNAL|UNAVAILABLE/i.test(message))return false;
  for(const m of message.matchAll(/evaluation error at L(\d+):\d+ for '(\w+)'/g)){
   if(!message.includes(`false for '${m[2]}' @ L${m[1]},`)&&!message.endsWith(`false for '${m[2]}' @ L${m[1]}`))return false;
  }
  return /false for '(get|list)' @ L\d+/.test(message);
 });
 return message;
}

test('H002 login real, URL Dashboard, recarga e historial sin inserción protegida ni consultas ajenas',async({page})=>{
 const targets=trackTargets(page);
 await login(page,consulta);await noDashboard(page);
 for(const path of ['/dashboard','/','/usuarios']){await page.goto(path);await noDashboard(page);await page.reload();await noDashboard(page);}
 await page.evaluate(()=>{history.pushState({},'', '/dashboard');history.pushState({},'', '/asignaciones');});
 await page.goBack();await noDashboard(page);await page.goForward();await noDashboard(page);
 assertTargets(targets);
 await page.screenshot({path:resolve(evidence,'h002-consulta-after.png'),fullPage:true});
 writeFileSync(resolve(evidence,'h002-targets.json'),JSON.stringify({status:'PASS',targets,protectedInsertions:await page.evaluate(()=>window.protectedInsertions)},null,2));
});

test('H002 permisos sin resolver: no se crea el Dashboard mientras se espera el perfil del servidor',async({page})=>{
 const targets=trackTargets(page);
 let release;const gate=new Promise(r=>release=r);let listening=false;
 await page.route('**/google.firestore.v1.Firestore/Listen/channel**',async r=>{listening=true;await gate;await r.continue();});
 try{
  await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(consulta);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();
  await expect.poll(()=>listening).toBe(true);
  await expect.poll(()=>targets.length).toBeGreaterThan(0);
  expect(targets.every(t=>!t.query && t.documents?.documents?.every(path=>path.endsWith('/usuarios/demo-r01-consulta')))).toBe(true);
  await expect(page.locator('.dashboard-overview,.metric-card,.security-panel')).toHaveCount(0);expect(await page.evaluate(()=>window.protectedInsertions)).toEqual([]);
 }finally{release();}
 await noDashboard(page);
});

test('Sesión persistida de una versión antigua se invalida; un nuevo login completo no requiere doble ingreso',async({page})=>{
 await login(page,'demo.sistemas@tecplayacar.edu.mx');await expect(page.locator('.dashboard-overview')).toBeVisible();
 await page.evaluate(()=>localStorage.setItem('spai.session.release','version-anterior-ficticia'));await page.reload();
 await expect(page.getByLabel('Cuenta ficticia del emulador')).toBeVisible();
 expect(await page.evaluate(()=>window.protectedInsertions)).toEqual([]);
 await page.getByLabel('Cuenta ficticia del emulador').selectOption(consulta);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await noDashboard(page);
});

test('H002 cambio Sistemas → Consulta limpia los datos y cancela suscripciones de la sesión previa',async({page})=>{
 await login(page,'demo.sistemas@tecplayacar.edu.mx');await expect(page.locator('.dashboard-overview')).toBeVisible();
 await page.getByRole('button',{name:'Abrir menu de usuario',exact:true}).click();
 await page.getByRole('menuitem',{name:'Salir del sistema'}).click();
 await expect(page.getByLabel('Cuenta ficticia del emulador')).toBeVisible();
 await page.evaluate(()=>window.protectedInsertions=[]);const targets=trackTargets(page);
 await page.getByLabel('Cuenta ficticia del emulador').selectOption(consulta);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();
 await noDashboard(page);assertTargets(targets);
});

test('H002 lecturas directas del servidor: sin usuarios, roles, solicitudes ni agenda ajenos',async()=>{
 await setup(async({client})=>{
  const c=await client(consulta);const outcomes=[];
  for(const name of ['usuarios','roles_personalizados','solicitudes_sistemas','agenda_operativa_equipo','asignaciones']){
   const diagnostic=await policyDenied(()=>getDocsFromServer(collection(c.db,name)));outcomes.push({collection:name,status:'permission-denied',diagnostic});
  }
  await policyDenied(()=>getDocFromServer(doc(c.db,'usuarios/demo-sistemas')));
  expect((await getDocFromServer(doc(c.db,'usuarios/demo-r01-consulta'))).exists()).toBe(true);
  expect((await getDocsFromServer(collection(c.db,'ciclos'))).size).toBeGreaterThan(0);
  writeFileSync(resolve(evidence,'h002-server-reads.json'),JSON.stringify({outcomes,ownProfile:'allowed',cycles:'allowed assignment dependency'},null,2));
 });
});

test('H002 sin módulos no hay bucle; revocar Dashboard retira contenido y suscripciones',async({page})=>{
 await setup(async({db,client,command,P})=>{
  const admin=await client('demo.sistemas@tecplayacar.edu.mx');
  await login(page,'demo.auxiliar@tecplayacar.edu.mx');await expect(page).toHaveURL(/\/acceso-restringido$/);await expect(page.getByRole('heading',{name:'Acceso restringido'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'Acceso restringido'})).toBeVisible();
  const grant=await command(admin,{action:'grantDelegation',targetId:'demo-auxiliar',expectedRevision:(await db.doc('usuarios/demo-auxiliar').get()).data().revision,value:{permissions:{dashboard:'VIEW',asignaciones:'VIEW'},capabilities:[],scope:P.scope({programs:['ADM'],cycles:['27-1']})}});
  try{
   await expect(page.locator('.dashboard-overview')).toBeVisible();
   await command(admin,{action:'revokeDelegation',targetId:grant.delegationId,expectedRevision:1});
   await expect(page).toHaveURL(/\/acceso-restringido$/);await expect(page.locator('.dashboard-overview,.metric-card')).toHaveCount(0);
   const aux=await client('demo.auxiliar@tecplayacar.edu.mx');await assert.rejects(()=>getDocFromServer(doc(aux.db,'asignaciones/demo-asignacion-a')),e=>e.code==='permission-denied');
   await page.reload();await expect(page.getByRole('heading',{name:'Acceso restringido'})).toBeVisible();
  }finally{const d=(await db.doc(`delegaciones/${grant.delegationId}`).get()).data();if(d.status==='ACTIVE')await command(admin,{action:'revokeDelegation',targetId:grant.delegationId,expectedRevision:d.revision});}
 });
});

test('H003 nombre completo sin superposición en Dashboard autorizado: escritorio, tabletas y móvil',async({page})=>{
 await setup(async({db})=>{
  const ref=db.doc('usuarios/demo-sistemas');const before=(await ref.get()).data();const name='María Fernanda de los Ángeles Hernández Rodríguez DEMO';
  await ref.update({name});
  try{
   await login(page,'demo.sistemas@tecplayacar.edu.mx');await expect(page.locator('#dashboard-welcome-title')).toContainText(name);
   const layouts=[];
   for(const [width,height] of [[1366,900],[768,1024],[1032,1376],[390,844]]){
    await page.setViewportSize({width,height});await expect(page.locator('.welcome-meta')).toBeVisible();
    const layout=await page.locator('.welcome-panel').evaluate(el=>{const title=el.querySelector('h2'),copy=el.querySelector('.welcome-copy'),meta=el.querySelector('.welcome-meta');return {title:title.textContent,titleBottom:title.getBoundingClientRect().bottom,copyBottom:copy.getBoundingClientRect().bottom,metaTop:meta.getBoundingClientRect().top,overflow:el.scrollWidth>el.clientWidth,fontSize:parseFloat(getComputedStyle(title).fontSize)};});
    expect(layout.titleBottom).toBeLessThanOrEqual(layout.metaTop);expect(layout.copyBottom).toBeLessThanOrEqual(layout.metaTop);expect(layout.overflow).toBe(false);expect(layout.fontSize).toBeGreaterThanOrEqual(20);layouts.push({width,height,...layout});
    await page.screenshot({path:resolve(evidence,`dashboard-after-${width}.png`),fullPage:true});
   }
   writeFileSync(resolve(evidence,'h003-layouts.json'),JSON.stringify(layouts,null,2));
  }finally{await ref.update({name:before.name});}
 });
});
