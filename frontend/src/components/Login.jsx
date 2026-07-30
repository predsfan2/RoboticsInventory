import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { login, getUsernames } from '../lib/api';

export default function Login() {
  const { signIn } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUsernames()
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(() => setUsers([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected && !e.target.nameInput?.value) return;
    setError('');
    setLoading(true);
    const name = selected ? selected.name : e.target.nameInput?.value;
    try {
      const res = await login(name, password);
      signIn(res.user, res.token);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const ROLE_COLORS = {
    Admin: 'border-red-700 bg-red-950/40',
    Manager: 'border-amber-700 bg-amber-950/40',
    'Accounting Admin': 'border-blue-700 bg-blue-950/40',
    Member: 'border-indigo-700 bg-indigo-950/40',
    Viewer: 'border-gray-700 bg-gray-800/40',
  };

  const ROLE_ICON = {
    Admin: '👑',
    Manager: '🔑',
    'Accounting Admin': '💹',
    Member: '👤',
    Viewer: '👁',
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3" aria-hidden="true">🤖</div>
          <h1 className="text-3xl font-bold text-white">Robotics Inventory</h1>
          <p className="text-gray-400 mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {users.length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Select your account</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setSelected(u); setError(''); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-medium transition-all ${
                      selected?.id === u.id
                        ? 'border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-500/30'
                        : (ROLE_COLORS[u.role] || ROLE_COLORS.Member) + ' hover:border-opacity-80'
                    }`}
                  >
                    <span className="text-2xl" aria-hidden="true">{ROLE_ICON[u.role] || '👤'}</span>
                    <span className="text-gray-200 truncate w-full text-center">{u.name}</span>
                    <span className="text-xs text-gray-500">{u.role}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Username</label>
              <input name="nameInput" className="input" placeholder="Enter your name" autoComplete="username" />
            </div>
          )}

          {(selected || users.length === 0) && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Password {selected && <span className="text-gray-500">for {selected.name}</span>}
              </label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                autoFocus
              />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!selected && users.length > 0)}
            className="btn-primary w-full py-2.5 text-base"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="text-center text-xs text-gray-600 mt-6">
            Dev default: <span className="text-gray-500">Admin / admin123</span>
          </p>
        )}
      </div>
    </div>
  );
}
