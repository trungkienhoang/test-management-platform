import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dự án (Projects)', path: '/projects', icon: '📁' },
    { name: 'Test Suites', path: '/test-suites', icon: '📑', badge: 'Sprint 2' },
    { name: 'Test Runs', path: '/test-runs', icon: '▶️', badge: 'Sprint 3' },
    { name: 'Quản lý Bug', path: '/bugs', icon: '🐛', badge: 'Sprint 3' },
    { name: 'Dashboard', path: '/dashboard', icon: '📊', badge: 'Sprint 4' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Brand header */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
            <span className="text-2xl">🧪</span>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">Test Platform</h1>
              <p className="text-xs text-indigo-400">v1.0 · Sprint 1</p>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile in sidebar footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 truncate">{user?.email}</span>
                <span className="text-[10px] px-1 py-0.2 bg-indigo-900/80 text-indigo-300 rounded font-semibold border border-indigo-700">
                  {user?.systemRole}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-2 rounded transition flex items-center gap-2"
          >
            <span>🚪</span> Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Nền tảng Quản lý Kiểm thử Phần mềm
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="http://localhost:3001/api/docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-100 flex items-center gap-1.5 transition"
            >
              <span>📚</span> Swagger API Docs
            </a>
          </div>
        </header>

        {/* Dynamic page content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
