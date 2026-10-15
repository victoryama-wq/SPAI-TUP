import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root,sessionFile,verifyHub} from '../local/config.mjs';
await verifyHub();assert.equal(JSON.parse(readFileSync(sessionFile)).synthetic,true);
const lan=JSON.parse(readFileSync(resolve(root,'.local/lan-session.json')));const base=`http://${lan.host}:4201`;
const output=resolve(root,'.local/acceptance-2');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const attempts=[];const errors=[];const checks=[];
try{
 for(const [email,route] of [['demo.sistemas@tecplayacar.edu.mx','/usuarios'],['demo.r01.consulta@tecplayacar.edu.mx','/asignaciones']]){
  const page=await browser.newPage({viewport:{width:1366,height:900}});page.setDefaultTimeout(15000);
  await page.route('**/*',r=>{const url=new URL(r.request().url());attempts.push({origin:url.origin,path:url.pathname});return url.origin===base?r.continue():r.abort();});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.getByLabel('Cuenta ficticia del emulador').selectOption(email);await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
  await expect(page).toHaveURL(base+(route==='/usuarios'?'/':'/asignaciones'));
  await page.goto(base+route);await page.reload();
  if(route==='/usuarios'){
   await page.getByRole('button',{name:'Administrar roles personalizados',exact:true}).click();await expect(page.getByRole('heading',{name:'Directorio de roles personalizados'})).toBeVisible();
   await page.getByRole('button',{name:'Crear rol',exact:true}).click();await expect(page.getByLabel('Nombre',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  }else{
   await expect(page.locator('.dashboard-overview,.metric-card')).toHaveCount(0);
   await page.goto(base+'/dashboard');await expect(page).toHaveURL(base+'/asignaciones');
   await expect(page.locator('.table-panel tbody')).toContainText('27-1 ADM');await expect(page.locator('.table-panel tbody')).not.toContainText('DER');
   await expect(page.getByRole('button',{name:/Editar asignacion|Eliminar asignacion|^Asignacion$/})).toHaveCount(0);
  }
  await page.screenshot({path:resolve(output,`lan-${route.slice(1)}.png`),fullPage:true});checks.push({email,route,reload:true});await page.close();
 }
 for(const path of ['/health','/reset','/emulator/v1/projects/demo-spai-tup/accounts'])assert.equal((await fetch(base+path)).status,404);
 assert.equal((await fetch(base+'/',{headers:{authorization:'Bearer owner'}})).status,403);
 assert.equal((await fetch(base+'/',{headers:{origin:'https://example.invalid'}})).status,403);
 assert.ok(attempts.length>0);assert.ok(attempts.every(r=>r.origin===base));assert.deepEqual(errors,[]);
 const result={status:'PASS',base,checks,browser:await browser.version(),viewport:{width:1366,height:900},requests:attempts.length,origins:[...new Set(attempts.map(r=>r.origin))],services:['identitytoolkit.googleapis.com','google.firestore.v1.Firestore','demo-spai-tup/us-central1'].map(s=>({path:s,observed:attempts.some(r=>r.path.includes(s))})),administration:'not published',pageErrors:errors,physicalSecondComputer:false};
 writeFileSync(resolve(output,'lan-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
