import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AppProvider } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Production from './pages/Production';
import Income from './pages/Income';
import Salary from './pages/Salary';
import Analytics from './pages/Analytics';
import GExp from './pages/GExp';
import Thread from './pages/Thread';
import Ledger from './pages/Ledger';
import SalarySheet from './pages/SalarySheet';
import Settings from './pages/Settings';

function ProtectedRoutes() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-muted)' }}>
      Loading...
    </div>
  );
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="production" element={<Production />} />
        <Route path="income" element={<Income />} />
        <Route path="salary" element={<Salary />} />
        <Route path="g-exp" element={<GExp />} />
        <Route path="thread" element={<Thread />} />
        <Route path="ledger" element={<Ledger />} />
        <Route path="salary-sheet" element={<SalarySheet />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function LoginRoute() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return null;
  if (isLoggedIn) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-md)',
            fontSize: '0.875rem',
          },
        }}
      />
    </AppProvider>
  );
}
