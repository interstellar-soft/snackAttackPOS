import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
mkdirSync('.test-output', { recursive: true });
await build({ entryPoints: ['src/stores/cartStore.ts'], bundle: true, platform: 'node',
  format: 'esm', outfile: '.test-output/cart.mjs' });
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const { useCartStore } = await import('../.test-output/cart.mjs');
const base = { id: 'coffee', name: 'Coffee', priceUsd: 8, priceLbp: 720000,
  quantity: 1, discountPercent: 0, costUsd: 4, costLbp: 360000, isSoldByWeight: true };
useCartStore.getState().addItem(base);
const line = useCartStore.getState().items[0].lineId;
useCartStore.getState().setItemQuantity(line, 0.25);
assert.equal(useCartStore.getState().items[0].quantity, 0.25);
assert.equal(useCartStore.getState().subtotalUsd(), 2);
useCartStore.getState().setItemQuantity(line, 0.001);
assert.equal(useCartStore.getState().items[0].quantity, 0.001);
useCartStore.getState().clear();
useCartStore.getState().addItem({ ...base, id: 'can', isSoldByWeight: false });
useCartStore.getState().setItemQuantity(useCartStore.getState().items[0].lineId, 0.25);
assert.equal(useCartStore.getState().items[0].quantity, 1);
console.log('PASS: fractional weights, minimum weight, totals, and whole-unit quantities');
