import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Dialer from './pages/Dialer';
import Campaigns from './pages/Campaigns';
import Leads from './pages/Leads';
import Users from './pages/Users';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-calljet-600" /></div>;
  return user ? children : <Navigate to="/login" />;
}

function Wrapped({ children }) {
  return <ProtectedRoute><CallProvider><Layout>{children}</Layout></CallProvider></ProtectedRoute>;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<Wrapped><Dashboard /></Wrapped>} />
      <Route path="/dialer/:campaignId" element={<Wrapped><Dialer /></Wrapped>} />
      <Route path="/campaigns" element={<Wrapped><Campaigns /></Wrapped>} />
      <Route path="/leads/:campaignId" element={<Wrapped><Leads /></Wrapped>} />
      <Route path="/users" element={<Wrapped><Users /></Wrapped>} />
    </Routes>
  );
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>;
}
