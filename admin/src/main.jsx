import React from 'react'
import ReactDOM from 'react-dom/client'
import { AdminAuthProvider } from './AdminAuthContext.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminAuthProvider>
      <App />
    </AdminAuthProvider>
  </React.StrictMode>
)