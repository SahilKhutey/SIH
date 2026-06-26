import React, { useEffect, useState } from 'react';
import { getSocket } from '../socket';

export default function VideoOnly({ piBase }) {
  const [sensorData, setSensorData] = useState({
    hb100: 0,
    pir: 0,
    thermal: 24,
    camera: 0,
    threat: 0
  });

  // Persistent alerts state loaded directly from browser's localStorage
  const [alerts, setAlerts] = useState(() => {
    try {
      const cached = localStorage.getItem('orb_alerts_log');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  // Sync alerts to localStorage on updates
  useEffect(() => {
    localStorage.setItem('orb_alerts_log', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Listen for real-time blueprint sensor data
    const handleSensorData = (data) => {
      setSensorData(data);
    };

    // Listen for security alert warnings
    const handleAlert = (msg) => {
      setAlerts((prev) => [
        {
          id: Math.random().toString(36).substr(2, 9),
          ts: new Date(msg.ts * 1000).toLocaleTimeString(),
          level: msg.level || 'warning',
          msg: msg.msg
        },
        ...prev
      ].slice(0, 50)); // Keep last 50 entries in persistent storage
    };

    socket.on('sensor_data', handleSensorData);
    socket.on('telemetry', (msg) => {
      if (msg.type === 'alert') {
        handleAlert(msg.payload);
      }
    });

    return () => {
      socket.off('sensor_data', handleSensorData);
      socket.off('telemetry');
    };
  }, []);

  const handleClearLogs = () => {
    setAlerts([]);
  };

  // Determine threat parameters based on score
  const getThreatAttributes = (score) => {
    if (score <= 25) {
      return {
        label: 'Low Threat',
        color: '#00f076',
        gradient: 'linear-gradient(90deg, #00f076, #00cdff)',
        glow: 'rgba(0, 240, 118, 0.4)'
      };
    } else if (score <= 50) {
      return {
        label: 'Moderate Threat',
        color: '#ffc400',
        gradient: 'linear-gradient(90deg, #ffe600, #ffb300)',
        glow: 'rgba(255, 196, 0, 0.4)'
      };
    } else if (score <= 75) {
      return {
        label: 'High Threat',
        color: '#ff6c00',
        gradient: 'linear-gradient(90deg, #ff7b00, #ff4500)',
        glow: 'rgba(255, 108, 0, 0.4)'
      };
    } else {
      return {
        label: 'Critical Threat',
        color: '#ff0055',
        gradient: 'linear-gradient(90deg, #ff0055, #ff0000)',
        glow: 'rgba(255, 0, 85, 0.5)'
      };
    }
  };

  const threatAttr = getThreatAttributes(sensorData.threat);

  return (
    <div className="tactical-hud" style={{ color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header Threat Level Score HUD */}
      <header className="hud-threat-header" style={{
        background: '#141414',
        padding: '16px 20px',
        borderRadius: '8px',
        border: `1px solid ${sensorData.threat > 0 ? threatAttr.color : '#333'}`,
        boxShadow: `0 4px 15px ${sensorData.threat > 0 ? threatAttr.glow : 'rgba(0,0,0,0.5)'}`,
        marginBottom: '20px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            System Threat Level Score
          </h3>
          <span style={{
            color: threatAttr.color,
            fontWeight: 'bold',
            fontSize: '1.2rem',
            textShadow: `0 0 8px ${threatAttr.color}`
          }}>
            {threatAttr.label} ({sensorData.threat}%)
          </span>
        </div>

        {/* Dynamic score-colored threat bar */}
        <div style={{
          height: '14px',
          width: '100%',
          background: '#222',
          borderRadius: '7px',
          overflow: 'hidden',
          border: '1px solid #444'
        }}>
          <div style={{
            width: `${sensorData.threat}%`,
            height: '100%',
            background: threatAttr.gradient,
            borderRadius: '7px',
            boxShadow: `0 0 10px ${threatAttr.color}`,
            transition: 'width 0.4s cubic-bezier(0.1, 0.8, 0.1, 1)'
          }} />
        </div>
      </header>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* Live Camera Streams Box */}
        <div style={{ flex: '2', minWidth: '450px' }}>
          <div className="hud-card" style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '10px 14px', background: '#1c1c1c', borderBottom: '1px solid #333' }}>
              <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.9rem', color: '#888' }}>
                🟢 Real-Time Surveillance Stitch Feed
              </h4>
            </div>
            
            {/* Main Video Stream */}
            <img 
              alt="Live Video Feed" 
              src={`${piBase}/video_feed`} 
              style={{ width: '100%', display: 'block', borderBottom: '1px solid #333' }}
            />

            <div style={{ display: 'flex', padding: '12px', gap: '12px' }}>
              {/* Thermal thumbnail */}
              <div style={{ position: 'relative', width: '200px' }}>
                <img 
                  src={`${piBase}/thermal_feed`} 
                  alt="Thermal Stream" 
                  style={{ width: '100%', borderRadius: '4px', border: '1px solid #444', display: 'block' }}
                />
                <span style={{
                  position: 'absolute',
                  bottom: '6px',
                  left: '6px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '2px 6px',
                  fontSize: '0.65rem',
                  borderRadius: '2px',
                  textTransform: 'uppercase'
                }}>
                  Thermal HUD
                </span>
              </div>

              {/* Data Panel metrics */}
              <div style={{ flex: '1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ padding: '8px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                    <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>HB-100 Radar</div>
                    <div style={{ fontWeight: 'bold', color: sensorData.hb100 > 500 ? '#ff7b00' : '#888' }}>
                      {sensorData.hb100 > 500 ? `Motion (${sensorData.hb100})` : `Idle (${sensorData.hb100})`}
                    </div>
                  </div>
                  
                  <div style={{ padding: '8px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                    <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>PIR State</div>
                    <div style={{ fontWeight: 'bold', color: sensorData.pir ? '#ffb300' : '#888' }}>
                      {sensorData.pir ? 'Presence Detected' : 'Quiet'}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                    <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>Thermal Max</div>
                    <div style={{ fontWeight: 'bold', color: sensorData.thermal > 35 ? '#ff4500' : '#888' }}>
                      {sensorData.thermal}°C {sensorData.thermal > 35 ? '(HOTSPOT)' : '(Normal)'}
                    </div>
                  </div>

                  <div style={{ padding: '8px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                    <div style={{ color: '#666', fontSize: '0.75rem', textTransform: 'uppercase' }}>YOLO Tracking</div>
                    <div style={{ fontWeight: 'bold', color: sensorData.camera ? '#ff0055' : '#888' }}>
                      {sensorData.camera ? 'Human Target' : 'No human'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Alerts Side-Log */}
        <aside style={{ flex: '1', minWidth: '300px' }}>
          <div className="hud-card" style={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '10px 14px',
              background: '#1c1c1c',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, textTransform: 'uppercase', fontSize: '0.9rem', color: '#888' }}>
                🚨 Threat Alerts Activity Log
              </h4>
              <button onClick={handleClearLogs} style={{
                background: 'rgba(255, 69, 0, 0.12)',
                border: '1px solid #ff4500',
                color: '#ff4500',
                fontSize: '0.7rem',
                padding: '3px 8px',
                borderRadius: '3px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                fontWeight: 'bold',
                transition: 'all 0.2s ease'
              }}>Clear</button>
            </div>

            <div style={{
              flex: '1',
              padding: '12px',
              overflowY: 'auto',
              maxHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {alerts.length === 0 ? (
                <div style={{ color: '#555', textAlign: 'center', marginTop: '20px', fontSize: '0.9rem' }}>
                  No warnings active. Surveillance quiet.
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    style={{
                      background: '#181818',
                      padding: '10px 12px',
                      borderRadius: '4px',
                      borderLeft: `3px solid ${alert.level === 'danger' ? '#ff0055' : '#ffc400'}`,
                      fontSize: '0.85rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        color: alert.level === 'danger' ? '#ff0055' : '#ffc400',
                        fontWeight: 'bold',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase'
                      }}>
                        {alert.level}
                      </span>
                      <span style={{ color: '#555', fontSize: '0.75rem' }}>{alert.ts}</span>
                    </div>
                    <div style={{ color: '#ccc' }}>{alert.msg}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
        
      </div>
    </div>
  );
}
