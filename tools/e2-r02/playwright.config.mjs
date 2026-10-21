import {defineConfig} from '@playwright/test';
import {root,isolatedTest} from '../local/config.mjs';
import {resolve} from 'node:path';
if(!isolatedTest) throw Error('R02 UI requires isolated synthetic emulators');
export default defineConfig({
  testDir:'.',testMatch:'ui.spec.mjs',workers:1,retries:0,timeout:60000,
  outputDir:'../../.local/test-results/r02-ui-artifacts',
  reporter:[['list'],['json',{outputFile:resolve(root,'.local/test-results/r02-ui.json')}]],
  use:{baseURL:'http://127.0.0.1:4202',browserName:'chromium',screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:{command:`"${process.execPath}" node_modules/@angular/cli/bin/ng.js serve --configuration isolated --host 127.0.0.1 --port 4202`,cwd:root,url:'http://127.0.0.1:4202',timeout:120000,reuseExistingServer:false,env:{NG_CLI_ANALYTICS:'false'}}
});
