(() => {
  'use strict';

  const WAREHOUSES = { mks: '马卡萨', pnk: '坤甸', bali: '巴厘岛', unassigned: '未分配' };
  const SLOT = {
    mks: { label: '马卡萨仓库存', type: 'stock', warehouse: 'mks' },
    pnk: { label: '坤甸仓库存', type: 'stock', warehouse: 'pnk' },
    bali: { label: '巴厘岛仓库存', type: 'stock', warehouse: 'bali' },
    shopee: { label: 'Shopee 分店销量', type: 'shopee' },
    tiktok: { label: 'TikTok Shop 销量', type: 'tiktok' }
  };
  const DEFAULT_RULES = {
    modelAliases: {
      'realmec100i': 'C100i', 'c100i': 'C100i', '16proplus': '16 Pro+', '16pro+': '16 Pro+',
      '16pro': '16 Pro', '16': '16'
    },
    colorAliases: {
      'grey': 'Gray', 'mastergrey': 'Master Gray', 'deepbluetide': 'Deepblue Tides',
      'deepbluetides': 'Deepblue Tides', 'stromblack': 'Storm Black'
    },
    manual: {}, stockOverrides: {}
  };
  const COLOR_PHRASES = ['titanium silver','titanium black','lavender purple','moss green','ivory gold','white swan','forest owl','swan black','kingfisher blue','violet parrot','parrot purple','peacock green','phantom navy','rally white','glacier blue','storm black','dusk gray','dawn purple','master gray','master grey','master purple','master gold','pebble grey','pebble gray','orchid purple','air white','air black','pulse purple','glory beige','deepblue tides','deepblue tide','volt black','aurora purple','racing green','metallic grey','starlight green','comet grey','lightning gold','golden coast','victory purple','glory white','endurance brown','pine green','cloud white','titan grey','brown','black','white','blue','purple','green','gray','grey','gold','silver','red','orange'];
  const $ = (id) => document.getElementById(id);
  const app = { profiles: {}, rules: structuredClone(DEFAULT_RULES), sourceChoice: null, sourceConfirmed: false, view: 'model', scope: 'all', sort: 'turnAsc', result: null, historySnapshot: null, db: null };

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function clean(value) { return String(value ?? '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, ' ').replace(/hadiah\s*gratis|free\s*gift|promo/ig, ' ').replace(/\s+/g, ' ').trim(); }
  function norm(value) { return clean(value).toLowerCase().replace(/[＿_]/g, ' ').replace(/[|,，;；]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function key(value) { return norm(value).replace(/\+/g, ' plus ').replace(/[^a-z0-9]/g, ''); }
  function num(value) { const n = Number(String(value ?? '').replace(/[,，\s]/g, '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? n : 0; }
  function isSummary(value) { const s = key(value); return !s || /(total|subtotal|grandtotal|heji|zongji|xiaoj|dianpuheji)$/.test(s) || /(?:总计|合计|小计|汇总|店铺合计)/.test(String(value ?? '')); }
  function title(value) { return String(value || '').replace(/\b\w/g, x => x.toUpperCase()); }
  function show(message, type = 'info') { const node = $('notice'); node.textContent = message; node.className = `notice show ${type}`; }
  function setStatus(text, type = 'normal') { const node = $('status'); node.textContent = text; node.style.background = type === 'warn' ? 'var(--amber-soft)' : type === 'error' ? 'var(--red-soft)' : 'var(--brand-soft)'; node.style.color = type === 'warn' ? 'var(--amber)' : type === 'error' ? 'var(--red)' : 'var(--brand)'; }

  function cloneDefaults() { return structuredClone(DEFAULT_RULES); }
  function mergeRules(saved) {
    const base = cloneDefaults();
    return { modelAliases: { ...base.modelAliases, ...(saved?.modelAliases || {}) }, colorAliases: { ...base.colorAliases, ...(saved?.colorAliases || {}) }, manual: { ...(saved?.manual || {}) }, stockOverrides: { ...(saved?.stockOverrides || {}) } };
  }

  function createStore() {
    const fallback = {
      get(name) { try { return JSON.parse(localStorage.getItem(`turnover.v3.${name}`) || 'null'); } catch { return null; } },
      set(name, value) { localStorage.setItem(`turnover.v3.${name}`, JSON.stringify(value)); },
      history() { return this.get('history') || []; },
      saveHistory(row) { const list = [row, ...this.history()].slice(0, 30); this.set('history', list); return list; },
      deleteHistory(id) { this.set('history', this.history().filter(x => x.id !== id)); }
    };
    if (!window.indexedDB) return Promise.resolve(fallback);
    return new Promise(resolve => {
      const request = indexedDB.open('realme-turnover-stable-v1', 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings'); if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id' }); };
      request.onerror = () => resolve(fallback);
      request.onsuccess = () => {
        const db = request.result;
        const tx = (store, mode = 'readonly') => db.transaction(store, mode).objectStore(store);
        resolve({
          get(name) { return new Promise(r => { const q = tx('settings').get(name); q.onsuccess = () => r(q.result ?? null); q.onerror = () => r(null); }); },
          set(name, value) { return new Promise(r => { const q = tx('settings', 'readwrite').put(value, name); q.onsuccess = q.onerror = () => r(); }); },
          history() { return new Promise(r => { const q = tx('history').getAll(); q.onsuccess = () => r((q.result || []).sort((a, b) => b.createdAt - a.createdAt)); q.onerror = () => r([]); }); },
          saveHistory(row) { return new Promise(async r => { const rows = await this.history(); rows.slice(29).forEach(x => tx('history', 'readwrite').delete(x.id)); const q = tx('history', 'readwrite').put(row); q.onsuccess = q.onerror = () => r(); }); },
          deleteHistory(id) { return new Promise(r => { const q = tx('history', 'readwrite').delete(id); q.onsuccess = q.onerror = () => r(); }); }
        });
      };
    });
  }

  function header(value) { return norm(value).replace(/[ _-]/g, ''); }
  function headerScore(row, slot) {
    const text = row.map(header).join(' ');
    const has = (...names) => names.some(n => text.includes(n));
    if (slot === 'stock') return (has('商家编码','sellersku','sku','productname','商品') ? 8 : 0) + (has('oms可支配库存','库存','stock','available','quantity','jumlah') ? 8 : 0);
    if (slot === 'tiktok') return (has('机型','model','型号') ? 7 : 0) + (has('内存版本','memory','ram') ? 4 : 0) + (has('颜色','color','warna') ? 3 : 0) + (has('净成交数量','销量','quantity','sold','sales') ? 7 : 0);
    return (has('sku','商品') ? 7 : 0) + (has('店铺','shop','store','namatoko') ? 6 : 0) + (has('销量','quantity','sold','sales','jumlah') ? 7 : 0) + (has('1店','2店','3店','4店','5店') ? 4 : 0);
  }
  function uniqueHeaders(row) { const seen = {}; return row.map((v, i) => { const base = String(v || `列${i + 1}`).trim() || `列${i + 1}`; seen[base] = (seen[base] || 0) + 1; return seen[base] === 1 ? base : `${base} ${seen[base]}`; }); }
  function field(headers, names) { return headers.find(h => names.includes(header(h))) || headers.find(h => names.some(n => header(h).includes(n))) || ''; }
  function value(record, column) { return column ? record[column] : ''; }
  function sheetInfo(name, matrix, kind) {
    let hi = 0, best = -1;
    for (let i = 0; i < Math.min(35, matrix.length); i++) { const score = headerScore(matrix[i] || [], kind); if (score > best) { best = score; hi = i; } }
    const headers = uniqueHeaders(matrix[hi] || []);
    const records = matrix.slice(hi + 1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))).filter(r => Object.values(r).some(v => String(v).trim()));
    return { name, headerIndex: hi, headers, records, score: best, mapping: detectMapping(headers, kind) };
  }
  function detectMapping(headers, kind) {
    const sku = field(headers, ['商家编码','sellersku','variationsku','productsku','sku','商品名称','产品名称','商品sku','商品编码','itemname','productname','producttitle','namaproduk','namaprodukdanvariasi','description','title','variation','variasi']);
    const qtyStock = field(headers, ['oms可支配库存','可用库存','可用数量','availablequantity','available','availablestock','actualquantity','stocktersedia','stock','库存数量','库存','inventory','quantity','qty','jumlah','onhand']);
    const qtySales = field(headers, ['净成交数量','周销量','销量','销售数量','salesvolume','quantitysold','soldquantity','unitssold','totalsold','orderquantity','quantity','qty','sold','sales','jumlah','订单量','数量']);
    const model = field(headers, ['机型','model','型号','productmodel']);
    const memory = field(headers, ['内存版本','memoryversion','memory','ramrom','storage','规格','version']);
    const color = field(headers, ['颜色','color','warna']);
    const shop = field(headers, ['店铺名称','店铺','namatoko','shopname','storename','shop','store','channel','渠道']);
    const stores = headers.filter(h => /^(?:[1-5]店|shop\s*[1-5]|store\s*[1-5])$/i.test(String(h).trim()));
    return kind === 'stock' ? { sku, qty: qtyStock } : kind === 'tiktok' ? { model, memory, color, qty: qtySales } : { sku, shop, qty: qtySales, stores };
  }
  function chooseSheet(sheets, slot) {
    const kind = SLOT[slot].type;
    const sorted = [...sheets].sort((a, b) => (b.score * 1000 + b.records.length) - (a.score * 1000 + a.records.length));
    if (kind === 'shopee') return sorted.find(s => s.mapping.sku && s.mapping.shop && s.mapping.qty) || sorted[0];
    return sorted[0];
  }
  async function readFile(slot, file) {
    if (!window.XLSX) throw new Error('Excel 读取组件没有加载，请重新打开网页。');
    const data = await file.arrayBuffer();
    const book = XLSX.read(data, { type: 'array', cellDates: false });
    const kind = SLOT[slot].type;
    const sheets = book.SheetNames.map(name => sheetInfo(name, XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: '', raw: false }), kind));
    const chosen = chooseSheet(sheets, slot);
    if (!chosen?.records.length) throw new Error('没有找到可读取的数据行。');
    if (slot === 'shopee') { app.sourceChoice = null; app.sourceConfirmed = false; }
    app.profiles[slot] = { slot, fileName: file.name, sheets, chosenName: chosen.name };
    renderPreview();
  }
  function profile(slot) { const p = app.profiles[slot]; return p ? p.sheets.find(s => s.name === p.chosenName) : null; }
  function schemaText(slot, sheet) {
    if (!sheet) return '等待文件'; const m = sheet.mapping;
    const pairs = SLOT[slot].type === 'stock' ? [['SKU', m.sku], ['库存', m.qty]] : SLOT[slot].type === 'tiktok' ? [['机型', m.model], ['内存', m.memory], ['颜色', m.color], ['销量', m.qty]] : [['SKU', m.sku], ['店铺', m.shop], ['销量', m.qty]];
    return pairs.map(([a, b]) => `${a}：${b || '未找到'}`).join('；');
  }
  function rawSummary(slot) {
    const s = profile(slot); if (!s) return { rows: 0, quantity: 0, valid: false };
    const type = SLOT[slot].type, m = s.mapping; let rows = 0, quantity = 0;
    if (type === 'stock') for (const r of s.records) { const sku = value(r, m.sku); if (!sku || isSummary(sku)) continue; rows++; quantity += Math.max(0, num(value(r, m.qty))); }
    if (type === 'tiktok') for (const r of s.records) { const sku = value(r, m.model); if (!sku || isSummary(sku)) continue; rows++; quantity += Math.max(0, num(value(r, m.qty))); }
    if (type === 'shopee') for (const r of s.records) { const sku = value(r, m.sku); if (!sku || isSummary(sku)) continue; rows++; quantity += Math.max(0, num(value(r, m.qty))); }
    return { rows, quantity, valid: rows > 0 && Boolean(type === 'stock' ? m.sku && m.qty : type === 'tiktok' ? m.model && m.qty : m.sku && m.shop && m.qty) };
  }
  function findShopeeSheets() {
    const p = app.profiles.shopee; if (!p) return {};
    const detail = p.sheets.find(s => s.mapping.sku && s.mapping.shop && s.mapping.qty);
    const pivot = p.sheets.find(s => s.mapping.sku && s.mapping.stores?.length >= 2);
    return { detail, pivot };
  }
  function shopeeRows(sheet, mode) {
    if (!sheet) return []; const m = sheet.mapping, out = [];
    if (mode === 'pivot') {
      for (const r of sheet.records) { const sku = value(r, m.sku); if (!sku || isSummary(sku)) continue; for (const store of m.stores) { const q = num(value(r, store)); if (q > 0) out.push({ sku, shop: store, qty: q }); } }
    } else {
      for (const r of sheet.records) { const sku = value(r, m.sku), shop = value(r, m.shop), qty = num(value(r, m.qty)); if (!sku || isSummary(sku) || qty <= 0) continue; out.push({ sku, shop, qty }); }
    }
    return out;
  }
  function reconcileShopee() {
    const { detail, pivot } = findShopeeSheets(); const detailRows = shopeeRows(detail, 'detail'), pivotRows = shopeeRows(pivot, 'pivot');
    if (!detailRows.length || !pivotRows.length) return { hasBoth: false, detailRows, pivotRows, differences: [] };
    const group = rows => rows.reduce((a, x) => { const k = `${clean(x.sku)}|${clean(x.shop)}`; a[k] = (a[k] || 0) + x.qty; return a; }, {});
    const a = group(detailRows), b = group(pivotRows), keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const differences = [...keys].filter(k => (a[k] || 0) !== (b[k] || 0)).map(k => ({ key: k, detail: a[k] || 0, pivot: b[k] || 0 }));
    return { hasBoth: true, detailRows, pivotRows, differences };
  }
  function renderPreview() {
    const loaded = Object.keys(app.profiles).length; $('previewCard').classList.toggle('hidden', !loaded); if (!loaded) return;
    $('previewGrid').innerHTML = Object.keys(SLOT).map(slot => {
      const p = app.profiles[slot], s = profile(slot), summary = rawSummary(slot); if (!p) return `<div class="preview"><strong>${SLOT[slot].label}</strong><p>等待上传</p></div>`;
      const options = p.sheets.map(x => `<option value="${esc(x.name)}" ${x.name === p.chosenName ? 'selected' : ''}>${esc(x.name)}（${x.records.length} 行）</option>`).join('');
      return `<div class="preview"><strong>${SLOT[slot].label}</strong><p class="file">${esc(p.fileName)}</p><p>工作表：<select class="sheet-select" data-slot="${slot}">${options}</select></p><p>${esc(schemaText(slot, s))}</p><p class="${summary.valid ? 'ok' : 'bad'}">${summary.valid ? `读取 ${summary.rows} 行，数量 ${summary.quantity.toLocaleString()}` : '字段不完整，不能参与计算'}</p></div>`;
    }).join('');
    document.querySelectorAll('.sheet-select').forEach(node => node.onchange = () => { app.profiles[node.dataset.slot].chosenName = node.value; app.sourceConfirmed = false; renderPreview(); });
    renderAudit();
  }
  function renderAudit() {
    const stockSlots = ['mks', 'pnk', 'bali'], allLoaded = Object.keys(SLOT).every(x => app.profiles[x]);
    const stockChecks = stockSlots.map(x => ({ slot: x, ...rawSummary(x) })); const tk = rawSummary('tiktok'), sh = rawSummary('shopee'); const rec = reconcileShopee();
    const stockTotal = stockChecks.reduce((a, x) => a + x.quantity, 0); const stockText = stockChecks.map(x => `${WAREHOUSES[x.slot]} ${x.quantity.toLocaleString()}`).join('、');
    let html = `<div class="audit-item ${stockChecks.every(x => x.valid) ? 'good' : 'alert'}"><strong>库存控制数</strong><p>${stockText || '等待库存文件'}；合计 ${stockTotal.toLocaleString()}</p><p class="hint">${stockChecks.every(x => x.valid) ? '三个仓库均已找到 SKU 和库存字段。' : '请在上方为每个库存文件选择正确工作表。'}</p></div>`;
    if (stockChecks.every(x => x.valid)) {
      const problems = stocksFromInputs().filter(x => stockSkuProblems(x.sku).length);
      html += `<div class="audit-item ${problems.length ? 'alert' : 'good'}"><strong>库存 SKU 识别自检</strong><p>${problems.length ? `${problems.length} 条库存 SKU 需要补全` : '全部库存 SKU 均已识别完整'}</p><p class="hint">${problems.length ? `示例：${esc(problems.slice(0, 2).map(x => `${x.sku.raw}（${stockSkuProblems(x.sku).join('、')}）`).join('；'))}。计算后可在下方逐条修正。` : '每条库存都有可用于匹配的型号、内存和颜色信息。'}</p></div>`;
    }
    html += `<div class="audit-item ${tk.valid ? 'good' : 'alert'}"><strong>TikTok 周销量</strong><p>${tk.valid ? `${tk.rows} 条 SKU，合计 ${tk.quantity.toLocaleString()}` : '尚未识别到机型和净成交数量字段'}</p></div>`;
    if (rec.hasBoth) {
      const detailTotal = rec.detailRows.reduce((a, x) => a + x.qty, 0), pivotTotal = rec.pivotRows.reduce((a, x) => a + x.qty, 0), mismatch = rec.differences.length;
      html += `<div class="audit-item ${mismatch ? 'alert' : 'good'}"><strong>Shopee 两张表对账</strong><p>分组明细 ${detailTotal.toLocaleString()}；透视表 ${pivotTotal.toLocaleString()}${mismatch ? `；发现 ${mismatch} 项差异` : '；完全一致'}</p>${mismatch ? `<p class="hint">计算前请选择采用哪一个来源：<label><input type="radio" name="shopeeSource" value="detail" ${app.sourceChoice === 'detail' ? 'checked' : ''}> 分组明细</label> <label><input type="radio" name="shopeeSource" value="pivot" ${app.sourceChoice === 'pivot' ? 'checked' : ''}> 透视表</label></p><p class="hint">示例：${rec.differences.slice(0, 2).map(x => `${esc(x.key.split('|')[0])}（明细 ${x.detail} / 透视 ${x.pivot}）`).join('；')}</p>` : ''}</div>`;
    } else html += `<div class="audit-item ${sh.valid ? 'good' : 'alert'}"><strong>Shopee 周销量</strong><p>${sh.valid ? `${sh.rows} 条 SKU，合计 ${sh.quantity.toLocaleString()}` : '尚未识别到 SKU、店铺和销量字段'}</p></div>`;
    $('audit').innerHTML = html;
    document.querySelectorAll('[name=shopeeSource]').forEach(x => x.onchange = () => { app.sourceChoice = x.value; app.sourceConfirmed = true; updateCalculateButton(); });
    updateCalculateButton(allLoaded, stockChecks, tk, sh, rec);
  }
  function updateCalculateButton(allLoaded, stockChecks, tk, sh, rec) {
    const ready = (allLoaded ?? Object.keys(SLOT).every(x => app.profiles[x])) && (stockChecks ?? ['mks','pnk','bali'].map(rawSummary)).every(x => x.valid) && (tk ?? rawSummary('tiktok')).valid && (sh ?? rawSummary('shopee')).valid;
    const conflict = (rec ?? reconcileShopee()).hasBoth && (rec ?? reconcileShopee()).differences.length && !app.sourceConfirmed;
    $('calculate').disabled = !ready || conflict;
    setStatus(!ready ? '等待正确字段' : conflict ? '需要确认 Shopee 来源' : '可以计算周转', conflict ? 'warn' : 'normal');
  }

  function memory(value) {
    const x = norm(value).replace(/\s/g, '');
    // 先识别 WMS 常见的“128GB6GB”，避免把型号 P4x128GB 中的“4x128”误判成内存。
    const m = x.match(/(\d{2,4})(?:gb|g)(\d{1,2})(?:gb|g)/i)
      || x.match(/(?:^|[^a-z0-9])(\d{1,2})(?:gb|g)?[\/x×+\-](\d{2,4})(?:gb|g)/i)
      || x.match(/(?:^|[^a-z0-9])(\d{2,4})(?:gb|g)?[\/x×+\-](\d{1,2})(?:gb|g)/i);
    if (!m) return ''; const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]); return `${a}GB/${b}GB`;
  }
  function aliases(type) { return type === 'model' ? app.rules.modelAliases : app.rules.colorAliases; }
  function modelInfo(value) {
    const source = clean(value).replace(/\brealme\b/ig, ' ');
    const sixteen = source.match(/\b16\s*(?:pro\s*\+?)?(?![a-z0-9])/i);
    if (sixteen) { const v = key(sixteen[0]); return { value: v.includes('pro') ? (v.includes('plus') ? '16 Pro+' : '16 Pro') : '16', recognized: true }; }
    const m = source.match(/\b(techlife\s+buds|buds\s+clip|buds\s+t\d{1,4}(?:\s+lite)?|buds\s+air\s*\d{0,3}(?:\s*(?:pro|neo|lite|plus))?|watch\s*\d+[a-z]*|note\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|c\s*\d{1,3}(?:\s*(?:i|x|s|a|pro|plus|lite))?|p\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|narzo\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?)\b/i);
    let out = (m ? m[1] : source.split(/[|,，;]/)[0]).replace(/\b(?:128|256|512)\s*(?:gb|g)\b/ig, ' ').replace(/\b(?:4|6|8|12|16)\s*(?:gb|g)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    out = out.replace(/\bpro\b/ig, 'Pro').replace(/\bplus\b/ig, 'Plus').replace(/\blite\b/ig, 'Lite').replace(/\bnote\s*/ig, 'Note ').replace(/\bc\s*/ig, 'C').replace(/\bp\s*/ig, 'P');
    const mapped = aliases('model')[key(out)];
    return { value: mapped || out || '未识别型号', recognized: Boolean(m || mapped) };
  }
  function model(value) { return modelInfo(value).value; }
  function color(value) {
    const source = norm(value); let found = COLOR_PHRASES.filter(x => source.includes(x)).sort((a, b) => b.length - a.length)[0] || '';
    if (!found && value.includes('|')) found = clean(value).split('|').map(x => x.trim()).filter(x => x && !memory(x) && !/^realme\s/i.test(x)).pop() || '';
    const mapped = aliases('color')[key(found)] || found; return mapped ? title(mapped).replace(/Grey/g, 'Gray') : '';
  }
  function parseSKU(raw, parts = {}, override = null) {
    const label = [parts.model || raw, parts.memory, parts.color].filter(Boolean).join(' | ');
    const rawKey = key(label), found = modelInfo(label), m = clean(override?.model || found.value) || '未识别型号', mem = memory(override?.memory || parts.memory || label) || clean(override?.memory || ''), col = color(override?.color || parts.color || label) || clean(override?.color || '');
    return { raw: clean(label), rawKey, model: m, modelKey: key(m), memory: mem, color: col, fullKey: [key(m), key(mem), key(col)].join('|'), baseKey: [key(m), key(mem)].join('|'), recognizedModel: Boolean(override?.model || found.recognized) };
  }
  function isPhoneModel(name) { return /^(?:16(?:\s+Pro\+?)?|Note\s*\d|C\d|P\d|Narzo\s*\d)/i.test(name); }
  function stockSkuProblems(sku) {
    const problems = [];
    if (!sku.recognizedModel) problems.push('未识别型号');
    if (sku.recognizedModel && isPhoneModel(sku.model) && !sku.memory) problems.push('未识别内存');
    if (sku.recognizedModel && !sku.color) problems.push('未识别颜色');
    return problems;
  }
  function warehouse(shop) { const s = norm(shop); if (/tiktok|\btk\b/.test(s) || /(?:1店|3店|shop\s*[13]\b|store\s*[13]\b)/.test(s)) return 'bali'; if (/(?:4店|shop\s*4\b|store\s*4\b)/.test(s)) return 'pnk'; if (/(?:2店|5店|shop\s*[25]\b|store\s*[25]\b)/.test(s)) return 'mks'; return 'unassigned'; }
  function stocksFromInputs() { const out = []; for (const slot of ['mks','pnk','bali']) { const s = profile(slot), m = s.mapping; for (const r of s.records) { const raw = value(r, m.sku); if (!raw || isSummary(raw)) continue; const initial = parseSKU(raw), saved = app.rules.stockOverrides?.[initial.rawKey]; out.push({ sku: saved ? parseSKU(raw, {}, saved) : initial, warehouse: slot, qty: Math.max(0, num(value(r, m.qty))), source: SLOT[slot].label }); } } return out; }
  function salesFromInputs() {
    const out = [], t = profile('tiktok'); if (t) for (const r of t.records) { const raw = value(r, t.mapping.model), qty = num(value(r, t.mapping.qty)); if (!raw || isSummary(raw) || qty <= 0) continue; out.push({ sku: parseSKU(raw, { model: raw, memory: value(r, t.mapping.memory), color: value(r, t.mapping.color) }), warehouse: 'bali', qty, source: 'TikTok' }); }
    const rec = reconcileShopee(), mode = rec.hasBoth ? (app.sourceChoice || 'detail') : 'detail', rows = mode === 'pivot' ? rec.pivotRows : rec.detailRows.length ? rec.detailRows : shopeeRows(profile('shopee'), 'detail');
    for (const r of rows) out.push({ sku: parseSKU(r.sku), warehouse: warehouse(r.shop), qty: r.qty, source: `Shopee ${r.shop}` });
    return out;
  }
  function similarity(a, b) { if (!a || !b) return 0; if (a === b) return 1; const aa = new Set(a), bb = new Set(b), common = [...aa].filter(x => bb.has(x)).length; return common / Math.max(aa.size, bb.size); }
  function candidateScore(sale, stock) { if (sale.modelKey !== stock.modelKey) return 0; let score = 60; if (sale.memory && stock.memory) score += sale.memory === stock.memory ? 25 : 0; else score += 8; if (sale.color && stock.color) score += sale.color === stock.color ? 15 : Math.round(similarity(key(sale.color), key(stock.color)) * 8); else score += 5; return score; }
  function matchSales(stocks, sales) {
    const catalog = [...new Map(stocks.map(x => [x.sku.fullKey, x.sku])).values()]; const manual = app.rules.manual || {}; const issues = [];
    for (const sale of sales) {
      const forced = manual[sale.sku.rawKey]; let target = forced ? catalog.find(x => x.fullKey === forced) : null;
      const exact = catalog.find(x => x.fullKey === sale.sku.fullKey); const candidates = catalog.map(x => ({ sku: x, score: candidateScore(sale.sku, x) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
      if (!target && exact) target = exact;
      if (!target && candidates[0] && candidates[0].score >= 98 && (!candidates[1] || candidates[0].score - candidates[1].score >= 12)) target = candidates[0].sku;
      sale.targetKey = target?.fullKey || ''; sale.matchType = forced ? '手动规则' : exact ? '完全一致' : target ? '高置信度' : '待确认'; sale.candidates = candidates.slice(0, 8);
      if (!target) issues.push(sale);
    }
    return issues;
  }
  function groupRows(stocks, sales, view, scope) {
    const rows = new Map(); const add = (id, base) => { if (!rows.has(id)) rows.set(id, { ...base, stock: 0, sales: 0, byWarehouse: { mks: 0, pnk: 0, bali: 0 }, unmatched: false }); return rows.get(id); };
    stocks.filter(x => scope === 'all' || x.warehouse === scope).forEach(x => { const id = view === 'model' ? x.sku.modelKey : x.sku.fullKey; const row = add(id, { name: x.sku.model, memory: x.sku.memory, color: x.sku.color }); row.stock += x.qty; row.byWarehouse[x.warehouse] += x.qty; });
    sales.filter(x => scope === 'all' ? true : x.warehouse === scope).forEach(x => { const id = view === 'model' ? x.sku.modelKey : (x.targetKey || `unmatched:${x.sku.rawKey}`); const target = x.targetKey ? stocks.find(y => y.sku.fullKey === x.targetKey)?.sku : null; const row = add(id, { name: target?.model || x.sku.model, memory: target?.memory || x.sku.memory, color: target?.color || x.sku.color }); row.sales += x.qty; if (!x.targetKey && view === 'sku') row.unmatched = true; });
    return [...rows.values()].map(x => ({ ...x, turnover: x.sales ? x.stock / (x.sales / 7) : null }));
  }
  function rowStatus(days) { if (days == null) return ['无销量', 'none']; if (days < 14) return ['偏低', 'low']; if (days > 60) return ['偏高', 'high']; return ['正常', 'good']; }
  function sorted(rows) { const sorters = { turnAsc: (a,b) => (a.turnover ?? Infinity) - (b.turnover ?? Infinity), turnDesc: (a,b) => (b.turnover ?? -Infinity) - (a.turnover ?? -Infinity), stockDesc: (a,b) => b.stock - a.stock, salesDesc: (a,b) => b.sales - a.sales, nameAsc: (a,b) => a.name.localeCompare(b.name) }; return [...rows].sort(sorters[app.sort]); }
  function calculate(save = true) {
    const stocks = stocksFromInputs(), sales = salesFromInputs(), issues = matchSales(stocks, sales), stockIssues = stocks.filter(x => stockSkuProblems(x.sku).length); const modelRows = groupRows(stocks, sales, 'model', 'all'), skuRows = groupRows(stocks, sales, 'sku', 'all');
    app.historySnapshot = null; app.result = { stocks, sales, issues, stockIssues, modelRows, skuRows, createdAt: Date.now(), audit: auditSnapshot() }; $('report').classList.remove('hidden'); renderReport(); if (save) saveSnapshot(); const hasIssues = issues.length || stockIssues.length; setStatus(`已完成：${stocks.length} 条库存、${sales.length} 条销量`, hasIssues ? 'warn' : 'normal'); show(hasIssues ? `已计算。库存有 ${stockIssues.length} 条需要补全识别；销售有 ${issues.length} 条需要确认。` : '已计算，库存和销售 SKU 均已匹配。', hasIssues ? 'warn' : 'ok');
  }
  function auditSnapshot() { const rec = reconcileShopee(); return { stock: ['mks','pnk','bali'].map(x => ({ warehouse: WAREHOUSES[x], ...rawSummary(x) })), tiktok: rawSummary('tiktok'), shopee: rec.hasBoth ? { detail: rec.detailRows.reduce((a,x) => a+x.qty,0), pivot: rec.pivotRows.reduce((a,x) => a+x.qty,0), choice: app.sourceChoice, differences: rec.differences } : { chosen: rawSummary('shopee').quantity } }; }
  function renderReport() {
    if (!app.result) return; if (app.historySnapshot) return renderHistorical(app.historySnapshot); const { stocks, sales, issues, stockIssues } = app.result; const scopedStocks = stocks.filter(x => app.scope === 'all' || x.warehouse === app.scope), scopedSales = sales.filter(x => app.scope === 'all' || x.warehouse === app.scope); const stock = scopedStocks.reduce((a,x)=>a+x.qty,0), sold = scopedSales.reduce((a,x)=>a+x.qty,0), rows = sorted(groupRows(stocks, sales, app.view, app.scope));
    $('metrics').innerHTML = `<div class="metric"><small>可用库存</small><div class="n">${stock.toLocaleString()}</div><small>${app.scope === 'all' ? '三个仓库合计' : WAREHOUSES[app.scope]}</small></div><div class="metric"><small>上周销量</small><div class="n">${sold.toLocaleString()}</div><small>以已确认来源为准</small></div><div class="metric"><small>整体周转</small><div class="n">${sold ? `${(stock / (sold / 7)).toFixed(1)} 天` : '—'}</div><small>库存 ÷（周销量 ÷ 7）</small></div><div class="metric"><small>库存识别异常</small><div class="n">${stockIssues.length}</div><small>需补全型号、内存或颜色</small></div><div class="metric"><small>销售待确认 SKU</small><div class="n">${issues.length}</div><small>不会自动强行匹配</small></div>`;
    $('reportHint').textContent = `${app.scope === 'all' ? '全部仓库' : WAREHOUSES[app.scope]} · ${app.view === 'model' ? '型号已合并内存、颜色' : '完整 SKU 保留内存、颜色'} · ${rows.length} 条记录`;
    $('thead').innerHTML = `<tr><th>${app.view === 'model' ? '型号' : '型号 / SKU'}</th><th>马卡萨</th><th>坤甸</th><th>巴厘岛</th><th>可用库存</th><th>周销量</th><th>周转天数</th><th>状态</th></tr>`;
    $('tbody').innerHTML = rows.length ? rows.map(r => { const [label, cls] = rowStatus(r.turnover); return `<tr><td><span class="name">${esc(r.name)}</span>${app.view === 'sku' ? `<span class="detail">${esc([r.memory, r.color].filter(Boolean).join(' · ') || '未识别规格')}${r.unmatched ? ' · 未对应库存 SKU' : ''}</span>` : ''}</td><td>${r.byWarehouse.mks.toLocaleString()}</td><td>${r.byWarehouse.pnk.toLocaleString()}</td><td>${r.byWarehouse.bali.toLocaleString()}</td><td>${r.stock.toLocaleString()}</td><td>${r.sales.toLocaleString()}</td><td class="name">${r.turnover == null ? '—' : `${r.turnover.toFixed(1)} 天`}</td><td><span class="tag ${cls}">${label}</span></td></tr>`; }).join('') : '<tr><td colspan="8" class="empty">当前范围没有记录。</td></tr>';
    renderStockIssues(); renderIssues();
  }
  function renderStockIssues() {
    const issues = app.result?.stockIssues || []; $('stockIssueCount').textContent = `${issues.length} 条待补全`;
    $('stockIssues').innerHTML = issues.length ? issues.map((x, index) => {
      const problems = stockSkuProblems(x.sku).join('、');
      return `<div class="issue stock-issue"><strong>库存 SKU 识别不完整：${esc(x.sku.raw)}</strong><div class="raw">仓库：${esc(WAREHOUSES[x.warehouse])}；库存 ${x.qty}；问题：${esc(problems)}。</div><div class="fix-form"><input id="stock-model-${index}" type="text" value="${esc(x.sku.recognizedModel ? x.sku.model : '')}" placeholder="型号，例如 C100i"><input id="stock-memory-${index}" type="text" value="${esc(x.sku.memory)}" placeholder="内存，例如 4/128GB"><input id="stock-color-${index}" type="text" value="${esc(x.sku.color)}" placeholder="颜色，例如 Dusk Gray"><button class="btn" data-stock-fix-index="${index}">保存库存识别</button></div></div>`;
    }).join('') : '<div class="issue" style="border-color:#a8e1c0;background:var(--green-soft)"><strong style="color:var(--green)">库存 SKU 已完整识别</strong><div class="raw">每一条库存都已识别为可用于匹配的 SKU。</div></div>';
    document.querySelectorAll('[data-stock-fix-index]').forEach(btn => btn.onclick = async () => {
      const i = +btn.dataset.stockFixIndex, stock = app.result.stockIssues[i]; const modelValue = clean($(`stock-model-${i}`).value), memoryValue = memory($(`stock-memory-${i}`).value) || clean($(`stock-memory-${i}`).value), colorValue = color($(`stock-color-${i}`).value) || clean($(`stock-color-${i}`).value);
      if (!modelValue) return show('库存 SKU 至少需要填写型号。', 'error');
      app.rules.stockOverrides[stock.sku.rawKey] = { raw: stock.sku.raw, model: modelValue, memory: memoryValue, color: colorValue }; await saveRules(); calculate(true); show(`已保存库存 SKU「${stock.sku.raw}」的识别结果。其他异常仍会保留。`, 'ok');
    });
  }
  function renderIssues() {
    const issues = app.result?.issues || []; $('issueCount').textContent = `${issues.length} 条待确认`;
    $('issues').innerHTML = issues.length ? issues.map((x, index) => {
      const all = [...x.candidates, ...[...new Map(app.result.stocks.map(s => [s.sku.fullKey, { sku: s.sku, score: 0 }])).values()].filter(z => !x.candidates.some(c => c.sku.fullKey === z.sku.fullKey))];
      const opts = all.map(c => `<option value="${esc(c.sku.fullKey)}">${esc(c.sku.raw)}${c.score ? `（匹配度 ${c.score}%）` : ''}</option>`).join('');
      return `<div class="issue"><strong>未自动匹配：${esc(x.sku.raw)}</strong><div class="raw">来源：${esc(x.source)}；周销量 ${x.qty}。${x.candidates[0] ? `最佳候选匹配度 ${x.candidates[0].score}%` : '没有同型号候选。'}</div><div class="candidate"><select id="candidate-${index}"><option value="">选择对应的库存 SKU…</option>${opts}</select><button class="btn" data-map-index="${index}">保存对应</button></div></div>`;
    }).join('') : '<div class="issue" style="border-color:#a8e1c0;background:var(--green-soft)"><strong style="color:var(--green)">没有待确认 SKU</strong><div class="raw">销售 SKU 均已自动或手动对应库存。</div></div>';
    document.querySelectorAll('[data-map-index]').forEach(btn => btn.onclick = async () => { const i = +btn.dataset.mapIndex, sale = app.result.issues[i], target = $(`candidate-${i}`).value; if (!target) return show('请先选择一个库存 SKU。', 'error'); app.rules.manual[sale.sku.rawKey] = target; await saveRules(); calculate(true); show(`已保存「${sale.sku.raw}」的对应关系。其他异常会继续保留。`, 'ok'); });
  }
  function currentRows() { return app.historySnapshot ? sorted(app.view === 'model' ? app.historySnapshot.modelRows : app.historySnapshot.skuRows) : sorted(groupRows(app.result.stocks, app.result.sales, app.view, app.scope)); }
  function exportCsv() { if (!app.result) return; const headers = app.view === 'model' ? ['型号','马卡萨','坤甸','巴厘岛','可用库存','周销量','周转天数','状态'] : ['型号','内存','颜色','马卡萨','坤甸','巴厘岛','可用库存','周销量','周转天数','状态']; const data = currentRows().map(r => { const [label] = rowStatus(r.turnover); return app.view === 'model' ? [r.name,r.byWarehouse.mks,r.byWarehouse.pnk,r.byWarehouse.bali,r.stock,r.sales,r.turnover == null ? '无销量' : r.turnover.toFixed(1),label] : [r.name,r.memory,r.color,r.byWarehouse.mks,r.byWarehouse.pnk,r.byWarehouse.bali,r.stock,r.sales,r.turnover == null ? '无销量' : r.turnover.toFixed(1),label]; }); const csv = [headers,...data].map(row => row.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\r\n'); download(`周转_${app.view === 'model' ? '型号' : '完整SKU'}_${new Date().toISOString().slice(0,10)}.csv`, '\ufeff' + csv, 'text/csv;charset=utf-8'); }
  function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0); }

  async function saveRules() { await app.db.set('rules', app.rules); renderRules(); }
  function renderRules() {
    const render = (target, values, type) => { const entries = Object.entries(values); $(target).innerHTML = entries.length ? entries.map(([raw, canonical]) => `<div class="rule-row"><div><b>${esc(raw)}</b> <span class="row-meta">→ ${esc(canonical)}</span></div><button class="btn danger tiny" data-rule-type="${type}" data-rule-key="${esc(raw)}">删除</button></div>`).join('') : '<div class="row-meta">暂无自定义规则。</div>'; };
    render('modelRules', app.rules.modelAliases, 'modelAliases'); render('colorRules', app.rules.colorAliases, 'colorAliases');
    const overrides = Object.entries(app.rules.stockOverrides || {}); $('stockOverrides').innerHTML = overrides.length ? overrides.map(([raw, value]) => `<div><div class="rule-row"><div><b>${esc(value.raw || raw)}</b><span class="row-meta"> → ${esc([value.model, value.memory, value.color].filter(Boolean).join(' · '))}</span></div><button class="btn danger tiny" data-rule-type="stockOverrides" data-rule-key="${esc(raw)}">撤销</button></div></div>`).join('') : '<div class="row-meta">暂无库存 SKU 修正。</div>';
    const manuals = Object.entries(app.rules.manual); $('manualRules').innerHTML = manuals.length ? manuals.map(([raw, target]) => `<div class="rule-row"><div><b>${esc(raw)}</b><span class="row-meta"> → ${esc(target)}</span></div><button class="btn danger tiny" data-rule-type="manual" data-rule-key="${esc(raw)}">撤销</button></div>`).join('') : '<div class="row-meta">暂无手动 SKU 对应。</div>';
    document.querySelectorAll('[data-rule-type]').forEach(btn => btn.onclick = async () => { delete app.rules[btn.dataset.ruleType][btn.dataset.ruleKey]; await saveRules(); if (app.result?.stocks.length) calculate(false); });
  }
  function openRules() { renderRules(); $('rulesDialog').showModal(); }
  function exportRules() { download(`realme-SKU规则_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rules: app.rules }, null, 2), 'application/json'); }
  async function importRules(file) { try { const data = JSON.parse(await file.text()); app.rules = mergeRules(data.rules || data); await saveRules(); if (app.result) calculate(false); show('规则已恢复并保存到本机。', 'ok'); } catch { show('规则备份文件无法识别。', 'error'); } }
  function snapshot() { const r = app.result; return { id: crypto.randomUUID(), createdAt: Date.now(), title: new Date().toLocaleString('zh-CN',{hour12:false}), metrics: { stock: r.stocks.reduce((a,x)=>a+x.qty,0), sales: r.sales.reduce((a,x)=>a+x.qty,0), issues: r.issues.length, stockIssues: r.stockIssues?.length || 0 }, audit: r.audit, modelRows: r.modelRows, skuRows: r.skuRows, issues: r.issues.map(x => ({ sku: x.sku, qty: x.qty, source: x.source })) }; }
  async function saveSnapshot() { await app.db.saveHistory(snapshot()); }
  async function showHistory() { const list = await app.db.history(); $('historyList').innerHTML = list.length ? list.map(x => `<div class="history-row"><div><b>${esc(x.title)}</b><div class="row-meta">库存 ${x.metrics.stock.toLocaleString()} · 销量 ${x.metrics.sales.toLocaleString()} · 库存待补全 ${x.metrics.stockIssues || 0} · 销售待确认 ${x.metrics.issues}</div></div><div class="actions"><button class="btn tiny" data-history-open="${x.id}">查看</button><button class="btn danger tiny" data-history-delete="${x.id}">删除</button></div></div>`).join('') : '<div class="empty">暂无历史计算记录。</div>'; $('historyDialog').showModal(); document.querySelectorAll('[data-history-open]').forEach(btn => btn.onclick = () => { const x = list.find(y => y.id === btn.dataset.historyOpen); app.historySnapshot = x; app.scope = 'all'; document.querySelectorAll('[name=scope]').forEach(node => { node.checked = node.value === 'all'; }); app.result = { stocks: [], sales: [], issues: x.issues || [], stockIssues: [], modelRows: x.modelRows || [], skuRows: x.skuRows || [], audit: x.audit }; $('historyDialog').close(); $('report').classList.remove('hidden'); renderHistorical(x); }); document.querySelectorAll('[data-history-delete]').forEach(btn => btn.onclick = async () => { await app.db.deleteHistory(btn.dataset.historyDelete); showHistory(); }); }
  function renderHistorical(x) { const rows = sorted(app.view === 'model' ? x.modelRows : x.skuRows); $('metrics').innerHTML = `<div class="metric"><small>历史可用库存</small><div class="n">${x.metrics.stock.toLocaleString()}</div></div><div class="metric"><small>历史周销量</small><div class="n">${x.metrics.sales.toLocaleString()}</div></div><div class="metric"><small>库存待补全</small><div class="n">${x.metrics.stockIssues || 0}</div></div><div class="metric"><small>销售待确认 SKU</small><div class="n">${x.metrics.issues}</div></div><div class="metric"><small>记录时间</small><div class="n" style="font-size:16px">${esc(x.title)}</div></div>`; $('reportHint').textContent = '历史快照为只读结果，可切换两张表、排序或导出；仓库范围固定为全部仓库。'; $('thead').innerHTML = '<tr><th>型号 / SKU</th><th>马卡萨</th><th>坤甸</th><th>巴厘岛</th><th>可用库存</th><th>周销量</th><th>周转天数</th><th>状态</th></tr>'; $('tbody').innerHTML = rows.map(r => { const [label, cls] = rowStatus(r.turnover); return `<tr><td><span class="name">${esc(r.name)}</span><span class="detail">${esc([r.memory,r.color].filter(Boolean).join(' · '))}</span></td><td>${r.byWarehouse.mks}</td><td>${r.byWarehouse.pnk}</td><td>${r.byWarehouse.bali}</td><td>${r.stock}</td><td>${r.sales}</td><td>${r.turnover == null ? '—' : r.turnover.toFixed(1)+' 天'}</td><td><span class="tag ${cls}">${label}</span></td></tr>`; }).join(''); $('stockIssueCount').textContent = '历史快照'; $('stockIssues').innerHTML = '<div class="issue"><strong>这是历史快照</strong><div class="raw">历史记录只保存异常数量，不保存可编辑的库存 SKU 明细。</div></div>'; $('issues').innerHTML = '<div class="issue"><strong>这是历史快照</strong><div class="raw">历史异常明细不会改变现有规则。重新上传本周文件后可继续处理。</div></div>'; }

  function bindUpload() {
    document.querySelectorAll('.drop').forEach(box => { const slot = box.dataset.slot, input = box.querySelector('input'); const use = async file => { if (!file) return; box.classList.add('loaded'); box.querySelector('.file').textContent = file.name; try { await readFile(slot, file); show(`已读取 ${SLOT[slot].label}：请在“导入预览”确认工作表和控制数。`, 'ok'); } catch (e) { box.classList.remove('loaded'); show(`${SLOT[slot].label} 读取失败：${e.message}`, 'error'); } }; input.onchange = () => use(input.files[0]); ['dragenter','dragover'].forEach(e => box.addEventListener(e, x => { x.preventDefault(); box.classList.add('drag'); })); ['dragleave','drop'].forEach(e => box.addEventListener(e, x => { x.preventDefault(); box.classList.remove('drag'); })); box.addEventListener('drop', e => use(e.dataTransfer.files[0])); });
  }
  async function init() {
    app.db = await createStore(); app.rules = mergeRules(await app.db.get('rules'));
    if (!window.XLSX) show('Excel 读取组件加载失败，请重新从本地文件打开页面。', 'error');
    bindUpload(); $('refreshPreview').onclick = renderPreview; $('calculate').onclick = () => calculate(true); $('rulesBtn').onclick = openRules; $('historyBtn').onclick = showHistory; $('exportCsv').onclick = exportCsv; $('exportRules').onclick = exportRules; $('importRules').onchange = e => importRules(e.target.files[0]);
    $('addModelAlias').onclick = async () => { const raw = $('modelAliasRaw').value, canonical = $('modelAliasCanonical').value; if (!raw || !canonical) return show('请填写报表写法和统一型号。', 'error'); app.rules.modelAliases[key(raw)] = clean(canonical); $('modelAliasRaw').value = $('modelAliasCanonical').value = ''; await saveRules(); if (app.result) calculate(false); };
    $('addColorAlias').onclick = async () => { const raw = $('colorAliasRaw').value, canonical = $('colorAliasCanonical').value; if (!raw || !canonical) return show('请填写报表写法和统一颜色。', 'error'); app.rules.colorAliases[key(raw)] = clean(canonical); $('colorAliasRaw').value = $('colorAliasCanonical').value = ''; await saveRules(); if (app.result) calculate(false); };
    document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => $(btn.dataset.close).close()); $('sort').onchange = e => { app.sort = e.target.value; if (app.result) renderReport(); }; document.querySelectorAll('[name=scope]').forEach(x => x.onchange = e => { if (app.historySnapshot) { app.scope = 'all'; x.checked = false; document.querySelectorAll('[name=scope]').forEach(node => { node.checked = node.value === 'all'; }); return show('历史快照只保留全部仓库的计算结果。', 'info'); } app.scope = e.target.value; if (app.result) renderReport(); }); document.querySelectorAll('.tab').forEach(tab => tab.onclick = () => { document.querySelectorAll('.tab').forEach(x => x.classList.remove('active')); tab.classList.add('active'); app.view = tab.dataset.view; if (app.result) renderReport(); });
  }
  init();
})();
