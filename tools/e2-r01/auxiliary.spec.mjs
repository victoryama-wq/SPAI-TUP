import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {root,config,isolatedTest,localEnvironment,verifyHub} from '../local/config.mjs';
import {auxiliaryFixture} from './auxiliary-fixture.mjs';
const out=resolve(root,'.local/aux-review');mkdirSync(out,{recursive:true});let admin,db,fixture;
test.beforeEach(async({page})=>{
 assert.equal(isolatedTest,true);await verifyHub();Object.assign(process.env,localEnvironment());
 const require=createRequire(resolve(root,'functions/package.json'));admin=require('firebase-admin/app').initializeApp({projectId:config.projectId},crypto.randomUUID());db=require('firebase-admin/firestore').getFirestore(admin);
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
});
test.afterEach(async()=>{await fixture?.restore();fixture=undefined;const require=createRequire(resolve(root,'functions/package.json'));await require('firebase-admin/app').deleteApp(admin);});
async function login(page,actor='auxiliar'){await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(`demo.${actor}@tecplayacar.edu.mx`);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();}
function track(page){const targets=[],errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(r.url().includes('Firestore/Listen')&&r.postData())for(const [k,v] of new URLSearchParams(r.postData()))if(k.endsWith('__data__'))try{const d=JSON.parse(v);if(d.addTarget)targets.push(d.addTarget);}catch{}});return {targets,errors};}
const none=async(page)=>{await expect(page.getByRole('button',{name:/^(Nuevo docente|Asignacion|Nueva categoria|Nueva plantilla|Cargar CSV|Guardar categoria|Guardar plantilla)$/i})).toHaveCount(0);await expect(page.locator('input[type=file]')).toHaveCount(0);};

test('AUX caducidad de delegación retira datos y navegación sin otra escritura',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'VIEW'});
 const now=Date.now();await page.clock.install({time:now});
 await db.doc('delegaciones/aux-regression').update({expiresAtMillis:now+600000});
 await login(page);await page.goto('/asignaciones');await expect(page.locator('tbody')).toContainText('27-1 ADM');
 await page.clock.fastForward(600001);
 await expect(page).toHaveURL(/acceso-restringido$/);await expect(page.locator('nav a')).toHaveCount(0);
 await expect(page.locator('body')).not.toContainText('DOCENTE FICTICIO 1');
 expect((await db.doc('delegaciones/aux-regression').get()).data().status).toBe('ACTIVE');
});
test('AUX ámbito vacío comprobado: sin consultas imposibles ni acciones ni ceros verificados',async({page})=>{
 fixture=await auxiliaryFixture(db,{empty:true,capabilities:['VALIDATE_TEACHERS','MANAGE_MOODLE_TEMPLATES','CONFIRM_MOODLE_UPDATE']});const tracked=track(page);await login(page);
 for(const route of ['docentes','asignaciones','moodle']){
  await page.goto('/'+route);await expect(page.locator('body')).toContainText('Sin ámbito de consulta concedido');await none(page);
  await expect(page.locator('body')).not.toContainText(/Null value|evaluation error|Sin asignaciones en el catalogo global/);
  await page.screenshot({path:resolve(out,`empty-${route}-after.png`),fullPage:true});
 }
 const queried=tracked.targets.flatMap(t=>t.query?.structuredQuery?.from?.map(f=>f.collectionId)??[]);
 for(const c of ['docentes','asignaciones','moodle_categorias','moodle_plantillas'])expect(queried).not.toContain(c);
 expect(tracked.errors.filter(x=>/No se pudo leer/.test(x))).toEqual([]);writeFileSync(resolve(out,'empty-targets.json'),JSON.stringify(tracked,null,2));
});
test('AUX VIEW positivo, recarga y cambio Sistemas → Auxiliar sin datos ni capacidades anteriores',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'VIEW'});await login(page,'sistemas');await page.goto('/asignaciones');await expect(page.locator('tbody')).toContainText('27-1 DER');
 await page.getByRole('button',{name:'Abrir menu de usuario',exact:true}).click();await page.getByRole('menuitem',{name:'Salir del sistema'}).click();await login(page);
 for(const route of ['docentes','asignaciones','moodle']){
  await page.goto('/'+route);await page.reload();
  if(route==='docentes')await expect(page.locator('tbody')).toContainText('DOCENTE FICTICIO 1');
  if(route==='asignaciones'){await expect(page.locator('tbody')).toContainText('27-1 ADM');await expect(page.locator('tbody')).not.toContainText('27-1 DER');}
  if(route==='moodle'){await expect(page.locator('body')).toContainText('AUX-ADM');await expect(page.locator('body')).not.toContainText('AUX-DER');}
  await none(page);await expect(page.getByRole('button',{name:/Editar categoria|Editar plantilla|Editar asignacion|Eliminar categoria|Eliminar plantilla/})).toHaveCount(0);
  await page.screenshot({path:resolve(out,`view-${route}-after.png`),fullPage:true});
 }
});
test('AUX revocación directa de delegación retira menú, datos y ruta con proyección antigua intacta',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'VIEW'});await login(page);await page.goto('/asignaciones');await expect(page.locator('tbody')).toContainText('27-1 ADM');
 await db.doc('delegaciones/aux-regression').update({status:'REVOKED',revision:2});
 await expect(page).toHaveURL(/\/acceso-restringido$/);await expect(page.locator('tbody')).toHaveCount(0);await expect(page.locator('nav a')).toHaveCount(0);
 for(const route of ['docentes','asignaciones','moodle']){await page.goto('/'+route);await expect(page).toHaveURL(/\/acceso-restringido$/);}
 await page.reload();await expect(page).toHaveURL(/\/acceso-restringido$/);await page.screenshot({path:resolve(out,'revoked-after.png'),fullPage:true});
});
test('AUX consulta vacía válida, error técnico y recarga de recuperación son estados distintos',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'VIEW'});await db.doc('delegaciones/aux-regression').update({scope:{...fixture.scope,programs:['VACIO']}});
 await login(page);await page.goto('/asignaciones');await expect(page.locator('tbody')).toContainText('Sin asignaciones en tu ámbito para este ciclo');await expect(page.getByTestId('assignments-read-state')).toHaveCount(0);
 // Deny the data transport only; profile/grant may resolve, but data is unverified.
 await page.route('**/google.firestore.v1.Firestore/Listen/**',r=>r.abort());await page.reload();
 await expect(page.locator('body')).not.toContainText('Sin asignaciones en tu ámbito para este ciclo');
 await page.unroute('**/google.firestore.v1.Firestore/Listen/**');await page.reload();await expect(page.locator('tbody')).toContainText('Sin asignaciones en tu ámbito para este ciclo');
});
test('AUX EDIT sin capacidades sensibles permite ficha pero no administra Moodle',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'EDIT'});await login(page);await page.goto('/docentes');await expect(page.locator('tbody')).toContainText('DOCENTE FICTICIO 1');await expect(page.getByRole('button',{name:/Editar (docente|ficha)/})).toHaveCount(1);
 await page.goto('/moodle');await expect(page.locator('body')).toContainText('AUX-ADM');await none(page);await expect(page.getByRole('button',{name:/Editar categoria|Editar plantilla/})).toHaveCount(0);
});

test('AUX rechazo real del servidor no se presenta como lista vacía ni permite exportar',async({page})=>{
 fixture=await auxiliaryFixture(db,{level:'VIEW'});await login(page);
 await page.route('**/google.firestore.v1.Firestore/Listen/**',async route=>{
  const body=route.request().postData();if(!body)return route.continue();const params=new URLSearchParams(body);let changed=false;
  for(const [key,value] of params)if(key.endsWith('__data__'))try{
   const data=JSON.parse(value);const q=data.addTarget?.query?.structuredQuery;
   if(q?.from?.[0]?.collectionId==='asignaciones'){
    const replace=node=>{if(node?.fieldFilter?.field?.fieldPath==='program'){node.fieldFilter.value={arrayValue:{values:[{stringValue:'DER'}]}};changed=true;}for(const f of node?.compositeFilter?.filters??[])replace(f);};replace(q.where);params.set(key,JSON.stringify(data));
   }
  }catch{}
  return route.continue(changed?{postData:params.toString()}:{});
 });
 await page.goto('/asignaciones');await expect(page.getByTestId('assignments-read-state')).toContainText('Acceso denegado o revocado');
 await expect(page.locator('tbody')).not.toContainText('Sin asignaciones en tu ámbito para este ciclo');await expect(page.locator('body')).not.toContainText(/Null value|evaluation error/);
 await expect(page.getByRole('button',{name:'Reporte Excel'})).toBeDisabled();await expect(page.locator('.status-summary-list strong').first()).toHaveText('—');
 await page.screenshot({path:resolve(out,'denied-after.png'),fullPage:true});
});
