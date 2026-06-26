import React, {useRef, useEffect} from 'react';
export default function Overlay(){
  const videoRef = useRef();
  const canvasRef = useRef();
  useEffect(()=>{
    // For MJPEG: use <img> or hidden video and draw frames to canvas then overlay heatmap/radar.
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = 'http://<PI_IP>:5000/video_feed';
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    function draw(){
      if(img.complete){
        canvas.width = img.width || 640; canvas.height = img.height || 480;
        ctx.drawImage(img,0,0,canvas.width, canvas.height);
        // overlay example: simple translucent heatmap circle for demo
        ctx.fillStyle='rgba(255,0,0,0.2)';
        ctx.beginPath(); ctx.arc(canvas.width*0.7, canvas.height*0.4, 60,0,Math.PI*2); ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  },[]);
  return (
    <div>
      <h2>Overlay (Visible + Thermal + Radar)</h2>
      <canvas ref={canvasRef} style={{width:'100%', border:'1px solid #ccc'}}></canvas>
    </div>
  );
}
