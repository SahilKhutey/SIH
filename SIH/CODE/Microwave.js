import React, {useRef, useEffect} from 'react';
export default function Microwave(){
  const canvasRef = useRef();
  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 500; canvas.height = 400;
    const socket = new WebSocket('ws://<PI_IP>:5000'); // use same ws as server
    socket.onmessage = e => {
      const d = JSON.parse(e.data);
      if(d.type === 'radar'){
        drawRadar(d.payload);
      }
    };
    function drawRadar(p){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // draw concentric rings
      const cx = canvas.width/2, cy = canvas.height/2;
      for(let i=0;i<5;i++){
        ctx.beginPath(); ctx.arc(cx,cy, (i+1)*30, 0, Math.PI*2); ctx.strokeStyle='#444'; ctx.stroke();
      }
      // mark target
      const rad = p.distance / 8.0 * (5*30); // scale
      const angle = p.angle * Math.PI/180;
      const tx = cx + rad*Math.cos(angle);
      const ty = cy + rad*Math.sin(angle);
      ctx.beginPath(); ctx.arc(tx,ty,6,0,Math.PI*2); ctx.fillStyle='red'; ctx.fill();
    }
    return ()=> socket.close();
  },[]);
  return (
    <div style={{display:'flex', gap:12}}>
      <div style={{flex:1}}>
        <h2>Microwave / Radar</h2>
        <canvas ref={canvasRef} style={{width:'100%', border:'1px solid #ccc'}}></canvas>
      </div>
      <aside style={{width:300, padding:12}}>
        <h4>Radar Info</h4>
        <p>Distance: —</p>
        <p>Angle: —</p>
      </aside>
    </div>
  );
}
