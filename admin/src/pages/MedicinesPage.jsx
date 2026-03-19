import { useEffect, useState } from 'react';
import API from '../adminApi';

const CATEGORIES = ['antibiotic','analgesic','antiviral','antifungal','antihypertensive','antidiabetic','antihistamine','supplement','vaccine','other'];
const empty = { name:'', genericName:'', category:'', manufacturer:'', requiresPrescription: false };

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text:'', ok:true });
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/medicines', { params: { page, limit: 20, search } });
      setMedicines(data.medicines);
      setTotal(data.total);
    } catch { flash('Failed to load medicines', false); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, search]);

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text:'', ok:true }), 3000);
  };

  const toggleActive = async (id, isActive) => {
    try {
      await API.patch(`/admin/medicines/${id}`, { isActive: !isActive });
      flash(isActive ? 'Medicine deactivated' : 'Medicine activated');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', false); }
  };

  const saveEdit = async () => {
    try {
      await API.patch(`/admin/medicines/${editing._id}`, {
        name: editing.name, genericName: editing.genericName,
        category: editing.category, manufacturer: editing.manufacturer,
        requiresPrescription: editing.requiresPrescription,
      });
      flash('Medicine updated'); setEditing(null); load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', false); }
  };

  const saveNew = async () => {
    if (!form.name || !form.genericName || !form.category || !form.manufacturer) {
      flash('All fields are required', false); return;
    }
    try {
      await API.post('/admin/medicines', form);
      flash('Medicine added successfully');
      setAdding(false); setForm(empty); load();
    } catch (err) { flash(err.response?.data?.error || 'Failed to add', false); }
  };
  const deleteMedicine = async (id, name) => {
  if (!window.confirm(`Permanently delete "${name}"? This removes it from all inventories.`)) return;
  try {
    await API.delete(`/admin/medicines/${id}`);
    flash('Medicine deleted'); load();
  } catch (err) { flash(err.response?.data?.error || 'Failed', false); }
};

  const MedicineForm = ({ data, setData }) => (
    <div>
      {['name','genericName','manufacturer'].map(field => (
        <div key={field} style={{ marginBottom:12 }}>
          <label style={s.label}>{field}</label>
          <input style={s.input} value={data[field] || ''}
            onChange={e => setData({ ...data, [field]: e.target.value })} />
        </div>
      ))}
      <div style={{ marginBottom:12 }}>
        <label style={s.label}>Category</label>
        <select style={s.input} value={data.category || ''}
          onChange={e => setData({ ...data, category: e.target.value })}>
          <option value="">-- Select Category --</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <input type="checkbox" checked={data.requiresPrescription}
            onChange={e => setData({ ...data, requiresPrescription: e.target.checked })} />
          <span style={s.label}>Requires Prescription</span>
        </label>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 style={s.heading}>Medicines <span style={s.count}>({total})</span></h2>
        <button style={s.addBtn} onClick={() => { setForm(empty); setAdding(true); }}>
          ➕ Add New Medicine
        </button>
      </div>

      {msg.text && (
        <div style={{ background: msg.ok ? '#e8f5e9' : '#ffebee', color: msg.ok ? '#2e7d32' : '#c62828', padding:'10px 16px', borderRadius:8, marginBottom:16, cursor:'pointer', fontSize:13 }}
          onClick={() => setMsg({ text:'', ok:true })}>
          {msg.text} ✕
        </div>
      )}

      {adding && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <h3 style={{ marginTop:0, color:'#1B4F8A' }}>Add New Medicine</h3>
            <MedicineForm data={form} setData={setForm} />
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btn, background:'#1B4F8A', flex:1, padding:12 }} onClick={saveNew}>Save</button>
              <button style={{ ...s.btn, background:'#888', flex:1, padding:12 }} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div style={s.modal}>
          <div style={s.modalBox}>
            <h3 style={{ marginTop:0, color:'#1B4F8A' }}>Edit Medicine</h3>
            <MedicineForm data={editing} setData={setEditing} />
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ ...s.btn, background:'#1B4F8A', flex:1, padding:12 }} onClick={saveEdit}>Save</button>
              <button style={{ ...s.btn, background:'#888', flex:1, padding:12 }} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={s.toolbar}>
        <input style={s.search} placeholder="Search medicines..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <div style={s.tableBox}>
        <table style={s.table}>
          <thead><tr style={s.thead}>
            <th style={s.th}>Name</th>
            <th style={s.th}>Generic Name</th>
            <th style={s.th}>Category</th>
            <th style={s.th}>Prescription</th>
            <th style={s.th}>Status</th>
            <th style={s.th}>Actions</th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>Loading...</td></tr>
            ) : medicines.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#888' }}>No medicines found</td></tr>
            ) : medicines.map(m => (
              <tr key={m._id} style={s.tr}>
                <td style={s.td}>
                  <div style={{ fontWeight:'bold', color:'#1B4F8A' }}>{m.name}</div>
                  <div style={{ fontSize:11, color:'#aaa' }}>{m.manufacturer}</div>
                </td>
                <td style={s.td}>{m.genericName}</td>
                <td style={s.td}><span style={s.catBadge}>{m.category}</span></td>
                <td style={s.td}>
                  <span style={{ color: m.requiresPrescription ? '#c62828' : '#2e7d32', fontWeight:'bold', fontSize:12 }}>
                    {m.requiresPrescription ? '🔒 Yes' : '✅ No'}
                  </span>
                </td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: m.isActive ? '#e8f5e9' : '#ffebee', color: m.isActive ? '#2e7d32' : '#c62828' }}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
               <td style={s.td}>
  <div style={{ display:'flex', gap:6 }}>
    <button style={{ ...s.btn, background:'#1B4F8A' }} onClick={() => setEditing(m)}>Edit</button>
    <button style={{ ...s.btn, background: m.isActive ? '#e65100' : '#2e7d32' }}
      onClick={() => toggleActive(m._id, m.isActive)}>
      {m.isActive ? 'Deactivate' : 'Activate'}
    </button>
    <button style={{ ...s.btn, background:'#c62828' }}
      onClick={() => deleteMedicine(m._id, m.name)}>
      🗑️ Delete
    </button>
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
        <button style={s.pageBtn} disabled={medicines.length < 20} onClick={() => setPage(p => p + 1)}>Next →</button>
      </div>
    </div>
  );
}

const s = {
  heading:    { fontSize:24, fontWeight:'bold', color:'#1B4F8A', margin:0 },
  count:      { fontSize:16, color:'#888', fontWeight:'normal' },
  addBtn:     { padding:'10px 20px', background:'#1B4F8A', color:'#fff', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:'bold' },
  toolbar:    { marginBottom:16 },
  search:     { padding:'10px 14px', borderRadius:8, border:'1px solid #ddd', fontSize:14, width:280, outline:'none' },
  tableBox:   { background:'#fff', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', overflow:'hidden' },
  table:      { width:'100%', borderCollapse:'collapse' },
  thead:      { background:'#f5f5f5' },
  th:         { padding:'12px 16px', textAlign:'left', fontSize:12, color:'#888', fontWeight:'bold', textTransform:'uppercase' },
  tr:         { borderBottom:'1px solid #f0f0f0' },
  td:         { padding:'12px 16px', fontSize:13, color:'#333' },
  badge:      { padding:'4px 10px', borderRadius:12, fontSize:12, fontWeight:'bold' },
  catBadge:   { background:'#e8f0fe', color:'#1B4F8A', padding:'3px 8px', borderRadius:6, fontSize:12 },
  btn:        { padding:'5px 10px', borderRadius:6, border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:'bold' },
  pagination: { display:'flex', alignItems:'center', gap:16, marginTop:16, justifyContent:'center' },
  pageBtn:    { padding:'8px 16px', borderRadius:8, border:'1px solid #ddd', background:'#fff', cursor:'pointer', fontSize:13 },
  modal:      { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalBox:   { background:'#fff', borderRadius:16, padding:32, width:420, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  label:      { display:'block', fontSize:12, color:'#888', marginBottom:4, textTransform:'uppercase', fontWeight:'bold' },
  input:      { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #ddd', fontSize:14, boxSizing:'border-box', outline:'none' },
};