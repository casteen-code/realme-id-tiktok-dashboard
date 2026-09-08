const fs=require('node:fs'),path=require('node:path');
const Engine=require('../src/engine.js');
const root=path.resolve(__dirname,'..');
function loadProject(filename){
  const p=JSON.parse(fs.readFileSync(filename,'utf8'));
  const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm'};
  for(const a of Object.values(p.assets||{})){
    if(a.src.startsWith('data:'))continue;
    const local=path.resolve(root,a.src);
    if(!local.startsWith(root+path.sep))throw Error('Asset path must be inside the project');
    const mime=types[path.extname(local).toLowerCase()];if(!mime)throw Error('Unsupported asset: '+a.src);
    a.src='data:'+mime+';base64,'+fs.readFileSync(local).toString('base64');
  }
  return Engine.normalize(p);
}
module.exports={loadProject,root};
