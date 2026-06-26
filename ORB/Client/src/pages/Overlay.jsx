import React, { useRef, useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function Overlay({ piBase }) {
  const containerRef = useRef();
  const imageRef = useRef();
  const canvasRef = useRef();
  
  const [hudStats, setHudStats] = useState({
    threat: 0,
    radar_active: false,
    max_temp: 24.0,
    doppler_val: 0
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    let latestTelemetry = {
      radar: null,
      thermalMatrix: null,
      sensorData: null
    };

    // Listen for telemetry events
    const handleTelemetry = (msg) => {
      if (msg.type === 'radar') {
        latestTelemetry.radar = msg.payload;
        setHudStats(prev => ({
          ...prev,
          radar_active: msg.payload.motion
        }));
      }
      if (msg.type === 'thermal') {
        latestTelemetry.thermalMatrix = msg.payload;
      }
    };

    const handleSensorData = (data) => {
      latestTelemetry.sensorData = data;
      setHudStats(prev => ({
        ...prev,
        threat: data.threat,
        doppler_val: data.hb100,
        max_temp: data.thermal
      }));
    };

    socket.on('telemetry', handleTelemetry);
    socket.on('sensor_data', handleSensorData);

    // --- HUD OVERLAY ANIMATION LOOP ---
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');

    let animationId;
    let sweepLineX = 0;
    let crosshairPulse = 0;

    const renderOverlay = () => {
      // Clear previous overlays
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Rescale canvas to match image tag dimensions dynamically
      if (img && img.clientWidth > 0 && img.clientHeight > 0) {
        if (canvas.width !== img.clientWidth || canvas.height !== img.clientHeight) {
          canvas.width = img.clientWidth;
          canvas.height = img.clientHeight;
        }
      }

      const w = canvas.width;
      const h = canvas.height;

      if (w === 0 || h === 0) {
        animationId = requestAnimationFrame(renderOverlay);
        return;
      }

      // 1. Draw glowing corner HUD brackets
      ctx.strokeStyle = 'rgba(0, 240, 118, 0.7)';
      ctx.lineWidth = 2.5;
      const bl = 20; // bracket line length
      
      // Top-Left
      ctx.beginPath(); ctx.moveTo(bl, 10); ctx.lineTo(10, 10); ctx.lineTo(10, bl); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(w - bl, 10); ctx.lineTo(w - 10, 10); ctx.lineTo(w - 10, bl); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(bl, h - 10); ctx.lineTo(10, h - 10); ctx.lineTo(10, h - bl); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(w - bl, h - 10); ctx.lineTo(w - 10, h - 10); ctx.lineTo(w - 10, h - bl); ctx.stroke();

      // 2. Pulse factor for animation reticles
      crosshairPulse = (crosshairPulse + 0.08) % (Math.PI * 2);
      const pulseScale = 1.0 + 0.15 * np_sin_approx(crosshairPulse);

      // 3. Draw Thermal Hotspot Reticle
      if (latestTelemetry.thermalMatrix && latestTelemetry.thermalMatrix.length > 0) {
        const matrix = latestTelemetry.thermalMatrix;
        const rows = matrix.length;
        const cols = matrix[0].length;

        // Locate coordinate of maximum temperature hotspot
        let peakTemp = -999;
        let peakRow = 0;
        let peakCol = 0;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (matrix[r][c] > peakTemp) {
              peakTemp = matrix[r][c];
              peakRow = r;
              peakCol = c;
            }
          }
        }

        // Map grid coordinate to overlay pixel
        const tx = ((peakCol + 0.5) / cols) * w;
        const ty = ((peakRow + 0.5) / rows) * h;

        if (peakTemp > 30) {
          // Draw thermal hotspot reticle
          ctx.strokeStyle = peakTemp > 35 ? 'rgba(255, 69, 0, 0.95)' : 'rgba(255, 196, 0, 0.8)';
          ctx.lineWidth = 1.5;

          // Outter pulsing circle
          ctx.beginPath();
          ctx.arc(tx, ty, 20 * pulseScale, 0, Math.PI * 2);
          ctx.stroke();

          // Center target dot
          ctx.fillStyle = peakTemp > 35 ? 'rgba(255, 69, 0, 1)' : 'rgba(255, 196, 0, 1)';
          ctx.beginPath();
          ctx.arc(tx, ty, 3, 0, Math.PI * 2);
          ctx.fill();

          // Crosshairs lines
          const cl = 8; // crosshair line offset
          ctx.beginPath();
          ctx.moveTo(tx - 30, ty); ctx.lineTo(tx - cl, ty);
          ctx.moveTo(tx + cl, ty); ctx.lineTo(tx + 30, ty);
          ctx.moveTo(tx, ty - 30); ctx.lineTo(tx, ty - cl);
          ctx.moveTo(tx, ty + cl); ctx.lineTo(tx, ty + 30);
          ctx.stroke();

          // Label tag
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(tx + 35, ty - 18, 90, 24);
          ctx.strokeStyle = peakTemp > 35 ? 'rgba(255, 69, 0, 0.8)' : 'rgba(255, 196, 0, 0.8)';
          ctx.strokeRect(tx + 35, ty - 18, 90, 24);

          ctx.fillStyle = '#fff';
          ctx.font = '10px monospace';
          ctx.fillText(`HOTSPOT: ${peakTemp.toFixed(1)}°C`, tx + 40, ty - 2);
        }
      }

      // 4. Draw Doppler Radar Target Acquisition Banner
      if (latestTelemetry.radar && latestTelemetry.radar.motion && latestTelemetry.radar.distance_m > 0) {
        // Place radar alert box at top-center of view
        const radarBoxW = 200;
        const radarBoxH = 50;
        const rx = w / 2 - radarBoxW / 2;
        const ry = 20;

        ctx.fillStyle = 'rgba(0, 240, 118, 0.08)';
        ctx.fillRect(rx, ry, radarBoxW, radarBoxH);
        ctx.strokeStyle = 'rgba(0, 240, 118, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, radarBoxW, radarBoxH);

        // Pulsing warning text
        ctx.fillStyle = `rgba(0, 240, 118, ${0.6 + 0.4 * np_sin_approx(crosshairPulse * 2.0)})`;
        ctx.font = 'bold 10px monospace';
        ctx.fillText('📡 DOPPLER RADAR ACQUISITION', rx + 12, ry + 18);
        ctx.fillStyle = '#ccc';
        ctx.font = '9px monospace';
        ctx.fillText(`RANGE: ${latestTelemetry.radar.distance_m.toFixed(2)}m  DIR: ${latestTelemetry.radar.angle}°`, rx + 12, ry + 36);
      }

      // 5. HUD Scan Line overlay effect
      sweepLineX = (sweepLineX + 2) % w;
      ctx.strokeStyle = 'rgba(0, 240, 118, 0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sweepLineX, 10);
      ctx.lineTo(sweepLineX, h - 10);
      ctx.stroke();

      animationId = requestAnimationFrame(renderOverlay);
    };

    // Helper for fast sinus calculations without Math library overhead
    const np_sin_approx = (x) => {
      return Math.sin(x);
    };

    renderOverlay();

    return () => {
      socket.off('telemetry', handleTelemetry);
      socket.off('sensor_data', handleSensorData);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="tactical-hud" style={{ color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
          👁️ Target Acquisition Overlay
        </h2>
        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
          Real-time visible camera stream overlaid with vector-mapped thermal hotspots and Doppler radar coordinates.
        </p>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Stream container with absolute layers */}
        <div style={{ flex: '2', minWidth: '450px' }}>
          <div ref={containerRef} style={{
            position: 'relative',
            width: '100%',
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}>
            {/* HTML video feed stream */}
            <img 
              ref={imageRef}
              alt="Video Stream" 
              src={`${piBase}/video_feed`} 
              style={{ width: '100%', display: 'block' }}
            />
            {/* Canvas overlay layer */}
            <canvas 
              ref={canvasRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>

        {/* HUD Data panel stats */}
        <aside style={{ flex: '1', minWidth: '280px' }}>
          <div className="hud-card" style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '16px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h4 style={{ margin: '0 0 4px 0', textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem' }}>
              📊 Target Parameters HUD
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>Threat Score</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: hudStats.threat > 50 ? '#ff0055' : '#00f076' }}>
                  {hudStats.threat}% ({hudStats.threat > 50 ? 'WARNING' : 'SECURE'})
                </div>
              </div>

              <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>Doppler Amplitude</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: hudStats.doppler_val > 500 ? '#ff7b00' : '#888' }}>
                  {hudStats.doppler_val} / 1023 {hudStats.doppler_val > 500 ? '(MOTION SPIKE)' : '(Idle)'}
                </div>
              </div>

              <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>Peak Thermal Temp</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: hudStats.max_temp > 35 ? '#ff4500' : '#888' }}>
                  {hudStats.max_temp.toFixed(1)}°C {hudStats.max_temp > 35 ? '(HOTSPOT TRIGGER)' : '(Ambient)'}
                </div>
              </div>

              <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>Doppler Status</div>
                <div style={{ fontWeight: 'bold', color: hudStats.radar_active ? '#ffb300' : '#888' }}>
                  {hudStats.radar_active ? 'TARGET LOCKED' : 'SEARCHING'}
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.75rem', color: '#555', lineHeight: '1.4' }}>
              * Thermal hotspot coordinates are derived from the 2D grid matrix telemetry and mapped onto the visible stream. Bounding boxes are processed inside the server and streamed as frames.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
