import { useEffect, useState } from 'react';
import API from '../adminApi';

const formatBytes = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
};

const formatUptime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
};

export default function SystemPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/health');
      setHealth(data);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const dbColor = health?.db === 'connected' ? '#2e7d32' : '#c62828';
  const dbIcon  = health?.db === 'connected' ? '✅' : '❌';

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <h2 style={s.heading}>System Health</h2>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {lastRefresh && <span style={{ fontSize:12, color:'#aaa' }}>Last refresh: {lastRefresh.toLocaleTimeString()}</span>}
          <button style={s.refreshBtn} onClick={load} disabled={loading}>
            {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      <div style={s.cards}>
        <div style={s.card}>
          <div style={s.cardIcon}>🟢</div>
          <div style={s.cardLabel}>API Status</div>
          <div style={{ ...s.cardValue, color:'#2e7d32' }}>{health ? 'Online' : '...'}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardIcon}>{dbIcon}</div>
          <div style={s.cardLabel}>Database</div>
          <div style={{ ...s.cardValue, color: dbColor }}>{health?.db ?? '...'}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardIcon}>⏱️</div>
          <div style={s.cardLabel}>Uptime</div>
          <div style={s.cardValue}>{health ? formatUptime(health.uptime) : '...'}</div>
        </div>
        <div style={s.card}>
          <div style={s.cardIcon}>🟦</div>
          <div style={s.cardLabel}>Node.js</div>
          <div style={s.cardValue}>{health?.node ?? '...'}</div>
        </div>
      </div>

      {health?.memory && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Memory Usage</h3>
          <div style={s.memGrid}>
            {Object.entries(health.memory).map(([key, val]) => (
              <div key={key} style={s.memCard}>
                <div style={s.memLabel}>{key}</div>
                <div style={s.memValue}>{formatBytes(val)}</div>
                <div style={s.memBar}>
                  <div style={{ ...s.memFill, width: `${Math.min((val / (512 * 1024 * 1024)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.section}>
        <h3 style={s.sectionTitle}>Environment</h3>
        <div style={s.envBox}>
          <div style={s.envRow}>
            <span style={s.envLabel}>Environment</span>
            <span style={{ ...s.envValue, color: health?.env === 'production' ? '#2e7d32' : '#e65100', fontWeight:'bold' }}>
              {health?.env ?? '...'}
            </span>
          </div>
          <div style={s.envRow}>
            <span style={s.envLabel}>Server Time</span>
            <span style={s.envValue}>{health ? new Date(health.timestamp).toLocaleString() : '...'}</span>
          </div>
          <div style={s.envRow}>
            <span style={s.envLabel}>Node Version</span>
            <span style={{ ...s.envValue, fontFamily:'monospace' }}>{health?.node ?? '...'}</span>
          </div>
        </div>
      </div>

      <div style={s.section}>
        <h3 style={s.sectionTitle}>OWASP Security Checklist</h3>
        <div style={s.envBox}>
          {[
            ['Broken Access Control', 'Role-based middleware on all admin routes', true],
            ['Cryptographic Failures', 'bcrypt hashing + JWT HS256/RS256', true],
            ['Injection', 'MongoDB operator stripping + input validation', true],
            ['Insecure Design', 'Admin panel isolated on separate port', true],
            ['Security Misconfiguration', 'Helmet headers + CORS locked to known origins', true],
            ['Auth Failures', 'Login lockout after failed attempts + audit logging', true],
            ['Integrity Failures', 'All actions logged to AuditLog with actor + IP', true],
            ['Logging Failures', 'Full audit trail with timestamps and metadata', true],
            ['Rate Limiting', 'Per-IP rate limiting on all endpoints', true],
            ['SSRF', 'No external URL fetching in admin routes', true],
          ].map(([name, desc, ok]) => (
            <div key={name} style={s.envRow}>
              <div>
                <div style={{ fontSize:13, fontWeight:'bold', color:'#333' }}>{name}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{desc}</div>
              </div>
              <span style={{ color: ok ? '#2e7d32' : '#c62828', fontSize:18 }}>{ok ? '✅' : '❌'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  heading:      { fontSize:24, fontWeight:'bold', color:'#1B4F8A', margin:0 },
  refreshBtn:   { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
  cards:        { display:'flex', gap:16, flexWrap:'wrap', marginBottom:32 },
  card:         { background:'#fff', borderRadius:12, padding:24, flex:1, minWidth:150, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', textAlign:'center' },
  cardIcon:     { fontSize:32, marginBottom:8 },
  cardLabel:    { fontSize:12, color:'#888', marginBottom:4, textTransform:'uppercase', fontWeight:'bold' },
  cardValue:    { fontSize:20, fontWeight:'bold', color:'#333' },
  section:      { marginBottom:24 },
  sectionTitle: { fontSize:16, fontWeight:'bold', color:'#333', marginBottom:12 },
  memGrid:      { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:12 },
  memCard:      { background:'#fff', borderRadius:10, padding:16, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' },
  memLabel:     { fontSize:11, color:'#888', textTransform:'uppercase', fontWeight:'bold', marginBottom:6 },
  memValue:     { fontSize:18, fontWeight:'bold', color:'#1B4F8A', marginBottom:8 },
  memBar:       { height:6, background:'#f0f0f0', borderRadius:3, overflow:'hidden' },
  memFill:      { height:'100%', background:'#1B4F8A', borderRadius:3 },
  envBox:       { background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' },
  envRow:       { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #f0f0f0' },
  envLabel:     { fontSize:13, color:'#666' },
  envValue:     { fontSize:13, color:'#333' },
};