(() => {
  'use strict';

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
  const COLOR_PHRASES = ['mystic grey','mystic gray','titanium silver','titanium black','lavender purple','moss green','ivory gold','white swan','forest owl','swan black','kingfisher blue','violet parrot','parrot purple','peacock green','phantom navy','rally white','glacier blue','storm black','dusk gray','dawn purple','master gray','master grey','master purple','master gold','pebble grey','pebble gray','orchid purple','air white','air black','pulse purple','glory beige','deepblue tides','deepblue tide','volt black','aurora purple','racing green','metallic grey','starlight green','comet grey','lightning gold','golden coast','victory purple','glory white','endurance brown','pine green','cloud white','titan grey','brown','black','white','blue','purple','green','gray','grey','gold','silver','red','orange'];

  function isGiftSku(value) { return String(value ?? '').normalize('NFKC').trim().toLowerCase() === 'zp888'; }
  function clean(value) { return String(value ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\[\]()]/g, ' ').replace(/hadiah\s*gratis|free\s*gift|promo/ig, ' ').replace(/\s+/g, ' ').trim(); }
  function norm(value) { return clean(value).toLowerCase().replace(/[＿_]/g, ' ').replace(/[|,，;；]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function key(value) { return norm(value).replace(/\+/g, ' plus ').replace(/[^a-z0-9]/g, ''); }
  function title(value) { return String(value || '').replace(/\b\w/g, x => x.toUpperCase()); }
  function memory(value) {
    // Keep token boundaries: removing spaces turns "Note 80 64GB" into 8064GB.
    const x = norm(value).replace(/\b[45]g\s+(?=\d{2,4}\s*gb)/g, ' ').replace(/(\d+)\s*(?:gb)?\s*\+\s*\d+\s*gb\s*(?=\d{2,4}\s*gb)/g, '$1gb ');
    const ramSizes = [2, 3, 4, 6, 8, 12, 16, 24, 32, 64];
    const storageSizes = [32, 64, 128, 256, 512, 1024, 2048];
    const pairs = new Set();
    const add = (a, b) => {
      const ram = Math.min(+a, +b), storage = Math.max(+a, +b);
      if (ram < storage && ramSizes.includes(ram) && storageSizes.includes(storage)) pairs.add(`${ram}GB/${storage}GB`);
    };
    // Both unit-bearing orders, compact forms, and 4/64, 12+512, 8 x 256.
    const patterns = [
      /(?:^|[^a-z0-9])(\d{1,4})\s*(?:gb|g)\s*(?:ram|rom)?\s*(?:[\/x×+\-]\s*)?(?:ram|rom|storage)?\s*(\d{1,4})\s*(?:gb|g)(?![a-z0-9])/g,
      /(?:^|[^a-z0-9])(\d{1,4})\s*(?:gb|g)?\s*[\/x×+\-]\s*(\d{1,4})\s*(?:gb|g)?(?![a-z0-9])/g
    ];
    for (const pattern of patterns) for (const m of x.matchAll(pattern)) add(m[1], m[2]);
    const ram = x.match(/\bram\s*:?\s*(\d{1,2})\s*(?:gb|g)?\b/);
    const rom = x.match(/\b(?:rom|storage)\s*:?\s*(\d{2,4})\s*(?:gb|g)?\b/);
    if (ram && rom) add(ram[1], rom[1]);
    return pairs.size === 1 ? [...pairs][0] : '';
  }
  function aliases(type, rules = DEFAULT_RULES) { return type === 'model' ? (rules.modelAliases || {}) : (rules.colorAliases || {}); }
  function modelInfo(value, rules = DEFAULT_RULES) {
    const source = clean(value).replace(/[_–—-]/g, ' ').replace(/\brealme\s*/ig, ' ');
    const custom = aliases('model', rules)[key(source)];
    if (custom) return { value: custom, recognized: true };
    const sixteen = source.match(/^\s*16\s*(?:pro\s*(?:plus|\+)?|plus)?(?![a-z0-9])/i);
    if (sixteen) {
      const v = key(sixteen[0]);
      return { value: v.includes('pro') ? (v.includes('plus') ? '16 Pro+' : '16 Pro') : v.includes('plus') ? '16 Plus' : '16', recognized: true };
    }
    const m = source.match(/\b(techlife\s+buds|buds\s+clip|buds\s+t\d{1,4}(?:\s+lite)?|buds\s+air\s*\d{0,3}(?:\s*(?:pro|neo|lite|plus))?|watch\s*\d+[a-z]*|note\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|c\s*\d{1,3}(?:\s*(?:i|x|s|a|pro|plus|lite))?|p\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|narzo\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?)\b/i);
    let out = (m ? m[1] : source.split(/[|,，;]/)[0]).replace(/\b(?:128|256|512)\s*(?:gb|g)\b/ig, ' ').replace(/\b(?:4|6|8|12|16)\s*(?:gb|g)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    out = out.replace(/(\d)(pro|plus|lite)/ig, '$1 $2').replace(/\bpro\b/ig, 'Pro').replace(/\bplus\b/ig, 'Plus').replace(/\blite\b/ig, 'Lite').replace(/\bnote\s*/ig, 'Note ').replace(/\bc\s*/ig, 'C').replace(/\bp\s*/ig, 'P').replace(/(\d)\s+([ixst])\b/ig, '$1$2');
    const mapped = aliases('model', rules)[key(out)];
    return { value: mapped || out || '未识别型号', recognized: Boolean(m || mapped) };
  }
  function color(value, rules = DEFAULT_RULES) {
    const text = clean(value), source = norm(text).replace(/grey/g, 'gray').replace(/[-_]/g, ' ');
    const direct = aliases('color', rules)[key(text)];
    if (direct) return title(direct).replace(/Grey/g, 'Gray');
    const phrases = [...COLOR_PHRASES, 'storm gray', 'titanium gold', ...Object.values(aliases('color', rules))].map(x => norm(x).replace(/grey/g, 'gray'));
    let found = phrases.filter(x => (` ${source} `).includes(` ${x} `)).sort((a, b) => b.length - a.length)[0] || '';
    // Preserve a supplied color field (including a typo) for contextual correction.
    const tail = text.split('|').pop().trim();
    if (tail && !modelInfo(tail, rules).recognized && !memory(tail) && /^[a-z][a-z\s-]{2,45}$/i.test(tail) && !/\b(?:gb|ram|rom|un|global)\b/i.test(tail)) found = tail;
    const mapped = aliases('color', rules)[key(found)] || found;
    return mapped ? title(mapped).replace(/Grey/g, 'Gray') : '';
  }
  // Old saved mappings can contain the former merged-number bug. Read them
  // only to migrate an unambiguous target; never use them for new calculations.
  function legacyFullKey(label, modelKey) {
    const text = String(label).replace(/\[.*?\]|\(.*?\)|（.*?）/g, ' ').toLowerCase();
    const x = text.replace(/[|,，;；]/g, ' ').replace(/\s/g, '');
    const m = x.match(/(\d{2,4})(?:gb|g)(\d{1,2})(?:gb|g)/) || x.match(/(?:^|[^a-z0-9])(\d{1,2})(?:gb|g)?[\/x×+\-](\d{2,4})(?:gb|g)/) || x.match(/(?:^|[^a-z0-9])(\d{2,4})(?:gb|g)?[\/x×+\-](\d{1,2})(?:gb|g)/);
    const mem = m ? `${Math.min(+m[1], +m[2])}GB/${Math.max(+m[1], +m[2])}GB` : '';
    const col = COLOR_PHRASES.filter(c => text.includes(c)).sort((a,b) => b.length-a.length)[0] || '';
    return [modelKey, key(mem), key(col.replace(/grey/g, 'gray'))].join('|');
  }
  function parseSKU(raw, parts = {}, override = null, rules = DEFAULT_RULES) {
    const label = [parts.model || raw, parts.memory, parts.color].filter(Boolean).join(' | ');
    const rawKey = key(label), found = modelInfo(label, rules), model = clean(override?.model || found.value) || '未识别型号';
    const mem = memory(override?.memory || parts.memory || label) || clean(override?.memory || '');
    const col = color(override?.color || parts.color || label, rules) || clean(override?.color || '');
    return { raw: clean(label), rawKey, model, modelKey: key(model), memory: mem, color: col, fullKey: [key(model), key(mem), key(col)].join('|'), legacyFullKey: legacyFullKey(label, key(model)), baseKey: [key(model), key(mem)].join('|'), recognizedModel: Boolean(override?.model || found.recognized), excluded: isGiftSku(parts.model || raw) };
  }
  function isPhoneModel(name) { return /^(?:16(?:\s+Pro\+?)?|Note\s*\d|C\d|P\d|Narzo\s*\d)/i.test(name); }
  function stockSkuProblems(sku) {
    if (sku.excluded || isGiftSku(sku.raw)) return [];
    const problems = [];
    if (!sku.recognizedModel) problems.push('未识别型号');
    if (sku.recognizedModel && isPhoneModel(sku.model) && !sku.memory) problems.push('未识别内存');
    if (sku.recognizedModel && !sku.color) problems.push('未识别颜色');
    return problems;
  }
  function similarity(a, b) { if (!a || !b) return 0; if (a === b) return 1; const aa = new Set(a), bb = new Set(b), common = [...aa].filter(x => bb.has(x)).length; return common / Math.max(aa.size, bb.size); }
  function candidateScore(sale, stock) {
    if (sale.excluded || stock.excluded || isGiftSku(sale.raw) || isGiftSku(stock.raw)) return 0;
    if (sale.modelKey !== stock.modelKey || (sale.memory && stock.memory && sale.memory !== stock.memory)) return 0;
    let score = 60;
    if (sale.memory && stock.memory) score += sale.memory === stock.memory ? 25 : 0; else score += 8;
    if (sale.color && stock.color) score += sale.color === stock.color ? 15 : Math.round(similarity(key(sale.color), key(stock.color)) * 8); else score += 5;
    return score;
  }

  function editDistance(a, b) {
    let row = Array.from({length:b.length+1}, (_,i)=>i);
    for (let i=0;i<a.length;i++) { const next=[i+1]; for (let j=0;j<b.length;j++) next.push(Math.min(next[j]+1,row[j+1]+1,row[j]+(a[i]===b[j]?0:1))); row=next; }
    return row[b.length];
  }
  function resolveMatch(sale, catalog, forced) {
    if (forced) {
      const direct = catalog.find(x => x.fullKey === forced);
      const legacy = catalog.filter(x => x.legacyFullKey === forced);
      const target = direct || (legacy.length === 1 ? legacy[0] : null);
      if (target) return { target, type: '已记住的对应', reason: '沿用你保存的 SKU 对应关系' };
      return { target: null, reason: '之前保存的库存 SKU 本次未找到，请重新选择' };
    }
    if (!sale.recognizedModel) return { target: null, reason: '型号尚未识别' };
    if (isPhoneModel(sale.model) && !sale.memory) return { target: null, reason: '缺少或存在冲突的 RAM / 存储容量' };
    if (!sale.color) return { target: null, reason: '原始数据没有颜色，无法确定具体 SKU' };
    const peers = catalog.filter(x => x.modelKey === sale.modelKey && x.memory === sale.memory);
    const exact = peers.find(x => key(x.color) === key(sale.color));
    if (exact) return { target: exact, type: '自动一致', reason: '型号、内存和颜色统一后完全一致' };
    const base = norm(sale.color).replace(/grey/g, 'gray');
    if (/^(?:black|white|blue|purple|green|gray|gold|silver|red|orange|brown)$/.test(base)) {
      const colors = peers.filter(x => norm(x.color).split(' ').includes(base));
      if (colors.length === 1) return { target: colors[0], type: '颜色简称', reason: `同型号、同内存只有一种 ${sale.color}：${colors[0].color}` };
      if (colors.length > 1) return { target: null, reason: '同型号、同内存有多个同色候选，需要选择具体颜色' };
    }
    const near = peers.filter(x => Math.min(key(x.color).length, key(sale.color).length) >= 5 && editDistance(key(sale.color),key(x.color)) <= 1);
    if (near.length === 1) return { target: near[0], type: '拼写纠错', reason: `同型号、同内存的唯一近似颜色：${sale.color} → ${near[0].color}` };
    return { target: null, reason: peers.length ? '同型号、同内存中，颜色无法唯一对应' : '库存表中没有同型号、同内存的 SKU' };
  }

  const api = { DEFAULT_RULES, clean, norm, key, memory, modelInfo, color, parseSKU, isGiftSku, isPhoneModel, stockSkuProblems, similarity, candidateScore, resolveMatch };
  if (typeof window !== 'undefined') window.RealmeSkuCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
