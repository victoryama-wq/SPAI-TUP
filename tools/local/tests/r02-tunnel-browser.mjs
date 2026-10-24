import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root} from '../config.mjs';
import {tunnelOrigin} from '../tunnel-policy.mjs';
const origin=tunnelOrigin(JSON.parse(readFileSync(resolve(root,'.local/tunnel-recovery/origin.json'))).origin);
const version=await fetch(origin+'/demo-version.json').then(r=>r.json());assert.equal(version.revision,'tunnel-r02-two-cycles-20261022-01');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[],requests=[];page.setDefaultTimeout(30000);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());requests.push({origin:u.origin,path:u.pathname});return u.origin===origin?r.continue():r.abort();});
 await page.goto(origin);const interstitial=page.getByText('Continue',{exact:true});if(await interstitial.isVisible())await interstitial.click();await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');requests.length=0;await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();
 await page.goto(origin+'/ciclos');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('Ciclo 27-1');await expect(dialog).toContainText('Captura');await expect(dialog).toContainText('30 sep 2026');
 await page.screenshot({path:resolve(root,'docs/evidence/r02-two-cycles/tunnel-modal.png')});await dialog.getByRole('button',{name:'Entendido',exact:true}).click();
 await expect(page.locator('tbody tr')).toHaveCount(2);const rows=await page.locator('tbody tr').allTextContents();assert.ok(rows.some(r=>r.includes('27-1')&&r.includes('Captura')));assert.ok(rows.some(r=>r.includes('26-3')&&r.includes('Cerrado')));
 await expect(page.getByText('Inconsistencia: hay varios ciclos operativos.',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'Nuevo ciclo',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Cerrar captura',exact:true})).toBeEnabled();
 await page.screenshot({path:resolve(root,'docs/evidence/r02-two-cycles/tunnel-tabla.png'),fullPage:true});
 for(const path of ['/emulator/v1/projects/demo-spai-tup/accounts','/v1/projects/demo-spai-tup/databases/(default)/documents','/reset','/stop'])assert.equal((await fetch(origin+path)).status,404);
 assert.equal((await fetch(origin+'/demo-spai-tup/us-central1/cycleContext',{method:'POST',headers:{authorization:'Bearer owner','content-type':'application/json'},body:'{"data":{}}'})).status,403);
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.origin===origin));assert.ok(requests.some(r=>r.path.includes('accounts:signInWithPassword')));assert.ok(requests.some(r=>r.path.includes('google.firestore.v1.Firestore')));assert.ok(requests.some(r=>r.path.endsWith('/cycleContext')));assert.ok(!requests.some(r=>r.path.endsWith('/cycleCommand')));
 const result={at:new Date().toISOString(),status:'PASS',origin,version,realPublicTunnel:true,checkedFrom:'host computer browser, not a second physical computer',login:true,twoCycles:true,modalAndRowAction:true,newCycleDisabled:true,httpsSameOrigin:true,adminEndpointsBlocked:true,cycleCommands:0,errors};writeFileSync(resolve(root,'docs/evidence/r02-two-cycles/tunnel.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
