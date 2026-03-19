import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../AdminAuthContext';

export default function LoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={s.bg}>
      <div style={s.card}>
        <div style={s.icon}>🛡️</div>
        <h1 style={s.title}>MediLink Admin</h1>
        <p style={s.sub}>Master Administration Panel</p>
        {error && <div style={s.error}>⚠️ {error}</div>}
        <form onSubmit={handle}>
          <input style={s.input} type="email" placeholder="Admin email"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  bg:    { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#1B4F8A,#0d2d5a)' },
  card:  { background:'#fff', borderRadius:16, padding:40, width:380, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' },
  icon:  { fontSize:48, textAlign:'center', marginBottom:8 },
  title: { margin:0, textAlign:'center', color:'#1B4F8A', fontSize:24, fontWeight:'bold' },
  sub:   { textAlign:'center', color:'#888', marginBottom:24, fontSize:13 },
  error: { background:'#ffebee', color:'#c62828', padding:'10px 14px', borderRadius:8, marginBottom:16, fontSize:13 },
  input: { width:'100%', padding:'12px 14px', marginBottom:12, borderRadius:8, border:'1px solid #ddd', fontSize:14, boxSizing:'border-box', outline:'none' },
  btn:   { width:'100%', padding:14, background:'#1B4F8A', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:'bold', cursor:'pointer' },
};