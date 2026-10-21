import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium,expect} from '@playwright/test';
import {config,root,localEnvironment,complementTest,verifyHub,password} from '../local/config.mjs';
assert.equal(complementTest,true);assert.equal(config.firestore,28080);await verifyHub();Object.assign(process.env,localEnvironment());
const require=createRequire(resolve(root,'functions/package.json'));
const {initializeApp,deleteApp}=require('firebase-admin/app');const app=initializeApp({projectId:config.projectId},randomUUID());
const db=require('firebase-admin/firestore').getFirestore(app),auth=require('firebase-admin/auth').getAuth(app),P=require('./security/policy');
const out=resolve(root,'docs/evidence/users-deletion');mkdirSync(out,{recursive:true});
const runId=randomUUID().slice(0,8),id='ui-baja-'+runId,email=`demo.${id}@tecplayacar.edu.mx`,name='Persona ficticia para baja '+runId;
const create=async(uid,label)=>{const mail=`demo.${uid}@tecplayacar.edu.mx`;await auth.createUser({uid,email:mail,password,emailVerified:true});await db.doc('usuarios/'+uid).set({authUid:uid,name:label,email:mail,baseRole:'CUSTOM',role:'Consulta',status:'Activo',revision:1,permissionSchemaVersion:2,permissions:P.levels({asignaciones:'VIEW'}),scope:P.scope({programs:['ADM'],cycles:['27-1']}),assignedPrograms:['ADM'],capabilities:[]});};
await create(id,name);
const snapshot=async()=>Object.fromEntries(await Promise.all(['usuarios','bitacora','operaciones_baja','eventos_baja','bajas_usuarios','bloqueos_identidad','bajas_correo'].map(async c=>[c,(await db.collection(c).orderBy('__name__').get()).docs.map(d=>[d.id,d.data()])])));
const browser=await chromium.launch({headless:true});const base='http://127.0.0.1:4204',errors=[],commands=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(25000);
 const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().endsWith('/userDeletionCommand'))commands.push(r.postDataJSON()?.data?.action);});
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto(base+'/usuarios');
 const row=page.locator('tbody tr').filter({hasText:email}),button=row.getByRole('button',{name:'Eliminar usuario',exact:true}),dialog=page.getByRole('dialog');
 await expect(button).toBeEnabled();const count=Number(await page.locator('.users-metrics strong').first().innerText());const before=await snapshot();
 for(const width of [1280,768,390,320]){
  await page.setViewportSize({width,height:900});await button.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,`boton-${width}.png`)});
  await button.click();await expect(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await expect(dialog).toContainText(name);await expect(dialog).toContainText(email);
  await expect(dialog).toContainText('Se retirará el acceso a SPAI y se eliminará la cuenta de acceso de Firebase Authentication. Se conservarán el historial y las referencias institucionales. La cuenta institucional de Google no se modificará.');
  await expect(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();await dialog.getByLabel('Motivo de la baja').fill('Ensayo de cancelación sin cambios');
  await expect(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeEnabled();await dialog.screenshot({path:resolve(out,`confirmacion-${width}.png`)});
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).focus();await page.keyboard.press('Enter');await expect(dialog).not.toBeVisible();await expect(button).toBeFocused();
 }
 assert.deepEqual(await snapshot(),before);assert.ok(commands.every(c=>c==='prepare'));await auth.getUser(id);
 await page.setViewportSize({width:1280,height:900});await button.click();await expect(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await expect(dialog.getByLabel('Motivo de la baja')).toHaveValue('');await dialog.getByLabel('Motivo de la baja').fill('Baja ficticia confirmada durante validación local');await dialog.getByRole('button',{name:'Eliminar usuario',exact:true}).click();
 await expect(row).toHaveCount(0);await expect(page.locator('.users-metrics strong').first()).toHaveText(String(count-1));await expect(page.getByRole('status').filter({hasText:'Baja completada.'})).toBeVisible();await assert.rejects(auth.getUser(id),e=>e.code==='auth/user-not-found');await page.screenshot({path:resolve(out,'baja-completada.png')});
 // Real pending operation using only an injected Auth failure in this isolated slot.
 const pendingId='ui-pendiente-'+runId;await create(pendingId,'Persona ficticia con baja pendiente');
 const {createUserDeletionService}=require('./security/user-deletion');const key=readFileSync(resolve(root,'functions/.secret.local'),'utf8').split(/\r?\n/).find(line=>line.startsWith('SPAI_USER_DELETION_PREVIEW_KEY=')).slice('SPAI_USER_DELETION_PREVIEW_KEY='.length);
 const fault=createUserDeletionService(db,{getUser:auth.getUser.bind(auth),getUserByEmail:auth.getUserByEmail.bind(auth),revokeRefreshTokens:auth.revokeRefreshTokens.bind(auth),deleteUser:async()=>{throw Object.assign(new Error('synthetic'),{code:'auth/internal-error'});}},{previewKey:key});
 const preview=(await fault.execute({uid:'demo-sistemas'},{action:'prepare',targetId:pendingId})).preview;
 const pending=await fault.execute({uid:'demo-sistemas'},{action:'confirm',token:preview.token,operationId:randomUUID(),reason:'Fallo ficticio de Authentication para verificar recuperación'});assert.equal(pending.result.status,'PENDING_AUTH');
 await page.reload();await expect(page.locator('tbody tr')).not.toHaveCount(0);await page.getByText('Seguimiento de bajas de usuarios',{exact:true}).click();await page.getByRole('button',{name:'Consultar bajas pendientes'}).click();const recovery=page.locator('.deletion-tracking article').filter({hasText:'Persona ficticia con baja pendiente'});await expect(recovery).toBeVisible();await recovery.getByRole('button',{name:'Reintentar eliminación en Authentication'}).click();await expect(recovery).toHaveCount(0);await assert.rejects(auth.getUser(pendingId),e=>e.code==='auth/user-not-found');
 // A real second browser session is open before its fictitious account is deleted.
 const secondaryId=!(await db.doc('usuarios/demo-coord-b').get()).data()?.deletedAt?'demo-coord-b':'demo-coord-a';const secondaryEmail=(await db.doc('usuarios/'+secondaryId).get()).data().email;
 const prior=await browser.newPage();await prior.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 await prior.goto(base);await prior.getByLabel('Cuenta ficticia del emulador').selectOption(secondaryEmail);await prior.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(prior.locator('nav')).toBeVisible();await prior.goto(base+'/asignaciones');await expect(prior.locator('spai-assignments-page')).toBeVisible();
 await page.reload();const priorRow=page.locator('tbody tr').filter({hasText:secondaryEmail});await priorRow.getByRole('button',{name:'Eliminar usuario',exact:true}).click();await expect(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await dialog.getByLabel('Motivo de la baja').fill('Baja ficticia con sesión anterior abierta');await dialog.getByRole('button',{name:'Eliminar usuario',exact:true}).click();await expect(priorRow).toHaveCount(0);await expect(prior.locator('spai-assignments-page')).toHaveCount(0);await expect(prior.getByText('Acceso dado de baja',{exact:true})).toBeVisible();await prior.screenshot({path:resolve(out,'sesion-anterior-bloqueada.png')});await prior.close();
 assert.deepEqual(errors,[]);writeFileSync(resolve(out,'ui-results.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',widths:[1280,768,390,320],cancelUnchanged:true,mandatoryReason:true,focusReturned:true,cleanReason:true,realCallableDeletion:true,directoryDelta:-1,metricDelta:-1,pendingRecovery:true,priorBrowserSessionCleared:true,commands,errors,physicalSecondComputer:false},null,2));console.log('PASS: modales, cancelación, baja real, indicadores y recuperación administrativa.');
}finally{await browser.close();await deleteApp(app);}
