/* Campaign Motion Studio: pure, frame-addressable scene renderer. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CampaignEngine=factory();})(globalThis,function(){
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const num=(v,d,a=-1e5,b=1e5)=>clamp(Number.isFinite(Number(v))?Number(v):d,a,b);
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const back=v=>{v=clamp(v)-1;return 1+2.70158*v*v*v+1.70158*v*v;};
  const color=(v,d='#ffdb20')=>/^#[0-9a-f]{6}$/i.test(v)?v:d;
  const choice=(v,items,d)=>items.includes(v)?v:d;
  const copy=v=>JSON.parse(JSON.stringify(v));
  const motions=['still','float','sway','pulse','bounce','flash'];
  const transitions=['none','fade','left','right','up','down','zoom'];
  function transition(v={},exit=false,duration=5){
    const length=num(v.duration,.65,.05,duration);
    return {type:choice(v.type,transitions,'none'),start:num(v.start,exit?duration-.85:.5,0,duration-length),duration:length};
  }
  function layer(v={},duration=5,index=0){
    const a=v.animation||{};
    return {
      id:String(v.id||'layer-'+index),name:String(v.name||'新元素').slice(0,80),
      type:choice(v.type,['image','video','text','lightning'],'image'),assetId:String(v.assetId||''),
      role:choice(v.role,['background','decoration','title','product','copy'],'decoration'),
      visible:v.visible!==false,locked:!!v.locked,
      x:num(v.x,540),y:num(v.y,960),width:num(v.width,300,1,5000),height:num(v.height,400,1,5000),
      scale:num(v.scale,1,.05,6),rotation:num(v.rotation,0,-360,360),opacity:num(v.opacity,1,0,1),
      anchorX:num(v.anchorX,.5,0,1),anchorY:num(v.anchorY,.5,0,1),flipX:!!v.flipX,
      text:String(v.text||'').slice(0,1000),fontSize:num(v.fontSize,60,8,400),
      fontFamily:choice(v.fontFamily,['Arial','Georgia','Verdana','sans-serif'],'Arial'),
      bold:!!v.bold,color:color(v.color,'#15140c'),shadow:num(v.shadow,0,0,60),
      animation:{preset:choice(a.preset,motions,'still'),amplitude:num(a.amplitude,10,0,100),cycles:Math.round(num(a.cycles,1,1,8)),phase:num(a.phase,0,0,1),travel:num(a.travel,200,0,900),entry:transition(a.entry,false,duration),exit:transition(a.exit,true,duration)}
    };
  }
  function normalize(v){
    if(!v||v.format!=='campaign-motion-studio'||v.version!==1)throw Error('请选择本编辑器保存的 .campaign.json 项目文件');
    if(!Array.isArray(v.layers)||v.layers.length>100)throw Error('项目最多支持 100 个图层');
    const c=v.canvas||{},duration=num(c.duration,5,2,15);
    const assets={};
    for(const [key,a] of Object.entries(v.assets||{})){
      if(['__proto__','constructor','prototype'].includes(key))throw Error('素材编号不可用');
      if(!a||!/^data:(image\/(png|jpeg|webp)|video\/(mp4|webm));base64,[a-z0-9+/=\s]+$/i.test(a.src))throw Error('素材必须是内置的 PNG、JPG、WebP、MP4 或 WebM');
      assets[key]={name:String(a.name||key).slice(0,120),kind:a.src.startsWith('data:video/')?'video':'image',src:a.src,width:num(a.width,1,1,16384),height:num(a.height,1,1,16384)};
    }
    const layers=v.layers.map((l,i)=>layer(l,duration,i));
    const ids=new Set();
    for(const l of layers){if(ids.has(l.id))throw Error('图层编号重复');ids.add(l.id);if(['image','video'].includes(l.type)&&!assets[l.assetId])throw Error('缺少素材：'+l.name);}
    return {format:'campaign-motion-studio',version:1,id:String(v.id||'campaign'),name:String(v.name||'新活动').slice(0,100),canvas:{width:1080,height:1920,duration,fps:30,background:color(c.background,'#fff0bd')},assets,layers};
  }
  function compact(project){const p=copy({...project,assets:{}});for(const l of p.layers)if(project.assets[l.assetId])p.assets[l.assetId]=project.assets[l.assetId];return p;}
  function vector(type,travel){return {left:[-travel,0],right:[travel,0],up:[0,-travel],down:[0,travel]}[type]||[0,0];}
  function state(l,time,duration=5){
    const t=((time%duration)+duration)%duration,a=l.animation,q=TAU*(t/duration*a.cycles+a.phase);
    const sin=Math.sin(q),cos=Math.cos(q),amp=a.amplitude;
    let x=l.x,y=l.y,scale=l.scale,angle=l.rotation,opacity=l.opacity;
    if(a.preset==='float'){y+=sin*amp;x+=Math.sin(q+1)*amp*.22;}
    if(a.preset==='sway')angle+=sin*amp;
    if(a.preset==='pulse')scale*=1+(1-cos)*.5*amp/100;
    if(a.preset==='bounce'){y-=(1-cos)*.5*amp;scale*=1+Math.pow((1-Math.cos(q*2))*.5,4)*amp/500;}
    if(a.preset==='flash')opacity*=1-(1-cos)*.5*amp/100;
    const enter=a.entry,exit=a.exit;
    if(enter.type!=='none'){
      const p=clamp((t-enter.start)/enter.duration),e=enter.type==='fade'?smooth(p):back(p),v=vector(enter.type,a.travel);
      x+=v[0]*(1-e);y+=v[1]*(1-e);opacity*=smooth(p);
      if(enter.type==='zoom')scale*=.45+.55*e;
    }
    if(exit.type!=='none'){
      const p=smooth((t-exit.start)/exit.duration),v=vector(exit.type,a.travel);
      x+=v[0]*p;y+=v[1]*p;opacity*=1-p;if(exit.type==='zoom')scale*=1-.5*p;
    }
    return {x,y,scale,angle:angle*Math.PI/180,opacity:l.visible?clamp(opacity):0,width:l.width,height:l.height,t,q};
  }
  function lightning(ctx,l,s){
    const w=l.width,h=l.height,intensity=.25+.75*Math.pow((1+Math.cos(s.q*2))*.5,8);
    ctx.strokeStyle=l.color;ctx.shadowColor=l.color;ctx.shadowBlur=24;ctx.lineCap='round';
    ctx.globalAlpha*=intensity;
    ctx.save();ctx.rotate(-.1);ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,w*.47,h*.14,0,0,TAU);ctx.stroke();ctx.restore();
    const paths=[[[0,.18],[-.1,-.05],[-.08,-.16],[-.24,-.27],[-.34,-.48]],[[0,.14],[.12,-.08],[.18,-.03],[.32,-.31],[.42,-.27]]];
    for(const path of paths){ctx.beginPath();path.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='#fffce9';ctx.lineWidth=1.8;ctx.stroke();ctx.strokeStyle=l.color;}
  }
  function drawLayer(ctx,l,time,duration,cache){
    const s=state(l,time,duration);if(s.opacity<.001)return s;
    ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);ctx.scale(s.scale*(l.flipX?-1:1),s.scale);ctx.globalAlpha=s.opacity;
    if(l.shadow){ctx.shadowColor='#3b2a2455';ctx.shadowBlur=l.shadow;ctx.shadowOffsetY=l.shadow*.45;}
    const x=-l.width*l.anchorX,y=-l.height*l.anchorY;
    if(l.type==='text'){
      ctx.fillStyle=l.color;ctx.textAlign='center';ctx.textBaseline='middle';
      const lines=l.text.split('\n'),lineH=l.fontSize*1.2;
      ctx.font=(l.bold?'700 ':'400 ')+l.fontSize+'px '+l.fontFamily+', sans-serif';
      lines.forEach((line,i)=>ctx.fillText(line,x+l.width/2,y+l.height/2+(i-(lines.length-1)/2)*lineH,l.width));
    }else if(l.type==='lightning'){
      ctx.translate(x+l.width/2,y+l.height/2);lightning(ctx,l,s);
    }else{
      const img=cache.get?cache.get(l.assetId):cache[l.assetId];
      if(img&&(l.type!=='video'||img.readyState>=2))ctx.drawImage(img,x,y,l.width,l.height);
    }
    ctx.restore();return s;
  }
  function selectionGeometry(l,time,duration=5,offset=54){
    const s=state(l,time,duration),c=Math.cos(s.angle),n=Math.sin(s.angle),flip=l.flipX?-1:1;
    const transform=(x,y)=>({x:s.x+s.scale*(x*flip*c-y*n),y:s.y+s.scale*(x*flip*n+y*c)});
    const x=-l.width*l.anchorX,y=-l.height*l.anchorY;
    const corners=[[x,y],[x+l.width,y],[x+l.width,y+l.height],[x,y+l.height]].map(p=>transform(...p));
    const top=transform(x+l.width/2,y),rotate={x:top.x+n*offset,y:top.y-c*offset};
    return {state:s,corners,top,rotate};
  }
  // The list displays front-to-back, while the renderer stores back-to-front.
  function reorder(layers,sourceId,targetId,before=true){
    if(sourceId===targetId||!layers.some(l=>l.id===sourceId)||!layers.some(l=>l.id===targetId))return layers;
    const order=[...layers].reverse(),source=order.splice(order.findIndex(l=>l.id===sourceId),1)[0];
    order.splice(order.findIndex(l=>l.id===targetId)+(before?0:1),0,source);return order.reverse();
  }
  function draw(ctx,project,time,cache,selectedId=null,guideUnit=1){
    const {width,height,duration,background}=project.canvas;
    ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=background;ctx.fillRect(0,0,width,height);
    for(const l of project.layers)drawLayer(ctx,l,time,duration,cache);
    const l=project.layers.find(l=>l.id===selectedId);
    if(l){const g=selectionGeometry(l,time,duration,22*guideUnit),s=g.state;if(s.opacity>.02){
      ctx.save();ctx.strokeStyle='#ffdd20';ctx.lineWidth=1.5*guideUnit;ctx.setLineDash([5*guideUnit,3*guideUnit]);
      ctx.beginPath();g.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
      if(!l.locked){
        ctx.beginPath();ctx.moveTo(g.top.x,g.top.y);ctx.lineTo(g.rotate.x,g.rotate.y);ctx.stroke();ctx.fillStyle='#1c2414';
        for(const p of g.corners){const size=8*guideUnit;ctx.fillRect(p.x-size/2,p.y-size/2,size,size);ctx.strokeRect(p.x-size/2,p.y-size/2,size,size);}
        ctx.beginPath();ctx.arc(g.rotate.x,g.rotate.y,5*guideUnit,0,TAU);ctx.fill();ctx.stroke();
        ctx.fillStyle='#ffdd20';ctx.beginPath();ctx.arc(s.x,s.y,2.5*guideUnit,0,TAU);ctx.fill();
      }ctx.restore();
    }}
  }
  function hitTest(project,time,x,y){
    for(const l of [...project.layers].reverse()){
      if(l.locked)continue;const s=state(l,time,project.canvas.duration);if(s.opacity<.05)continue;
      const dx=x-s.x,dy=y-s.y,px=(dx*Math.cos(s.angle)+dy*Math.sin(s.angle))/s.scale*(l.flipX?-1:1),py=(-dx*Math.sin(s.angle)+dy*Math.cos(s.angle))/s.scale;
      if(px>=-l.width*l.anchorX&&px<=l.width*(1-l.anchorX)&&py>=-l.height*l.anchorY&&py<=l.height*(1-l.anchorY))return l;
    }return null;
  }
  return {clamp,copy,layer,normalize,compact,state,draw,hitTest,selectionGeometry,reorder,motions,transitions};
});
