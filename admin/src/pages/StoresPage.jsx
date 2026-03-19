import { useEffect, useState } from 'react';
import API from '../adminApi';

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter !== 'all') params.verified = filter === 'verified';
      const { data } = await API.get('/admin/stores', { params });
      setStores(data.stores);
      setTotal(data.total);
    } catch { setMsg('Failed to load stores'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, filter]);

  const verify = async (id, approve) => {
    if (!window.confirm(approve ? 'Approve this store?' : 'Reject this store?')) return;
    try {
      await API.patch(`/admin/stores/${id}/verify`, { approve });
      setMsg(approve ? 'Store approved' : 'Store rejected');
      load();
    } catch (err) { setMsg(err.response?.data?.error || 'Failed'); }
  };

  const deleteStore = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try {
      await API.delete(`/admin/stores/${id}`);
      setMsg('Store deleted');
      load();
    } catch (err) { setMsg(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <h2 style={s.heading}>Stores <span style={s.count}>({total})</span></h2>
      {msg && <div style={s.msg} onClick={() => setMsg('')}>{msg} ✕</div>}

      <div style={s.toolbar}>
        {['all', 'pending', 'verified'].map(f => (
          <button key={f} style={{ ...s.filterBtn, ...(filter === f ? s.filterActive : {}) }}
            onClick={() => { setFilter(f); setPage(1); }}>
            {f === 'all' ? '🏪 All' : f === 'pending' ? '⏳ Pending' : '✅ Verified'}
          </button>
        ))}
      </div>

      <div style={s.tableBox}>
        <table style={s.table}>
          <thead><tr style={s.thead}>
            <th style={s.th}>Store Name</th>
            <th style={s.th}>License</th>
            <th style={s.th}>City</th>
            <th style={s.th}>Owner</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>Loading...</td></tr>
            ) : stores.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>No stores found</td></tr>
            ) : stores.map(store => (
              <tr key={store._id} style={s.tr}>
                <td style={s.td}>
                  <div style={{ fontWeight:'bold', color:'#1B4F8A' }}>{store.name}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{store.phone}</div>
                </td>
                <td style={s.td}>
                  <div style={s.license}>{store.licenseNumber}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>
                    Exp: {new Date(store.licenseExpiry).toLocaleDateString()}
                  </div>
                </td>
                <td style={s.td}>{store.address?.city}, {store.address?.state}</td>
                <td style={s.td}>
                  <div>{store.ownerName}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{store.ownerPhone}</div>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: store.isVerified ? '#e8f5e9' : '#fff8e1', color: store.isVerified ? '#2e7d32' : '#e65100' }}>
                    {store.isVerified ? '✅ Verified' : '⏳ Pending'}
                  </span>
                </td>
                <td style={s.td}>
                  <div style={{ display:'flex', gap:6 }}>
                    {!store.isVerified ? (
                      <button style={{ ...s.btn, background:'#2e7d32' }} onClick={() => verify(store._id, true)}>Approve</button>
                    ) : (
                      <button style={{ ...s.btn, background:'#e65100' }} onClick={() => verify(store._id, false)}>Revoke</button>
                    )}
                    <button style={{ ...s.btn, background:'#c62828' }} onClick={() => deleteStore(store._id, store.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.pagination}>
        <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ fontSize:13, color:'#666' }}>Page {page}</span>
        <button style={s.pageBtn} disabled={stores.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

const s = {
  heading:      { fontSize:24, fontWeight:'bold', color:'#1B4F8A', marginBottom:24 },
  count:        { fontSize:16, color:'#888', fontWeight:'normal' },
  msg:          { background:'#e8f5e9', color:'#2e7d32', padding:'10px 16px', borderRadius:8, marginBottom:16, cursor:'pointer', fontSize:13 },
  toolbar:      { display:'flex', gap:8, marginBottom:16 },
  filterBtn:    { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
  filterActive: { background:'#1B4F8A', color:'#fff', borderColor:'#1B4F8A' },
  tableBox:     { background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' },
  table:        { width:'100%', borderCollapse:'collapse' },
  thead:        { background:'#f5f5f5' },
  th:           { padding:'12px 16px', textAlign:'left', fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  tr:           { borderBottom:'1px solid #f0f0f0' },
  td:           { padding:'12px 16px', fontSize:13, color:'#333' },
  badge:        { padding:'4px 10px', borderRadius:12, fontSize:12, fontWeight:'bold' },
  license:      { fontFamily:'monospace', background:'#f5f5f5', padding:'2px 6px', borderRadius:4, fontSize:12 },
  btn:          { padding:'5px 10px', borderRadius:6, border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:'bold' },
  pagination:   { display:'flex', alignItems:'center', gap:16, marginTop:16, justifyContent:'center' },
  pageBtn:      { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
};