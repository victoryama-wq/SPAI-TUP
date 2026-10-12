import { defineConfig } from '@playwright/test';
import { root } from '../local/config.mjs';
import { resolve } from 'node:path';
export default defineConfig({
  testDir: '.', testMatch: 'ui.spec.mjs', workers: 1, retries: 0,
  outputDir: '../../.local/test-results/r01-ui', reporter: [['list'], ['json', { outputFile: resolve(root, '.local/test-results/r01-ui.json') }]],
  use: { baseURL: 'http://127.0.0.1:4200', browserName: 'chromium', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: `"${process.execPath}" node_modules/@angular/cli/bin/ng.js serve --configuration local --host 127.0.0.1`, cwd: root, url: 'http://127.0.0.1:4200', timeout: 120000, reuseExistingServer: false, env: { NG_CLI_ANALYTICS: 'false' } },
});
