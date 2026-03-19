import { useEffect, useState } from 'react';
import API from '../adminApi';

export default function StockRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState('pending');
  const [msg, setMsg]           = useState({ text: '', ok: true });
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/admin/stock-requests', { params: { status } });
      setRequests(data.requests);
      setTotal(data.total);
    } catch { flash('Failed to load', false); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: '', ok: true }), 4000);
  };

  const reviewAll = async (requestId, action) => {
    const request = requests.find(r => r._id === requestId);
    if (!request) return;
    const items = request.items
      .filter(i => i.status === 'pending')
      .map(i => ({ itemId: i._id, action, quantity: i.quantity, price: i.price }));
    try {
      await API.patch(`/admin/stock-requests/${requestId}/review`, { items });
      flash(action === 'approve' ? '✅ All approved and added to inventory' : '❌ All rejected');
      load();
      setExpanded(null);
    } catch (err) { flash(err.response?.data?.error || 'Failed', false); }
  };

  const reviewItem = async (requestId, itemId, action, quantity, price) => {
    try {
      await API.patch(`/admin/stock-requests/${requestId}/review`, {
        items: [{ itemId, action, quantity, price }]
      });
      flash(action === 'approve' ? '✅ Approved' : '❌ Rejected');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', false); }
  };

  const confidenceColor = (score) => {
    if (score >= 80) return '#2e7d32';
    if (score >= 60) return '#f57c00';
    return '#c62828';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', color: '#1B4F8A', margin: 0 }}>
          Stock Approval Requests
          {total > 0 && status === 'pending' && (
            <span style={{ marginLeft: 10, background: '#e53935', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 14 }}>
              {total}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {['pending', 'approved', 'rejected', 'partial'].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 13,
                background: status === s ? '#1B4F8A' : '#f0f0f0', color: status === s ? '#fff' : '#555' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {msg.text && (
        <div style={{ background: msg.ok ? '#e8f5e9' : '#ffebee', color: msg.ok ? '#2e7d32' : '#c62828',
          padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16 }}>No {status} requests</div>
        </div>
      ) : requests.map(req => (
        <div key={req._id} style={{ background: '#fff', borderRadius: 12, marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}>

          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#f8faff', borderBottom: '1px solid #eee' }}>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 16, color: '#1B4F8A' }}>
                🏪 {req.storeId?.name || 'Unknown Store'}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                {new Date(req.createdAt).toLocaleString()} · {req.submittedBy?.email} ·
                <span style={{ color: '#2e7d32' }}> ✅ {req.autoApprovedCount} auto-approved</span> ·
                <span style={{ color: '#e65100' }}> ⚠️ {req.pendingCount} pending</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 'bold',
                background: req.status === 'pending' ? '#fff3e0' : req.status === 'approved' ? '#e8f5e9' : '#ffebee',
                color: req.status === 'pending' ? '#e65100' : req.status === 'approved' ? '#2e7d32' : '#c62828' }}>
                {req.status.toUpperCase()}
              </span>
              {req.status === 'pending' && (
                <>
                  <button onClick={() => reviewAll(req._id, 'approve')}
                    style={{ padding: '6px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                    ✅ Approve All
                  </button>
                  <button onClick={() => reviewAll(req._id, 'reject')}
                    style={{ padding: '6px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                    ❌ Reject All
                  </button>
                </>
              )}
              <button onClick={() => setExpanded(expanded === req._id ? null : req._id)}
                style={{ padding: '6px 14px', background: '#e3f2fd', color: '#1B4F8A', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 'bold' }}>
                {expanded === req._id ? 'Hide' : 'Review'} Items
              </button>
            </div>
          </div>

          {expanded === req._id && (
            <div style={{ padding: 20 }}>
              {req.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#1B4F8A', fontSize: 14 }}>
                      {item.matchedName || item.extractedName}
                      {!item.inDatabase && <span style={{ fontSize: 11, background: '#e3f2fd', color: '#1B4F8A', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>NEW</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>Extracted: "{item.extractedName}"</div>
                   {item.flags?.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {item.flags.map((f, fi) => (
                          <span key={fi} style={{ fontSize: 11, background: '#fff3e0', color: '#e65100',
                            padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>⚠️ {f}</span>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 'bold', padding: '3px 8px', borderRadius: 6,
                        background: item.aiVerdict === 'legit' ? '#e8f5e9' : item.aiVerdict === 'fake' ? '#ffebee' : '#fff3e0',
                        color: item.aiVerdict === 'legit' ? '#2e7d32' : item.aiVerdict === 'fake' ? '#c62828' : '#e65100',
                      }}>
                        🤖 AI: {item.aiVerdict?.toUpperCase() || 'UNKNOWN'} ({item.confidence}%)
                      </span>
                      {item.aiReason && (
                        <span style={{ fontSize: 11, color: '#888' }}>{item.aiReason}</span>
                      )}
                      {!item.inDatabase && (
                        <span style={{ fontSize: 11, color: '#1B4F8A', fontWeight: 'bold' }}>📥 Not in DB — will be added on approval</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: confidenceColor(item.confidence) }}>
                      {item.confidence}%
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>confidence</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontWeight: 'bold' }}>{item.quantity}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>qty</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontWeight: 'bold' }}>₹{item.price}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>price</div>
                  </div>
                  <div>
                    {item.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => reviewItem(req._id, item._id, 'approve', item.quantity, item.price)}
                          style={{ padding: '5px 12px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                          ✅ Approve
                        </button>
                        <button onClick={() => reviewItem(req._id, item._id, 'reject', item.quantity, item.price)}
                          style={{ padding: '5px 12px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>
                          ❌ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 'bold',
                        color: item.status === 'approved' ? '#2e7d32' : '#c62828' }}>
                        {item.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}