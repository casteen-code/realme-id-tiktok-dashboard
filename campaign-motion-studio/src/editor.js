(function(){
  'use strict';
  const E=CampaignEngine,$=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d',{alpha:false});
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>globalThis.crypto?.randomUUID?.()||'item-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  let project=E.normalize(JSON.parse($('boot-project').textContent)),selectedId='product-a',cache=new Map();
  if(!project.layers.some(l=>l.id===selectedId))selectedId=project.layers.find(l=>l.role==='product')?.id||project.layers.at(-1)?.id;
  let current=Math.min(2,project.canvas.duration/2),playing=false,ready=false,busy=false,clockStart=0,startAt=0,mediaMode='add';
  let undoStack=[],redoStack=[],draft=null,draftTimer,drag=null,dbPromise,canMp4=false,draggedLayerId=null;
  const motionLabels={still:'静止',float:'自然悬浮',sway:'左右摇摆',pulse:'呼吸缩放',bounce:'大促弹跳',flash:'明暗闪动'};
  const transitionLabels={none:'无',fade:'淡入 / 淡出',left:'从 / 向左侧',right:'从 / 向右侧',up:'从 / 向上方',down:'从 / 向下方',zoom:'缩放'};
  const roleLabels={background:'背景',decoration:'装饰',title:'促销主题',product:'产品',copy:'文案'};
  const wrapAngle=v=>((v+180)%360+360)%360-180;
  const selected=()=>project.layers.find(l=>l.id===selectedId);
  const status=(s,error=false)=>{$('status').textContent=s;$('status').style.color=error?'#ffc0a9':'';};
  function snapshot(){return {...E.copy({...project,assets:{}}),assets:{...project.assets}};}
  function remember(){undoStack.push(snapshot());if(undoStack.length>40)undoStack.shift();redoStack=[];}
  function updateHistory(){$('undo').disabled=busy||!undoStack.length;$('redo').disabled=busy||!redoStack.length;}
  function changed(rebuild=true){
    if(rebuild){renderLayers();renderInspector();}
    render(current);updateHistory();saveDraftSoon();
  }
  function edit(fn,rebuild=true){if(busy)return;remember();fn();changed(rebuild);}
  function render(t=current,guides=true){
    if(!ready)return;
    E.draw(ctx,project,t,cache,guides&&$('show-guides').checked?selectedId:null,guideUnit());
    $('timeline').value=t;$('time-label').textContent=t.toFixed(2)+' / '+project.canvas.duration+'s';
  }
  function guideUnit(){return 1080/Math.max(100,canvas.getBoundingClientRect().width);}
  function fitStage(){
    const r=$('canvas-slot').getBoundingClientRect();if(!r.width||!r.height)return;
    const width=Math.floor(Math.min(r.width,r.height*9/16));$('canvas-wrap').style.width=width+'px';$('canvas-wrap').style.height=(width*16/9)+'px';render();
  }
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitStage).observe($('canvas-slot'));else globalThis.addEventListener?.('resize',fitStage);
  function videoItems(){return [...cache.values()].filter(v=>v.tagName==='VIDEO');}
  function alignVideos(t,force=false){for(const v of videoItems()){
    const target=t%(v.duration||project.canvas.duration);
    if(!v.seeking&&(force||Math.abs(v.currentTime-target)>.16))v.currentTime=target;
  }}
  function setPlaying(value){
    if(!ready||busy)return;playing=value;startAt=current;clockStart=performance.now();
    alignVideos(current,true);for(const v of videoItems())if(value)v.play().catch(()=>{});else v.pause();
    $('play').textContent=playing?'Ⅱ':'▶';
  }
  function frame(now){
    if(ready&&!busy&&playing){current=(startAt+(now-clockStart)/1000)%project.canvas.duration;alignVideos(current);render();}
    requestAnimationFrame(frame);
  }
  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);}
  function filename(){return (project.name.replace(/[^\p{L}\p{N}_-]+/gu,'_').slice(0,70)||'campaign');}
  function lock(value){busy=value;document.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);if(!value){updateHistory();$('restore-draft').disabled=!draft;renderInspector();}}
  function loadAsset(a){return new Promise((resolve,reject)=>{
    let timer;const bad=()=>{clearTimeout(timer);reject(Error('素材无法解码：'+a.name));};
    if(a.kind==='video'){
      const v=document.createElement('video');v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';
      timer=setTimeout(bad,20000);v.onloadeddata=()=>{clearTimeout(timer);resolve(v);};v.onerror=bad;v.src=a.src;v.load();
    }else{const img=new Image();timer=setTimeout(bad,15000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=bad;img.src=a.src;}
  });}
  async function prepareAssets(p){const out=new Map();await Promise.all(Object.entries(p.assets).map(async([id,a])=>{
    const old=project.assets[id];out.set(id,cache.has(id)&&old?.src===a.src?cache.get(id):await loadAsset(a));
  }));return out;}
  async function applyProject(candidate,keepHistory=false){
    const normalized=E.normalize(candidate),wasPlaying=playing;setPlaying(false);lock(true);
    try{
      const next=await prepareAssets(normalized);
      for(const v of videoItems())v.pause();
      if(!keepHistory)remember();project=normalized;cache=next;selectedId=project.layers.find(l=>l.role==='product')?.id||project.layers.at(-1)?.id;
      current=Math.min(2,project.canvas.duration/2);ready=true;syncProjectControls();changed();status('项目已打开，素材和动画设置已恢复。');
    }finally{lock(false);if(wasPlaying)setPlaying(true);}
  }
  function syncProjectControls(){
    $('project-name').value=project.name;$('duration').value=project.canvas.duration;$('background-color').value=project.canvas.background;
    $('timeline').max=project.canvas.duration-.001;$('canvas-summary').textContent='1080 × 1920 · '+project.canvas.duration+' 秒';
  }
  function renderLayers(){
    const list=$('layer-list'),scroll=list.scrollTop;
    $('layer-count').textContent=project.layers.length+' 层';
    list.innerHTML=[...project.layers].reverse().map(l=>{
      const a=project.assets[l.assetId];const thumb=a?.kind==='image'?'<img class="layer-thumb" draggable="false" alt="" src="'+esc(a.src)+'">':'<span class="layer-thumb text-icon">'+(l.type==='text'?'T':l.type==='lightning'?'ϟ':'▸')+'</span>';
      return '<div data-layer-id="'+esc(l.id)+'" draggable="true" class="layer-row '+(l.id===selectedId?'selected ':'')+(l.visible?'':'hidden-layer')+'"><span class="layer-drag-handle" aria-hidden="true" title="拖动调整层级">⠿</span><button class="layer-select" data-select="'+esc(l.id)+'" aria-label="选择 '+esc(l.name)+'">'+thumb+'<span class="layer-copy"><span class="layer-name" title="双击重命名">'+esc(l.name)+'</span><span class="layer-meta">'+roleLabels[l.role]+' · '+Math.round(l.width*l.scale)+' × '+Math.round(l.height*l.scale)+'</span></span></button><button class="row-icon" data-eye="'+esc(l.id)+'" title="'+(l.visible?'隐藏':'显示')+'元素" aria-label="'+(l.visible?'隐藏':'显示')+esc(l.name)+'">'+(l.visible?'◉':'○')+'</button><button class="row-icon" data-lock="'+esc(l.id)+'" title="'+(l.locked?'解锁':'锁定')+'拖动" aria-label="'+(l.locked?'解锁':'锁定')+esc(l.name)+'">'+(l.locked?'■':'□')+'</button></div>';
    }).join('');
    list.scrollTop=scroll;
    const none=!selected();for(const id of ['duplicate-layer','delete-layer','layer-up','layer-down'])$(id).disabled=busy||none;
  }
  function options(labels,value){return Object.entries(labels).map(([v,label])=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(label)+'</option>').join('');}
  function range(key,label,value,min,max,step,unit){return '<div class="control"><div class="control-head"><label for="prop-'+key+'">'+label+'</label><output id="value-'+key+'">'+Number(value).toFixed(step<1?2:0)+unit+'</output></div><input id="prop-'+key+'" data-prop="'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'" data-unit="'+unit+'"></div>';}
  function numField(key,label,value,min,max,step=1){return '<label>'+label+'<input data-prop="'+key+'" type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"></label>';}
  function times(kind,title,a){return '<div class="control"><div class="control-head">'+title+'</div><div class="motion-times"><label>方式<select data-prop="animation.'+kind+'.type">'+options(transitionLabels,a.type)+'</select></label>'+numField('animation.'+kind+'.start','开始（秒）',a.start,0,project.canvas.duration,.05)+numField('animation.'+kind+'.duration','持续（秒）',a.duration,.05,project.canvas.duration,.05)+'</div></div>';}
  function renderInspector(){
    const l=selected();$('selected-kind').textContent=l?({image:'图片',video:'视频',text:'文字',lightning:'光效'}[l.type]):'';
    if(!l){$('inspector').innerHTML='<p class="empty-inspector">选择一个元素，或添加新图片。</p>';return;}
    const a=l.animation;let html='<section class="inspector-section"><label class="field-label" for="layer-name">元素名称</label><input id="layer-name" data-prop="name" value="'+esc(l.name)+'" maxlength="80">';
    html+='<label class="field-label" style="margin-top:12px">元素用途</label><select data-prop="role">'+options({background:'背景',decoration:'装饰',title:'促销主题',product:'产品',copy:'文案'},l.role)+'</select>';
    if(['image','video'].includes(l.type))html+='<div class="media-action-row"><button id="replace-media">替换素材</button>'+(l.type==='image'?'<button id="cutout-media">抠图 / 去底</button>':'')+'</div><p class="muted tiny">替换素材保留位置和动画；抠图支持去纯色底、圈选和画笔修整。</p>';
    if(l.type==='text')html+='<label class="field-label" style="margin-top:12px">文字内容</label><textarea data-prop="text" maxlength="1000">'+esc(l.text)+'</textarea><div class="form-row" style="margin-top:10px">'+numField('fontSize','字号',l.fontSize,8,400)+'<label>文字颜色<input type="color" data-prop="color" value="'+l.color+'"></label></div><div class="button-row"><button id="toggle-bold">'+(l.bold?'取消加粗':'文字加粗')+'</button></div>';
    if(l.type==='lightning')html+='<label class="field-label" style="margin-top:12px">闪电颜色<input data-prop="color" type="color" value="'+l.color+'"></label>';
    html+='<button class="wide-button" id="focus-layer">查看这个元素的展示时刻</button>'+(l.locked?'<div class="lock-note">已锁定画布拖动，可点图层右侧方块解锁。</div>':'')+'</section>';
    html+='<section class="inspector-section"><h3>位置与大小</h3><div class="form-row">'+numField('x','横向位置',Math.round(l.x),-1080,2160)+numField('y','垂直位置',Math.round(l.y),-1920,3840)+'</div>';
    html+=range('scale','大小倍数',l.scale,.1,4,.01,' ×')+range('rotation','旋转',l.rotation,-360,360,1,'°')+'<label class="rotation-angle">精确角度（°）<input id="rotation-number" data-prop="rotation" type="number" min="-360" max="360" step="1" value="'+l.rotation+'"></label><div class="rotation-actions"><button id="rotate-left">↶ −90°</button><button id="rotate-reset">归零</button><button id="rotate-right">↷ +90°</button></div>'+range('opacity','不透明度',l.opacity,0,1,.01,'');
    html+='<div class="form-row" style="margin-top:13px">'+numField('width','元素宽度',Math.round(l.width),1,5000)+numField('height','元素高度',Math.round(l.height),1,5000)+'</div><div class="button-row"><button id="center-layer">水平居中</button><button id="flip-layer">水平翻转</button></div>';
    if(l.role==='product')html+='<div class="control"><div class="control-head">两个产品的距离</div><div class="button-row"><button id="products-closer">− 靠近</button><button id="products-apart">＋ 分开</button><button id="products-align">一键并排</button></div><p class="muted tiny">调整画面中前两个产品；每个产品也能单独拖动。</p></div>';
    html+='<details class="quick-help"><summary>摇摆支点与阴影</summary><div class="form-row">'+numField('anchorX','横向支点 0–1',l.anchorX,0,1,.1)+numField('anchorY','纵向支点 0–1',l.anchorY,0,1,.1)+'</div>'+range('shadow','投影柔和度',l.shadow,0,60,1,'')+'</details></section>';
    html+='<section class="inspector-section"><h3>独立动效</h3><label class="field-label">循环动作</label><select data-prop="animation.preset">'+options(motionLabels,a.preset)+'</select>'+range('animation.amplitude','动作幅度',a.amplitude,0,100,1,a.preset==='sway'?'°':a.preset==='pulse'||a.preset==='flash'?'%':' px')+range('animation.cycles','每轮重复次数',a.cycles,1,8,1,' 次')+range('animation.phase','动作错峰',a.phase,0,1,.01,'')+range('animation.travel','入退场移动距离',a.travel,0,900,10,' px')+times('entry','入场',a.entry)+times('exit','退场',a.exit)+'<p class="muted tiny">替换图片会沿用这些设置。把入退场方式设为“无”可整轮常驻。</p></section>';
    $('inspector').innerHTML=html;
    if(busy)$('inspector').querySelectorAll('button,input,textarea,select').forEach(x=>x.disabled=true);
  }
  function setProperty(path,value){
    const l=selected();if(!l)return;let obj=l,parts=path.split('.');for(const p of parts.slice(0,-1))obj=obj[p];obj[parts.at(-1)]=value;
    if((path==='width'||path==='height')&&['image','video'].includes(l.type)){
      const a=project.assets[l.assetId];if(path==='width')l.height=l.width*a.height/a.width;else l.width=l.height*a.width/a.height;
    }
    const normalized=E.layer(l,project.canvas.duration,project.layers.indexOf(l));Object.assign(l,normalized);
  }
  $('inspector').addEventListener('input',e=>{
    const el=e.target,key=el.dataset.prop;if(!key||busy)return;
    if(el.type==='number'&&(el.value===''||!Number.isFinite(Number(el.value))))return;
    const value=['range','number'].includes(el.type)?Number(el.value):el.value;
    remember();setProperty(key,value);const label=$('value-'+key);if(label)label.textContent=Number(value).toFixed(Number(el.step)<1?2:0)+(el.dataset.unit||'');
    if(key==='rotation'){const angle=selected().rotation;$('rotation-number').value=angle;$('prop-rotation').value=angle;$('value-rotation').textContent=Math.round(angle)+'°';}
    render();updateHistory();saveDraftSoon();
    if(key==='name')renderLayers();
  });
  $('inspector').addEventListener('change',e=>{if(e.target.dataset.prop)renderInspector();});
  $('inspector').addEventListener('click',e=>{
    const id=e.target.id,l=selected();if(!l||busy)return;
    if(id==='replace-media'){mediaMode='replace';$('media-file').multiple=false;$('media-file').click();}
    if(id==='cutout-media')editCutout(l);
    if(id==='rotate-left'||id==='rotate-right'||id==='rotate-reset')edit(()=>l.rotation=id==='rotate-reset'?0:wrapAngle(l.rotation+(id==='rotate-left'?-90:90)));
    if(id==='center-layer')edit(()=>l.x=project.canvas.width/2);
    if(id==='flip-layer')edit(()=>l.flipX=!l.flipX);
    if(id==='toggle-bold')edit(()=>l.bold=!l.bold);
    if(id==='focus-layer'){
      setPlaying(false);const entry=l.animation.entry,exit=l.animation.exit,lo=entry.type==='none'?0:entry.start+entry.duration,hi=exit.type==='none'?project.canvas.duration:exit.start;
      current=E.clamp((lo+hi)/2,0,project.canvas.duration-.001);alignVideos(current,true);render();
    }
    if(['products-closer','products-apart','products-align'].includes(id)){
      const pair=project.layers.filter(l=>l.role==='product').slice(0,2).sort((a,b)=>a.x-b.x);if(pair.length<2){status('先添加第二个产品元素。');return;}
      edit(()=>{const [a,b]=pair,c=(a.x+b.x)/2;let distance=Math.max(0,b.x-a.x+(id==='products-closer'?-35:35));if(id==='products-align')distance=(boundsWidth(a)+boundsWidth(b))/2+45;a.x=c-distance/2;b.x=c+distance/2;});
    }
  });
  async function editCutout(l){
    if(busy||l.type!=='image')return;const wasPlaying=playing;setPlaying(false);lock(true);
    try{
      const asset=project.assets[l.assetId],result=await CampaignCutoutUI.open(asset,cache.get(l.assetId));
      if(result){
        const id=uid(),next={...result,kind:'image',name:asset.name.replace(/\.[^.]+$/,'')+'_cutout.png'},image=await loadAsset(next);
        remember();project.assets[id]=next;cache.set(id,image);l.assetId=id;changed();status('抠图已应用，位置、大小、旋转和动画均已保留；可撤销还原。');
      }
    }catch(e){status('抠图未完成：'+e.message,true);}finally{lock(false);render();if(wasPlaying)setPlaying(true);}
  }
  function boundsWidth(l){const r=l.rotation*Math.PI/180;return (Math.abs(l.width*Math.cos(r))+Math.abs(l.height*Math.sin(r)))*l.scale;}
  $('layer-list').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||busy)return;
    if(b.dataset.select){selectedId=b.dataset.select;$('layer-list').querySelectorAll('.layer-row').forEach(row=>row.classList.toggle('selected',row.dataset.layerId===selectedId));renderInspector();render();}
    if(b.dataset.eye)edit(()=>{const l=project.layers.find(l=>l.id===b.dataset.eye);l.visible=!l.visible;});
    if(b.dataset.lock)edit(()=>{const l=project.layers.find(l=>l.id===b.dataset.lock);l.locked=!l.locked;});
  });
  $('layer-list').addEventListener('dblclick',e=>{
    if(busy||!e.target.closest('.layer-name'))return;const row=e.target.closest('.layer-row');selectedId=row.dataset.layerId;renderInspector();setPanel('inspector');$('layer-name').focus();$('layer-name').select?.();
  });
  document.querySelectorAll('[data-layer-view]').forEach(b=>b.onclick=()=>{
    $('layer-list').dataset.view=b.dataset.layerView;document.querySelectorAll('[data-layer-view]').forEach(x=>x.classList.toggle('active',x===b));
  });
  function setPanel(panel){document.querySelector('.workspace').dataset.panel=panel;document.querySelectorAll('.mobile-panel-tabs [data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===panel));}
  document.querySelectorAll('.mobile-panel-tabs [data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));
  function clearDrop(){ $('layer-list').querySelectorAll('.drop-before,.drop-after').forEach(row=>row.classList.remove('drop-before','drop-after')); }
  $('layer-list').addEventListener('dragstart',e=>{
    const row=e.target.closest('.layer-row');if(busy||!row){e.preventDefault();return;}draggedLayerId=row.dataset.layerId;row.classList.add('dragging');
    if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedLayerId);}
  });
  $('layer-list').addEventListener('dragover',e=>{
    const row=e.target.closest('.layer-row');if(busy||!draggedLayerId||!row)return;e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';clearDrop();
    if(row.dataset.layerId!==draggedLayerId){const r=row.getBoundingClientRect();row.classList.add(e.clientY<r.top+r.height/2?'drop-before':'drop-after');}
    const list=$('layer-list'),r=list.getBoundingClientRect();if(e.clientY<r.top+30)list.scrollTop-=12;else if(e.clientY>r.bottom-30)list.scrollTop+=12;
  });
  $('layer-list').addEventListener('drop',e=>{
    const row=e.target.closest('.layer-row');if(busy||!draggedLayerId||!row)return;e.preventDefault();const target=row.dataset.layerId,source=draggedLayerId,r=row.getBoundingClientRect();
    clearDrop();draggedLayerId=null;if(target!==source)edit(()=>{project.layers=E.reorder(project.layers,source,target,e.clientY<r.top+r.height/2);selectedId=source;});
  });
  $('layer-list').addEventListener('dragend',()=>{draggedLayerId=null;clearDrop();$('layer-list').querySelectorAll('.dragging').forEach(row=>row.classList.remove('dragging'));});
  function add(l){if(project.layers.length>=100){status('最多支持 100 个元素。',true);return;}project.layers.push(E.layer(l,project.canvas.duration,project.layers.length));selectedId=l.id;}
  $('add-text').onclick=()=>edit(()=>add({id:uid(),name:'新文案',role:'copy',type:'text',text:'YOUR CAMPAIGN',x:540,y:780,width:850,height:100,fontSize:72,bold:true}));
  $('add-lightning').onclick=()=>edit(()=>add({id:uid(),name:'闪电光效',type:'lightning',x:540,y:340,width:850,height:400,color:'#ffdb20',animation:{preset:'pulse',amplitude:8}}));
  $('add-image').onclick=()=>{mediaMode='add';$('media-file').multiple=true;$('media-file').click();};
  $('add-background').onclick=()=>{mediaMode='background';$('media-file').multiple=false;$('media-file').click();};
  function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('文件读取失败'));r.readAsDataURL(file);});}
  $('media-file').onchange=async e=>{
    const files=[...e.target.files];e.target.value='';if(!files.length||busy)return;
    const wasPlaying=playing;setPlaying(false);lock(true);
    try{
      const extra=mediaMode==='add'?files.length:mediaMode==='background'&&!project.layers.some(l=>l.role==='background')?1:0;
      if(project.layers.length+extra>100)throw Error('最多支持 100 个元素');
      const prepared=[];
      for(const file of files){
        if(file.size>40*1024*1024)throw Error('每个素材请小于 40 MB：'+file.name);
        if(!/^image\/(png|jpeg|webp)$|^video\/(mp4|webm)$/.test(file.type))throw Error('请用 PNG、JPG、WebP、MP4 或 WebM');
        const a={name:file.name,kind:file.type.startsWith('video/')?'video':'image',src:await readFile(file)};
        const decoded=await loadAsset(a);a.width=decoded.naturalWidth||decoded.videoWidth;a.height=decoded.naturalHeight||decoded.videoHeight;
        if(!a.width||!a.height)throw Error('素材没有可用画面');prepared.push({id:uid(),a,decoded});
      }
      remember();
      for(const {id,a,decoded} of prepared){
        project.assets[id]=a;cache.set(id,decoded);
        if(mediaMode==='background'){
          const existing=project.layers.find(l=>l.role==='background');
          if(existing){existing.type=a.kind;existing.assetId=id;selectedId=existing.id;}
          else{const l=E.layer({id:uid(),name:'活动背景',type:a.kind,assetId:id,role:'background',locked:true,x:540,y:960,width:1080,height:1920},project.canvas.duration);project.layers.unshift(l);selectedId=l.id;}
        }else if(mediaMode==='replace'&&selected()){
          const l=selected();l.assetId=id;l.type=a.kind;l.width=l.height*a.width/a.height;
          if(l.role==='background'){l.width=1080;l.height=1920;l.scale=1;l.x=540;l.y=960;l.anchorX=.5;l.anchorY=.5;}
        }else{
          const h=550;add({id:uid(),name:a.name.replace(/\.[^.]+$/,''),type:a.kind,assetId:id,role:'product',x:540,y:960,width:h*a.width/a.height,height:h,shadow:15,animation:{preset:'float',amplitude:9,entry:{type:'zoom',start:.5,duration:.7},exit:{type:'fade',start:project.canvas.duration-.8,duration:.6}}});
        }
      }
      changed();status(mediaMode==='background'?'背景已替换。建议使用 9:16 图片，避免拉伸。':mediaMode==='replace'?'素材已替换，动画设置已保留。':'新素材已加入。可在右侧点“抠图 / 去底”，或拖动旋转点调整角度。');
    }catch(err){status(err.message,true);}finally{lock(false);if(wasPlaying)setPlaying(true);}
  };
  $('duplicate-layer').onclick=()=>{const l=selected();if(l)edit(()=>{const n=E.copy(l);n.id=uid();n.name+=' 副本';n.x+=40;n.y+=40;add(n);});};
  $('delete-layer').onclick=()=>{if(selected())edit(()=>{project.layers=project.layers.filter(l=>l.id!==selectedId);selectedId=project.layers.at(-1)?.id;});};
  for(const [id,delta]of[['layer-up',1],['layer-down',-1]])$(id).onclick=()=>{const i=project.layers.findIndex(l=>l.id===selectedId),j=i+delta;if(i<0||j<0||j>=project.layers.length)return;edit(()=>[project.layers[i],project.layers[j]]=[project.layers[j],project.layers[i]]);};
  async function history(from,to){if(!from.length||busy)return;const candidate=from.at(-1);try{const old=snapshot();await applyProject(candidate,true);from.pop();to.push(old);updateHistory();status('已恢复上一步。');}catch(e){status(e.message,true);}}
  $('undo').onclick=()=>history(undoStack,redoStack);$('redo').onclick=()=>history(redoStack,undoStack);
  function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*1080,y:(e.clientY-r.top)/r.height*1920};}
  function selectedHandle(p){
    const l=selected();if(!l||l.locked||!$('show-guides').checked)return null;
    const unit=guideUnit(),g=E.selectionGeometry(l,current,project.canvas.duration,22*unit);if(g.state.opacity<.05)return null;
    if(Math.hypot(p.x-g.rotate.x,p.y-g.rotate.y)<11*unit)return 'rotate';
    if(g.corners.some(c=>Math.hypot(p.x-c.x,p.y-c.y)<10*unit&&Math.hypot(c.x-g.state.x,c.y-g.state.y)>10))return 'scale';
    return null;
  }
  canvas.addEventListener('pointerdown',e=>{
    if(busy||!ready||e.button!==0)return;const p=point(e),mode=selectedHandle(p)||'move',l=mode==='move'?E.hitTest(project,current,p.x,p.y):selected();if(!l)return;
    e.preventDefault();setPlaying(false);selectedId=l.id;const s=E.state(l,current,project.canvas.duration);
    drag={id:l.id,mode,start:p,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation,pivot:{x:s.x,y:s.y},angle:Math.atan2(p.y-s.y,p.x-s.x),distance:Math.max(1,Math.hypot(p.x-s.x,p.y-s.y)),changed:false};
    canvas.setPointerCapture(e.pointerId);canvas.style.cursor=mode==='scale'?'nwse-resize':'grabbing';renderLayers();renderInspector();render();
  });
  canvas.addEventListener('pointermove',e=>{
    if(busy||!ready)return;const p=point(e);
    if(!drag){const handle=selectedHandle(p);canvas.style.cursor=handle==='scale'?'nwse-resize':handle==='rotate'?'crosshair':'grab';return;}
    const l=selected();if(!l||Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<1&&!drag.changed)return;
    if(!drag.changed){remember();drag.changed=true;}
    if(drag.mode==='rotate'){const delta=(Math.atan2(p.y-drag.pivot.y,p.x-drag.pivot.x)-drag.angle)*180/Math.PI;const angle=wrapAngle(drag.rotation+delta);l.rotation=e.shiftKey?Math.round(angle/15)*15:Math.round(angle*10)/10;}
    else if(drag.mode==='scale')l.scale=Math.round(E.clamp(drag.scale*Math.hypot(p.x-drag.pivot.x,p.y-drag.pivot.y)/drag.distance,.1,4)*100)/100;
    else{l.x=drag.x+p.x-drag.start.x;l.y=drag.y+p.y-drag.start.y;}render();
  });
  function endDrag(){if(!drag)return;const moved=drag.changed;drag=null;canvas.style.cursor='grab';if(moved)changed();}
  canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
  document.addEventListener('keydown',e=>{
    if(busy||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();return;}
    if(e.code==='Space'){e.preventDefault();setPlaying(!playing);return;}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete-layer').click();return;}
    if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();$(e.key==='ArrowUp'?'layer-up':'layer-down').click();return;}
    const l=selected(),delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(l&&!l.locked&&delta){e.preventDefault();edit(()=>{const n=e.shiftKey?10:1;l.x+=delta[0]*n;l.y+=delta[1]*n;});}
  });
  $('project-name').onchange=e=>edit(()=>{project.name=e.target.value.trim()||'新活动';},false);
  $('duration').onchange=e=>{
    setPlaying(false);const v=E.clamp(Number(e.target.value)||5,2,15),ratio=v/project.canvas.duration;
    edit(()=>{project.canvas.duration=v;for(const l of project.layers){for(const k of ['entry','exit']){l.animation[k].start*=ratio;l.animation[k].duration*=ratio;}}current=Math.min(current,v-.001);syncProjectControls();});
  };
  $('background-color').oninput=e=>edit(()=>project.canvas.background=e.target.value,false);
  $('play').onclick=()=>setPlaying(!playing);$('show-guides').onchange=()=>render();
  $('timeline').oninput=e=>{setPlaying(false);current=Number(e.target.value);alignVideos(current,true);render();};
  $('save-project').onclick=()=>{download(new Blob([JSON.stringify(E.compact(project),null,2)],{type:'application/json'}),filename()+'.campaign.json');status('项目已保存，包含图片、文字、位置与动画。');};
  $('open-project').onclick=()=>$('project-file').click();
  $('project-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>150*1024*1024)throw Error('项目文件请小于 150 MB');await applyProject(JSON.parse(await f.text()));}catch(err){status('项目未打开：'+err.message,true);}};
  $('new-project').onclick=async()=>{try{await applyProject({format:'campaign-motion-studio',version:1,id:uid(),name:'新 Campaign',canvas:{duration:5,background:'#fff0bd'},assets:{},layers:[{id:uid(),name:'活动标题',type:'text',role:'title',text:'YOUR CAMPAIGN',x:540,y:370,width:960,height:150,fontSize:95,bold:true,animation:{preset:'bounce',amplitude:20}},{id:uid(),name:'活动口号',type:'text',role:'copy',text:'MAKE IT YOURS',x:540,y:580,width:850,height:80,fontSize:42} ]});status('新活动已创建。点“背景”替换底图，再添加图片或文字；也可撤销返回。');}catch(e){status(e.message,true);}};
  $('export-html').onclick=()=>{
    const root=document.documentElement.cloneNode(true);
    root.querySelector('#boot-project').textContent=JSON.stringify(E.compact(project)).replace(/</g,'\\u003c');
    root.querySelector('#layer-list').replaceChildren();root.querySelector('#inspector').replaceChildren();
    root.querySelector('#cutout-dialog').removeAttribute('open');
    root.querySelectorAll('button,input,textarea,select').forEach(el=>el.disabled=false);
    root.querySelector('#loading').hidden=false;root.querySelector('title').textContent=project.name+' · 活动背景工坊';
    download(new Blob(['<!doctype html>\n'+root.outerHTML],{type:'text/html'}),filename()+'.html');status('独立 HTML 已保存，素材已内置，下次可直接打开。');
  };
  $('export-png').onclick=()=>{if(!ready||busy)return;render(current,false);canvas.toBlob(blob=>{if(blob)download(blob,filename()+'.png');render();},'image/png');};
  function seekVideo(v,t){const target=t%(v.duration||project.canvas.duration);return new Promise((resolve,reject)=>{
    if(Math.abs(v.currentTime-target)<.002&&!v.seeking&&v.readyState>=2){resolve();return;}
    const done=()=>{clearTimeout(timer);v.removeEventListener('seeked',done);resolve();};
    const timer=setTimeout(()=>{v.removeEventListener('seeked',done);reject(Error('视频素材定位超时'));},10000);v.addEventListener('seeked',done);v.currentTime=target;
  });}
  async function seekVideos(t){await Promise.all(videoItems().map(v=>seekVideo(v,t)));}
  async function mp4Export(){
    const fps=30,count=Math.round(project.canvas.duration*fps),samples=[];let description,encodingError;
    const encoder=new VideoEncoder({output:(chunk,meta)=>{const data=new Uint8Array(chunk.byteLength);chunk.copyTo(data);samples.push({data,key:chunk.type==='key',timestamp:chunk.timestamp});if(meta.decoderConfig?.description)description=meta.decoderConfig.description;},error:e=>encodingError=e});
    try{
      encoder.configure({codec:'avc1.420028',width:1080,height:1920,bitrate:10000000,framerate:fps,latencyMode:'realtime',avc:{format:'avc'}});
      for(let i=0;i<count;i++){
        const t=i/fps;await seekVideos(t);render(t,false);const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
        encoder.encode(frame,{keyFrame:i%30===0});frame.close();if(encoder.encodeQueueSize>4)await encoder.flush();if(encodingError)throw encodingError;
        if(i%5===0){status('正在导出 MP4 · '+(i+1)+' / '+count+' 帧');await new Promise(requestAnimationFrame);}
      }
      await encoder.flush();if(encodingError)throw encodingError;samples.sort((a,b)=>a.timestamp-b.timestamp);if(samples.length!==count)throw Error('视频帧不完整');
      download(makeAvcMp4(samples,description,1080,1920,fps),filename()+'.mp4');status('MP4 已导出 · '+(count/fps)+' 秒 · 1080×1920 · 无声');
    }finally{if(encoder.state!=='closed')encoder.close();}
  }
  async function webmExport(){
    if(typeof MediaRecorder==='undefined'||typeof canvas.captureStream!=='function')throw Error('浏览器不支持视频导出，请保存项目后换一个支持视频录制的浏览器');
    await seekVideos(0);render(0,false);const stream=canvas.captureStream(30),chunks=[];
    const types=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'],mime=types.find(t=>MediaRecorder.isTypeSupported(t));if(!mime){stream.getTracks().forEach(t=>t.stop());throw Error('本浏览器不支持 WebM 编码');}
    let recorder;
    try{
      recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      let recordingError;const done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=e=>{recordingError=e.error||Error('录制失败');reject(recordingError);};});done.catch(()=>{});
      recorder.start();for(const v of videoItems())await v.play().catch(()=>{});const start=performance.now();
      await new Promise((resolve,reject)=>{function draw(now){if(recordingError){reject(recordingError);return;}const t=Math.min((now-start)/1000,project.canvas.duration-.001);alignVideos(t);render(t,false);status('正在录制 WebM · '+t.toFixed(1)+' 秒');if(now-start>=project.canvas.duration*1000)resolve();else requestAnimationFrame(draw);}requestAnimationFrame(draw);});
      recorder.stop();await done;download(new Blob(chunks,{type:'video/webm'}),filename()+'.webm');status('WebM 已导出。本浏览器未提供 MP4 编码，录制时长以播放节奏为准。');
    }finally{if(recorder&&recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(t=>t.stop());for(const v of videoItems())v.pause();}
  }
  $('export-video').onclick=async()=>{
    if(!ready||busy)return;const wasPlaying=playing;setPlaying(false);lock(true);
    try{if(canMp4)await mp4Export();else await webmExport();}
    catch(e){status('导出未完成：'+e.message+'。可保存项目后重试。',true);}
    finally{lock(false);await seekVideos(current).catch(()=>{});render();if(wasPlaying)setPlaying(true);}
  };
  function database(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('此浏览器无法保存草稿'));return;}
    const r=indexedDB.open('campaign-motion-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  }));}
  async function saveDraft(){try{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(E.compact(project),'latest');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});draft=snapshot();$('restore-draft').disabled=busy;$('draft-status').textContent='草稿已自动保存到此浏览器。';}catch(e){$('draft-status').textContent='自动保存不可用，请点击“保存项目”下载备份。';}}
  function saveDraftSoon(){clearTimeout(draftTimer);$('draft-status').textContent='有新调整，正在保存草稿…';draftTimer=setTimeout(saveDraft,650);}
  $('restore-draft').onclick=async()=>{if(!draft)return;try{await applyProject(draft);}catch(e){status('草稿无法恢复：'+e.message,true);}};
  async function init(){
    syncProjectControls();renderLayers();renderInspector();lock(true);
    try{
      cache=await prepareAssets(project);ready=true;$('loading').hidden=true;
      if(typeof VideoEncoder!=='undefined')try{const s=await VideoEncoder.isConfigSupported({codec:'avc1.420028',width:1080,height:1920,bitrate:10000000,framerate:30,latencyMode:'realtime',avc:{format:'avc'}});canMp4=s.supported;}catch(e){}
      $('export-video').textContent=canMp4?'导出 MP4':'导出 WebM';lock(false);fitStage();render();
      const reduce=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;setPlaying(!reduce);
      database().then(db=>{const tx=db.transaction('drafts'),r=tx.objectStore('drafts').get('latest');r.onsuccess=()=>{if(r.result){draft=r.result;$('restore-draft').disabled=busy;$('draft-status').textContent='有本机草稿，可点“恢复草稿”；也可继续当前项目。';}};}).catch(()=>{$('draft-status').textContent='请点击“保存项目”下载备份。';});
      status('分层模板已就绪。选中元素后点“替换素材”，或拖动它调整位置。');
    }catch(e){$('loading').textContent='素材加载失败，请重新打开项目';status(e.message,true);lock(false);}
  }
  requestAnimationFrame(frame);init();
})();
