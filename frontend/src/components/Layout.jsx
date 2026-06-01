import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { NAV_ITEMS } from '../lib/constants';
import { hasPermission } from '../lib/permissions';

export default function Layout({ children, onOpenSearch }) {
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const visibleNav = NAV_ITEMS.filter((n) =>
    !n.permission || hasPermission(user, n.permission)
  );
  // Bottom nav: first 4 items only
  const mobileNav = visibleNav.slice(0, 4);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-gray-800">
          <span className="text-2xl">🤖</span>
          <span className="font-bold text-white text-sm leading-tight">Robotics<br />Inventory</span>
        </div>

        {/* Nav links */}
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

        {/* Search + User */}
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
              onClick={signOut}
              className="text-gray-600 hover:text-gray-400 transition-colors text-lg"
              title="Sign out"
            >
              ⏏
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile overlay sidebar ─────────────────────────────────────── */}
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

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gray-200 text-xl">☰</button>
          <span className="text-sm font-semibold text-gray-200">
            {visibleNav.find((n) => location.pathname.startsWith(n.path))?.label || 'Inventory'}
          </span>
          <button onClick={onOpenSearch} className="text-gray-400 hover:text-gray-200">🔍</button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* ── Bottom nav (mobile) ──────────────────────────────────────── */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-30">
          {mobileNav.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
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
        </nav>
      </div>
    </div>
  );
}
