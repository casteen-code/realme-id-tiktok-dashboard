const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../src/engine.js'),{loadProject,root}=require('../scripts/project.cjs'),{build}=require('../scripts/build.cjs');
const base=()=>({format:'campaign-motion-studio',version:1,id:'test',name:'Test',canvas:{duration:5},assets:{},layers:[]});
test('each layer has independent transforms and animation',()=>{
  const a=E.layer({id:'a',x:100,y:200,animation:{preset:'float',amplitude:20}}),b=E.layer({id:'b',x:500,y:200,animation:{preset:'float',amplitude:0}});
  const old=E.state(b,1.25);a.animation.amplitude=70;a.scale=2.4;assert.deepEqual(E.state(b,1.25),old);assert.equal(E.state(a,1.25).y,270);assert.equal(E.state(a,1.25).scale,2.4);
});
test('loop joins and product entry/exit are deterministic',()=>{
  const l=E.layer({animation:{preset:'float',amplitude:10,cycles:3,entry:{type:'left',start:.6,duration:.7},exit:{type:'right',start:4,duration:.6}}});
  assert.deepEqual(E.state(l,0),E.state(l,5));assert.equal(E.state(l,.2).opacity,0);assert.equal(E.state(l,2).opacity,1);assert.equal(E.state(l,4.9).opacity,0);
});
test('all cycle presets meet at duration boundary',()=>{
  for(const preset of E.motions){const l=E.layer({animation:{preset,amplitude:18,cycles:2,phase:.3}});assert.deepEqual(E.state(l,0),E.state(l,5));}
});
test('entry/exit times remain within total duration',()=>{
  const l=E.layer({animation:{exit:{type:'right',start:100,duration:30}}},5);assert.equal(l.animation.exit.duration,5);assert.equal(l.animation.exit.start,0);
});
test('hit testing respects rotation, visibility, locks and z order',()=>{
  const p=base();p.layers=[E.layer({id:'bottom',x:300,y:300,width:100,height:100}),E.layer({id:'top',x:300,y:300,width:100,height:100,rotation:30})];
  assert.equal(E.hitTest(p,2,300,300).id,'top');p.layers[1].locked=true;assert.equal(E.hitTest(p,2,300,300).id,'bottom');p.layers[0].visible=false;assert.equal(E.hitTest(p,2,300,300),null);
});
test('normalization rejects remote/executable media and unknown versions',()=>{
  const p=base();p.assets.bad={src:'https://example.com/track.png'};assert.throws(()=>E.normalize(p),/素材/);p.assets.bad.src='data:image/svg+xml;base64,AAAA';assert.throws(()=>E.normalize(p),/素材/);p.version=99;assert.throws(()=>E.normalize(p),/项目文件/);
});
test('portable project retains only referenced media and round trips',()=>{
  const p=loadProject(path.join(root,'examples/realme-99.campaign.json'));p.assets.unused=p.assets.background;
  const saved=E.compact(p);assert(!saved.assets.unused);assert(saved.assets['product-a'].src.startsWith('data:image/png;base64,'));assert.deepEqual(E.normalize(JSON.parse(JSON.stringify(saved))),saved);
});
test('standalone build has embedded assets, valid scripts, no external scripts and safe user text',()=>{
  const p=base();p.name='</script><script>alert(1)</script>';const html=build(p);
  assert(html.includes('\\u003c/script>'));assert(!html.includes('<script>alert(1)'));
  assert(!/<script[^>]+src=/.test(html));assert(!/__ENGINE__|__PROJECT__|__EDITOR__/.test(html));
  const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,6);
  for(const [,attrs,body]of scripts)if(!attrs.includes('application/json'))new vm.Script(body);
});
test('selection handles follow flipped and rotated geometry around an off-centre anchor',()=>{
  const l=E.layer({x:300,y:400,width:100,height:200,anchorX:0,anchorY:0,scale:2,rotation:90,flipX:true});
  const g=E.selectionGeometry(l,0,5,50);const near=(a,b)=>assert(Math.abs(a-b)<1e-8);
  near(g.corners[0].x,300);near(g.corners[0].y,400);near(g.corners[2].x,-100);near(g.corners[2].y,200);near(g.rotate.x,350);near(g.rotate.y,300);
});
test('full layered campaign uses the intended words and no standalone top logo',()=>{
  const p=loadProject(path.join(root,'examples/realme-99.campaign.json'));assert.equal(p.layers.length,14);assert.equal(p.layers.find(l=>l.id==='series').text,'realme P4 Series');assert.equal(p.layers.find(l=>l.id==='tagline').text.replace(/\s/g,''),'MAKEITREAL');assert(!p.layers.some(l=>l.id==='realme-logo'));
});
