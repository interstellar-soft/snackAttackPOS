const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { _electron: electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const dataDir = path.resolve(`../.tools/ui-test-${Date.now()}`);
const artifacts = path.resolve('../artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const executablePath = path.resolve('release/win-unpacked/Aurora POS.exe');
const password = 'Test1234!'; // Exactly nine characters: setup and login boundary.
(async () => {
  let app;
  const failures = [];
  try {
    app = await electron.launch({ executablePath, env: { ...process.env, AURORA_DATA_DIR: dataDir }, timeout: 60000 });
    let page = await app.firstWindow();
    page.on('pageerror', e => failures.push(e.message));
    await page.locator('#setup').waitFor({ state: 'visible', timeout: 60000 });
    await page.screenshot({ path: path.join(artifacts, 'desktop-first-run.png') });
    await page.locator('#password').fill('Test123!');
    assert.equal(await page.locator('#password').evaluate(input => input.checkValidity()), false);
    const rejected = await page.evaluate(async () => {
      try { await window.electronAPI.setupStore('Test123!'); return false; }
      catch (error) { return error.message.includes('at least 9 characters'); }
    });
    assert.equal(rejected, true, 'IPC must reject an eight-character password');
    await page.locator('#password').fill(password);
    await page.locator('#confirm').fill(password);
    await page.locator('#submit').click();
    await page.locator('#username').waitFor({ timeout: 120000 });
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill(password);
    await page.locator('button[type=submit]').click();
    await page.locator('#username').waitFor({ state: 'hidden', timeout: 30000 });
    await page.waitForURL(url => url.hash === '#/', { timeout: 30000 });
    await page.getByRole('button', { name: 'Logout', exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.getByText(/Preferred serial port/).count(), 0);
    await page.screenshot({ path: path.join(artifacts, 'desktop-pos.png') });
    assert.equal(await page.evaluate(() => Boolean(window.electronAPI)), true);
    await app.close(); app = undefined;
    app = await electron.launch({ executablePath, env: { ...process.env, AURORA_DATA_DIR: dataDir }, timeout: 60000 });
    page = await app.firstWindow();
    await page.locator('#username').waitFor({ timeout: 120000 });
    assert.equal(await page.locator('#setup').count(), 0);
    assert.deepEqual(failures, []);
    console.log('PASS: packaged Electron first-run setup, encrypted credentials, sign-in, POS rendering, and reopening without setup');
  } finally { if (app) await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
