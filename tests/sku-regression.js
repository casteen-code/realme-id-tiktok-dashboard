'use strict';

const assert = require('node:assert/strict');
const cases = require('./sku-cases.json');
const sku = require('../sku-core.js');

let passed = 0;
for (const item of cases) {
  const stock = sku.parseSKU(item.stock);
  if (item.expectProblems) {
    assert.deepEqual(sku.stockSkuProblems(stock), item.expectProblems, `${item.name}: inventory self-check`);
    passed++;
    continue;
  }
  const sale = sku.parseSKU(item.sales.model, item.sales);
  assert.equal(stock.model, item.expected.model, `${item.name}: stock model`);
  assert.equal(stock.memory, item.expected.memory, `${item.name}: stock memory`);
  assert.equal(stock.color, item.expected.color, `${item.name}: stock color`);
  assert.equal(sale.fullKey, stock.fullKey, `${item.name}: stock and sales must match`);
  passed++;
}

const families = ['realme 16 5G 256GB 8GB Air White', 'realme 16 Pro 5G 256GB 12GB Pebble Grey', 'realme 16 Pro+ 5G 512GB 12GB Master Grey'].map(x => sku.parseSKU(x).modelKey);
assert.equal(new Set(families).size, 3, '16、16 Pro、16 Pro+ must stay separate models');

console.log(`SKU regression passed: ${passed} cases + model-family separation`);
