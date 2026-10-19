import { defineConfig } from '@playwright/test';
import { root, isolatedTest } from '../local/config.mjs';
import { resolve } from 'node:path';
export default defineConfig({
  timeout: 60000,
  testDir: '.', testMatch: isolatedTest ? ['ui.spec.mjs','acceptance.spec.mjs','navigation.spec.mjs','auxiliary.spec.mjs','access.spec.mjs','users-layout.spec.mjs'] : 'ui.spec.mjs', workers: 1, retries: 0,
  outputDir: '../../.local/test-results/r01-ui', reporter: [['list'], ['json', { outputFile: resolve(root, '.local/test-results/r01-ui.json') }]],
  use: { baseURL: `http://127.0.0.1:${isolatedTest ? 4202 : 4200}`, browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `"${process.execPath}" node_modules/@angular/cli/bin/ng.js serve --configuration ${isolatedTest ? 'isolated' : 'local'} --host 127.0.0.1 --port ${isolatedTest ? 4202 : 4200}`, cwd: root, url: `http://127.0.0.1:${isolatedTest ? 4202 : 4200}`, timeout: 120000, reuseExistingServer: false, env: { NG_CLI_ANALYTICS: 'false' } },
});
