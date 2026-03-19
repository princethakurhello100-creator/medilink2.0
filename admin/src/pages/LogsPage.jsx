import { useEffect, useState } from 'react';
import API from '../adminApi';

const actionColors = {
  LOGIN_SUCCESS: '#2e7d32', LOGIN_FAILED: '#c62828', USER_REGISTER: '#1565c0',
  USER_BAN: '#c62828', USER_UNBAN: '#2e7d32', ROLE_CHANGE: '#e65100',
  STORE_APPROVED: '#2e7d32', STORE_REJECTED: '#c62828', STORE_DELETED: '#c62828',
  MEDICINE_UPDATED: '#6a1b9a', MEDICINE_SEARCH: '#1565c0',
};

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/logs', { params: { page, limit: 50, action } });
      setLogs(data.logs);
      setTotal(data.total);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, action]);

  return (
    <div>
      <h2 style={s.heading}>Audit Logs <span style={s.count}>({total})</span></h2>

      {selected && (
        <div style={s.modal} onClick={() => setSelected(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop:0, color:'#1B4F8A' }}>Log Details</h3>
            <div style={s.detailRow}><span style={s.detailLabel}>Action</span><span style={{ ...s.actionBadge, background: actionColors[selected.action] || '#888' }}>{selected.action}</span></div>
            <div style={s.detailRow}><span style={s.detailLabel}>Actor</span><span>{selected.actorId?.email || 'System'}</span></div>
            <div style={s.detailRow}><span style={s.detailLabel}>Role</span><span>{selected.actorId?.role || 'N/A'}</span></div>
            <div style={s.detailRow}><span style={s.detailLabel}>Outcome</span><span style={{ color: selected.outcome === 'success' ? '#2e7d32' : '#c62828', fontWeight:'bold' }}>{selected.outcome}</span></div>
            <div style={s.detailRow}><span style={s.detailLabel}>IP Address</span><span style={{ fontFamily:'monospace' }}>{selected.ipAddress}</span></div>
            <div style={s.detailRow}><span style={s.detailLabel}>Time</span><span>{new Date(selected.createdAt).toLocaleString()}</span></div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div style={{ marginTop:12 }}>
                <div style={s.detailLabel}>Metadata</div>
                <pre style={s.pre}>{JSON.stringify(selected.metadata, null, 2)}</pre>
              </div>
            )}
            <button style={s.closeBtn} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Filter by action (e.g. LOGIN)..."
          value={action} onChange={e => { setAction(e.target.value); setPage(1); }} />
        <button style={s.refreshBtn} onClick={load}>🔄 Refresh</button>
      </div>

      <div style={s.tableBox}>
        <table style={s.table}>
          <thead><tr style={s.thead}>
            <th style={s.th}>Action</th>
            <th style={s.th}>Actor</th>
            <th style={s.th}>IP Address</th>
            <th style={s.th}>Outcome</th>
            <th style={s.th}>Time</th>
            <th style={s.th}>Details</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>No logs found</td></tr>
            ) : logs.map(log => (
              <tr key={log._id} style={s.tr}>
                <td style={s.td}>
                  <span style={{ ...s.actionBadge, background: actionColors[log.action] || '#888' }}>
                    {log.action}
                  </span>
                </td>
                <td style={s.td}>
                  <div>{log.actorId?.email || 'System'}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{log.actorId?.role}</div>
                </td>
                <td style={s.td}><span style={{ fontFamily:'monospace', fontSize:12 }}>{log.ipAddress}</span></td>
                <td style={s.td}>
                  <span style={{ color: log.outcome === 'success' ? '#2e7d32' : '#c62828', fontWeight:'bold', fontSize:12 }}>
                    {log.outcome === 'success' ? '✅' : '❌'} {log.outcome}
                  </span>
                </td>
                <td style={s.td}>{new Date(log.createdAt).toLocaleString()}</td>
                <td style={s.td}>
                  <button style={s.viewBtn} onClick={() => setSelected(log)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.pagination}>
        <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ fontSize:13, color:'#666' }}>Page {page}</span>
        <button style={s.pageBtn} disabled={logs.length < 50} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

const s = {
  heading:     { fontSize:24, fontWeight:'bold', color:'#1B4F8A', marginBottom:24 },
  count:       { fontSize:16, color:'#888', fontWeight:'normal' },
  toolbar:     { display:'flex', gap:12, marginBottom:16, alignItems:'center' },
  search:      { padding:'10px 14px', borderRadius:8, border:'1px solid #ddd', fontSize:14, width:320, outline:'none' },
  refreshBtn:  { padding:'10px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
  tableBox:    { background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' },
  table:       { width:'100%', borderCollapse:'collapse' },
  thead:       { background:'#f5f5f5' },
  th:          { padding:'12px 16px', textAlign:'left', fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  tr:          { borderBottom:'1px solid #f0f0f0' },
  td:          { padding:'12px 16px', fontSize:13, color:'#333' },
  actionBadge: { color:'#fff', padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:'bold' },
  viewBtn:     { padding:'4px 10px', borderRadius:6, border:'1px solid #1B4F8A', background:'#fff', color:'#1B4F8A', fontSize:12, cursor:'pointer' },
  pagination:  { display:'flex', alignItems:'center', gap:16, marginTop:16, justifyContent:'center' },
  pageBtn:     { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
  modal:       { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalBox:    { background:'#fff', borderRadius:16, padding:32, width:480, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', maxHeight:'80vh', overflowY:'auto' },
  detailRow:   { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f0f0f0' },
  detailLabel: { fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  pre:         { background:'#f5f5f5', borderRadius:8, padding:12, fontSize:12, fontFamily:'monospace', overflowX:'auto', marginTop:8 },
  closeBtn:    { marginTop:16, width:'100%', padding:12, background:'#1B4F8A', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontWeight:'bold' },
};