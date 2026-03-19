import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import StoresPage from './pages/StoresPage';
import MedicinesPage from './pages/MedicinesPage';
import LogsPage from './pages/LogsPage';
import SystemPage from './pages/SystemPage';
import Layout from './components/Layout';
import StockRequestsPage from './pages/StockRequestsPage';

function Protected({ children }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontSize:18}}>Loading...</div>;
  return admin ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin" element={<Protected><Layout /></Protected>}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="stores" element={<StoresPage />} />
          <Route path="medicines" element={<MedicinesPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="stock-requests" element={<StockRequestsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}