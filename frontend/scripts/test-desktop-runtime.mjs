import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
mkdirSync('.test-output', { recursive: true });
await build({ entryPoints: ['electron/local-runtime.ts'], bundle: true, platform: 'node',
  format: 'esm', outfile: '.test-output/runtime.mjs' });
const { startLocalRuntime } = await import('../.test-output/runtime.mjs');
const dataRoot = path.resolve(`../.tools/runtime-test-${Date.now()}`);
const credentials = { databasePassword: randomBytes(32).toString('hex'),
  jwtKey: randomBytes(48).toString('hex'), adminPassword: randomBytes(16).toString('hex') };
const resources = path.resolve(process.env.TEST_RESOURCES || 'resources');
let runtime;
let token;
async function api(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${runtime.url}${route}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}
try {
  runtime = await startLocalRuntime(resources, dataRoot, credentials);
  const html = await fetch(runtime.url);
  assert.match(await html.text(), /id="root"/);
  assert.equal((await fetch(`${runtime.url}/seed`)).status, 404);
  assert.equal((await fetch(`${runtime.url}/api/admin/backup/export`)).status, 401);
  const cors = await fetch(`${runtime.url}/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), null);
  token = (await api('/api/auth/login', { username: 'admin', password: credentials.adminPassword })).token;
  const initial = await api('/api/admin/backup/export');
  assert.equal(initial.products.length, 0);
  assert.equal(initial.users.length, 1);
  const product = await api('/api/products', { name: 'Weight test coffee', barcode: '1234567890123',
    price: 8, currency: 'USD', cost: 4, costCurrency: 'USD', categoryName: 'Coffee',
    isSoldByWeight: true, weightUnit: 'kg', quantityOnHand: 10,
    additionalBarcodes: [{ code: 'COFFEE-PACK', quantity: 3, price: 20, currency: 'USD' }] });
  const scan = await api('/api/products/scan', { barcode: '1234567890123' });
  assert.equal(scan.id, product.id);
  const packScan = await api('/api/products/scan', { barcode: 'COFFEE-PACK' });
  assert.equal(packScan.scannedQuantity, 3);
  assert.equal(packScan.scannedTotalUsd, 20);
  const sale = await api('/api/transactions/checkout', { exchangeRate: 90000, paidUsd: 2,
    items: [{ productId: product.id, quantity: 0.25 }] });
  assert.equal(sale.totalUsd, 2);
  await api('/api/transactions/checkout', { exchangeRate: 90000, paidUsd: 0.01,
    items: [{ productId: product.id, quantity: 0.001 }] });
  await api('/api/transactions/checkout', { exchangeRate: 90000, paidUsd: 0, debtCardName: 'Test customer',
    items: [{ productId: product.id, quantity: 1 }] });
  await api('/api/transactions/checkout', { exchangeRate: 90000, paidUsd: 4, saveToMyCart: true,
    items: [{ productId: product.id, quantity: 1 }] });
  const backup = await api('/api/admin/backup/export');
  assert.equal(backup.schemaVersion, 2);
  assert.equal(backup.productBarcodes[0].quantityPerScan, 3);
  assert.equal(backup.personalPurchases.length, 1);
  assert.equal(backup.transactions.filter(t => t.debtCardName === 'Test customer').length, 1);
  assert.equal(backup.inventories[0].quantityOnHand, 7.749);
  assert.ok(backup.transactionLines.some(line => line.quantity === 0.001));
  await api('/api/admin/backup/import', backup);
  const restored = await api('/api/admin/backup/export');
  for (const name of ['products', 'productBarcodes', 'personalPurchases', 'transactions', 'transactionLines', 'inventories']) {
    assert.deepEqual(restored[name], backup[name], `${name} changed during restore`);
  }
  await runtime.stop(); runtime = undefined;
  runtime = await startLocalRuntime(resources, dataRoot, { ...credentials, adminPassword: undefined });
  token = (await api('/api/auth/login', { username: 'admin', password: credentials.adminPassword })).token;
  const reopened = await api('/api/admin/backup/export');
  assert.equal(reopened.transactions.length, 4);
  assert.equal(reopened.inventories[0].quantityOnHand, 7.749);
  const debt = reopened.transactions.find(t => t.debtCardName === 'Test customer');
  const settled = await api(`/api/transactions/${debt.id}/settle-debt`, { paidUsd: 0, paidLbp: 0 });
  assert.equal(settled.balanceUsd, 0);
  assert.equal(settled.balanceLbp, 0);
  assert.ok(settled.debtSettledAt);
  console.log('PASS: fresh database, migrations, login, barcode scans without ML, fractional checkout, PDF receipt, debt, personal purchases, backup/restore, restart persistence, CORS and authorization');
} finally { if (runtime) await runtime.stop(); }
