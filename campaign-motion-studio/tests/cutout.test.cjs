const test=require('node:test'),assert=require('node:assert/strict'),C=require('../src/cutout.js');
function ring(){const w=9,h=9,rgba=new Uint8ClampedArray(w*h*4).fill(255);for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)if(x===2||x===6||y===2||y===6){const i=(y*w+x)*4;rgba[i]=30;rgba[i+1]=50;rgba[i+2]=80;}return {w,h,rgba,mask:C.alpha(rgba)};}
test('connected background removal preserves enclosed light-coloured subject detail',()=>{
  const {w,h,rgba,mask}=ring(),color=C.borderColor(rgba,w,h);assert.deepEqual(color,[255,255,255]);
  const result=C.removeColor(rgba,mask,w,h,color,20,true);assert.equal(result.mask[0],0);assert.equal(result.mask[4*w+4],255);assert.equal(result.mask[2*w+2],255);assert.equal(mask[0],255);
  const all=C.removeColor(rgba,mask,w,h,color,20,false);assert.equal(all.mask[4*w+4],0);assert.equal(all.mask[2*w+2],255);
  const seed=C.removeColor(rgba,mask,w,h,color,20,true,{x:4,y:4});assert.equal(seed.mask[4*w+4],0);assert.equal(seed.mask[0],255);
});
test('erase and restore strokes are continuous and respect existing transparency',()=>{
  const w=20,h=10,original=new Uint8ClampedArray(w*h).fill(255),mask=original.slice();original[0]=mask[0]=0;
  C.brushLine(mask,original,w,h,{x:2,y:5},{x:17,y:5},2);for(let x=2;x<=17;x++)assert.equal(mask[5*w+x],0);
  C.brush(mask,original,w,h,10,5,2,true);assert.equal(mask[5*w+10],255);C.brush(mask,original,w,h,0,0,3,true);assert.equal(mask[0],0);
});
test('polygon preserves its interior; feathering retains original transparent pixels',()=>{
  const w=10,h=10,original=new Uint8ClampedArray(w*h).fill(255);original[0]=0;
  const mask=C.keepPolygon(original,w,h,[{x:2,y:2},{x:8,y:2},{x:8,y:8},{x:2,y:8}]);assert.equal(mask[5*w+5],255);assert.equal(mask[0],0);assert.equal(mask[9*w+9],0);
  const soft=C.feather(mask,original,w,h,1);assert.equal(soft[0],0);assert(soft[2*w+2]>0&&soft[2*w+2]<255);assert.equal(soft[5*w+5],255);
});
test('transparent edges are detected and RGB content is preserved in the exported alpha mask',()=>{
  const {rgba,w,h,mask}=ring();for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1)rgba[(y*w+x)*4+3]=0;
  assert.equal(C.borderColor(rgba,w,h),null);mask[4*w+4]=64;const out=C.rgbaWithMask(rgba,mask);assert.equal(out[(4*w+4)*4+3],64);assert.equal(out[3],0);
  for(let i=0;i<rgba.length;i++)if(i%4!==3)assert.equal(out[i],rgba[i]);
});
