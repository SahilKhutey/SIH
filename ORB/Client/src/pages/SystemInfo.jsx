import React, { useEffect, useState } from 'react';

export default function SystemInfo({ piBase }) {
  const [systemStats, setSystemStats] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Fetch system statistics and logs
  const fetchData = () => {
    // 1. Fetch system health metrics
    fetch(`${piBase}/api/system`)
      .then((r) => r.json())
      .then(setSystemStats)
      .catch((err) => console.error('Error fetching system stats:', err));

    // 2. Fetch recent database log entries
    setLoadingLogs(true);
    fetch(`${piBase}/api/logs`)
      .then((r) => r.json())
      .then((data) => {
        setLogEntries(data);
        setLoadingLogs(false);
      })
      .catch((err) => {
        console.error('Error fetching logs:', err);
        setLoadingLogs(false);
      });
  };

  useEffect(() => {
    fetchData();
    // Poll diagnostic statistics every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Format uptime in seconds to HH:MM:SS
  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    const uptimeStr = [];
    if (d > 0) uptimeStr.push(`${d}d`);
    if (h > 0) uptimeStr.push(`${h}h`);
    if (m > 0) uptimeStr.push(`${m}m`);
    uptimeStr.push(`${s}s`);
    
    return uptimeStr.join(' ');
  };

  return (
    <div className="tactical-hud" style={{ color: '#e0e0e0', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
          ⚙️ Administrative Diagnostics & Logs
        </h2>
        <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>
          Real-time hardware status verification and parsed threat event log database.
        </p>
      </header>

      {/* Grid: Diagnostics and Schematics */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '25px' }}>
        
        {/* Diagnostics Card */}
        <div className="hud-card" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          flex: '1.2',
          minWidth: '320px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem' }}>
            🛰️ System Diagnostics Checklist
          </h4>

          {systemStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Uptime and Signal */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Uptime Counter</span>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ccc', marginTop: '4px' }}>
                    {formatUptime(systemStats.uptime)}
                  </div>
                </div>
                <div style={{ padding: '10px', background: '#181818', borderRadius: '4px', border: '1px solid #222' }}>
                  <span style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>Radio Signal</span>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#00f076', marginTop: '4px', textTransform: 'uppercase' }}>
                    📶 {systemStats.signal}
                  </div>
                </div>
              </div>

              {/* Sensor Nodes Status */}
              <h5 style={{ margin: '8px 0 4px 0', textTransform: 'uppercase', color: '#666', fontSize: '0.75rem' }}>
                Active Sensor Buses
              </h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(systemStats.sensors).map(([name, status]) => (
                  <div key={name} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#181818',
                    borderRadius: '4px',
                    border: '1px solid #222',
                    fontSize: '0.85rem'
                  }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: '500', color: '#aaa' }}>{name} Interface</span>
                    <span style={{
                      color: status === 'ok' ? '#00f076' : (status === 'disabled' ? '#666' : '#ffb300'),
                      background: status === 'ok' ? 'rgba(0,240,118,0.1)' : (status === 'disabled' ? 'rgba(100,100,100,0.1)' : 'rgba(255,179,0,0.1)'),
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      border: `1px solid ${status === 'ok' ? 'rgba(0,240,118,0.2)' : (status === 'disabled' ? 'rgba(100,100,100,0.2)' : 'rgba(255,179,0,0.2)')}`
                    }}>{status}</span>
                  </div>
                ))}
              </div>

            </div>
          ) : (
            <div style={{ color: '#555', textAlign: 'center', padding: '40px 0' }}>Ping server diagnostic api...</div>
          )}
        </div>

        {/* Schematics Block */}
        <div className="hud-card" style={{
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          flex: '1',
          minWidth: '280px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <h4 style={{ margin: '0 0 16px 0', textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem', alignSelf: 'flex-start' }}>
            📐 Board Wiring Layout
          </h4>
          <div style={{
            width: '100%',
            background: '#151515',
            borderRadius: '4px',
            border: '1px solid #222',
            padding: '8px',
            textAlign: 'center'
          }}>
            <img src="/2.jpg" alt="Blueprint Schematics" style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '2px' }} />
          </div>
        </div>

      </div>

      {/* Log Database Console Section */}
      <section className="hud-card" style={{
        background: '#111',
        border: '1px solid #333',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #333',
          paddingBottom: '12px',
          marginBottom: '12px'
        }}>
          <h4 style={{ margin: 0, textTransform: 'uppercase', color: '#00f076', fontSize: '0.85rem' }}>
            📋 Parsed Detections Database (Last 50 Entries)
          </h4>
          
          {/* Download Raw CSV button */}
          <a 
            href={`${piBase}/api/logs/download`} 
            download 
            style={{
              background: 'rgba(0, 240, 118, 0.12)',
              border: '1px solid #00f076',
              color: '#00f076',
              textDecoration: 'none',
              fontSize: '0.75rem',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              fontWeight: 'bold',
              transition: 'all 0.2s ease'
            }}
          >
            📥 Download Log CSV
          </a>
        </header>

        {/* Scrollable table wrapper */}
        <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
          {loadingLogs ? (
            <div style={{ color: '#555', textAlign: 'center', padding: '30px 0' }}>Loading database...</div>
          ) : logEntries.length === 0 ? (
            <div style={{ color: '#555', textAlign: 'center', padding: '30px 0', fontSize: '0.9rem' }}>
              No threat event logs have been written to the CSV file yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#666', borderBottom: '1px solid #222', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 12px' }}>Timestamp</th>
                  <th style={{ padding: '8px 12px' }}>Sensor Node</th>
                  <th style={{ padding: '8px 12px' }}>Event</th>
                  <th style={{ padding: '8px 12px' }}>Class</th>
                  <th style={{ padding: '8px 12px' }}>Conf</th>
                  <th style={{ padding: '8px 12px' }}>Box Coordinate</th>
                  <th style={{ padding: '8px 12px' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((log, index) => (
                  <tr key={index} style={{
                    borderBottom: '1px solid #222',
                    background: index % 2 === 0 ? '#141414' : 'transparent',
                    color: log.event === 'threat' ? '#ff4500' : '#ccc'
                  }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{log.sensor}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'uppercase', fontWeight: 'bold' }}>{log.event}</td>
                    <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{log.class || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{log.confidence ? `${(parseFloat(log.confidence) * 100).toFixed(0)}%` : '—'}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                      {log.x1 ? `[${Math.round(log.x1)}, ${Math.round(log.y1)}, ${Math.round(log.x2)}, ${Math.round(log.y2)}]` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{log.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}
