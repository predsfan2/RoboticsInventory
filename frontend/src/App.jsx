import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Toaster from './components/Toaster';
import GlobalSearch from './components/GlobalSearch';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Whereabouts from './pages/Whereabouts';
import ConditionTracker from './pages/ConditionTracker';
import Purchases from './pages/Purchases';
import Borrows from './pages/Borrows';
import Approvals from './pages/Approvals';
import Team from './pages/Team';
import Locations from './pages/Locations';
import ActivityLog from './pages/ActivityLog';
import Finance from './pages/Finance';
import { hasPermission } from './lib/permissions';

// ── Contexts ──────────────────────────────────────────────────────────────────
export const AuthContext = createContext(null);
export const ToastContext = createContext(null);

export function useAuth() { return useContext(AuthContext); }
export function useToast() { return useContext(ToastContext); }

// ── Toast state ───────────────────────────────────────────────────────────────
function useToastState() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), duration);
  }, []);
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

// ── PermRoute — renders children only if user has the permission ──────────────
function PermRoute({ permission, user, children }) {
  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rt_user')); } catch { return null; }
  });
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const toast = useToastState();
  const navigate = useNavigate();

  const signIn = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('rt_user', JSON.stringify(userData));
    navigate('/dashboard');
  }, [navigate]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('rt_user');
    navigate('/login');
  }, [navigate]);

  // Ctrl+K global search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const perm = (p) => ({ permission: p, user });

  return (
    <AuthContext.Provider value={{ user, signIn, signOut }}>
      <ToastContext.Provider value={toast.push}>
        <Toaster toasts={toast.toasts} dismiss={toast.dismiss} />
        {globalSearchOpen && (
          <GlobalSearch onClose={() => setGlobalSearchOpen(false)} navigate={navigate} />
        )}
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route
            path="/*"
            element={
              user ? (
                <Layout onOpenSearch={() => setGlobalSearchOpen(true)}>
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />

                    <Route path="/inventory" element={
                      <PermRoute {...perm('inventory.view')}><Inventory /></PermRoute>
                    } />
                    <Route path="/whereabouts" element={
                      <PermRoute {...perm('inventory.view')}><Whereabouts /></PermRoute>
                    } />
                    <Route path="/condition" element={
                      <PermRoute {...perm('inventory.view')}><ConditionTracker /></PermRoute>
                    } />
                    <Route path="/purchases" element={
                      <PermRoute {...perm('purchases.view')}><Purchases /></PermRoute>
                    } />
                    <Route path="/borrows" element={
                      <PermRoute {...perm('borrows.view')}><Borrows /></PermRoute>
                    } />
                    <Route path="/approvals" element={
                      <PermRoute {...perm('approvals.manage')}><Approvals /></PermRoute>
                    } />
                    <Route path="/finance/*" element={
                      <PermRoute {...perm('finance.view')}><Finance /></PermRoute>
                    } />
                    <Route path="/activity" element={
                      <PermRoute {...perm('audit.view')}><ActivityLog /></PermRoute>
                    } />
                    <Route path="/team" element={
                      <PermRoute {...perm('admin.users')}><Team /></PermRoute>
                    } />
                    <Route path="/locations" element={
                      <PermRoute {...perm('admin.locations')}><Locations /></PermRoute>
                    } />

                    <Route path="*" element={<Navigate to="/dashboard" />} />
                  </Routes>
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
