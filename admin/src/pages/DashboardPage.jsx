import { useEffect, useState } from 'react';
import API from '../adminApi';

const StatCard = ({ icon, label, value, color }) => (
  <div style={{ background:'#fff', borderRadius:12, padding:24, flex:1, minWidth:160, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize:32, marginBottom:8 }}>{icon}</div>
    <div style={{ fontSize:28, fontWeight:'bold', color }}>{value ?? '...'}</div>
    <div style={{ color:'#888', fontSize:13, marginTop:4 }}>{label}</div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get('/admin/stats').then(r => setStats(r.data)).catch(() => setError('Failed to load stats'));
  }, []);

  return (
    <div>
      <h2 style={s.heading}>Dashboard</h2>
      {error && <div style={s.error}>{error}</div>}
      <div style={s.cards}>
        <StatCard icon="👥" label="Total Users" value={stats?.totalUsers} color="#1B4F8A" />
        <StatCard icon="🏪" label="Total Stores" value={stats?.totalStores} color="#2e7d32" />
        <StatCard icon="⏳" label="Pending Verification" value={stats?.pendingStores} color="#e65100" />
        <StatCard icon="💊" label="Active Medicines" value={stats?.totalMedicines} color="#6a1b9a" />
      </div>
      <div style={s.logsBox}>
        <h3 style={s.subheading}>Recent Activity</h3>
        <table style={s.table}>
          <thead><tr style={s.thead}>
            <th style={s.th}>Action</th>
            <th style={s.th}>Actor</th>
            <th style={s.th}>Outcome</th>
            <th style={s.th}>Time</th>
          </tr></thead>
          <tbody>
            {stats?.recentLogs?.map(log => (
              <tr key={log._id} style={s.tr}>
                <td style={s.td}><span style={s.actionBadge}>{log.action}</span></td>
                <td style={s.td}>{log.actorId?.email || 'System'}</td>
                <td style={s.td}>
                  <span style={{ color: log.outcome === 'success' ? '#2e7d32' : '#c62828', fontWeight:'bold' }}>
                    {log.outcome}
                  </span>
                </td>
                <td style={s.td}>{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s = {
  heading:    { fontSize:24, fontWeight:'bold', color:'#1B4F8A', marginBottom:24 },
  subheading: { fontSize:16, fontWeight:'bold', color:'#333', marginBottom:12 },
  cards:      { display:'flex', gap:16, flexWrap:'wrap', marginBottom:32 },
  logsBox:    { background:'#fff', borderRadius:12, padding:24, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' },
  table:      { width:'100%', borderCollapse:'collapse' },
  thead:      { background:'#f5f5f5' },
  th:         { padding:'10px 14px', textAlign:'left', fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  tr:         { borderBottom:'1px solid #f0f0f0' },
  td:         { padding:'12px 14px', fontSize:13, color:'#333' },
  actionBadge:{ background:'#e8f0fe', color:'#1B4F8A', padding:'3px 8px', borderRadius:6, fontSize:12, fontWeight:'bold' },
  error:      { background:'#ffebee', color:'#c62828', padding:12, borderRadius:8, marginBottom:16 },
};