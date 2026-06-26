import React, {useEffect, useRef} from 'react';
export default function Thermal(){
  const canvasRef = useRef();
  useEffect(()=>{
    // If you have MJPEG thermal stream:
    // show video stream (img tag) or receive thermal matrix via WS and draw heatmap onto canvas.
    const ws = new WebSocket('ws://<PI_IP>:5000/socket.io/?EIO=4'); // or use socket.io-client
    ws.onmessage = e => {
      try{
        const data = JSON.parse(e.data);
        if(data.type === 'thermal'){
          const arr = data.payload; // 2d array
          drawHeatmap(arr);
        }
      }catch(e){}
    };
    function drawHeatmap(arr){
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      const h = 240, w=320;
      canvas.width = w; canvas.height = h;
      const img = ctx.createImageData(w,h);
      // simple upsample arr -> image
      for(let y=0;y<h;y++){
        for(let x=0;x<w;x++){
          const val = arr[Math.floor(y/ (h/arr.length))]?.[Math.floor(x/(w/arr[0].length))] ?? 20;
          const color = tempToRGB(val);
          const idx = (y*w + x)*4;
          img.data[idx] = color[0];
          img.data[idx+1] = color[1];
          img.data[idx+2] = color[2];
          img.data[idx+3] = 255;
        }
      }
      ctx.putImageData(img,0,0);
    }
    function tempToRGB(t){
      // map 0-100 -> blue->red
      const v = Math.max(0, Math.min(100, (t-10)));
      const r = Math.min(255, Math.round((v/100)*255));
      const b = 255 - r;
      return [r, 0, b];
    }
    return ()=> ws.close();
  },[]);
  return (
    <div style={{display:'flex', gap:12}}>
      <div style={{flex:1}}>
        <h2>Thermal Feed</h2>
        <canvas ref={canvasRef} style={{width:'100%', border:'1px solid #ccc'}}></canvas>
      </div>
      <aside style={{width:300, padding:12}}>
        <h4>Thermal Details</h4>
        <p>Min / Max / Alerts</p>
      </aside>
    </div>
  );
}
