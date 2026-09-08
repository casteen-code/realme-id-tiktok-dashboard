/* Minimal AVC MP4 muxer for the editor's deterministic 150-frame browser export. */
(function(root){
  const u8=(...v)=>new Uint8Array(v);
  const u16=n=>u8(n>>>8,n&255);
  const u32=n=>u8(n>>>24,(n>>>16)&255,(n>>>8)&255,n&255);
  const str=s=>new TextEncoder().encode(s);
  const zeros=n=>new Uint8Array(n);
  const cat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
  const box=(name,...data)=>{const body=cat(...data);return cat(u32(body.length+8),str(name),body);};
  const full=(name,version,flags,...data)=>box(name,u8(version,(flags>>>16)&255,(flags>>>8)&255,flags&255),...data);
  const matrix=cat(u32(0x10000),u32(0),u32(0),u32(0),u32(0x10000),u32(0),u32(0),u32(0),u32(0x40000000));
  root.makeAvcMp4=function(samples,description,width,height,fps){
    if(!samples.length||!description)throw Error('没有收到有效视频帧');
    const timescale=90000,delta=timescale/fps,duration=samples.length*delta;
    const ftyp=box('ftyp',str('isom'),u32(0x200),str('isomiso2avc1mp41'));
    const mvhd=full('mvhd',0,0,u32(0),u32(0),u32(timescale),u32(duration),u32(0x10000),u16(0x100),zeros(10),matrix,zeros(24),u32(2));
    const tkhd=full('tkhd',0,7,u32(0),u32(0),u32(1),u32(0),u32(duration),zeros(8),u16(0),u16(0),u16(0),u16(0),matrix,u32(width*65536),u32(height*65536));
    const mdhd=full('mdhd',0,0,u32(0),u32(0),u32(timescale),u32(duration),u16(0x55c4),u16(0));
    const hdlr=full('hdlr',0,0,u32(0),str('vide'),zeros(12),str('VideoHandler\0'));
    const vmhd=full('vmhd',0,1,u16(0),zeros(6));
    const dinf=box('dinf',full('dref',0,0,u32(1),full('url ',0,1)));
    const avc1=box('avc1',zeros(6),u16(1),zeros(16),u16(width),u16(height),u32(0x480000),u32(0x480000),u32(0),u16(1),zeros(32),u16(0x18),u16(0xffff),box('avcC',new Uint8Array(description)));
    const stsd=full('stsd',0,0,u32(1),avc1);
    const stts=full('stts',0,0,u32(1),u32(samples.length),u32(delta));
    const stsc=full('stsc',0,0,u32(1),u32(1),u32(samples.length),u32(1));
    const stsz=full('stsz',0,0,u32(0),u32(samples.length),...samples.map(s=>u32(s.data.length)));
    const keys=samples.map((s,i)=>s.key?i+1:0).filter(Boolean);
    const stss=full('stss',0,0,u32(keys.length),...keys.map(u32));
    function moov(offset){
      const stco=full('stco',0,0,u32(1),u32(offset));
      const stbl=box('stbl',stsd,stts,stsc,stsz,stss,stco);
      return box('moov',mvhd,box('trak',tkhd,box('mdia',mdhd,hdlr,box('minf',vmhd,dinf,stbl))));
    }
    const header=moov(ftyp.length+moov(0).length+8);
    return new Blob([ftyp,header,box('mdat',...samples.map(s=>s.data))],{type:'video/mp4'});
  };
})(globalThis);
