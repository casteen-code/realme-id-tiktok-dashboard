/* Local alpha-mask editing. Color removal is not semantic AI segmentation. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CampaignCutout=factory();})(globalThis,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function alpha(rgba){const out=new Uint8ClampedArray(rgba.length/4);for(let i=0;i<out.length;i++)out[i]=rgba[i*4+3];return out;}
  function sample(rgba,w,h,x,y){const i=(clamp(Math.floor(y),0,h-1)*w+clamp(Math.floor(x),0,w-1))*4;return [rgba[i],rgba[i+1],rgba[i+2]];}
  function borderColor(rgba,w,h){
    const bins=new Map(),step=Math.max(1,Math.floor(Math.max(w,h)/128));
    function add(x,y){const i=(y*w+x)*4;if(rgba[i+3]<200)return;const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=(r>>5)*64+(g>>5)*8+(b>>5);let v=bins.get(key);if(!v){v={n:0,r:0,g:0,b:0};bins.set(key,v);}v.n++;v.r+=r;v.g+=g;v.b+=b;}
    for(let x=0;x<w;x+=step){add(x,0);add(x,h-1);}for(let y=0;y<h;y+=step){add(0,y);add(w-1,y);}
    const best=[...bins.values()].sort((a,b)=>b.n-a.n)[0];return best?[Math.round(best.r/best.n),Math.round(best.g/best.n),Math.round(best.b/best.n)]:null;
  }
  function removeColor(rgba,mask,w,h,target,tolerance=35,connected=true,seed=null){
    const out=mask.slice(),limit=3*tolerance*tolerance,n=w*h;let removed=0;
    function matches(i){if(mask[i]===0)return true;const j=i*4,r=rgba[j]-target[0],g=rgba[j+1]-target[1],b=rgba[j+2]-target[2];return r*r+g*g+b*b<=limit;}
    function clear(i){if(out[i])removed++;out[i]=0;}
    if(!connected){for(let i=0;i<n;i++)if(matches(i))clear(i);return {mask:out,removed};}
    const seen=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;
    function add(i){if(i<0||i>=n||seen[i])return;seen[i]=1;if(matches(i)){queue[tail++]=i;clear(i);}}
    if(seed){add(clamp(Math.floor(seed.y),0,h-1)*w+clamp(Math.floor(seed.x),0,w-1));}
    else{for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}}
    while(head<tail){const i=queue[head++],x=i%w;add(i-w);add(i+w);if(x>0)add(i-1);if(x<w-1)add(i+1);}
    return {mask:out,removed};
  }
  function brush(mask,original,w,h,x,y,radius,restore=false){
    const r=Math.max(1,radius),x0=Math.max(0,Math.floor(x-r)),x1=Math.min(w-1,Math.ceil(x+r)),y0=Math.max(0,Math.floor(y-r)),y1=Math.min(h-1,Math.ceil(y+r));
    for(let yy=y0;yy<=y1;yy++)for(let xx=x0;xx<=x1;xx++){
      const d=Math.hypot(xx-x,yy-y);if(d>r)continue;const i=yy*w+xx,strength=clamp((r-d)/(r*.2),0,1),target=restore?original[i]:0;
      mask[i]=Math.round(mask[i]+(target-mask[i])*strength);
    }return mask;
  }
  function brushLine(mask,original,w,h,a,b,radius,restore=false){
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1,radius*.35)));
    for(let i=0;i<=count;i++){const t=i/count;brush(mask,original,w,h,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,radius,restore);}return mask;
  }
  function keepPolygon(mask,w,h,points){
    if(points.length<3)return mask.slice();const out=new Uint8ClampedArray(mask.length);
    for(let y=0;y<h;y++){
      const scan=y+.5,crossings=[];
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const a=points[j],b=points[i];if((a.y>scan)!==(b.y>scan))crossings.push(a.x+(scan-a.y)*(b.x-a.x)/(b.y-a.y));
      }
      crossings.sort((a,b)=>a-b);
      for(let k=0;k+1<crossings.length;k+=2){const left=Math.max(0,Math.ceil(crossings[k]-.5)),right=Math.min(w-1,Math.floor(crossings[k+1]-.5));for(let x=left;x<=right;x++)out[y*w+x]=mask[y*w+x];}
    }return out;
  }
  function feather(mask,original,w,h,radius=0){
    const r=clamp(Math.round(radius),0,8);if(!r)return mask.slice();const temp=new Float32Array(mask.length),out=new Uint8ClampedArray(mask.length);
    for(let y=0;y<h;y++){
      let sum=0,count=0;for(let x=0;x<=Math.min(r,w-1);x++){sum+=mask[y*w+x];count++;}
      for(let x=0;x<w;x++){temp[y*w+x]=sum/count;const remove=x-r,add=x+r+1;if(remove>=0){sum-=mask[y*w+remove];count--;}if(add<w){sum+=mask[y*w+add];count++;}}
    }
    for(let x=0;x<w;x++){
      let sum=0,count=0;for(let y=0;y<=Math.min(r,h-1);y++){sum+=temp[y*w+x];count++;}
      for(let y=0;y<h;y++){out[y*w+x]=Math.min(original[y*w+x],Math.round(sum/count));const remove=y-r,add=y+r+1;if(remove>=0){sum-=temp[remove*w+x];count--;}if(add<h){sum+=temp[add*w+x];count++;}}
    }return out;
  }
  function rgbaWithMask(original,mask){const out=new Uint8ClampedArray(original);for(let i=0;i<mask.length;i++)out[i*4+3]=Math.min(original[i*4+3],mask[i]);return out;}
  return {alpha,sample,borderColor,removeColor,brush,brushLine,keepPolygon,feather,rgbaWithMask};
});
