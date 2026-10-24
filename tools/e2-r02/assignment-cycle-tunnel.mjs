import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium,expect} from '@playwright/test';
import {root} from '../local/config.mjs';
const origin=JSON.parse(readFileSync(resolve(root,'.local/tunnel-recovery/origin.json'))).origin;
assert.match(origin,/^https:\/\/[a-z0-9-]+\.[a-z0-9]+\.devtunnels\.ms$/);
const version=await fetch(origin+'/demo-version.json').then(r=>r.json());assert.equal(version.revision,'tunnel-r02-consulta-ciclo-20261023-01');
const snapshot=async()=>{const result={};for(const col of ['ciclos','usuarios','asignaciones','grupos','delegaciones','operaciones_ciclo']){const r=await fetch('http://127.0.0.1:18080/v1/projects/demo-spai-tup/databases/(default)/documents/'+col+'?pageSize=1000',{headers:{authorization:'Bearer owner'}});assert.ok(r.ok);const data=await r.json();assert.ok(!data.nextPageToken);result[col]=(data.documents||[]).sort((a,b)=>a.name.localeCompare(b.name));}return result;};
const before=await snapshot(),cycleStates=before.ciclos.map(d=>({id:d.name.split('/').pop(),code:d.fields.code.stringValue,status:d.fields.status.stringValue})),operative=cycleStates.filter(c=>c.status!=='Cerrado');assert.ok(operative.length<=1);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],commands=[];page.setDefaultTimeout(30000);
page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(/cycleCommand|securityCommand/.test(r.request().url()))commands.push(r.request().url());return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
try{
 await page.goto(origin);if(await page.getByText('Continue',{exact:true}).isVisible())await page.getByText('Continue',{exact:true}).click();await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();await expect(page.locator('nav')).toBeVisible();await page.goto(origin+'/asignaciones');
 const selector=page.getByLabel('Ciclo de consulta',{exact:true});await expect(selector).toHaveValue('demo-27-1');await selector.selectOption('demo-26-3');await expect(page.locator('.panel-heading-copy small')).toContainText('Consulta histórica 26-3');await expect(page.locator('.cycle-chip')).toContainText(operative[0]?.code??'Sin ciclo activo');await expect(page.getByRole('button',{name:'Asignacion',exact:true})).toBeDisabled();await page.screenshot({path:resolve(root,'docs/evidence/assignment-cycle-selection/tunnel.png')});
 await selector.selectOption('demo-27-1');await expect(page.locator('.panel-heading-copy small')).toContainText((operative[0]?.code==='27-1'?'Consulta operativa':'Consulta histórica')+' 27-1');await expect(page.getByRole('button',{name:'Asignacion',exact:true})).toBeDisabled();assert.deepEqual(await snapshot(),before);assert.deepEqual(commands,[]);assert.deepEqual(errors,[]);
 const result={at:new Date().toISOString(),status:'PASS',version,origin,checkedFrom:'host browser through HTTPS; not another computer',sharedDataUnchanged:true,cycleStates,mutatingCommands:0,errors};writeFileSync(resolve(root,'docs/evidence/assignment-cycle-selection/tunnel.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
