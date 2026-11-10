const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');

const chromePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '');

const launchOptions = {
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
};
if (chromePath) launchOptions.executablePath = chromePath;

module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'e2e.spec.js',
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    trace: 'off',
    launchOptions,
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
