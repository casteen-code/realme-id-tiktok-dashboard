/* Optional offline still / MP4 render. Browser editor additionally supports video layers. */
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const E=require('../src/engine.js'),{loadProject,root}=require('./project.cjs');
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const font=option('--font','/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf');
if(fs.existsSync(font))GlobalFonts.registerFromPath(font,'Arial');
const boldFont='/usr/share/fonts/opentype/urw-base35/NimbusSans-Bold.otf';if(fs.existsSync(boldFont))GlobalFonts.registerFromPath(boldFont,'Arial');
(async()=>{
  const p=loadProject(path.resolve(option('--project',path.join(root,'examples/realme-99.campaign.json'))));
  if(Object.values(p.assets).some(a=>a.kind==='video'))throw Error('Use the HTML editor to export projects that contain video layers.');
  const cache=new Map();await Promise.all(Object.entries(p.assets).map(async([id,a])=>cache.set(id,await loadImage(Buffer.from(a.src.split(',')[1],'base64')))));
  const canvas=createCanvas(1080,1920),ctx=canvas.getContext('2d'),out=path.resolve(option('--out',path.join(root,'renders',args.includes('--still')?'preview.png':'campaign-demo.mp4')));
  fs.mkdirSync(path.dirname(out),{recursive:true});
  if(args.includes('--still')){E.draw(ctx,p,Number(option('--time','2')),cache);fs.writeFileSync(out,canvas.toBuffer('image/png'));console.log('Saved '+out);return;}
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgba','-s','1080x1920','-r','30','-i','pipe:0','-an','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,setsar=1','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-color_range','tv','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',out],{stdio:['pipe','ignore','inherit']});
  const done=once(encoder,'close'),count=Math.round(p.canvas.duration*30);
  for(let n=0;n<count;n++){E.draw(ctx,p,n/30,cache);if(!encoder.stdin.write(canvas.data()))await once(encoder.stdin,'drain');if(n%30===0)console.log('Rendered '+n+'/'+count);}
  encoder.stdin.end();const [code]=await done;if(code)throw Error('FFmpeg render failed: '+code);console.log('Saved '+out+' · '+count+' frames');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
