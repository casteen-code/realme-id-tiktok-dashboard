'use strict';

// Synthetic fixtures only. Never commit operational sales or inventory files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('../sku-core.js');
const nodes = new Map();
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', innerHTML: '', style: {}, classList: { toggle() {}, remove() {} } });
    return nodes.get(id);
  },
  querySelectorAll() { return []; }
};
const source = fs.readFileSync(path.join(__dirname, '../inventory-turnover.js'), 'utf8');
const marker = '\n  init();\n';
assert.ok(source.includes(marker));
const sandbox = { window: { RealmeSkuCore: core }, document, structuredClone };
vm.runInNewContext(source.replace(marker, '\n  globalThis.importTest = { app, sheetInfo, chooseSheet, shopeeMode, rawSummary, schemaText, salesFromInputs, stocksFromInputs, reconcileShopee, renderPreview, renderAudit, updateCalculateButton, groupRows };\n'), sandbox);
const api = sandbox.importTest;
const plain = x => JSON.parse(JSON.stringify(x));
const sum = rows => rows.reduce((n, r) => n + r.qty, 0);
function install(slot, sheets, chosenName = sheets[0].name) {
  api.app.profiles[slot] = { sheets, chosenName, fileName: `${slot}.xlsx` };
  api.app.sourceChoice = null;
  api.app.sourceConfirmed = false;
}
const phone = 'realme C100i 128GB 4GB Dawn Purple';
const wide = api.sheetInfo('Wide', [
  ['SKU', '1店', '2店', '3店', '4店', '5店', '合计 Total'],
  [phone, 2, 3, 0, 4, 1, 10],
  ['realme Note 80 64GB 4GB Storm Black', 0, 0, 2, 0, 0, 2],
  [' ZP888 ', 9, 0, 0, 0, 0, 9],
  ['合计 Total', 11, 3, 2, 4, 1, 21]
], 'shopee');
install('shopee', [wide]);
assert.equal(api.shopeeMode(wide.mapping), 'pivot');
assert.equal(api.rawSummary('shopee').valid, true);
assert.equal(api.rawSummary('shopee').rows, 2);
assert.equal(api.rawSummary('shopee').quantity, 12);
assert.equal(api.rawSummary('shopee').excludedQuantity, 9);
assert.equal(sum(api.salesFromInputs()), 12, 'single pivot must reach calculation without totals or gifts');
assert.deepEqual(plain(api.rawSummary('shopee').byStore), { shop1: 2, shop2: 3, shop3: 2, shop4: 4, shop5: 1, tiktok: 0 });
assert.match(api.schemaText('shopee', wide), /1店、2店、3店、4店、5店/);
assert.ok(api.salesFromInputs().every(x => x.store && x.warehouse !== 'unassigned'));

for (const slot of ['mks', 'pnk', 'bali']) install(slot, [api.sheetInfo(slot, [
  ['商家编码', 'OMS可支配库存'], [phone, 20], [' zp888 ', 80], ['合计 Total', 100]
], 'stock')]);
install('tiktok', [api.sheetInfo('TikTok', [
  ['商品型号', 'SKU规格 / 颜色 / 套餐', '有效销量'],
  ['realme C100i', '4/128GB Dawn Purple', 3], ['ZP888', '', 90], ['合计 Total', '', 93]
], 'tiktok')]);
assert.equal(api.stocksFromInputs().length, 3);
assert.equal(sum(api.stocksFromInputs()), 60);
for (const slot of ['mks', 'pnk', 'bali']) {
  assert.equal(api.rawSummary(slot).quantity, 20);
  assert.equal(api.rawSummary(slot).excludedQuantity, 80);
}
assert.equal(api.rawSummary('tiktok').quantity, 3);
assert.equal(sum(api.salesFromInputs()), 15);
api.renderPreview();
assert.equal(nodes.get('calculate').disabled, false, 'valid single-sheet pivot enables calculation');
assert.match(nodes.get('previewGrid').innerHTML, /已排除赠品 zp888/);
assert.match(nodes.get('audit').innerHTML, /1店 2；2店 3；3店 2；4店 4；5店 1/);
assert.doesNotMatch(nodes.get('audit').innerHTML, /zp888（未识别型号/);
assert.equal(api.groupRows(api.stocksFromInputs(), api.salesFromInputs(), 'model', 'bali').reduce((n, r) => n + r.sales, 0), 7);
assert.equal(api.groupRows([], api.salesFromInputs(), 'model', 'pnk').reduce((n, r) => n + r.sales, 0), 4);
assert.equal(api.groupRows([], api.salesFromInputs(), 'model', 'mks').reduce((n, r) => n + r.sales, 0), 4);
delete api.app.profiles.tiktok;

const detail = api.sheetInfo('Detail', [
  ['SKU', '店铺', '销量'], [phone, 'Shop 1', 2], [phone, '2店', 3], [phone, '4店', 4], [phone, '5店', 1],
  ['realme Note 80 64GB 4GB Storm Black', '3店', 2], ['zp888', '1店', 9], ['合计', '', 21]
], 'shopee');
install('shopee', [detail]);
assert.equal(sum(api.salesFromInputs()), 12, 'long form remains supported');
install('shopee', [wide, detail]);
assert.equal(api.reconcileShopee().hasBoth, true);
assert.equal(api.reconcileShopee().differences.length, 0, 'store aliases reconcile with Chinese columns');
assert.equal(sum(api.salesFromInputs()), 12, 'matching detail and pivot must never be added together');

const zero = api.sheetInfo('Zero', [['SKU', '1店'], [phone, 0]], 'shopee');
install('shopee', [detail, zero], 'Zero');
assert.equal(api.rawSummary('shopee').valid, true, 'zero sales is valid');
assert.equal(api.reconcileShopee().hasBoth, true, 'zero versus positive sources must still reconcile');
api.updateCalculateButton(true, [{ valid: true }], { valid: true }, { valid: true });
assert.equal(nodes.get('calculate').disabled, true, 'source conflict blocks calculation until selected');
api.app.sourceChoice = 'pivot';
api.app.sourceConfirmed = true;
api.updateCalculateButton(true, [{ valid: true }], { valid: true }, { valid: true });
assert.equal(nodes.get('calculate').disabled, false);
assert.equal(sum(api.salesFromInputs()), 0, 'choosing zero pivot must not silently fall back to detail');
api.app.sourceChoice = 'detail';
assert.equal(sum(api.salesFromInputs()), 12);
install('shopee', [wide, zero], 'Zero');
assert.equal(sum(api.salesFromInputs()), 0, 'selected sheet controls single-format workbook');

const aliases = api.sheetInfo('Aliases', [
  ['Weekly sales'], ['SKU', '１ 店', 'Shop 2', 'store_3', '４店', '5 店', 'Total Sales'],
  [phone, 1, 2, 3, 4, 5, 999]
], 'shopee');
install('shopee', [aliases]);
assert.equal(aliases.headerIndex, 1);
assert.equal(api.shopeeMode(aliases.mapping), 'pivot', 'store columns take priority over total sales');
assert.equal(sum(api.salesFromInputs()), 15);
assert.deepEqual(plain(api.rawSummary('shopee').byStore), { shop1: 1, shop2: 2, shop3: 3, shop4: 4, shop5: 5, tiktok: 0 });
const invalid = api.sheetInfo('Notes', [['SKU', '合计 Total'], [phone, 20]], 'shopee');
assert.equal(api.chooseSheet([invalid, wide], 'shopee').name, 'Wide');
install('shopee', [invalid]);
assert.equal(api.rawSummary('shopee').valid, false, 'total-only files cannot be assigned to stores');

for (const raw of ['zp888', 'ZP888', ' zp888 ', 'ＺＰ８８８']) {
  assert.equal(core.isGiftSku(raw), true);
  assert.equal(core.parseSKU(raw, {}, { model: 'C100i' }).excluded, true, 'old overrides cannot undo exclusion');
  assert.deepEqual(core.stockSkuProblems(core.parseSKU(raw)), []);
}
assert.equal(core.isGiftSku('zp888-phone'), false, 'only the exact gift code is excluded');
assert.deepEqual(core.stockSkuProblems(core.parseSKU('unknown-code')), ['未识别型号']);
assert.equal(core.parseSKU('realme Buds T200 RMA2410 Mystic Grey UN').color, 'Mystic Gray');
assert.equal(core.parseSKU('realme TechLife Buds').color, '', 'missing color must not be invented');
console.log('Import regression passed: wide/detail sheets, totals, store mapping, gift exclusion, source selection and zero sales');

module.exports = { api, install, plain, sum };
