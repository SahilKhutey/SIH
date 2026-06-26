import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import SystemInfo from './pages/SystemInfo';
import VideoOnly from './pages/VideoOnly';
import Thermal from './pages/Thermal';
import Microwave from './pages/Microwave';
import Overlay from './pages/Overlay';

function App(){
  return (
    <BrowserRouter>
      <div style={{display:'flex', height:'100vh'}}>
        <nav style={{width:220, padding:16, borderRight:'1px solid #ddd'}}>
          <h3>Device</h3>
          <ul style={{listStyle:'none', padding:0}}>
            <li><Link to="/system">System Info</Link></li>
            <li><Link to="/video">Video Only</Link></li>
            <li><Link to="/thermal">Thermal Feed</Link></li>
            <li><Link to="/microwave">Microwave Feed</Link></li>
            <li><Link to="/overlay">Overlay</Link></li>
          </ul>
        </nav>
        <main style={{flex:1, padding:12}}>
          <Routes>
            <Route path="/system" element={<SystemInfo/>}/>
            <Route path="/video" element={<VideoOnly/>}/>
            <Route path="/thermal" element={<Thermal/>}/>
            <Route path="/microwave" element={<Microwave/>}/>
            <Route path="/overlay" element={<Overlay/>}/>
            <Route index element={<VideoOnly/>}/>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
export default App;
