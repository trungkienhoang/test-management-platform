import React from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const projectNavItems = [
    { name: 'Dự án (Projects)', path: '/projects', icon: '📁' },
    { name: 'Kho Test Suites & Cases', path: '/test-suites', icon: '📑' },
    { name: 'Test Runs', path: '/test-runs', icon: '▶️', badge: 'Sprint 3' },
    { name: 'Quản lý Bug', path: '/bugs', icon: '🐛', badge: 'Sprint 3' },
    { name: 'Dashboard', path: '/dashboard', icon: '📊', badge: 'Sprint 4' },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0 shadow-lg">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand header */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 shrink-0">
            <span className="text-2xl">🧪</span>
            <div>
              <h1 className="font-bold text-sm tracking-wide text-white">Test Platform</h1>
              <p className="text-xs text-emerald-400">v1.2 · Sprint 2</p>
            </div>
          </div>

          {/* Project modules navigation */}
          <div className="p-4 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
              Dự Án & Kiểm Thử
            </div>
            <nav className="space-y-1">
              {projectNavItems.map((item) => (
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

            {/* System Admin Section (Near bottom, above user footer) */}
            {user?.systemRole === 'ADMIN' && (
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="text-[10px] font-bold uppercase tracking-wider text-purple-400 px-3 mb-2 flex items-center gap-1.5">
                  <span>👑</span> Quản Trị Hệ Thống
                </div>
                <NavLink
                  to="/users"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-200 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <span>👥</span>
                    <span>Quản lý User</span>
                  </div>
                  <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/60">
                    Admin
                  </span>
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* User Profile in sidebar footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900/95">
          <Link
            to="/profile"
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition mb-2 group"
          >
            <div className="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow shrink-0">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition">
                {user?.fullName}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 truncate">{user?.email}</span>
                <span className="text-[10px] px-1 py-0.2 bg-indigo-900/80 text-indigo-300 rounded font-semibold border border-indigo-700">
                  {user?.systemRole}
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60 text-xs">
            <Link
              to="/profile"
              className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <span>⚙️</span> Hồ sơ
            </Link>

            <button
              onClick={handleLogout}
              className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-950/40 transition flex items-center gap-1"
            >
              <span>🚪</span> Đăng xuất
            </button>
          </div>
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
