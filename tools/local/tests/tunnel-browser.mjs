// Local TLS proxy and synthetic restored emulators, no internet connection.
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { root } from '../config.mjs';
const dir=resolve(root,'.local/tunnel-recovery'), origin='https://review-4206.usw2.devtunnels.ms';
const server=createServer({key:readFileSync(resolve(dir,'test-key.pem')),cert:readFileSync(resolve(dir,'test-cert.pem'))},(req,res)=>{
  const proxy=request({host:'127.0.0.1',port:4206,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
  proxy.on('error',()=>res.destroy());req.pipe(proxy);
});
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4443,'127.0.0.1',ok);});
const browser=await chromium.launch({headless:true,args:['--no-proxy-server','--host-resolver-rules=MAP review-4206.usw2.devtunnels.ms:443 127.0.0.1:4443']});
try {
  const page=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1280,height:900}}),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') console.log('Browser:',m.text());});
  page.on('response',r=>{if(r.status()>=400) console.log('HTTP',r.status(),new URL(r.url()).pathname);});
  page.on('requestfailed',r=>console.log('Failed',r.url(),r.failure()?.errorText));
  await page.route('**/*',r=>{const url=new URL(r.request().url());requests.push({origin:url.origin,path:url.pathname});return url.hostname==='review-4206.usw2.devtunnels.ms'?r.continue():r.abort();});
  await page.goto(origin);await page.getByLabel('Cuenta ficticia del emulador').selectOption('demo.sistemas@tecplayacar.edu.mx');await page.getByRole('button',{name:'Ingresar a DEMO',exact:true}).click();
  await expect(page.locator('nav')).toBeVisible({timeout:30000});
  await page.goto(origin+'/usuarios');await expect(page.getByRole('heading',{name:'Usuarios registrados',exact:true})).toBeVisible();
  await page.screenshot({path:resolve(dir,'usuarios-https-local.png'),fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  assert(requests.some(r=>r.path.includes('accounts:signInWithPassword')));
  assert(requests.some(r=>r.path.includes('google.firestore.v1.Firestore')));
  assert(requests.some(r=>r.path.includes('/demo-spai-tup/us-central1/')));
  assert(requests.every(r=>r.origin===origin),'All SDK traffic must be HTTPS and same origin');
  const result={at:new Date().toISOString(),status:'PASS',localTLS:true,realInternetTunnel:false,login:true,directory:true,httpsSameOrigin:true,requests:requests.map(r=>r.path),errors};
  writeFileSync(resolve(dir,'browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();server.closeAllConnections();await new Promise(ok=>server.close(ok));}
