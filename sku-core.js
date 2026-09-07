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
  const COLOR_PHRASES = ['titanium silver','titanium black','lavender purple','moss green','ivory gold','white swan','forest owl','swan black','kingfisher blue','violet parrot','parrot purple','peacock green','phantom navy','rally white','glacier blue','storm black','dusk gray','dawn purple','master gray','master grey','master purple','master gold','pebble grey','pebble gray','orchid purple','air white','air black','pulse purple','glory beige','deepblue tides','deepblue tide','volt black','aurora purple','racing green','metallic grey','starlight green','comet grey','lightning gold','golden coast','victory purple','glory white','endurance brown','pine green','cloud white','titan grey','brown','black','white','blue','purple','green','gray','grey','gold','silver','red','orange'];

  function clean(value) { return String(value ?? '').replace(/\[.*?\]|\(.*?\)|（.*?）/g, ' ').replace(/hadiah\s*gratis|free\s*gift|promo/ig, ' ').replace(/\s+/g, ' ').trim(); }
  function norm(value) { return clean(value).toLowerCase().replace(/[＿_]/g, ' ').replace(/[|,，;；]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function key(value) { return norm(value).replace(/\+/g, ' plus ').replace(/[^a-z0-9]/g, ''); }
  function title(value) { return String(value || '').replace(/\b\w/g, x => x.toUpperCase()); }
  function memory(value) {
    const x = norm(value).replace(/\s/g, '');
    const m = x.match(/(\d{2,4})(?:gb|g)(\d{1,2})(?:gb|g)/i)
      || x.match(/(?:^|[^a-z0-9])(\d{1,2})(?:gb|g)?[\/x×+\-](\d{2,4})(?:gb|g)/i)
      || x.match(/(?:^|[^a-z0-9])(\d{2,4})(?:gb|g)?[\/x×+\-](\d{1,2})(?:gb|g)/i);
    if (!m) return '';
    const a = Math.min(+m[1], +m[2]), b = Math.max(+m[1], +m[2]);
    return `${a}GB/${b}GB`;
  }
  function aliases(type, rules = DEFAULT_RULES) { return type === 'model' ? (rules.modelAliases || {}) : (rules.colorAliases || {}); }
  function modelInfo(value, rules = DEFAULT_RULES) {
    const source = clean(value).replace(/\brealme\b/ig, ' ');
    const sixteen = source.match(/\b16\s*(?:pro\s*\+?)?(?![a-z0-9])/i);
    if (sixteen) {
      const v = key(sixteen[0]);
      return { value: v.includes('pro') ? (v.includes('plus') ? '16 Pro+' : '16 Pro') : '16', recognized: true };
    }
    const m = source.match(/\b(techlife\s+buds|buds\s+clip|buds\s+t\d{1,4}(?:\s+lite)?|buds\s+air\s*\d{0,3}(?:\s*(?:pro|neo|lite|plus))?|watch\s*\d+[a-z]*|note\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|c\s*\d{1,3}(?:\s*(?:i|x|s|a|pro|plus|lite))?|p\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?|narzo\s*\d{1,3}(?:\s*(?:pro|plus|x|t|s|lite))?)\b/i);
    let out = (m ? m[1] : source.split(/[|,，;]/)[0]).replace(/\b(?:128|256|512)\s*(?:gb|g)\b/ig, ' ').replace(/\b(?:4|6|8|12|16)\s*(?:gb|g)\b/ig, ' ').replace(/\s+/g, ' ').trim();
    out = out.replace(/\bpro\b/ig, 'Pro').replace(/\bplus\b/ig, 'Plus').replace(/\blite\b/ig, 'Lite').replace(/\bnote\s*/ig, 'Note ').replace(/\bc\s*/ig, 'C').replace(/\bp\s*/ig, 'P');
    const mapped = aliases('model', rules)[key(out)];
    return { value: mapped || out || '未识别型号', recognized: Boolean(m || mapped) };
  }
  function color(value, rules = DEFAULT_RULES) {
    const text = String(value ?? ''), source = norm(text);
    let found = COLOR_PHRASES.filter(x => source.includes(x)).sort((a, b) => b.length - a.length)[0] || '';
    if (!found && text.includes('|')) found = clean(text).split('|').map(x => x.trim()).filter(x => x && !memory(x) && !/^realme\s/i.test(x)).pop() || '';
    const mapped = aliases('color', rules)[key(found)] || found;
    return mapped ? title(mapped).replace(/Grey/g, 'Gray') : '';
  }
  function parseSKU(raw, parts = {}, override = null, rules = DEFAULT_RULES) {
    const label = [parts.model || raw, parts.memory, parts.color].filter(Boolean).join(' | ');
    const rawKey = key(label), found = modelInfo(label, rules), model = clean(override?.model || found.value) || '未识别型号';
    const mem = memory(override?.memory || parts.memory || label) || clean(override?.memory || '');
    const col = color(override?.color || parts.color || label, rules) || clean(override?.color || '');
    return { raw: clean(label), rawKey, model, modelKey: key(model), memory: mem, color: col, fullKey: [key(model), key(mem), key(col)].join('|'), baseKey: [key(model), key(mem)].join('|'), recognizedModel: Boolean(override?.model || found.recognized) };
  }
  function isPhoneModel(name) { return /^(?:16(?:\s+Pro\+?)?|Note\s*\d|C\d|P\d|Narzo\s*\d)/i.test(name); }
  function stockSkuProblems(sku) {
    const problems = [];
    if (!sku.recognizedModel) problems.push('未识别型号');
    if (sku.recognizedModel && isPhoneModel(sku.model) && !sku.memory) problems.push('未识别内存');
    if (sku.recognizedModel && !sku.color) problems.push('未识别颜色');
    return problems;
  }
  function similarity(a, b) { if (!a || !b) return 0; if (a === b) return 1; const aa = new Set(a), bb = new Set(b), common = [...aa].filter(x => bb.has(x)).length; return common / Math.max(aa.size, bb.size); }
  function candidateScore(sale, stock) {
    if (sale.modelKey !== stock.modelKey) return 0;
    let score = 60;
    if (sale.memory && stock.memory) score += sale.memory === stock.memory ? 25 : 0; else score += 8;
    if (sale.color && stock.color) score += sale.color === stock.color ? 15 : Math.round(similarity(key(sale.color), key(stock.color)) * 8); else score += 5;
    return score;
  }

  const api = { DEFAULT_RULES, clean, norm, key, memory, modelInfo, color, parseSKU, isPhoneModel, stockSkuProblems, similarity, candidateScore };
  if (typeof window !== 'undefined') window.RealmeSkuCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
