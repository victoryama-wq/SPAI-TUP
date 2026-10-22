import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {root,config,isolatedTest,localEnvironment,verifyHub,accounts} from '../local/config.mjs';
const evidence=resolve(root,'docs/evidence/e2-r02');mkdirSync(evidence,{recursive:true});
test.beforeEach(async({page})=>{
  expect(isolatedTest).toBe(true);await verifyHub();
  await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
});
async function setup(work){
  Object.assign(process.env,localEnvironment());const require=createRequire(resolve(root,'functions/package.json'));
  const A=require('firebase-admin/app');const app=A.initializeApp({projectId:config.projectId},crypto.randomUUID());const db=require('firebase-admin/firestore').getFirestore(app);
  try{return await work(db,require('./cycles/service').createCycleService(db));}finally{await A.deleteApp(app);}
}
async function login(page,email=accounts[0].email){await page.goto('/');await page.getByLabel('Cuenta ficticia del emulador').selectOption(email);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();}
async function capture(page,name){await page.locator('main').evaluate(el=>el.scrollTop=0);await page.locator('.table-wrap').evaluateAll(els=>els.forEach(el=>el.scrollLeft=0));await page.screenshot({path:resolve(evidence,`${name}.png`),fullPage:true});}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
test('Ciclo operativo: transiciones, motivo, Especiales y tamaños de revisión',async({page})=>{
  await login(page);await page.goto('/ciclos');
  await page.getByRole('dialog').getByRole('button',{name:'Entendido'}).click();
  const row=page.locator('tbody tr').filter({has:page.locator('.cycle-code',{hasText:'27-1'})});
  await expect(row.getByRole('button',{name:'Cerrar captura',exact:true})).toBeEnabled();
  await page.setViewportSize({width:1280,height:960});await capture(page,'01-ciclo-captura-1280');
  await row.getByRole('button',{name:'Cerrar captura',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await capture(page,'02-confirmar-cierre-1280');
  await page.getByRole('dialog').getByRole('button',{name:'Cerrar captura',exact:true}).click();
  await expect(row.locator('.status-badge')).toHaveText('Captura cerrada');
  await row.getByRole('button',{name:'Reabrir captura',exact:true}).click();await expect(page.getByRole('alert')).toContainText('motivo');
  await row.getByRole('button',{name:'Habilitar Especiales',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Habilitar Especiales',exact:true}).click();
  await expect(row.getByRole('button',{name:'Deshabilitar Especiales',exact:true})).toBeEnabled();
  for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:960});await noOverflow(page);await capture(page,`03-especiales-${width}`);await row.screenshot({path:resolve(evidence,`03-controles-${width}.png`)});}
});
test('Coordinación: Especiales habilitado, ordinaria bloqueada e histórico solo consulta',async({page})=>{
  await login(page,accounts[2].email);await page.goto('/asignaciones');
  await expect(page.getByLabel('Ciclo de consulta')).toBeVisible();
  const add=page.getByRole('button',{name:/^Asignacion$|^Asignación$/});
  await expect(add).toBeDisabled();
  await page.getByRole('button',{name:'Especiales',exact:true}).click();
  await expect(add).toBeEnabled();await add.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Grupo especial admitido *')).toBeVisible();
  await page.setViewportSize({width:1280,height:960});await capture(page,'04-especial-form-1280');
  await page.setViewportSize({width:390,height:960});await capture(page,'04-especial-form-390');
  await setup(async(db,service)=>{const c=(await db.doc('ciclos/demo-27-1').get()).data();await service.execute({uid:'demo-sistemas'},{action:'specials',cycleId:'demo-27-1',expectedRevision:c.revision,enabled:false,operationId:crypto.randomUUID()});});
  await expect(page.getByRole('dialog').getByRole('button',{name:'Guardar asignacion',exact:true})).toBeDisabled();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('bloqueadas');
  await capture(page,'04-formulario-obsoleto-390');
  await page.getByRole('dialog').getByRole('button',{name:/Cerrar/}).first().click();
  const historic=await page.getByLabel('Ciclo de consulta').locator('optgroup[label="Ciclos históricos"] option').first().getAttribute('value');
  await page.getByLabel('Ciclo de consulta').selectOption(historic);
  await expect(page.locator('.cycle-selection')).toContainText('Consulta histórica');await expect(add).toBeDisabled();
  for(const width of [1280,768,390,320]){await page.setViewportSize({width,height:960});await noOverflow(page);if(width>=900){const copy=await page.locator('.panel-heading-copy').boundingBox();const actions=await page.locator('.panel-heading-actions').boundingBox();expect(actions.y).toBeGreaterThanOrEqual(copy.y+copy.height-1);}
    await capture(page,`05-historico-${width}`);}
});
test('CO-01 cambios rápidos: nunca mezcla filas ni conserva selección en otra sesión',async({page})=>{
  await setup(async db=>{
    const src=(await db.doc('asignaciones/demo-asignacion-a').get()).data();
    await db.doc('asignaciones/r02-history-row').set({...src,cycle:'26-3',moodleId:'HISTORICO-R02',normalizedMoodleId:'HISTORICO-R02',group:'26-3 ADM 11 01'});
  });
  await login(page);await page.goto('/asignaciones');
  const selector=page.getByLabel('Ciclo de consulta');
  const hist=await selector.locator('option').filter({hasText:'26-3'}).getAttribute('value');
  await selector.selectOption(hist);await expect(page.locator('tbody')).toContainText('HISTORICO-R02');
  await selector.selectOption('');await selector.selectOption(hist);await selector.selectOption('');
  await expect(page.locator('tbody')).not.toContainText('HISTORICO-R02');
  await page.waitForTimeout(800);await expect(page.locator('tbody')).not.toContainText('HISTORICO-R02');
  await page.goto('/ciclos');await page.goto('/asignaciones');await expect(selector).toHaveValue('');
});
test('Múltiples operativos y ausencia: avisos explícitos, sin elección arbitraria',async({page})=>{
  await setup(async(db,service)=>{await db.doc('ciclos/demo-26-3').update({status:'Preparacion'});await service.inspect({uid:'demo-sistemas'});});
  await login(page);await page.goto('/ciclos');await expect(page.locator('spai-cycles-page > [role=status]')).toContainText('varios ciclos');await expect(page.getByRole('button',{name:'Nuevo ciclo'})).toBeDisabled();await capture(page,'06-inconsistencia-1280');
  await setup(async(db,service)=>{for(const doc of (await db.collection('ciclos').get()).docs)await doc.ref.update({status:'Cerrado'});await service.inspect({uid:'demo-sistemas'});});
  await expect(page.locator('spai-cycles-page > [role=status]')).toContainText('No hay ciclo operativo');await expect(page.getByRole('button',{name:'Nuevo ciclo'})).toBeEnabled();await capture(page,'07-sin-operativo-1280');
});

test('Especiales: alta real desde formulario en captura cerrada',async({page})=>{
  await setup(async db=>{for(const d of (await db.collection('asignaciones').where('group','==','27-1 ADM 12 C.A').get()).docs)if(d.data().moodleId?.startsWith('r02-ui-'))await d.ref.delete();});
  await setup(async(db,service)=>{for(const d of (await db.collection('ciclos').get()).docs)await d.ref.update({status:d.id==='demo-27-1'?'Captura cerrada':'Cerrado',specialsEnabled:d.id==='demo-27-1'});await db.doc('grupos/27_1_ADM_12_C_A').set({... (await db.doc('grupos/27_1_ADM_11_C_A').get()).data(),fullGroup:'27-1 ADM 12 C.A',groupCode:'12'});await service.inspect({uid:'demo-sistemas'});});
  await login(page,accounts[2].email);await page.goto('/asignaciones');
  await page.getByRole('button',{name:'Especiales',exact:true}).click();
  await page.getByRole('button',{name:'Asignacion',exact:true}).click();
  const modal=page.getByRole('dialog');
  const id=`r02-ui-${Date.now()}`;
  await modal.getByLabel('ID Moodle *',{exact:true}).fill(id);
  await modal.getByRole('button',{name:'Ver materias'}).click();await modal.locator('.subject-field .combo-menu button').first().click();
  await modal.getByRole('button',{name:'Ver docentes'}).click();await modal.locator('.teacher-field .combo-menu button').first().click();
  await modal.getByLabel('Grupo especial admitido *').selectOption({label:'27-1 ADM 12 C.A — Administración ficticia'});
  await modal.locator('.program-field select').selectOption('ADM');
  await modal.locator('.special-enrollments-field textarea').fill('R02-UI-FICTICIO');
  await modal.getByRole('button',{name:'Guardar asignacion',exact:true}).click();
  await expect(modal).toHaveCount(0);
  await setup(async db=>{const rows=await db.collection('asignaciones').where('moodleId','==',id).get();expect(rows.size).toBe(1);expect(rows.docs[0].data()).toMatchObject({cycle:'27-1',group:'27-1 ADM 12 C.A',assignmentType:'ESPECIAL'});});
});
