(function(root){
  'use strict';
  const C=CampaignCutout,$=id=>document.getElementById(id);
  let active=false,resolveEdit,source,original,mask,history=[],points=[],mode='pick',last=null,painting=false,renderPending=false,w=0,h=0;
  const dialog=$('cutout-dialog'),canvas=$('cutout-canvas'),overlay=$('cutout-overlay');
  let ctx,pen;
  const note=s=>$('cutout-status').textContent=s;
  function remember(){history.push(mask.slice());if(history.length>12)history.shift();$('cutout-undo').disabled=!history.length;}
  function setMode(value){mode=value;points=[];document.querySelectorAll('[data-cutout-mode]').forEach(b=>b.classList.toggle('active',b.dataset.cutoutMode===mode));$('cutout-finish-polygon').disabled=true;drawOverlay();canvas.style.cursor=mode==='pick'?'crosshair':mode==='polygon'?'crosshair':'none';$('cutout-cursor').hidden=true;note({pick:'点一下要移除的背景；可调容差后再次点选。',erase:'按住拖动，擦除不需要的区域。',restore:'按住拖动，恢复被误删的区域。',polygon:'沿主体轮廓逐点点击，再点“完成圈选”保留内部。'}[mode]);}
  function draw(feathered=true){if(!active)return;const a=feathered?C.feather(mask,original,w,h,Number($('cutout-feather').value)):mask;const data=ctx.createImageData(w,h);data.data.set(C.rgbaWithMask(source,a));ctx.putImageData(data,0,0);drawOverlay();}
  function scheduleDraw(){if(renderPending)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;draw(!painting);});}
  function drawOverlay(){if(!pen)return;pen.clearRect(0,0,w,h);if(!points.length)return;
    const ratio=w/Math.max(1,canvas.getBoundingClientRect().width);pen.strokeStyle='#ffdd20';pen.fillStyle='#ffdd20';pen.lineWidth=2*ratio;pen.beginPath();points.forEach((p,i)=>i?pen.lineTo(p.x,p.y):pen.moveTo(p.x,p.y));pen.stroke();for(const p of points){pen.beginPath();pen.arc(p.x,p.y,3*ratio,0,Math.PI*2);pen.fill();}
  }
  function position(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(w-1,(e.clientX-r.left)/r.width*w)),y:Math.max(0,Math.min(h-1,(e.clientY-r.top)/r.height*h))};}
  function cursor(e){const c=$('cutout-cursor');if(!active||!['erase','restore'].includes(mode)){c.hidden=true;return;}const r=canvas.getBoundingClientRect(),parent=$('cutout-image-wrap').getBoundingClientRect(),size=Number($('cutout-brush').value)*r.width/w;c.hidden=false;c.style.width=size+'px';c.style.height=size+'px';c.style.left=(e.clientX-parent.left)+'px';c.style.top=(e.clientY-parent.top)+'px';}
  function close(result=null){if(!active)return;active=false;painting=false;points=[];source=null;original=null;mask=null;history=[];if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');const done=resolveEdit;resolveEdit=null;done?.(result);}
  function fit(){if(!active)return;const r=$('cutout-canvas-slot').getBoundingClientRect();if(!r.width||!r.height)return;const scale=Math.min(r.width/w,r.height/h);$('cutout-image-wrap').style.width=Math.floor(w*scale)+'px';$('cutout-image-wrap').style.height=Math.floor(h*scale)+'px';drawOverlay();}
  async function open(asset,image){
    if(active)throw Error('请先完成当前抠图');ctx=canvas.getContext('2d',{willReadFrequently:true});pen=overlay.getContext('2d');
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,factor=Math.min(1,2048/Math.max(iw,ih));w=Math.max(1,Math.round(iw*factor));h=Math.max(1,Math.round(ih*factor));
    canvas.width=overlay.width=w;canvas.height=overlay.height=h;ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);source=ctx.getImageData(0,0,w,h).data;original=C.alpha(source);mask=original.slice();history=[];points=[];active=true;
    $('cutout-name').textContent=asset.name;$('cutout-resolution').textContent=w+' × '+h+(factor<1?' · 大图已适配为最长边 2048px':'');
    dialog.querySelectorAll('button,input').forEach(el=>el.disabled=false);$('cutout-undo').disabled=true;$('cutout-feather').value=0;$('cutout-tolerance').value=35;$('cutout-brush').value=65;$('cutout-connected').checked=true;
    updateValues();setMode('pick');if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');fit();requestAnimationFrame(fit);draw();
    return new Promise(resolve=>resolveEdit=resolve);
  }
  function updateValues(){for(const id of ['tolerance','brush','feather'])$('cutout-'+id+'-value').textContent=$('cutout-'+id).value+(id==='tolerance'?'':' px');}
  document.querySelectorAll('[data-cutout-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.cutoutMode));
  $('cutout-auto').onclick=()=>{
    const color=C.borderColor(source,w,h);if(!color){note('图像边缘已有透明背景；可用擦除或圈选继续修整。');return;}
    remember();const result=C.removeColor(source,mask,w,h,color,Number($('cutout-tolerance').value),true);mask=result.mask;draw();note(result.removed?'已移除与画面边缘连通的相近底色。可继续点选、擦除或恢复。':'未找到匹配的边缘背景，可提高容差或使用圈选。');
  };
  canvas.addEventListener('pointerdown',e=>{
    if(!active||e.button!==0)return;const p=position(e);
    if(mode==='polygon'){const prev=points.at(-1);if(!prev||Math.hypot(prev.x-p.x,prev.y-p.y)>1)points.push(p);$('cutout-finish-polygon').disabled=points.length<3;drawOverlay();return;}
    remember();
    if(mode==='pick'){
      const color=C.sample(source,w,h,p.x,p.y),result=C.removeColor(source,mask,w,h,color,Number($('cutout-tolerance').value),$('cutout-connected').checked,p);mask=result.mask;draw();note('已去除选中的底色。误删时可撤销，或用“恢复”画笔修补。');
    }else{painting=true;last=p;canvas.setPointerCapture(e.pointerId);C.brush(mask,original,w,h,p.x,p.y,Number($('cutout-brush').value)/2,mode==='restore');cursor(e);scheduleDraw();}
  });
  canvas.addEventListener('pointermove',e=>{cursor(e);if(!painting||!active)return;const p=position(e);C.brushLine(mask,original,w,h,last,p,Number($('cutout-brush').value)/2,mode==='restore');last=p;scheduleDraw();});
  function endStroke(){if(!painting)return;painting=false;last=null;draw();}
  canvas.addEventListener('pointerup',endStroke);canvas.addEventListener('pointercancel',endStroke);canvas.addEventListener('pointerleave',()=>$('cutout-cursor').hidden=true);
  $('cutout-finish-polygon').onclick=()=>{if(points.length<3)return;remember();mask=C.keepPolygon(mask,w,h,points);points=[];$('cutout-finish-polygon').disabled=true;draw();note('已保留圈选区域，其余部分变为透明。');};
  canvas.addEventListener('dblclick',()=>{if(mode==='polygon'&&points.length>=3)$('cutout-finish-polygon').click();});
  $('cutout-undo').onclick=()=>{if(!history.length)return;mask=history.pop();points=[];$('cutout-undo').disabled=!history.length;$('cutout-finish-polygon').disabled=true;draw();};
  $('cutout-reset').onclick=()=>{remember();mask=original.slice();points=[];$('cutout-finish-polygon').disabled=true;draw();note('已恢复本次打开时的原图。');};
  for(const id of ['tolerance','brush','feather'])$('cutout-'+id).oninput=()=>{updateValues();if(id==='feather')scheduleDraw();};
  $('cutout-cancel').onclick=()=>close();$('cutout-close').onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('cutout-apply').onclick=()=>{draw(true);const result={src:canvas.toDataURL('image/png'),width:w,height:h};close(result);};
  $('cutout-download').onclick=()=>{draw(true);canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download='cutout.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),15000);},'image/png');};
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe($('cutout-canvas-slot'));else root.addEventListener?.('resize',fit);
  root.CampaignCutoutUI={open,isOpen:()=>active};
})(globalThis);
