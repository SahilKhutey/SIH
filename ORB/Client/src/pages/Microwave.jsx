import React, { useRef, useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function Microwave() {
  const radarCanvasRef = useRef();
  const waveCanvasRef = useRef();
  
  const [radarStats, setRadarStats] = useState({
    distance_m: 0.0,
    angle: 0,
    strength: 0.0,
    motion: false
  });
  const [rawHbValue, setRawHbValue] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // --- State variables for canvas drawing (preserved in closure) ---
    let currentSweepAngle = 0;
    let targetHistory = []; // array of { angle, distance_m, alpha, ts }
    let hb100History = Array(100).fill(50); // baseline ambient noise array

    // Listen for radar sweep targets
    const handleRadarTelemetry = (msg) => {
      if (msg.type === 'radar') {
        const payload = msg.payload;
        setRadarStats(payload);
        
        // If motion is detected, add target trace
        if (payload.motion && payload.distance_m > 0) {
          targetHistory.push({
            angle: payload.angle,
            distance_m: payload.distance_m,
            alpha: 1.0,
            ts: Date.now()
          });
          // Limit trails size
          if (targetHistory.length > 10) targetHistory.shift();
        }
      }
    };

    // Listen for raw Doppler shift ADC spikes
    const handleSensorData = (data) => {
      setRawHbValue(data.hb100);
      hb100History.push(data.hb100);
      if (hb100History.length > 100) hb100History.shift();
    };

    socket.on('telemetry', handleRadarTelemetry);
    socket.on('sensor_data', handleSensorData);

    // --- OSCILLOSCOPE SWEEP & SCROLL WAVE DRAWING LOOP ---
    const radarCanvas = radarCanvasRef.current;
    const waveCanvas = waveCanvasRef.current;
    const rCtx = radarCanvas.getContext('2d');
    const wCtx = waveCanvas.getContext('2d');

    radarCanvas.width = 400;
    radarCanvas.height = 400;
    waveCanvas.width = 500;
    waveCanvas.height = 400;

    let animationId;
    
    const draw = () => {
      // ----------------------------------------------------
      // DRAW RADAR SCOPE
      // ----------------------------------------------------
      rCtx.fillStyle = '#0a0a0a';
      rCtx.fillRect(0, 0, radarCanvas.width, radarCanvas.height);

      const cx = radarCanvas.width / 2;
      const cy = radarCanvas.height / 2;
      const rMax = Math.min(cx, cy) - 20;

      // Draw radar grid rings
      rCtx.strokeStyle = 'rgba(0, 240, 118, 0.25)';
      rCtx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        rCtx.beginPath();
        rCtx.arc(cx, cy, (i / 4) * rMax, 0, Math.PI * 2);
        rCtx.stroke();
        
        // Ring distance labels
        rCtx.fillStyle = 'rgba(0, 240, 118, 0.5)';
        rCtx.font = '10px monospace';
        rCtx.fillText(`${(i * 2)}m`, cx + (i / 4) * rMax - 12, cy - 4);
      }

      // Draw crosshairs
      rCtx.beginPath();
      rCtx.moveTo(cx - rMax, cy); rCtx.lineTo(cx + rMax, cy);
      rCtx.moveTo(cx, cy - rMax); rCtx.lineTo(cx, cy + rMax);
      rCtx.stroke();

      // Draw angle markers
      rCtx.fillStyle = 'rgba(0, 240, 118, 0.7)';
      rCtx.font = '10px monospace';
      rCtx.fillText('N (0°)', cx - 18, cy - rMax - 6);
      rCtx.fillText('E (90°)', cx + rMax + 4, cy + 4);
      rCtx.fillText('S (180°)', cx - 20, cy + rMax + 14);
      rCtx.fillText('W (270°)', cx - rMax - 45, cy + 4);

      // Draw sweep beam line
      rCtx.save();
      rCtx.translate(cx, cy);
      rCtx.rotate((currentSweepAngle * Math.PI) / 180);
      
      // Sweep beam glow gradient
      const gradient = rCtx.createLinearGradient(0, 0, rMax, 0);
      gradient.addColorStop(0, 'rgba(0, 240, 118, 0)');
      gradient.addColorStop(0.8, 'rgba(0, 240, 118, 0.15)');
      gradient.addColorStop(1, 'rgba(0, 240, 118, 0.8)');
      
      rCtx.strokeStyle = gradient;
      rCtx.lineWidth = 3;
      rCtx.beginPath();
      rCtx.moveTo(0, 0);
      rCtx.lineTo(rMax, 0);
      rCtx.stroke();
      rCtx.restore();

      // Draw target traces (with alpha decay)
      targetHistory.forEach((target, index) => {
        const rad = (target.distance_m / 8.0) * rMax;
        const angleRad = (target.angle * Math.PI) / 180;
        const tx = cx + rad * Math.cos(angleRad);
        const ty = cy + rad * Math.sin(angleRad);

        // Draw targets
        rCtx.beginPath();
        rCtx.arc(tx, ty, 8, 0, Math.PI * 2);
        rCtx.fillStyle = `rgba(255, 69, 0, ${target.alpha})`;
        rCtx.shadowBlur = 15;
        rCtx.shadowColor = 'rgba(255, 69, 0, 0.8)';
        rCtx.fill();
        rCtx.shadowBlur = 0; // reset

        // Draw concentric ripple ring around target
        rCtx.strokeStyle = `rgba(255, 69, 0, ${target.alpha * 0.4})`;
        rCtx.beginPath();
        rCtx.arc(tx, ty, 16 - target.alpha * 8, 0, Math.PI * 2);
        rCtx.stroke();

        // Decay alpha
        target.alpha -= 0.008;
      });

      // Filter out dead targets
      targetHistory = targetHistory.filter((t) => t.alpha > 0);

      // Increment angle
      currentSweepAngle = (currentSweepAngle + 2) % 360;

      // ----------------------------------------------------
      // DRAW DOPPLER SCROLL WAVE GRAPH
      // ----------------------------------------------------
      wCtx.fillStyle = '#0a0a0a';
      wCtx.fillRect(0, 0, waveCanvas.width, waveCanvas.height);

      // Draw grid
      wCtx.strokeStyle = 'rgba(0, 240, 118, 0.1)';
      wCtx.lineWidth = 1;
      for (let i = 40; i < waveCanvas.width; i += 40) {
        wCtx.beginPath(); wCtx.moveTo(i, 0); wCtx.lineTo(i, waveCanvas.height); wCtx.stroke();
      }
      for (let i = 40; i < waveCanvas.height; i += 40) {
        wCtx.beginPath(); wCtx.moveTo(0, i); wCtx.lineTo(waveCanvas.width, i); wCtx.stroke();
      }

      // Draw threshold line (ADC 500 threshold, flipped: 0 is top, 1023 is bottom)
      const thresholdY = waveCanvas.height - (500 / 1023) * (waveCanvas.height - 40) - 20;
      wCtx.strokeStyle = 'rgba(255, 0, 85, 0.6)';
      wCtx.lineWidth = 2;
      wCtx.setLineDash([4, 4]);
      wCtx.beginPath();
      wCtx.moveTo(0, thresholdY);
      wCtx.lineTo(waveCanvas.width, thresholdY);
      wCtx.stroke();
      wCtx.setLineDash([]); // reset

      wCtx.fillStyle = 'rgba(255, 0, 85, 0.8)';
      wCtx.font = '10px monospace';
      wCtx.fillText('THRESHOLD (500)', 8, thresholdY - 4);

      // Draw Doppler shift frequency line
      wCtx.strokeStyle = '#00f076';
      wCtx.lineWidth = 2.5;
      wCtx.shadowBlur = 6;
      wCtx.shadowColor = '#00f076';
      wCtx.beginPath();

      const step = waveCanvas.width / 99;
      for (let i = 0; i < hb100History.length; i++) {
        // Map 0-1023 to canvas height leaving margins
        const val = hb100History[i];
        const y = waveCanvas.height - (val / 1023) * (waveCanvas.height - 60) - 30;
        const x = i * step;

        if (i === 0) {
          wCtx.moveTo(x, y);
        } else {
          wCtx.lineTo(x, y);
        }
      }
      wCtx.stroke();
      wCtx.shadowBlur = 0; // reset

      // Draw gradient under area
      wCtx.fillStyle = 'rgba(0, 240, 118, 0.03)';
      wCtx.lineTo((hb100History.length - 1) * step, waveCanvas.height);
      wCtx.lineTo(0, waveCanvas.height);
      wCtx.closePath();
      wCtx.fill();

      // Heading label
      wCtx.fillStyle = '#00f076';
      wCtx.font = '11px monospace';
      wCtx.fillText('HB-100 DOPPLER FREQUENCY SHIFT AMPLITUDE', 12, 20);

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      socket.off('telemetry', handleRadarTelemetry);
      socket.off('sensor_data', handleSensorData);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="tactical-hud" style={{ color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
          📻 Doppler Microwave Radar Console
        </h2>
        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
          Interfacing Doppler shift frequency values (MCP3008 ADC) fused with sweeping targets.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Radar Scope Scope */}
        <div className="hud-card" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem' }}>
            🛰️ Doppler Sonar Radar Sweep
          </h4>
          <canvas ref={radarCanvasRef} style={{ borderRadius: '50%', border: '1px solid #222' }} />
        </div>

        {/* Doppler Scrolling Wave */}
        <div className="hud-card" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          flex: '1',
          minWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem' }}>
            📈 Live Doppler shift (100 Cycle Trace)
          </h4>
          <canvas ref={waveCanvasRef} style={{ border: '1px solid #222', borderRadius: '4px', flex: '1' }} />
        </div>
      </div>

      {/* Info Status Grid */}
      <footer style={{
        marginTop: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        <div style={{ padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>System Status</div>
          <div style={{ fontWeight: 'bold', color: '#00f076' }}>ONLINE / SWEEPING</div>
        </div>

        <div style={{ padding: '12px', background: '#111', border: '3px solid #111', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Raw ADC Voltage</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: rawHbValue > 500 ? '#ff0055' : '#ccc' }}>
            {rawHbValue} / 1023
          </div>
        </div>

        <div style={{ padding: '12px', background: '#111', border: '3px solid #111', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Detected Distance</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: radarStats.motion ? '#ff7b00' : '#888' }}>
            {radarStats.motion ? `${radarStats.distance_m.toFixed(2)} m` : '—'}
          </div>
        </div>

        <div style={{ padding: '12px', background: '#111', border: '3px solid #111', borderRadius: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Sweep Angle</div>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: radarStats.motion ? '#ffb300' : '#888' }}>
            {radarStats.motion ? `${radarStats.angle}°` : '—'}
          </div>
        </div>
      </footer>
    </div>
  );
}
