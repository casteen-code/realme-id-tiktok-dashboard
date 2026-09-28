'use strict';

// Minimal fabricated SKU / quantity fixtures only; no source workbooks or orders.
const assert = require('node:assert/strict');
const core = require('../sku-core.js');
const { api, install, plain, sum, nodes } = require('./import-regression.js');
const parse = raw => core.parseSKU(raw);
const catalog = [
  'realme P4 Lite 64GB 4GB Titan Grey',
  'realme P4 Lite 128GB 4GB Titan Grey',
  'realme P4 Lite 256GB 4GB Titan Grey',
  'realme Note 80 64GB 4GB Glacier Blue',
  'realme C100i 128GB 4GB Dusk Gray',
  'realme C100i 128GB 6GB Dusk Gray',
  'realme 16 256GB 12GB Air Black',
  'realme 16 Pro 256GB 12GB Pebble Gray',
  'realme 16 Pro+ 256GB 12GB Master Gray'
].map(parse);
for (const capacity of [64, 128, 256]) {
  const sale = core.parseSKU('P4 Lite', {memory:`4/${capacity}GB`, color:'Titan Gray'});
  const match = core.resolveMatch(sale, catalog);
  assert.equal(match.target.fullKey, parse(`realme P4 Lite ${capacity}GB 4GB Titan Grey`).fullKey);
}
assert.equal(core.resolveMatch(parse('C100i | 4/128 | Gray'), catalog).type, '颜色简称');
assert.equal(core.resolveMatch(parse('C100i | 4/128 | Duskk Gray'), catalog).type, '拼写纠错');
assert.equal(core.resolveMatch(parse('C100i | 4/128 | Gray'), [...catalog, parse('C100i 4/128 Titan Gray')]).target, null, 'two gray colors require confirmation');
assert.equal(core.resolveMatch(parse('C100i | 4/128 | Dusk Gray'), [...catalog, parse('C100i 4/128 Titan Gray')]).target.fullKey, catalog[4].fullKey, 'exact color wins');
assert.equal(core.resolveMatch(parse('C100i | 4/256 | Dusk Gray'), catalog).target, null, 'never cross storage capacity');
assert.equal(core.resolveMatch(parse('C100i | 8/128 | Dusk Gray'), catalog).target, null, 'never cross physical RAM');
assert.equal(core.candidateScore(parse('C100i | 8/128 | Dusk Gray'), catalog[4]), 0);
assert.equal(core.resolveMatch(parse('C100i | Dusk Gray'), catalog).target, null, 'missing memory must not be invented');
assert.equal(core.resolveMatch(parse('C100i | 4/128'), catalog).target, null, 'missing color must not be invented');
assert.equal(core.resolveMatch(parse('16 | 12/256 | Master Gray'), catalog).target, null, 'never match base model to Pro+');
assert.equal(core.resolveMatch(parse('C100x | 4/128 | Dusk Gray'), catalog).target, null, 'keep x and i separate');
assert.equal(core.resolveMatch(parse('P4 | 4/64 | Titan Gray'), catalog).target, null, 'keep Lite suffix');
assert.equal(core.memory('4/8064GB'), '', 'reject impossible model-plus-capacity number');
assert.equal(core.memory('4/128GB or 8/256GB'), '', 'conflicting specifications need confirmation');
assert.equal(core.parseSKU('realme P4x 128GB 16GB Rally White').model, 'P4x', 'RAM 16 is not model 16');
assert.equal(core.resolveMatch(parse('Note 80 | 4/64 | Glacier Blue'), catalog, 'note80|4gb8064gb|glacierblue').target.fullKey, catalog[3].fullKey, 'migrate unique old corrupted target');
assert.equal(core.resolveMatch(catalog[0], catalog, 'obsolete-target').target, null, 'stale manual mappings are visible');

// Net units must outrank percentage, gross orders and money regardless of column order.
for (const net of ['净成交（台）', '净成交（件）', '净成交台数', '净成交数量']) {
  const summary = api.sheetInfo('SKU汇总', [
    ['统计口径：按机型、颜色、内存版本统计净成交；金额及销量占比仅供参考，不代表实际销售数量。'],
    ['机型', '颜色', '内存版本', '销量占比', '有效成交', net, '商品净额'],
    ['Note 80', 'Glacier Blue', '4/64GB', '100%', 12, 7, 9999],
    ['总计', '', '', '100%', 12, 7, 9999]
  ], 'tiktok');
  const detail = api.sheetInfo('订单明细', [
    ['机型', '颜色', '内存版本', '净成交数量'],
    ...Array.from({length:7}, () => ['Note 80', 'Glacier Blue', '4/64GB', 1])
  ], 'tiktok');
  assert.equal(summary.headerIndex, 1);
  assert.equal(summary.mapping.qty, net);
  assert.equal(api.chooseSheet([detail, summary], 'tiktok').name, 'SKU汇总', 'summary wins without double counting detail');
  api.app.profiles = {};
  install('tiktok', [detail, summary], 'SKU汇总');
  assert.equal(sum(api.salesFromInputs()), 7);
  install('tiktok', [detail, summary], '订单明细');
  assert.equal(sum(api.salesFromInputs()), 7);
}
const percentOnly = api.sheetInfo('Wrong', [['机型','颜色','内存版本','销量占比'], ['Note 80','Glacier Blue','4/64',100]], 'tiktok');
assert.equal(percentOnly.mapping.qty, '', 'percentage-only file cannot pretend to have quantity');

// Exercise the actual Save button handler, persistence and recalculation together.
async function testSaveAndRecall() {
  api.app.profiles = {};
  api.app.rules = structuredClone(core.DEFAULT_RULES);
  let savedRules;
  api.app.db = { set(name, value) { savedRules = structuredClone(value); }, saveHistory() {} };
  for (const warehouse of ['mks','pnk','bali']) install(warehouse, [api.sheetInfo('Stock', [['商家编码','OMS可支配库存'], ...catalog.map(s => [s.raw, warehouse === 'mks' ? 10 : 0])], 'stock')]);
  const detail = api.sheetInfo('订单明细', [
    ['机型','颜色','内存版本','净成交数量'],
    ['C100i','', '4/128', 2], ['realme C100i','', '4GB/128GB', 3],
    ['Note 80','', '4/64', 1], ['P4 Lite','Titan Gray','4/64',4]
  ], 'tiktok');
  install('tiktok', [detail]);
  api.calculate(false);
  assert.equal(api.app.result.issues.length, 2, 'same unresolved SKU is one card');
  assert.equal(api.app.result.issues[0].rowCount, 2);
  assert.equal(api.app.result.issues[0].qty, 5);
  await api.saveIssueMapping(0, catalog[4].fullKey);
  assert.equal(api.app.result.issues.length, 1, 'saving one SKU must not clear unrelated problems');
  assert.equal(api.app.result.issues[0].sku.model, 'Note 80');
  assert.equal(Object.keys(savedRules.manual).length, 1, 'one removable remembered rule');
  assert.equal(sum(api.app.result.sales), 10, 'saving never drops or duplicates sales');
  assert.match(nodes.get('matchSummary').textContent, /沿用已记住对应 1 种/);
  assert.equal(nodes.get('matchDetails').hidden, false);
  for (const view of ['model', 'sku']) {
    const rows = api.groupRows(api.app.result.stocks, api.app.result.sales, view, 'all');
    assert.equal(rows.reduce((n,x) => n+x.sales, 0), 10);
    for (const row of rows) assert.equal(Object.values(row.byStore).reduce((n,x) => n+x, 0), row.sales);
  }
  // Simulate a new browser session / weekly report with a different textual order.
  api.app.rules = plain(savedRules);
  install('tiktok', [api.sheetInfo('SKU汇总', [['机型','内存版本','颜色','净成交（台）'], ['C100 I','128GB 4GB','',8]], 'tiktok')]);
  api.calculate(false);
  assert.equal(api.app.result.issues.length, 0);
  assert.equal(api.app.result.sales[0].matchType, '已记住的对应');
  delete api.app.rules.manual[Object.keys(api.app.rules.manual)[0]];
  api.calculate(false);
  assert.equal(api.app.result.issues.length, 1, 'removing the single rule really revokes it');
}
testSaveAndRecall().then(() => console.log('Matching regression passed: capacity/family guards, color correction, net quantity, duplicate grouping, single-save isolation and persistence')).catch(error => { console.error(error); process.exitCode = 1; });
