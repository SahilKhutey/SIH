import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../socket';

export default function Thermal({ piBase }) {
  const canvasRef = useRef();
  const [palette, setPalette] = useState('jet');
  const paletteRef = useRef('jet');
  
  const [thermalStats, setThermalStats] = useState({
    min: 22.0,
    max: 24.0,
    avg: 23.0
  });

  const [hotspotLog, setHotspotLog] = useState([]);

  // Sync state to ref to avoid WebSocket event listener closure stale state
  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let lastLogTime = 0;

    const handleTelemetry = (msg) => {
      if (msg.type === 'thermal') {
        const matrix = msg.payload; // 2D array
        if (!matrix || matrix.length === 0) return;

        // 1. Calculate temperature stats
        let minTemp = 999;
        let maxTemp = -999;
        let sumTemp = 0;
        let count = 0;

        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            const val = matrix[r][c];
            if (val < minTemp) minTemp = val;
            if (val > maxTemp) maxTemp = val;
            sumTemp += val;
            count++;
          }
        }

        const avgTemp = sumTemp / count;
        setThermalStats({
          min: minTemp,
          max: maxTemp,
          avg: avgTemp
        });

        // 2. Log hotspots exceeding 35C (throttled to once every 3 seconds)
        const now = Date.now();
        if (maxTemp > 35.0 && now - lastLogTime > 3000) {
          lastLogTime = now;
          setHotspotLog(prev => [
            {
              id: Math.random().toString(36).substr(2, 9),
              ts: new Date().toLocaleTimeString(),
              temp: maxTemp
            },
            ...prev
          ].slice(0, 10)); // Keep last 10 entries
        }

        // 3. Render raw matrix onto canvas
        drawHeatmap(matrix);
      }
    };

    const drawHeatmap = (arr) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const w = 320;
      const h = 240;
      
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const image = ctx.createImageData(w, h);
      const rows = arr.length;
      const cols = arr[0].length;

      // Upsample grid matrix to canvas size
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const vy = Math.floor(y / (h / rows));
          const vx = Math.floor(x / (w / cols));
          
          // Safeguard boundaries
          const r = Math.min(rows - 1, Math.max(0, vy));
          const c = Math.min(cols - 1, Math.max(0, vx));
          const temp = arr[r][c];

          // Map Celsius to color spectrum depending on selected palette
          const color = tempToColor(temp, paletteRef.current);
          const idx = (y * w + x) * 4;

          image.data[idx] = color[0];     // Red
          image.data[idx + 1] = color[1]; // Green
          image.data[idx + 2] = color[2]; // Blue
          image.data[idx + 3] = 255;      // Alpha
        }
      }
      
      ctx.putImageData(image, 0, 0);
    };

    // Color mapping router
    const tempToColor = (t, pal) => {
      // Map range [20C, 45C] to [0, 1] float
      const minLimit = 20.0;
      const maxLimit = 45.0;
      let val = (t - minLimit) / (maxLimit - minLimit);
      val = Math.max(0.0, Math.min(1.0, val));

      if (pal === 'grayscale') {
        const v = Math.round(val * 255);
        return [v, v, v];
      } else if (pal === 'redhot') {
        const v = Math.round(val * 255);
        return [v, 0, 0];
      } else if (pal === 'inferno') {
        // Inferno/Ironbow approximation: Black -> Purple -> Orange -> Yellow
        const r = Math.max(0, Math.min(255, Math.round(val * 1.5 * 255)));
        const g = Math.max(0, Math.min(255, Math.round(Math.max(0, val - 0.4) * 1.6 * 255)));
        const b = Math.max(0, Math.min(255, Math.round(Math.max(0, 0.6 - Math.abs(val - 0.4)) * 255)));
        return [r, g, b];
      } else {
        // Standard JET RGB color algorithm
        const r = Math.max(0, Math.min(255, Math.round(255 * Math.min(4 * val - 1.5, -4 * val + 4.5))));
        const g = Math.max(0, Math.min(255, Math.round(255 * Math.min(4 * val - 0.5, -4 * val + 3.5))));
        const b = Math.max(0, Math.min(255, Math.round(255 * Math.min(4 * val + 0.5, -4 * val + 2.5))));
        return [r, g, b];
      }
    };

    socket.on('telemetry', handleTelemetry);

    return () => {
      socket.off('telemetry', handleTelemetry);
    };
  }, []);

  return (
    <div className="tactical-hud" style={{ color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
          🔥 Thermal Radiometry Matrix
        </h2>
        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
          Interfacing raw I2C radiometry pixels. Color spectrum maps 20°C (ambient) to 45°C+ (body temperature).
        </p>
      </header>

      {/* Alarm Banner if Max Temp > 35°C */}
      {thermalStats.max > 35.0 && (
        <div style={{
          background: 'rgba(255, 69, 0, 0.15)',
          border: '1px solid #ff4500',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'pulsate-border 1.5s infinite alternate',
          boxShadow: '0 0 10px rgba(255, 69, 0, 0.2)'
        }}>
          <span style={{ fontSize: '1.3rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 'bold', color: '#ff4500', fontSize: '0.95rem', textTransform: 'uppercase' }}>
              High Heat Source Detected
            </div>
            <div style={{ fontSize: '0.8rem', color: '#ccc' }}>
              Hotspot peak temperature measured at {thermalStats.max.toFixed(1)}°C. Triggering alarm logic.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Thermal Canvas Viewer */}
        <div className="hud-card" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: 0, textTransform: 'uppercase', color: '#ff7b00', fontSize: '0.85rem' }}>
              📹 Thermal Heatmap (320x240)
            </h4>
            
            {/* Color Palette Toggle Selector */}
            <select 
              value={palette} 
              onChange={(e) => setPalette(e.target.value)} 
              style={{
                background: '#222',
                border: '1px solid #444',
                color: '#fff',
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="jet">JET Spectrum</option>
              <option value="inferno">Inferno / Ironbow</option>
              <option value="grayscale">Grayscale</option>
              <option value="redhot">Red Hot</option>
            </select>
          </div>

          <canvas ref={canvasRef} style={{ border: '1px solid #222', borderRadius: '4px', display: 'block' }} />
        </div>

        {/* Sidebar Stats & History Logs */}
        <aside style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Temperature Numbers */}
          <div className="hud-card" style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}>
            <h4 style={{ margin: '0 0 12px 0', textTransform: 'uppercase', color: '#ff7b00', fontSize: '0.85rem' }}>
              📊 Radiometry Metrics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div style={{ padding: '10px 4px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Peak Max</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: thermalStats.max > 35.0 ? '#ff4500' : '#ffb300' }}>
                  {thermalStats.max.toFixed(1)}°C
                </div>
              </div>
              <div style={{ padding: '10px 4px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Minimum</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#00cdff' }}>
                  {thermalStats.min.toFixed(1)}°C
                </div>
              </div>
              <div style={{ padding: '10px 4px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ fontSize: '0.7rem', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Average</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#ccc' }}>
                  {thermalStats.avg.toFixed(1)}°C
                </div>
              </div>
            </div>
          </div>

          {/* Hotspot Detection History Log */}
          <div className="hud-card" style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '16px',
            flex: '1',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <h4 style={{ margin: '0 0 10px 0', textTransform: 'uppercase', color: '#ff7b00', fontSize: '0.85rem' }}>
              🚨 Hotspot Alert History log
            </h4>
            <div style={{
              flex: '1',
              maxHeight: '150px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              {hotspotLog.length === 0 ? (
                <div style={{ color: '#555', textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>
                  No hotspots recorded. Thermal sensors nominal.
                </div>
              ) : (
                hotspotLog.map((log) => (
                  <div 
                    key={log.id} 
                    style={{
                      background: '#181818',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      borderLeft: '3px solid #ff4500',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.8rem'
                    }}
                  >
                    <span style={{ color: '#ccc' }}>🔥 Trigger Event: <strong>{log.temp.toFixed(1)}°C</strong></span>
                    <span style={{ color: '#555', fontSize: '0.75rem' }}>{log.ts}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes pulsate-border {
          0% { border-color: rgba(255, 69, 0, 0.4); }
          100% { border-color: rgba(255, 69, 0, 1); }
        }
      `}</style>
    </div>
  );
}
