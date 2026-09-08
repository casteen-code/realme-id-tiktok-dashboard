const fs=require('node:fs'),path=require('node:path');
const {loadProject,root}=require('./project.cjs');
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const source=path.resolve(option('--project',path.join(root,'examples/realme-99.campaign.json')));
const out=path.resolve(option('--out',path.join(root,'index.html')));
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
function build(project){
  const pieces={__STYLES__:read('src/styles.css'),__PROJECT__:JSON.stringify(project).replace(/</g,'\\u003c'),__ENGINE__:read('src/engine.js'),__CUTOUT__:read('src/cutout.js'),__CUTOUT_UI__:read('src/cutout-ui.js'),__MP4__:read('src/mp4.js'),__EDITOR__:read('src/editor.js')};
  return read('src/editor.html').replace(/__STYLES__|__PROJECT__|__ENGINE__|__CUTOUT_UI__|__CUTOUT__|__MP4__|__EDITOR__/g,key=>pieces[key]);
}
if(require.main===module){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,build(loadProject(source)));console.log('Built '+out+' ('+fs.statSync(out).size+' bytes)');}
module.exports={build};
