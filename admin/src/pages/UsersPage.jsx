import { useEffect, useState } from 'react';
import API from '../adminApi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/users', { params: { page, limit: 20, search } });
      setUsers(data.users);
      setTotal(data.total);
    } catch { setMsg('Failed to load users'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, search]);

  const changeRole = async (id, role) => {
    try {
      await API.patch(`/admin/users/${id}/role`, { role });
      setMsg('Role updated'); load();
    } catch (err) { setMsg(err.response?.data?.error || 'Failed'); }
  };

  const toggleBan = async (id, banned) => {
    if (!window.confirm(banned ? 'Unban this user?' : 'Ban this user?')) return;
    try {
      await API.patch(`/admin/users/${id}/ban`);
      setMsg(banned ? 'User unbanned' : 'User banned'); load();
    } catch (err) { setMsg(err.response?.data?.error || 'Failed'); }
  };
 const deleteUser = async (id, email) => {
  if (!window.confirm(`Permanently delete user ${email}? This cannot be undone.`)) return;
  try {
    await API.delete(`/admin/users/${id}`);
    setMsg('User deleted'); load();
  } catch (err) { setMsg(err.response?.data?.error || 'Failed'); }
};

  return (
    <div>
      <h2 style={s.heading}>Users <span style={s.count}>({total})</span></h2>
      {msg && <div style={s.msg} onClick={() => setMsg('')}>{msg} ✕</div>}
      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search by email..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <div style={s.tableBox}>
        <table style={s.table}>
          <thead><tr style={s.thead}>
            <th style={s.th}>Email</th>
            <th style={s.th}>Role</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Joined</th>
            <th style={s.th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'#888' }}>Loading...</td></tr>
            ) : users.map(u => {
              const banned = u.lockedUntil && new Date(u.lockedUntil) > new Date();
              return (
                <tr key={u._id} style={s.tr}>
                  <td style={s.td}>{u.email}</td>
                  <td style={s.td}>
                    <select style={s.select} value={u.role}
                      onChange={e => changeRole(u._id, e.target.value)}>
                      <option value="patient">patient</option>
                      <option value="pharmacist">pharmacist</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                 <td style={s.td}>
  <div style={{ display:'flex', gap:6 }}>
    <button style={{ ...s.btn, background: banned ? '#2e7d32' : '#e65100' }}
      onClick={() => toggleBan(u._id, banned)}>
      {banned ? 'Unban' : 'Ban'}
    </button>
    <button style={{ ...s.btn, background:'#c62828' }}
      onClick={() => deleteUser(u._id, u.email)}>
      🗑️ Delete
    </button>
  </div>
</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={s.pagination}>
        <button style={s.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
        <span style={{ fontSize:13, color:'#666' }}>Page {page}</span>
        <button style={s.pageBtn} disabled={users.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

const s = {
  heading:    { fontSize:24, fontWeight:'bold', color:'#1B4F8A', marginBottom:24 },
  count:      { fontSize:16, color:'#888', fontWeight:'normal' },
  msg:        { background:'#e8f5e9', color:'#2e7d32', padding:'10px 16px', borderRadius:8, marginBottom:16, cursor:'pointer', fontSize:13 },
  toolbar:    { marginBottom:16 },
  search:     { padding:'10px 14px', borderRadius:8, border:'1px solid #ddd', fontSize:14, width:280, outline:'none' },
  tableBox:   { background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' },
  table:      { width:'100%', borderCollapse:'collapse' },
  thead:      { background:'#f5f5f5' },
  th:         { padding:'12px 16px', textAlign:'left', fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  tr:         { borderBottom:'1px solid #f0f0f0' },
  td:         { padding:'12px 16px', fontSize:13, color:'#333' },
  badge:      { padding:'3px 10px', borderRadius:12, fontSize:12, fontWeight:'bold' },
  select:     { padding:'4px 8px', borderRadius:6, border:'1px solid #ddd', fontSize:13, cursor:'pointer' },
  btn:        { padding:'5px 12px', borderRadius:6, border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:'bold' },
  pagination: { display:'flex', alignItems:'center', gap:16, marginTop:16, justifyContent:'center' },
  pageBtn:    { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
};