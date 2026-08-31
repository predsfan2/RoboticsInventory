import React, { useState } from 'react';
import { useAuth } from '../App';
import { login } from '../lib/api';

export default function Login() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await login(name.trim(), password);
      signIn(res.user, res.token);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3" aria-hidden="true">🤖</div>
          <h1 className="text-3xl font-bold text-white">Robotics Inventory</h1>
          <p className="text-gray-400 mt-1">Sign in with your name and password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading || !name.trim() || !password} className="btn-primary w-full py-2.5 text-base">
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
