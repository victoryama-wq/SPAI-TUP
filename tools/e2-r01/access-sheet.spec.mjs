import {test,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {mkdirSync} from 'node:fs';
import {root,config,isolatedTest,localEnvironment,verifyHub} from '../local/config.mjs';
const require=createRequire(resolve(root,'functions/package.json'));
const P=require('./security/policy');
const out=resolve(root,'.local/access-sheet/screenshots');mkdirSync(out,{recursive:true});
const collections=['usuarios','delegaciones','roles_personalizados','asignaciones_roles','revisiones_roles','bitacora','eventos_seguridad','operaciones_seguridad','seguridad'];
let app,db,backup;
const scope=P.scope({programs:['ADM'],cycles:['27-1']});
test.beforeEach(async({page})=>{
 assert.equal(isolatedTest,true);assert.equal(config.firestore,18080);await verifyHub();Object.assign(process.env,localEnvironment());
 app=require('firebase-admin/app').initializeApp({projectId:config.projectId},crypto.randomUUID());db=require('firebase-admin/firestore').getFirestore(app);
 backup=new Map();for(const c of collections)backup.set(c,(await db.collection(c).get()).docs.map(d=>[d.id,d.data()]));
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const base=(await db.doc('usuarios/demo-coord-a').get()).data();
 await db.doc('usuarios/sheet-person').set({...base,id:'sheet-person',authUid:'sheet-person',name:'María Alejandra de los Ángeles — Persona ficticia',email:'demo.sheet.person@tecplayacar.edu.mx',baseRole:'CUSTOM',status:'Activo',permissionSchemaVersion:2,revision:1,permissions:P.levels(),basePermissions:P.levels(),capabilities:[],baseCapabilities:[],scope,baseScope:scope,assignedPrograms:['ADM']});
 const aux=(await db.doc('usuarios/demo-auxiliar').get()).data();
 await db.doc('usuarios/demo-auxiliar').set({...aux,status:'Activo',permissionSchemaVersion:2,baseRole:'ADMIN_OPERATIVO',delegationId:'sheet-grant'});
 await db.doc('delegaciones/sheet-grant').set({id:'sheet-grant',userId:'demo-auxiliar',status:'ACTIVE',revision:1,permissions:P.levels({usuarios:'VIEW',asignaciones:'VIEW'}),capabilities:['MANAGE_CUSTOM_ROLES'],scope});
 await db.doc('roles_personalizados/sheet-role').set({id:'sheet-role',name:'Consulta preaprobada de la ficha',status:'ACTIVE',approvedBy:'demo-sistemas',revision:1,permissions:P.levels({asignaciones:'VIEW'}),capabilities:[],scope});
 await db.doc('roles_personalizados/sheet-forbidden').set({id:'sheet-forbidden',name:'Rol fuera del techo delegado',status:'ACTIVE',approvedBy:'demo-sistemas',revision:1,permissions:P.levels({asignaciones:'EDIT'}),capabilities:[],scope});
});
test.afterEach(async()=>{
 // Only the isolated suite owns these collections. Shared emulators never enter this fixture.
 for(const [c,rows] of backup){const batch=db.batch();for(const doc of (await db.collection(c).get()).docs)batch.delete(doc.ref);for(const [id,data] of rows)batch.set(db.doc(c+'/'+id),data);await batch.commit();}
 await require('firebase-admin/app').deleteApp(app);
});
async function login(page,actor='sistemas'){
 await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(`demo.${actor}@tecplayacar.edu.mx`);
 await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav').first()).toBeVisible();
 await page.goto('/usuarios');await expect(page.locator('.directory-filters')).toBeVisible();
}
async function person(page,email='demo.sheet.person@'){
 const trigger=page.getByRole('row').filter({hasText:email}).getByRole('button',{name:'Ver acceso',exact:true});await trigger.click();return trigger;
}
async function editAssignment(page){
 const dialog=page.locator('dialog[open]');await dialog.getByRole('button',{name:'Editar perfil',exact:true}).click();
 const intent=dialog.getByLabel('Operación sobre el perfil');if(await intent.count())await intent.selectOption('assignment');
 await dialog.getByRole('combobox',{name:'Rol preaprobado',exact:true}).selectOption('sheet-role');return dialog;
}
async function review(page){
 const dialog=page.locator('dialog[open]');await dialog.getByRole('button',{name:'Revisar y confirmar',exact:true}).click();
 await dialog.getByRole('button',{name:'Revisar y confirmar',exact:true}).click();return dialog;
}
for(const width of [320,390,768,1280])test(`FICHA presentación, ámbitos, teclado y cancelación ${width}`,async({page})=>{
 await page.setViewportSize({width,height:960});
 await db.doc('usuarios/sheet-person').update({permissions:P.levels({asignaciones:'VIEW'}),basePermissions:P.levels({asignaciones:'VIEW'})});
 await db.doc('revisiones_roles/sheet-review').set({userId:'sheet-person',status:'REQUIERE_REVISION_ADMIN_GENERAL',revision:1});
 await db.doc('asignaciones_roles/sheet-retired').set({userId:'sheet-person',roleId:'sheet-role',status:'REMOVED',reviewStatus:'RESOLVED',revision:2});
 await login(page);let writes=0;page.on('request',r=>{if(r.url().endsWith('/securityCommand'))writes++;});
 const trigger=await person(page);const dialog=page.locator('dialog[open]');
 await expect(dialog).toContainText('Perfil y permisos vigentes');await expect(dialog).toContainText('1 revisiones pendientes');
 await expect(dialog.locator('.person-permissions')).toContainText('Acceso efectivo: Consultar');
 await expect(dialog.locator('.scope-grid')).toContainText('ADM');await expect(dialog.locator('.scope-grid')).toContainText('27-1');
 await expect(dialog.locator('.scope-grid')).toContainText('Sin ámbito');await expect(dialog.locator('.scope-grid')).toContainText('No aplica');
 await expect(dialog.getByText('Asignar un rol preaprobado',{exact:true})).toHaveCount(0);
 await expect(dialog.locator('.person-history')).not.toHaveAttribute('open','');
 await expect(dialog.locator('#security-editor-title')).toBeFocused();
 await page.screenshot({path:resolve(out,`ficha-${width}.png`),fullPage:true});
 await dialog.getByText('No aplica: sin facultad extraordinaria',{exact:true}).scrollIntoViewIfNeeded();await expect(dialog.getByText('No aplica: sin facultad extraordinaria',{exact:true})).toBeInViewport();await expect(dialog.locator('.editor-actions')).toBeInViewport();await page.screenshot({path:resolve(out,`alcances-${width}.png`),fullPage:true});
 await dialog.locator('.person-history > summary').click();await expect(dialog.locator('.person-history')).toContainText('Retirado');
 await expect(dialog.getByRole('button',{name:'Conservar',exact:true})).toBeVisible();await dialog.locator('.person-history > summary').click();
 await dialog.getByRole('button',{name:'Editar perfil',exact:true}).click();await expect(dialog.getByLabel('Nombre',{exact:true})).toHaveValue('María Alejandra de los Ángeles — Persona ficticia');
 await dialog.getByLabel('Nombre',{exact:true}).fill('Borrador cancelado');await dialog.getByRole('button',{name:'3 Módulos disponibles',exact:true}).click();
 await expect(dialog.locator('#available-modules')).toBeFocused();await expect(dialog.getByLabel('Nombre',{exact:true})).toHaveValue('Borrador cancelado');
 await dialog.getByRole('button',{name:'1 Datos de acceso',exact:true}).click();
 await page.screenshot({path:resolve(out,`editor-${width}.png`),fullPage:true});
 await expect(dialog.locator('.editor-actions')).toBeInViewport();expect(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1)).toBe(true);
 await page.keyboard.press('Tab');expect(await dialog.evaluate(d=>d.contains(document.activeElement))).toBe(true);
 await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(trigger).toBeFocused();expect(writes).toBe(0);
 expect((await db.doc('usuarios/sheet-person').get()).data().name).not.toBe('Borrador cancelado');
 await person(page);await dialog.getByRole('button',{name:'Editar perfil',exact:true}).click();await expect(dialog.getByLabel('Nombre',{exact:true})).not.toHaveValue('Borrador cancelado');await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
test('FICHA cuenta inactiva, global explícito, ámbito ausente y delegación revocada',async({page})=>{
 await page.setViewportSize({width:1280,height:960});await login(page);const dialog=page.locator('dialog[open]');
 await person(page,'demo.sistemas@');await expect(dialog.locator('.scope-values')).toHaveText(['Todos','Todos','Todos','Todos']);await page.screenshot({path:resolve(out,'global.png'),fullPage:true});await page.keyboard.press('Escape');
 await db.doc('usuarios/sheet-person').update({status:'Inactivo',permissions:P.levels({asignaciones:'VIEW'}),scope:null});
 await page.reload();await person(page);await expect(dialog).toContainText('Cuenta inactiva');await expect(dialog.locator('.person-permissions')).toContainText('Configurado: Consultar');await expect(dialog.locator('.person-permissions')).toContainText('No habilitado');await expect(dialog.locator('.scope-values')).not.toContainText(['Todos','Todos','Todos','Todos']);
 await expect(dialog.locator('.scope-values')).toHaveText(Array(4).fill('Sin ámbito'));await page.screenshot({path:resolve(out,'inactiva.png'),fullPage:true});await page.keyboard.press('Escape');
 await db.doc('delegaciones/sheet-grant').update({status:'REVOKED',revision:2,scope:{...scope,fields:['studentEnrollments','teacherName','sharedGroups']}});await page.reload();await person(page,'demo.auxiliar@');
 await expect(dialog).toContainText('la delegación no está vigente');await expect(dialog.locator('.person-permissions')).toContainText('Configurado: Consultar');await expect(dialog.locator('.person-permissions')).not.toContainText('Acceso efectivo: Consultar');
 await expect(dialog.locator('.scope-grid')).toContainText('Matrículas');await expect(dialog.locator('.scope-grid')).toContainText('Nombre del docente');await expect(dialog.locator('.scope-grid')).toContainText('Grupos compartidos');await expect(dialog.locator('.scope-grid')).not.toContainText('studentEnrollments');
 expect((await db.doc('delegaciones/sheet-grant').get()).data().scope.fields).toEqual(['studentEnrollments','teacherName','sharedGroups']);await page.screenshot({path:resolve(out,'revocada.png'),fullPage:true});
});
test('FICHA auxiliar: editor restringido, cancelación limpia y asignación auditada',async({page})=>{
 await login(page,'auxiliar');await person(page);let dialog=await editAssignment(page);
 await expect(dialog.getByLabel('Operación sobre el perfil')).toHaveCount(0);await expect(dialog.getByLabel('Nombre',{exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('option',{name:'Rol fuera del techo delegado'})).toHaveCount(0);
 for(const control of await dialog.locator('#available-modules input').all())await expect(control).toBeDisabled();
 await page.screenshot({path:resolve(out,'editor-auxiliar.png'),fullPage:true});await review(page);await dialog.getByLabel('Motivo del cambio').fill('Motivo que se cancela');await page.keyboard.press('Escape');
 expect((await db.collection('asignaciones_roles').where('userId','==','sheet-person').get()).size).toBe(0);
 await person(page);await dialog.getByRole('button',{name:'Editar perfil',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Rol preaprobado',exact:true})).toHaveValue('');
 await dialog.getByRole('combobox',{name:'Rol preaprobado',exact:true}).selectOption('sheet-role');await review(page);await expect(dialog.getByLabel('Motivo del cambio')).toHaveValue('');
 await dialog.getByLabel('Motivo del cambio').fill('Asignación ficticia permitida desde editor unificado');
 await dialog.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(dialog).toHaveCount(0);
 const assignments=await db.collection('asignaciones_roles').where('userId','==','sheet-person').get();expect(assignments.size).toBe(1);const assignment=assignments.docs[0].data();
 expect(assignment.status).toBe('ACTIVE');expect(assignment.assignedByDelegationId).toBe('sheet-grant');expect(assignment.roleId).toBe('sheet-role');
 expect((await db.doc('usuarios/sheet-person').get()).data().permissions.asignaciones).toBe('VIEW');
 expect((await db.collection('bitacora').get()).size).toBeGreaterThan(backup.get('bitacora').length);
 await person(page);await expect(dialog.locator('.person-permissions')).toContainText('Acceso efectivo: Consultar');
});
test('FICHA versión obsoleta y revocación rechazan la asignación sin cambios parciales',async({page})=>{
 await login(page,'auxiliar');await person(page);await editAssignment(page);const dialog=await review(page);
 await db.doc('roles_personalizados/sheet-role').update({revision:2});await dialog.getByLabel('Motivo del cambio').fill('No aplicar una definición obsoleta');
 const audit=(await db.collection('bitacora').get()).size,ops=(await db.collection('operaciones_seguridad').get()).size,events=(await db.collection('eventos_seguridad').get()).size;
 await dialog.getByRole('button',{name:'Confirmar',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText(/revisión cambió/i);
 expect((await db.doc('usuarios/sheet-person').get()).data().revision).toBe(1);
 expect((await db.collection('asignaciones_roles').where('userId','==','sheet-person').get()).size).toBe(0);
 expect((await db.collection('bitacora').get()).size).toBe(audit);expect((await db.collection('operaciones_seguridad').get()).size).toBe(ops);expect((await db.collection('eventos_seguridad').get()).size).toBe(events);
 await db.doc('delegaciones/sheet-grant').update({status:'REVOKED',revision:2});await expect(dialog).toHaveCount(0);await expect(page).not.toHaveURL(/usuarios$/);
 await page.goto('/usuarios');await expect(page).not.toHaveURL(/usuarios$/);
});
