/* DOM integration checks without a browser. Codec, native picker and IndexedDB are not emulated. */
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {build}=require('../scripts/build.cjs'),{loadProject,root}=require('../scripts/project.cjs');
const fixture=()=>loadProject(root+'/examples/realme-99.campaign.json');
async function boot(project=fixture(),nativeCutout=false){
  const html=build(project),{document,window}=parseHTML(html),downloads=[],timers=new Set();
  const canvas=document.getElementById('stage'),drawing=new Proxy({},{get:(obj,key)=>key in obj?obj[key]:(()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});
  canvas.getContext=()=>drawing;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1080,height:1920});canvas.setPointerCapture=()=>{};
  document.querySelectorAll('input[type="checkbox"]').forEach(el=>el.checked=el.hasAttribute('checked'));
  if(nativeCutout){
    const {createCanvas}=require('@napi-rs/canvas');
    for(const id of ['cutout-canvas','cutout-overlay']){const el=document.getElementById(id),backing=createCanvas(1,1);
      for(const key of ['width','height'])Object.defineProperty(el,key,{get:()=>backing[key],set:v=>{backing[key]=v;el.setAttribute(key,String(v));}});
      el.getContext=(...args)=>backing.getContext(...args);el.toDataURL=(...args)=>backing.toDataURL(...args);el.setPointerCapture=()=>{};
      el.getBoundingClientRect=()=>({left:0,top:0,width:backing.width,height:backing.height});
    }
  }
  class ImageFixture{set src(value){this.width=this.naturalWidth=500;this.height=this.naturalHeight=990;queueMicrotask(()=>this.onload?.());}}
  class FileReaderFixture{readAsDataURL(file){this.result=file.fixtureData;queueMicrotask(()=>this.onload?.());}}
  const timeout=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);t.unref();timers.add(t);return t;};
  let sequence=0;
  const context=vm.createContext({document,window,console,Image:nativeCutout?require('@napi-rs/canvas').Image:ImageFixture,FileReader:FileReaderFixture,Blob,TextEncoder,Uint8Array,performance,crypto:{randomUUID:()=>`test-${++sequence}`},setTimeout:timeout,clearTimeout,requestAnimationFrame:()=>0,matchMedia:()=>({matches:true}),URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL:()=>{}}});
  for(const [,attrs,body]of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!attrs.includes('application/json'))vm.runInContext(body,context);
  const settle=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
  for(let i=0;i<100&&!/分层模板已就绪/.test(document.getElementById('status').textContent);i++)await new Promise(r=>setTimeout(r,5));await settle();
  assert.match(document.getElementById('status').textContent,/分层模板已就绪/);
  const $=id=>document.getElementById(id);
  async function snapshot(){ $('save-project').click();return JSON.parse(await downloads.at(-1).text());}
  function input(selector,value){const el=document.querySelector(selector);assert(el,selector);el.value=String(value);el.dispatchEvent(new window.Event('input',{bubbles:true}));}
  function close(){for(const t of timers)clearTimeout(t);}
  function fire(el,type,props={}){const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);el.dispatchEvent(e);return e;}
  return {$,document,window,downloads,snapshot,input,settle,close,fire};
}
test('size controls and two-product separation change actual saved scene independently',async t=>{
  const h=await boot();t.after(h.close);const before=await h.snapshot();h.input('[data-prop="scale"]',2.4);h.$('products-apart').click();
  const p=await h.snapshot(),a=p.layers.find(l=>l.id==='product-a'),b=p.layers.find(l=>l.id==='product-b');
  assert.equal(a.scale,2.4);assert.equal(b.scale,before.layers.find(l=>l.id==='product-b').scale);assert.equal(b.x-a.x,440);
  h.$('products-align').click();const wide=await h.snapshot();assert(wide.layers.find(l=>l.id==='product-b').x-wide.layers.find(l=>l.id==='product-a').x>440);
});
test('replace image retains transform and motion; saved HTML restores edited campaign',async t=>{
  const h=await boot();t.after(h.close);const before=await h.snapshot(),old=before.layers.find(l=>l.id==='product-a');
  h.$('replace-media').click();
  await h.$('media-file').onchange({target:{files:[{name:'new-phone.png',type:'image/png',size:100,fixtureData:before.assets['product-b'].src}],value:'file'}});
  const p=await h.snapshot(),l=p.layers.find(l=>l.id==='product-a');assert.notEqual(l.assetId,old.assetId);assert.equal(l.x,old.x);assert.equal(l.scale,old.scale);assert.deepEqual(l.animation,old.animation);
  h.$('export-html').click();const saved=await h.downloads.at(-1).text(),{document}=parseHTML(saved);const restored=JSON.parse(document.getElementById('boot-project').textContent);assert.deepEqual(restored,p);
  const next=await boot(restored);t.after(next.close);assert.deepEqual(await next.snapshot(),p);
});
test('new campaign, undo, redo and loading a project preserve assets',async t=>{
  const h=await boot();t.after(h.close);const original=await h.snapshot();await h.$('new-project').onclick();assert.equal((await h.snapshot()).layers.length,2);
  await h.$('undo').onclick();assert.deepEqual(await h.snapshot(),original);await h.$('redo').onclick();assert.equal((await h.snapshot()).layers.length,2);
  await h.$('project-file').onchange({target:{files:[{size:100,text:async()=>JSON.stringify(original)}],value:'x'}});assert.deepEqual(await h.snapshot(),original);
});
test('background replacement keeps one background layer and other assets',async t=>{
  const h=await boot();t.after(h.close);const before=await h.snapshot();h.$('add-background').click();
  await h.$('media-file').onchange({target:{files:[{name:'next-background.png',type:'image/png',size:100,fixtureData:before.assets.background.src}],value:'x'}});
  const after=await h.snapshot();assert.equal(after.layers.length,14);assert.equal(after.layers.filter(l=>l.role==='background').length,1);assert.notEqual(after.layers[0].assetId,'background');assert.deepEqual(after.layers.slice(1),before.layers.slice(1));
});
test('user text cannot create new scripts in exported HTML',async t=>{
  const h=await boot();t.after(h.close);h.$('add-text').click();h.input('textarea[data-prop="text"]','</script><script>example</script>');h.$('export-html').click();
  const saved=await h.downloads.at(-1).text(),{document}=parseHTML(saved);assert.equal(document.querySelectorAll('script').length,6);assert.equal(JSON.parse(document.getElementById('boot-project').textContent).layers.at(-1).text,'</script><script>example</script>');
});
test('rotation buttons, precise angle and canvas handles update the saved transform',async t=>{
  const E=require('../src/engine.js'),h=await boot();t.after(h.close);
  h.$('rotate-reset').click();h.$('rotate-right').click();assert.equal((await h.snapshot()).layers.find(l=>l.id==='product-a').rotation,90);
  h.$('rotate-left').click();h.input('#rotation-number',30);let p=await h.snapshot(),l=p.layers.find(l=>l.id==='product-a');assert.equal(l.rotation,30);
  const g=E.selectionGeometry(l,2,5,22),dx=g.rotate.x-g.state.x,dy=g.rotate.y-g.state.y;
  h.fire(h.$('stage'),'pointerdown',{button:0,pointerId:1,clientX:g.rotate.x,clientY:g.rotate.y});
  h.fire(h.$('stage'),'pointermove',{pointerId:1,clientX:g.state.x-dy,clientY:g.state.y+dx});h.fire(h.$('stage'),'pointerup');
  p=await h.snapshot();l=p.layers.find(l=>l.id==='product-a');assert.equal(l.rotation,120);
  const next=E.selectionGeometry(l,2,5,22),corner=next.corners[2],old=l.scale;
  h.fire(h.$('stage'),'pointerdown',{button:0,pointerId:2,clientX:corner.x,clientY:corner.y});
  h.fire(h.$('stage'),'pointermove',{pointerId:2,clientX:next.state.x+(corner.x-next.state.x)*1.5,clientY:next.state.y+(corner.y-next.state.y)*1.5});h.fire(h.$('stage'),'pointerup');
  assert.equal((await h.snapshot()).layers.find(l=>l.id==='product-a').scale,Math.round(old*1.5*100)/100);
});
test('layer drag reorder, view modes, lock and hide survive saving',async t=>{
  const h=await boot();t.after(h.close);const list=h.$('layer-list'),source=h.document.querySelector('[data-layer-id="product-a"]'),target=h.document.querySelector('[data-layer-id="background"]');
  target.getBoundingClientRect=()=>({top:300,height:50});list.getBoundingClientRect=()=>({top:0,bottom:600});
  h.fire(source,'dragstart',{dataTransfer:{setData(){}}});h.fire(target,'dragover',{clientY:340});assert(target.classList.contains('drop-after'));h.fire(target,'drop',{clientY:340});h.fire(list,'dragend');
  assert.equal((await h.snapshot()).layers[0].id,'product-a');await h.$('undo').onclick();assert.notEqual((await h.snapshot()).layers[0].id,'product-a');
  h.document.querySelector('[data-layer-view="tiles"]').click();assert.equal(list.dataset.view,'tiles');
  h.document.querySelector('.mobile-panel-tabs [data-panel="inspector"]').click();assert.equal(h.document.querySelector('.workspace').dataset.panel,'inspector');
  h.document.querySelector('[data-eye="product-a"]').click();h.document.querySelector('[data-lock="product-a"]').click();const l=(await h.snapshot()).layers.find(l=>l.id==='product-a');assert.equal(l.visible,false);assert.equal(l.locked,true);
});
test('cutout dialog produces transparent PNG, preserves motion and geometry, and can be undone or cancelled',async t=>{
  const {createCanvas,loadImage}=require('@napi-rs/canvas'),c=createCanvas(40,60),ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,40,60);ctx.fillStyle='#234567';ctx.fillRect(10,10,20,40);
  const p={format:'campaign-motion-studio',version:1,name:'Cutout test',canvas:{duration:5},assets:{phone:{name:'phone.jpg',src:c.toDataURL('image/png'),width:40,height:60}},layers:[{id:'product-a',assetId:'phone',role:'product',x:400,y:900,width:400,height:600,scale:1.4,rotation:24,animation:{preset:'float',amplitude:17}}]};
  const h=await boot(p,true);t.after(h.close);const before=await h.snapshot();h.$('cutout-media').click();await h.settle();assert(h.$('cutout-dialog').hasAttribute('open'));
  h.$('cutout-auto').click();h.$('cutout-apply').click();for(let i=0;i<100&&h.$('save-project').disabled;i++)await new Promise(r=>setTimeout(r,5));await h.settle();
  const after=await h.snapshot(),old=before.layers[0],layer=after.layers[0];assert.notEqual(layer.assetId,old.assetId);assert.deepEqual({...layer,assetId:old.assetId},old);assert(!h.$('cutout-dialog').hasAttribute('open'));
  const img=await loadImage(after.assets[layer.assetId].src);ctx.clearRect(0,0,40,60);ctx.drawImage(img,0,0);assert.equal(ctx.getImageData(1,1,1,1).data[3],0);assert.equal(ctx.getImageData(20,30,1,1).data[3],255);
  h.$('export-html').click();const saved=await h.downloads.at(-1).text(),{document}=parseHTML(saved);assert.deepEqual(JSON.parse(document.getElementById('boot-project').textContent),after);
  await h.$('undo').onclick();assert.deepEqual(await h.snapshot(),before);
  h.$('cutout-media').click();await h.settle();h.$('cutout-auto').click();h.$('cutout-cancel').click();await h.settle();assert.deepEqual(await h.snapshot(),before);
});
