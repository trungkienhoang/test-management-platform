import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        await register(email, fullName, password);
      } else {
        await login(email, password);
      }
      navigate('/projects');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (isRegister ? 'Đăng ký không thành công' : 'Đăng nhập không thành công, vui lòng kiểm tra lại'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setIsRegister(false);
    setError(null);
    setIsLoading(true);
    try {
      await login(quickEmail, quickPass);
      navigate('/projects');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng nhập không thành công');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-3xl shadow-lg mb-3">
            🧪
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Test Management Platform</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister ? 'Tạo tài khoản mới để bắt đầu' : 'Đăng nhập vào hệ thống kiểm thử'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Họ và tên</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50"
          >
            {isLoading
              ? 'Đang xử lý...'
              : isRegister
              ? 'Tạo tài khoản'
              : 'Đăng nhập'}
          </button>
        </form>

        {/* Toggle between Login / Register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            {isRegister
              ? 'Đã có tài khoản? Đăng nhập ngay'
              : 'Chưa có tài khoản? Đăng ký tại đây'}
          </button>
        </div>

        {/* Quick Demo Logins */}
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
            ⚡ Tài khoản mẫu (Demo Seed)
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleQuickLogin('admin@testplatform.dev', 'Admin123!')}
              className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
            >
              <div className="font-semibold text-slate-700">👑 Admin</div>
              <div className="text-[10px] text-slate-400">admin@testplatform.dev</div>
            </button>
            <button
              onClick={() => handleQuickLogin('qa.lead@testplatform.dev', 'QaLead123!')}
              className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
            >
              <div className="font-semibold text-slate-700">🎯 QA Lead</div>
              <div className="text-[10px] text-slate-400">qa.lead@testplatform.dev</div>
            </button>
            <button
              onClick={() => handleQuickLogin('tester@testplatform.dev', 'Tester123!')}
              className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
            >
              <div className="font-semibold text-slate-700">🔍 Tester</div>
              <div className="text-[10px] text-slate-400">tester@testplatform.dev</div>
            </button>
            <button
              onClick={() => handleQuickLogin('dev@testplatform.dev', 'Dev12345!')}
              className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
            >
              <div className="font-semibold text-slate-700">💻 Developer</div>
              <div className="text-[10px] text-slate-400">dev@testplatform.dev</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
