import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {deleteApp} from 'firebase/app';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {doc,updateDoc,terminate} from 'firebase/firestore';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {root,config,isolatedTest,localEnvironment,verifyHub,password} from '../local/config.mjs';
const require=createRequire(resolve(root,'functions/package.json')),P=require('./security/policy');
const out=resolve(root,'.local/scope-selector/screenshots');mkdirSync(out,{recursive:true});
const collections=['usuarios','delegaciones','roles_personalizados','asignaciones_roles','revisiones_roles','bitacora','eventos_seguridad','operaciones_seguridad','seguridad'];
let app,db,backup;
const scope=P.scope({programs:['ADM'],cycles:['27-1','saved-unresolved']});
async function snapshot(){const result={};for(const c of collections)result[c]=(await db.collection(c).get()).docs.map(d=>[d.id,d.data()]);return result;}
test.beforeEach(async({page})=>{
 assert.equal(isolatedTest,true);assert.equal(config.firestore,18080);await verifyHub();Object.assign(process.env,localEnvironment());
 app=require('firebase-admin/app').initializeApp({projectId:config.projectId},crypto.randomUUID());db=require('firebase-admin/firestore').getFirestore(app);backup=await snapshot();
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const base=(await db.doc('usuarios/demo-coord-a').get()).data();
 await db.doc('usuarios/scope-person').set({...base,id:'scope-person',authUid:'scope-person',name:'María Alejandra — Selección de ciclos ficticia',email:'demo.scope.person@tecplayacar.edu.mx',baseRole:'CUSTOM',status:'Activo',permissionSchemaVersion:2,revision:1,permissions:P.levels({asignaciones:'VIEW'}),basePermissions:P.levels({asignaciones:'VIEW'}),capabilities:[],baseCapabilities:[],scope,baseScope:scope,assignedPrograms:['ADM']});
});
test.afterEach(async()=>{
 for(const [c,rows] of Object.entries(backup)){const batch=db.batch();for(const d of (await db.collection(c).get()).docs)batch.delete(d.ref);for(const [id,data] of rows)batch.set(db.doc(c+'/'+id),data);await batch.commit();}
 await require('firebase-admin/app').deleteApp(app);
});
async function login(page,actor='sistemas'){
 await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(`demo.${actor}@tecplayacar.edu.mx`);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto('/usuarios');await expect(page.locator('.directory-filters')).toBeVisible();
}
async function edit(page){await page.getByRole('row').filter({hasText:'demo.scope.person@'}).getByRole('button',{name:'Editar',exact:true}).click();const d=page.locator('dialog[open]');await d.getByRole('button',{name:'2 Alcance académico',exact:true}).click();return d;}
async function save(page){const d=page.locator('dialog[open]');await d.getByRole('button',{name:'Revisar y confirmar',exact:true}).click();await d.getByLabel('Motivo del cambio').fill('Verificación aislada del selector de ciclos');await d.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(d).toHaveCount(0);}
for(const width of [320,390,768,1280])test('ÁMBITO selector accesible y guardado sin cambios '+width,async({page})=>{
 await page.setViewportSize({width,height:960});await login(page);
 await expect(page.getByRole('searchbox')).toHaveCount(0);await expect(page.getByLabel('Estado de la cuenta')).toBeVisible();
 await page.getByLabel('Estado de la cuenta').selectOption('Inactivo');await expect(page.getByRole('row').filter({hasText:'demo.scope.person@'})).toHaveCount(0);await page.getByLabel('Estado de la cuenta').selectOption('');
 await page.screenshot({path:resolve(out,`panel-${width}.png`),fullPage:true});
 await page.locator('.operational-heading').evaluate(el=>el.scrollIntoView({block:'start'}));
 await page.screenshot({path:resolve(out,`tabla-${width}.png`),fullPage:true});
 const d=await edit(page),picker=d.locator('spai-cycle-scope-picker');await picker.locator('summary').focus();await page.keyboard.press('Enter');await expect(picker.getByText('Ciclos históricos',{exact:true})).toBeVisible();
 await expect(picker).toContainText('Ciclo activo');await expect(picker).toContainText('Ciclos en preparación');await expect(picker).toContainText('saved-unresolved (no resuelto)');
 const active=picker.getByRole('checkbox',{name:/Ciclo DEMO 27-1/});await expect(active).toBeChecked();await active.focus();await page.keyboard.press('Space');await expect(active).not.toBeChecked();await page.keyboard.press('Space');await expect(active).toBeChecked();
 // Restore original order via reopening: keyboard changes do not commit or discard the saved unresolved value.
 await d.getByRole('button',{name:'Cancelar',exact:true}).click();await edit(page);await picker.locator('summary').click();
 await page.screenshot({path:resolve(out,`selector-${width}.png`),fullPage:true});await expect(d.locator('.editor-actions')).toBeInViewport();expect(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope).toEqual(scope);
});
test('ÁMBITO global excluyente, individual, múltiple, vacío y presentación Todos',async({page})=>{
 await db.doc('usuarios/scope-person').update({scope:{...scope,programs:['*'],cycles:['*'],teachers:['*'],fields:['*']},baseScope:{...scope,programs:['*'],cycles:['*'],teachers:['*'],fields:['*']},assignedPrograms:['*']});
 await page.setViewportSize({width:1280,height:960});await login(page);const globalRow=page.getByRole('row').filter({hasText:'demo.scope.person@'});await expect(globalRow.locator('td').nth(3)).toHaveText('Todos');await globalRow.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'tabla-global.png'),fullPage:true});
 await edit(page);const picker=page.locator('spai-cycle-scope-picker');await picker.locator('summary').click();await expect(picker.getByRole('checkbox',{name:'Todos los ciclos',exact:true})).toBeChecked();
 for(const name of ['programs','teachers','fields'])await expect(page.locator(`input[name="${name}"]`)).toHaveValue('Todos');
 await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope).toEqual({programs:['*'],cycles:['*'],teachers:['*'],fields:['*']});
 await edit(page);await picker.locator('summary').click();await picker.getByRole('checkbox',{name:/Ciclo DEMO 27-1/}).check();await expect(picker.getByRole('checkbox',{name:'Todos los ciclos',exact:true})).not.toBeChecked();await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope.cycles).toEqual(['27-1']);
 await edit(page);await picker.locator('summary').click();await picker.getByRole('checkbox',{name:/Ciclo DEMO 26-2/}).check();await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope.cycles).toEqual(['27-1','26-2']);
 await edit(page);await picker.locator('summary').click();await picker.getByRole('checkbox',{name:'Todos los ciclos',exact:true}).check();await expect(picker.getByRole('checkbox',{name:/Ciclo DEMO 27-1/})).not.toBeChecked();await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope.cycles).toEqual(['*']);
 await edit(page);await picker.getByRole('button',{name:'Retirar ciclo Todos',exact:true}).click();await expect(picker.locator('.selected-cycles')).toHaveText('Sin ámbito');await save(page);expect((await db.doc('usuarios/scope-person').get()).data().scope.cycles).toEqual([]);
});
test('ÁMBITO auxiliar: global rechazado por interfaz/callables y diagnóstico de escritura directa',async({page})=>{
 const limited=P.scope({programs:['ADM'],cycles:['27-1']});
 await db.doc('usuarios/demo-auxiliar').update({delegationId:'scope-grant',status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_OPERATIVO'});
 await db.doc('delegaciones/scope-grant').set({id:'scope-grant',userId:'demo-auxiliar',status:'ACTIVE',revision:1,permissions:P.levels({usuarios:'VIEW',asignaciones:'VIEW'}),capabilities:['MANAGE_CUSTOM_ROLES'],scope:limited});
 await db.doc('roles_personalizados/scope-global').set({id:'scope-global',revision:1,status:'ACTIVE',approvedBy:'demo-sistemas',name:'Global prohibido al auxiliar',permissions:P.levels({asignaciones:'VIEW'}),capabilities:[],scope:{...limited,cycles:['*']}});
 await login(page,'auxiliar');await page.getByRole('row').filter({hasText:'demo.scope.person@'}).getByRole('button',{name:'Ver acceso',exact:true}).click();await page.getByRole('button',{name:'Editar perfil',exact:true}).click();await expect(page.locator('spai-cycle-scope-picker')).toHaveCount(0);await expect(page.getByRole('option',{name:'Global prohibido al auxiliar'})).toHaveCount(0);
 const c=runtime.initializeFirebaseRuntime(localConfig,crypto.randomUUID());
 try{
  await signInWithEmailAndPassword(c.auth,'demo.auxiliar@tecplayacar.edu.mx',password);const before=await snapshot();
  const command=async data=>httpsCallable(c.functions,'securityCommand')({operationId:crypto.randomUUID(),reason:'Intento global aislado prohibido',...data});
  await assert.rejects(()=>command({action:'assignRole',targetId:'scope-person',expectedRevision:1,roleId:'scope-global',roleRevision:1}),e=>e.code==='functions/permission-denied');
  const person=(await db.doc('usuarios/scope-person').get()).data();await assert.rejects(()=>command({action:'saveUser',targetId:'scope-person',expectedRevision:1,value:{...person,scope:{...limited,cycles:['*']}}}),e=>e.code==='functions/permission-denied');
  // A Rules evaluation error is recorded separately, never credited as policy validation.
  // The callable negatives above require clean permission-denied responses.
  let rulesError;
  try { await updateDoc(doc(c.db,'usuarios/scope-person'),{'scope.cycles':['*']}); } catch(e) { rulesError=e; }
  assert.ok(rulesError,'La escritura directa no debe tener éxito');
  const clean=rulesError.code==='permission-denied' && !/evaluation error|Null value|maximum of|INTERNAL|UNAVAILABLE/i.test(rulesError.message);
  writeFileSync(resolve(root,'.local/scope-selector/direct-rules.json'),JSON.stringify({status:clean?'VERIFIED_DENIAL':'INCONCLUSIVE_EVALUATOR',code:rulesError.code,message:rulesError.message,creditedAsPolicyDenial:clean},null,2));
  test.info().annotations.push({type:'Rules probe',description:clean?'Rechazo sin errores de evaluación':'INCONCLUSO: error de evaluador; no acredita cumplimiento de Rules'});
  expect(await snapshot()).toEqual(before);
 }finally{await terminate(c.db);await deleteApp(c.app);}
});
