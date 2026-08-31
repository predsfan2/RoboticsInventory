import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { NAV_ITEMS } from '../lib/constants';
import { hasPermission, hasAnyPermission } from '../lib/permissions';

export default function Layout({ children, onOpenSearch }) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const visibleNav = NAV_ITEMS.filter((n) => {
    if (n.permissions) return hasAnyPermission(user, n.permissions);
    if (n.permission) return hasPermission(user, n.permission);
    return true;
  });
  const mobileNav = visibleNav.slice(0, 4);
  const moreNav = visibleNav.slice(4);
  const moreActive = moreNav.some((n) => location.pathname.startsWith(n.path))
    || location.pathname === '/account'
    || location.pathname.startsWith('/inventory/labels');

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-800">
          <span className="text-2xl">🤖</span>
          <span className="font-bold text-white text-sm leading-tight">Robotics<br />Inventory</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-700/40'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-800 p-2 space-y-1">
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <span>🔍</span>
            <span>Search</span>
            <span className="ml-auto text-xs bg-gray-800 text-gray-600 rounded px-1.5 py-0.5">Ctrl+K</span>
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{user?.name}</p>
              <p className="text-xs text-gray-600">{user?.role}</p>
            </div>
            <button
              onClick={() => navigate('/account')}
              className="text-xs text-gray-500 hover:text-gray-300"
              title="My account"
            >
              ⚙
            </button>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-400 transition-colors text-lg"
              title="Sign out"
            >
              ⏏
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <span className="font-bold text-white text-sm">Robotics Inventory</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2">
              {visibleNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-700/40'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`
                  }
                >
                  <span>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <NavLink
                to="/account"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              >
                <span>⚙</span>
                My account
              </NavLink>
            </nav>
            <div className="border-t border-gray-800 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-300">{user?.name}</p>
                  <p className="text-xs text-gray-600">{user?.role}</p>
                </div>
              </div>
              <button onClick={signOut} className="btn-ghost w-full text-xs">Sign out</button>
            </div>
          </aside>
        </div>
      )}

      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-16 left-0 right-0 bg-gray-900 border-t border-gray-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-200">More</h2>
              <button onClick={() => setMoreOpen(false)} className="text-gray-500">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {moreNav.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => { navigate(item.path); setMoreOpen(false); }}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs ${
                    location.pathname.startsWith(item.path)
                      ? 'border-indigo-600 bg-indigo-950/40 text-indigo-300'
                      : 'border-gray-800 text-gray-400'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { navigate('/account'); setMoreOpen(false); }}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs ${
                  location.pathname === '/account'
                    ? 'border-indigo-600 bg-indigo-950/40 text-indigo-300'
                    : 'border-gray-800 text-gray-400'
                }`}
              >
                <span className="text-xl">⚙</span>
                Account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-200 text-xl">☰</button>
          <span className="text-sm font-semibold text-gray-200">
            {visibleNav.find((n) => location.pathname.startsWith(n.path))?.label
              || (location.pathname === '/account' ? 'Account' : 'Inventory')}
          </span>
          <button onClick={onOpenSearch} className="text-gray-400 hover:text-gray-200">🔍</button>
        </header>

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-30">
          {mobileNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path) && !location.pathname.startsWith('/inventory/labels');
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {moreNav.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                moreActive ? 'text-indigo-400' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              <span className="text-xl">⋯</span>
              <span>More</span>
            </button>
          )}
        </nav>
      </div>
    </div>
  );
}
