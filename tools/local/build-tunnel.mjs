import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const r02Review=process.argv.includes('--r02');
const output=r02Review?'dist/spai-tup-r02-tunnel':'dist/spai-tup-tunnel';
// Build separately: a failed compilation must not remove the shared frontend.
const staged=`.local/tunnel-build-${process.pid}`;
const build=spawnSync(process.execPath,['node_modules/@angular/cli/bin/ng.js','build','--configuration','tunnel','--output-path',staged],{cwd:root,stdio:'inherit',windowsHide:true});
if(build.status!==0)process.exit(build.status||1);
const baseCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const localChanges=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8',windowsHide:true}).trim());
if(r02Review){
  const index=resolve(root,staged,'browser/index.html');
  writeFileSync(index,readFileSync(index,'utf8').replaceAll('DEMO HISTÓRICA','DEMO R02').replace('Captura recuperada del 16 de octubre','Escenario de dos ciclos · r02-two-cycles-v1'));
}
writeFileSync(resolve(root,staged,'browser/demo-version.json'),JSON.stringify({revision:r02Review?'tunnel-r02-complement-20261023-01':'tunnel-recovery-20261022-01',baseCommit,localChanges,builtAt:new Date().toISOString(),dataSource:r02Review?'r02-two-cycles-v1; sesión sintética preservada 18080':'Captura 2026-10-16 recuperada',humanAcceptance:'pendiente'},null,2));
const source=resolve(root,staged,'browser'),destination=resolve(root,output,'browser');
mkdirSync(destination,{recursive:true});
// Keep the old hashed assets for browsers already open. Switch the entry last.
for(const name of readdirSync(source)) if(!['index.html','demo-version.json'].includes(name)) cpSync(resolve(source,name),resolve(destination,name),{recursive:true});
for(const name of ['index.html','demo-version.json']) {
  const temporary=resolve(destination,`${name}.next-${process.pid}`);
  writeFileSync(temporary,readFileSync(resolve(source,name)));
  renameSync(temporary,resolve(destination,name));
}
console.log(`Frontend actualizado en ${destination}; servicios y datos conservados.`);
