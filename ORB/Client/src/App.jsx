import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import SystemInfo from './pages/SystemInfo';
import VideoOnly from './pages/VideoOnly';
import Thermal from './pages/Thermal';
import Microwave from './pages/Microwave';
import Overlay from './pages/Overlay';
import { connectSocket } from './socket';

const PI_BASE = 'http://<PI_IP>:5000'; // <<-- replace <PI_IP> with Raspberry Pi LAN IP

export default function App(){
  useEffect(()=>{
    connectSocket(PI_BASE);
  }, []);
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <img src="/1.jpg" alt="sketch" style={{width:'100%', marginBottom:10}}/>
          <ul>
            <li><Link to="/system">System Info</Link></li>
            <li><Link to="/video">Video Only</Link></li>
            <li><Link to="/thermal">Thermal Feed</Link></li>
            <li><Link to="/microwave">Microwave Feed</Link></li>
            <li><Link to="/overlay">Overlay</Link></li>
          </ul>
        </nav>
        <main className="main">
          <Routes>
            <Route path="/system" element={<SystemInfo piBase={PI_BASE}/>}/>
            <Route path="/video" element={<VideoOnly piBase={PI_BASE}/>}/>
            <Route path="/thermal" element={<Thermal piBase={PI_BASE}/>}/>
            <Route path="/microwave" element={<Microwave piBase={PI_BASE}/>}/>
            <Route path="/overlay" element={<Overlay piBase={PI_BASE}/>}/>
            <Route index element={<VideoOnly piBase={PI_BASE}/>}/>
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
