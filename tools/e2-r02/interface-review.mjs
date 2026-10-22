// Read-only review of the running complement slot. No fixtures or successful writes.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root,config,complementTest,verifyHub} from '../local/config.mjs';
assert.equal(complementTest,true);await verifyHub();
const base='http://127.0.0.1:4204',out=resolve(root,'docs/evidence/interface-actions-cycle');mkdirSync(out,{recursive:true});
const snapshot=async()=>{const result={};for(const name of ['usuarios','delegaciones','ciclos','bitacora','operaciones_ciclo']){const r=await fetch(`http://127.0.0.1:${config.firestore}/v1/projects/demo-spai-tup/databases/(default)/documents/${name}?pageSize=1000`,{headers:{authorization:'Bearer owner'}});assert.equal(r.status,200);result[name]=await r.json();}return result;};
const before=await snapshot(),errors=[],commands=[],results=[];
const current=before.ciclos.documents.find(d=>d.fields.status?.stringValue==='Captura');assert.ok(current);
const cycleCode=current.fields.code.stringValue,date=current.fields.tentativeCaptureCloseAt?.stringValue;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950}});page.setDefaultTimeout(25000);
 const allowed=new Set([base,...['auth','firestore','functions','storage'].map(k=>`http://127.0.0.1:${config[k]}`)]);
 await page.route('**/*',r=>allowed.has(new URL(r.request().url()).origin)?r.continue():r.abort());
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',r=>{if(r.url().endsWith('/cycleCommand'))commands.push(r.postDataJSON().data);});
 await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
 for(const width of [1280,768,390,320]){
  await page.setViewportSize({width,height:950});await page.goto(base+'/usuarios');
  const row=page.locator('tbody tr').filter({hasText:'Persona ficticia del-stale'}),group=row.locator('.row-actions');await expect(group.getByRole('button',{name:'Ver acceso',exact:true})).toBeEnabled();
  await group.scrollIntoViewIfNeeded();const geometry=await group.locator('button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),width:r.width,height:r.height,y:r.y,x:r.x};}));
  assert.deepEqual(geometry.map(b=>b.label),['Ver acceso','Editar','Eliminar usuario']);assert.ok(geometry.every(b=>b.width===44&&b.height===44&&Math.abs(b.y-geometry[0].y)<1));assert.equal(Math.round(geometry[1].x-geometry[0].x),52);
  const view=group.getByRole('button',{name:'Ver acceso',exact:true});await view.hover();await expect(view.locator('.action-tooltip')).toBeVisible();await page.mouse.move(0,0);await view.focus();await page.keyboard.press('Tab');const edit=group.getByRole('button',{name:'Editar',exact:true});await expect(edit).toBeFocused();await expect(edit.locator('.action-tooltip')).toBeVisible();
  await page.screenshot({path:resolve(out,`usuarios-${width}.png`)});
  await group.getByRole('button',{name:'Eliminar usuario',exact:true}).click();let dialog=page.getByRole('dialog');await expect(dialog).toContainText('Persona ficticia del-stale');await expect(dialog.getByLabel('Motivo de la baja')).toBeEnabled();await expect(dialog.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(group.getByRole('button',{name:'Eliminar usuario',exact:true})).toBeFocused();
  await page.goto(base+'/ciclos');dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByRole('heading')).toHaveText('Ciclo '+cycleCode);await expect(dialog).toContainText('Captura');await expect(dialog).toContainText(date?new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00')):'Sin fecha definida');await expect(dialog.getByRole('heading')).toBeFocused();
  await expect(page.locator('.operative-control')).toHaveCount(0);assert.equal(await page.locator('dialog[open]').count(),1);
  for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await dialog.evaluate(d=>d.contains(document.activeElement)),true);}
  await page.screenshot({path:resolve(out,`ciclos-modal-${width}.png`)});
  const dismissal=width===768?'close':width===390?'escape':'understood';
  if(dismissal==='close')await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();else if(dismissal==='escape')await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:'Entendido'}).click();
  await expect(dialog).toHaveCount(0);await expect(page.locator('#cycles-directory-title')).toBeFocused();
  // Server refresh triggers repository/render updates without editing a document.
  await page.evaluate(async()=>{const c=window.ng.getComponent(document.querySelector('spai-cycles-page'));await c.cyclesRepository.refreshFromServer();});
  await expect(page.locator('.cycle-close-action')).toBeEnabled();await expect(dialog).toHaveCount(0);
  await page.screenshot({path:resolve(out,`ciclos-descartado-${width}.png`)});
  const rowClose=page.getByRole('button',{name:'Cerrar captura',exact:true});await rowClose.scrollIntoViewIfNeeded();await rowClose.focus();await page.keyboard.press('Tab');await rowClose.focus();await expect(rowClose.locator('.action-tooltip')).toBeVisible();await rowClose.click();await expect(dialog).toContainText('Al cerrar la captura, se bloquearán las operaciones académicas ordinarias del ciclo.');await expect(dialog.getByRole('heading')).toBeFocused();assert.equal(await page.locator('dialog[open]').count(),1);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(commands.length,0);
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert.ok(noOverflow);
  results.push({width,geometry,dismissal,keyboardTooltip:true,noticeOnceAfterRefresh:true,confirmationFromRow:true,noOverflow});
 }
 // Entering again offers the notice again; transition to confirmation uses the same dialog.
 await page.goto(base+'/ciclos');let dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading')).toHaveText('Ciclo '+cycleCode);await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();await expect(dialog.getByRole('heading')).toHaveText('Cerrar captura');assert.equal(await page.locator('dialog[open]').count(),1);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);assert.equal(commands.length,0);
 // Existing stale-revision regression: real server rejection, never a successful write.
 await page.route('**/cycleCommand',r=>{const data=r.request().postDataJSON();data.data.expectedRevision=-1;return r.continue({postData:JSON.stringify(data)});});
 await page.getByRole('button',{name:'Cerrar captura',exact:true}).click();const reply=page.waitForResponse(r=>r.url().endsWith('/cycleCommand'));await dialog.getByRole('button',{name:'Cerrar captura',exact:true}).click();assert.equal((await reply).status(),409);await expect(page.getByRole('alert')).toContainText('el ciclo cambió');await expect(page.locator('tbody tr').filter({hasText:cycleCode}).locator('.status-badge')).toHaveText('Captura');
 assert.deepEqual(await snapshot(),before);assert.deepEqual(errors,[]);
 writeFileSync(resolve(out,'resultados.json'),JSON.stringify({at:new Date().toISOString(),status:'PASS',base,results,realCycle:{code:cycleCode,captureDate:date??null},cyclesAndUsersUnchanged:true,confirmationFromNotice:true,realStaleVersionRejection:409,commands,errors,physicalSecondComputer:false},null,2));console.log('PASS: actions, tooltips, notice dismissal, refresh, both confirmation paths, 409, unchanged data.');
}finally{await browser.close();}
