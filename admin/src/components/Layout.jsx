import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../AdminAuthContext';

export default function Layout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/'); };

  const links = [
    { to: '/admin',                label: '📊 Dashboard',        end: true },
    { to: '/admin/users',          label: '👥 Users' },
    { to: '/admin/stores',         label: '🏪 Stores' },
    { to: '/admin/medicines',      label: '💊 Medicines' },
    { to: '/admin/stock-requests', label: '📦 Stock Requests' },
    { to: '/admin/logs',           label: '📋 Audit Logs' },
    { to: '/admin/system',         label: '⚙️ System' },
  ];

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <div style={s.brandIcon}>🛡️</div>
          <div>
            <div style={s.brandTitle}>MediLink</div>
            <div style={s.brandSub}>Admin Panel</div>
          </div>
        </div>
        <nav style={s.nav}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end}
              style={({ isActive }) => ({ ...s.link, ...(isActive ? s.linkActive : {}) })}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button style={s.logoutBtn} onClick={handleLogout}>🚪 Sign Out</button>
      </aside>
      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  );
}

const s = {
  shell:      { display:'flex', height:'100vh', fontFamily:'system-ui,sans-serif', background:'#f0f2f5' },
  sidebar:    { width:240, background:'#1B4F8A', display:'flex', flexDirection:'column', padding:'24px 0' },
  brand:      { display:'flex', alignItems:'center', gap:12, padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.1)' },
  brandIcon:  { fontSize:28 },
  brandTitle: { color:'#fff', fontWeight:'bold', fontSize:16 },
  brandSub:   { color:'rgba(255,255,255,0.6)', fontSize:11 },
  nav:        { flex:1, padding:'16px 0' },
  link:       { display:'block', padding:'11px 20px', color:'rgba(255,255,255,0.75)', textDecoration:'none', fontSize:14, transition:'all 0.15s' },
  linkActive: { background:'rgba(255,255,255,0.15)', color:'#fff', borderLeft:'3px solid #fff' },
  logoutBtn:  { margin:'0 16px', padding:'10px', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:8, color:'#fff', cursor:'pointer', fontSize:13 },
  main:       { flex:1, overflow:'auto', padding:32 },
};