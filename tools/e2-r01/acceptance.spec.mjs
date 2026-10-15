import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {deleteApp} from 'firebase/app';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {doc,collection,query,where,getDocFromServer,getDocsFromServer,updateDoc,setDoc,deleteDoc,terminate} from 'firebase/firestore';
import {config,root,isolatedTest,localEnvironment,verifyHub,password} from '../local/config.mjs';
import {runtime,localConfig} from '../local/tests/runtime.mjs';
import {createT10Assignment} from './t10-fixture.mjs';

const evidence=resolve(root,'.local/acceptance'); mkdirSync(evidence,{recursive:true});
test.beforeEach(async({page})=>{
 assert.equal(isolatedTest,true); await verifyHub();
 await page.addInitScript(()=>localStorage.setItem('spai.session.release','2026-08-03-operational-dashboard'));
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
});
async function login(page,email){await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(email);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();}
async function setup(work){
 Object.assign(process.env,localEnvironment()); const require=createRequire(resolve(root,'functions/package.json'));
 const {initializeApp,deleteApp:deleteAdmin}=require('firebase-admin/app');const {getFirestore}=require('firebase-admin/firestore');
 const admin=initializeApp({projectId:config.projectId},crypto.randomUUID());const db=getFirestore(admin);const clients=[];
 const client=async(email)=>{const c=runtime.initializeFirebaseRuntime(localConfig,crypto.randomUUID());clients.push(c);await signInWithEmailAndPassword(c.auth,email,password);return c;};
 const command=async(c,data)=>(await httpsCallable(c.functions,'securityCommand')({operationId:crypto.randomUUID(),reason:'Ensayo aislado de aceptación R01',...data})).data;
 try{await work({db,client,command,P:require('./security/policy')});}finally{for(const c of clients){await terminate(c.db);await deleteApp(c.app);}await deleteAdmin(admin);}
}
async function denied(action,kind){
 await assert.rejects(action,e=>{
  if(!['permission-denied','functions/permission-denied'].includes(e.code)||/maximum of|INTERNAL|UNAVAILABLE/i.test(e.message))return false;
  for(const m of e.message.matchAll(/evaluation error at L(\d+):\d+ for '(\w+)'/g)){
   if(kind==='create'&&m[2]==='update')continue;
   if(!e.message.includes(`false for '${m[2]}' @ L${m[1]},`)&&!e.message.endsWith(`false for '${m[2]}' @ L${m[1]}`))return false;
  } return true;
 });
}
// REST emits the same preliminary diagnostics as streaming writes. As in the
// established integration suite, every applicable allow line must also return
// explicit false; an evaluation error or catch-all denial alone never passes.
async function restWriteDenied(c,path,values,operation='update') {
 const encode=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v};
 const name=`projects/${config.projectId}/databases/(default)/documents/${path}`;
 const write=operation==='delete'?{delete:name}:{update:{name,fields:Object.fromEntries(Object.entries(values).map(([k,v])=>[k,encode(v)]))},...(operation==='update'?{updateMask:{fieldPaths:Object.keys(values)},currentDocument:{exists:true}}:{currentDocument:{exists:false}})};
 const response=await fetch(`http://${config.host}:${config.firestore}/v1/projects/${config.projectId}/databases/(default)/documents:commit`,{method:'POST',headers:{Authorization:`Bearer ${await c.auth.currentUser.getIdToken()}`,'Content-Type':'application/json'},body:JSON.stringify({writes:[write]})});
 const result=await response.json();expect(response.status).toBe(403);expect(result.error.status).toBe('PERMISSION_DENIED');expect(result.error.message).not.toMatch(/maximum of|Null value|INTERNAL|UNAVAILABLE/i);
 await denied(async()=>{const error=new Error(result.error.message);error.code='permission-denied';throw error;},operation);
}
test('T09 identidad CUSTOM autenticable: UI, ámbitos y rechazos directos de servidor',async({page})=>{
 await setup(async({db,client})=>{
  const c=await client('demo.r01.consulta@tecplayacar.edu.mx');const own=doc(c.db,'asignaciones/demo-asignacion-a');
  const before=(await db.doc('asignaciones/demo-asignacion-a').get()).data();
  expect((await getDocFromServer(own)).exists()).toBe(true);
  const rows=await getDocsFromServer(query(collection(c.db,'asignaciones'),where('program','==','ADM'),where('cycle','==','27-1')));
  expect(rows.size).toBeGreaterThan(0);expect(rows.docs.every(d=>d.data().program==='ADM'&&d.data().cycle==='27-1')).toBe(true);
  for(const id of ['demo-asignacion-b','demo-asignacion-cerrada'])await denied(()=>getDocFromServer(doc(c.db,'asignaciones',id)));
  await denied(()=>getDocsFromServer(collection(c.db,'asignaciones')));
  for(const value of [{teacherName:'NO'},{studentEnrollments:'NO'},{status:'EN_REVISION'},{sharedGroups:['NO']}])await denied(()=>updateDoc(own,value));
  await denied(()=>deleteDoc(own));
  expect((await db.doc('asignaciones/acceptance-create-denied').get()).exists).toBe(false);
  await denied(()=>setDoc(doc(c.db,'asignaciones/acceptance-create-denied'),{...before,createdBy:c.auth.currentUser.uid}),'create');
  await denied(()=>httpsCallable(c.functions,'securityDirectory')({}));
  await restWriteDenied(c,'asignaciones/demo-asignacion-a',{teacherName:'NO'});
  await restWriteDenied(c,'asignaciones/demo-asignacion-a',null,'delete');
  await restWriteDenied(c,'asignaciones/acceptance-create-denied',{...before,createdBy:c.auth.currentUser.uid},'create');
  expect((await db.doc('asignaciones/demo-asignacion-a').get()).data()).toEqual(before);
  await login(page,'demo.r01.consulta@tecplayacar.edu.mx');await expect(page).toHaveURL(/\/asignaciones$/);
  await expect(page.locator('.table-panel tbody')).toContainText('27-1 ADM');await expect(page.locator('.table-panel tbody')).not.toContainText('DER');
  await expect(page.locator('nav a')).toHaveCount(1);
  await expect(page.getByRole('button',{name:/Editar asignacion|Eliminar asignacion|^Asignacion$/})).toHaveCount(0);
  await page.screenshot({path:resolve(evidence,'t09-custom.png'),fullPage:true});
  for(const route of ['/usuarios','/ciclos','/moodle']){await page.goto(route);await expect(page).not.toHaveURL(new RegExp(`${route}$`));}
  writeFileSync(resolve(evidence,'t09.json'),JSON.stringify({status:'PASS',actor:'demo-r01-consulta',scope:{programs:['ADM'],cycles:['27-1']},writes:'denied',directReadsOutside:'denied',ui:'one module; no write controls',browser:'Chromium'},null,2));
 });
});
test('T10 excepción académica global en Captura; CUSTOM y auxiliar conservan su ámbito',async({page,browser})=>{
 await setup(async({db,client,command,P})=>{
  const admin=await client('demo.sistemas@tecplayacar.edu.mx');const academic=await client('demo.coordinacion.a@tecplayacar.edu.mx');const custom=await client('demo.r01.consulta@tecplayacar.edu.mx');const aux=await client('demo.auxiliar@tecplayacar.edu.mx');
  expect((await db.doc('ciclos/demo-27-1').get()).data().status).toBe('Captura');
  const grant=await command(admin,{action:'grantDelegation',targetId:'demo-auxiliar',expectedRevision:(await db.doc('usuarios/demo-auxiliar').get()).data().revision,value:{permissions:{asignaciones:'EDIT'},capabilities:[],scope:P.scope({programs:['ADM'],cycles:['27-1']})}});
  const actors=[];
  for(const c of [academic,custom,aux]){const u=(await db.doc(`usuarios/${c.auth.currentUser.uid}`).get()).data();const d=u.delegationId?(await db.doc(`delegaciones/${u.delegationId}`).get()).data():null;actors.push({uid:c.auth.currentUser.uid,profile:u,delegation:d,effective:P.effective(u,d)});}
  writeFileSync(resolve(evidence,'t10-actors-before.json'),JSON.stringify(actors,null,2));
  await createT10Assignment(db);
  try{
   const a=doc(academic.db,'asignaciones/acceptance-foreign');expect((await getDocFromServer(a)).exists()).toBe(true);
   await updateDoc(a,{studentEnrollments:'demo-adicional-001'});
   expect((await db.doc('asignaciones/acceptance-foreign').get()).data().studentEnrollments).toBe('demo-adicional-001');
   await denied(()=>updateDoc(a,{teacherName:'NO'}));
   for(const c of [custom,aux]){await denied(()=>getDocFromServer(doc(c.db,'asignaciones/acceptance-foreign')));await denied(()=>updateDoc(doc(c.db,'asignaciones/acceptance-foreign'),{studentEnrollments:'NO'}));}
   expect((await getDocFromServer(doc(aux.db,'asignaciones/demo-asignacion-a'))).exists()).toBe(true);
   await login(page,'demo.coordinacion.a@tecplayacar.edu.mx');await page.goto('/asignaciones');
   const toggle=page.getByRole('button',{name:'Catalogo global',exact:true});if(await toggle.count())await toggle.click();
   await expect(page.locator('.table-panel tbody')).toContainText('27-1 DER');
   const foreignRow=page.locator('.table-panel tbody tr').filter({hasText:'acceptance-foreign'});
   await foreignRow.getByRole('button',{name:'Editar asignacion',exact:true}).click();
   await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toBeVisible();
   await page.screenshot({path:resolve(evidence,'t10-academic.png'),fullPage:true});
   const beforeUi=(await db.doc('asignaciones/acceptance-foreign').get()).data();
   await page.locator('.additional-enrollments-only-field textarea').fill('DEMO-T10-UI-002');
   await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
   await expect(page.getByRole('button',{name:'Guardar cambios',exact:true})).toHaveCount(0);
   await expect.poll(async()=>(await db.doc('asignaciones/acceptance-foreign').get()).data().studentEnrollments).toBe('DEMO-T10-UI-002');
   const afterUi=(await db.doc('asignaciones/acceptance-foreign').get()).data();
   for(const key of ['program','cycle','teacherName','teacherMoodleUser','group','sharedGroups','moodleId','subjectId','status'])expect(afterUi[key]).toEqual(beforeUi[key]);
   writeFileSync(resolve(evidence,'t10.json'),JSON.stringify({status:'PASS',cycle:'27-1',state:'Captura',foreign:'acceptance-foreign DER',academic:'SDK and UI enrollments allowed; teacher denied; protected fields unchanged',custom:'foreign read/write denied',auxiliary:'foreign read/write denied; own read allowed',humanAcceptance:'PENDING'},null,2));
   const other=await browser.newPage();await other.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
   await other.addInitScript(()=>localStorage.setItem('spai.session.release','2026-08-03-operational-dashboard'));
   try {await other.goto(test.info().project.use.baseURL);await other.getByLabel('Cuenta ficticia del emulador').selectOption('demo.auxiliar@tecplayacar.edu.mx');await other.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(other.locator('nav')).toBeVisible();await other.goto(`${test.info().project.use.baseURL}/asignaciones`);await expect(other.locator('.table-panel tbody')).toContainText('27-1 ADM');await expect(other.locator('.table-panel tbody')).not.toContainText('27-1 DER');await other.screenshot({path:resolve(evidence,'t10-auxiliary.png'),fullPage:true});}finally{await other.close();}
  }finally{await command(admin,{action:'revokeDelegation',targetId:grant.delegationId,expectedRevision:1});await db.doc('asignaciones/acceptance-foreign').delete();}
 });
});
test('T11 revocación: siguientes operaciones denegadas y rol del destinatario activo con revisión',async({page})=>{
 await setup(async({db,client,command,P})=>{
  const admin=await client('demo.sistemas@tecplayacar.edu.mx');const aux=await client('demo.auxiliar@tecplayacar.edu.mx');
  const grant=await command(admin,{action:'grantDelegation',targetId:'demo-auxiliar',expectedRevision:(await db.doc('usuarios/demo-auxiliar').get()).data().revision,value:{permissions:{asignaciones:'VIEW'},capabilities:['MANAGE_CUSTOM_ROLES'],scope:P.scope({programs:['ADM'],cycles:['27-1']})}});
  try {
  await command(admin,{action:'saveUser',targetId:'acceptance-recipient',expectedRevision:0,value:{name:'Destinatario ficticio',email:'demo.destinatario@tecplayacar.edu.mx',area:'Pruebas R01',baseRole:'CUSTOM',status:'Activo',permissions:{},assignedPrograms:['ADM'],scope:P.scope({programs:['ADM'],cycles:['27-1']})}});
  const role=(await db.collection('roles_personalizados').where('name','==','PRUEBA-R01-Consulta').get()).docs[0];
  const assigned=await command(aux,{action:'assignRole',targetId:'acceptance-recipient',expectedRevision:(await db.doc('usuarios/acceptance-recipient').get()).data().revision,roleId:role.id,roleRevision:role.data().revision});
  await login(page,'demo.auxiliar@tecplayacar.edu.mx');await page.goto('/usuarios');await expect(page.getByRole('heading',{name:'Asignar un rol preaprobado'})).toBeVisible();
  const revoked=await command(admin,{action:'revokeDelegation',targetId:grant.delegationId,expectedRevision:1});
  await expect(page.locator('.security-panel')).toHaveCount(0);
  await denied(()=>getDocFromServer(doc(aux.db,'asignaciones/demo-asignacion-a')));
  await denied(()=>updateDoc(doc(aux.db,'asignaciones/demo-asignacion-a'),{studentEnrollments:'NO'}));
  await denied(()=>httpsCallable(aux.functions,'securityDirectory')({}));
  await denied(()=>command(aux,{action:'removeRole',targetId:assigned.assignmentId,expectedRevision:1}));
  const kept=(await db.doc(`asignaciones_roles/${assigned.assignmentId}`).get()).data();expect(kept.status).toBe('ACTIVE');expect(kept.reviewStatus).toBe('REQUIERE_REVISION_ADMIN_GENERAL');expect(kept.assignedByDelegationId).toBe(grant.delegationId);
  expect(revoked.reviewIds).toHaveLength(1);expect((await db.doc(`revisiones_roles/${revoked.reviewIds[0]}`).get()).data().status).toBe('REQUIERE_REVISION_ADMIN_GENERAL');
  writeFileSync(resolve(evidence,'t11.json'),JSON.stringify({status:'PASS',auxiliary:'demo-auxiliar',delegation:grant.delegationId,assignment:kept,reviewId:revoked.reviewIds[0],followingOperations:'read/update/directory/removeRole denied',physicalDevices:'not tested by Codex'},null,2));
  } finally {
   const current=(await db.doc(`delegaciones/${grant.delegationId}`).get()).data();
   if(current.status==='ACTIVE')await command(admin,{action:'revokeDelegation',targetId:grant.delegationId,expectedRevision:current.revision});
  }
 });
});
for(const [width,height] of [[1366,900],[768,1024],[1032,1376],[390,844]])test(`CO-11 formulario y roles accesibles ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});await login(page,'demo.sistemas@tecplayacar.edu.mx');await page.goto('/usuarios');
 const opener=page.getByRole('button',{name:'Nuevo perfil institucional',exact:true});await expect(opener).toBeVisible();
 await page.screenshot({path:resolve(evidence,`directorio-usuarios-after-${width}.png`),fullPage:true});
 await opener.click();const dialog=page.getByRole('dialog');
 for(const label of ['Nombre','Correo institucional','Área institucional real','Perfil','Saludo','Estado','Programas (claves separadas por coma)','Ciclos (códigos separados por coma)','Docentes (identidades verificadas, separadas por coma)','Motivo del cambio']){
  const field=['Perfil','Saludo','Estado'].includes(label)?dialog.getByRole('combobox',{name:label,exact:true}):dialog.getByLabel(label,{exact:true});await field.focus();await expect(field).toBeFocused();await expect(field).toBeInViewport();
 }
 const body=dialog.locator('.editor-body');await body.evaluate(el=>el.scrollTop=0);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 expect(await body.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(width<=800?1:2);
 await expect(dialog.locator('.editor-heading')).toBeInViewport();await expect(dialog.locator('.editor-actions')).toBeInViewport();
 await page.screenshot({path:resolve(evidence,`usuarios-after-${width}.png`),fullPage:true});
 await page.keyboard.press('Escape');await expect(opener).toBeFocused();
 await page.getByRole('button',{name:'Administrar roles personalizados',exact:true}).click();await expect(dialog.locator('form')).toHaveCount(0);
 await page.screenshot({path:resolve(evidence,`directorio-roles-after-${width}.png`),fullPage:true});
 await dialog.getByRole('button',{name:'Crear rol',exact:true}).click();await dialog.getByLabel('Nombre',{exact:true}).fill('Solo inspección; cancelar');
 const row=dialog.locator('.permission-row').filter({hasText:'asignaciones'});
 await row.getByLabel('Editar',{exact:true}).check();await expect(row.getByLabel('Consultar',{exact:true})).toBeChecked();await row.getByLabel('Consultar',{exact:true}).uncheck();await expect(row.getByLabel('Editar',{exact:true})).not.toBeChecked();
 await page.screenshot({path:resolve(evidence,`roles-after-${width}.png`),fullPage:true});
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
});
