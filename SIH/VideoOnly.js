import React from 'react';
export default function VideoOnly(){
  return (
    <div style={{display:'flex', gap:12, height:'100%'}}>
      <div style={{flex:2}}>
        <h2>Live Video</h2>
        <img alt="video" src="http://<PI_IP>:5000/video_feed" style={{width:'100%', border:'1px solid #ccc'}}/>
      </div>
      <aside style={{width:320, padding:12, borderLeft:'1px solid #eee'}}>
        <h3>Data Panel</h3>
        <p>Accuracy: <b>—</b></p>
        <p>Warnings:<br/>—</p>
        <p>Location: —</p>
        <p>Backup: —</p>
        <div id="alerts"></div>
      </aside>
    </div>
  );
}
