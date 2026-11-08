import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [registerStep, setRegisterStep] = useState<'FORM' | 'OTP'>('FORM');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');

  // UI status
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Resend cooldown timer
  const [countdown, setCountdown] = useState(0);

  const { login, sendRegisterOtp, verifyRegisterOtp, resendRegisterOtp } = useAuth();
  const navigate = useNavigate();

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle Login or Step 1 of Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        if (registerStep === 'FORM') {
          // Gửi OTP
          const res = await sendRegisterOtp(email, fullName, password);
          setInfoMessage(res.message);
          if (res.devOtp) {
            setOtp(res.devOtp);
          }
          setRegisterStep('OTP');
          setCountdown(60); // 60s cooldown
        } else {
          // Xác thực OTP
          if (!otp || otp.trim().length !== 6) {
            setError('Vui lòng nhập đúng 6 chữ số mã OTP');
            setIsLoading(false);
            return;
          }
          await verifyRegisterOtp(email, otp.trim());
          navigate('/projects');
        }
      } else {
        // Đăng nhập thường
        await login(email, password);
        navigate('/projects');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (isRegister
            ? registerStep === 'OTP'
              ? 'Xác thực OTP thất bại'
              : 'Gửi mã OTP thất bại'
            : 'Đăng nhập không thành công, vui lòng kiểm tra lại thông tin'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || isLoading) return;
    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    try {
      const res = await resendRegisterOtp(email);
      setInfoMessage(res.message);
      if (res.devOtp) {
        setOtp(res.devOtp);
      }
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setIsRegister(false);
    setRegisterStep('FORM');
    setError(null);
    setInfoMessage(null);
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
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white text-3xl shadow-lg mb-3">
            🧪
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Test Management Platform</h2>
          <p className="text-sm text-slate-500 mt-1">
            {isRegister
              ? registerStep === 'OTP'
                ? 'Nhập mã xác thực gửi về hộp thư'
                : 'Đăng ký tài khoản mới bằng Email thực tế'
              : 'Đăng nhập vào hệ thống kiểm thử'}
          </p>
        </div>

        {/* Info message */}
        {infoMessage && (
          <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 text-xs rounded flex items-center gap-2">
            <span>📩</span>
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STEP 1: Registration Form or Login Form */}
          {(!isRegister || registerStep === 'FORM') && (
            <>
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Họ và tên *
                  </label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Địa chỉ Email {isRegister ? '(Gmail thực tế) *' : '*'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isRegister && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống sẽ gửi mã xác thực 6 số về địa chỉ email này.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mật khẩu *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự (chữ hoa, chữ thường, số)"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span>Đang xử lý...</span>
                ) : isRegister ? (
                  <span>📩 Gửi mã OTP xác thực Email</span>
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>
            </>
          )}

          {/* STEP 2: OTP Verification Form */}
          {isRegister && registerStep === 'OTP' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <span className="text-xs text-slate-500">Mã xác thực đã gửi tới:</span>
                <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                  Nhập mã OTP gồm 6 chữ số *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-4 py-3 text-center tracking-[10px] font-mono text-2xl font-bold rounded-xl border-2 border-indigo-500 bg-indigo-50/30 text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-[11px] text-slate-400 text-center mt-1">
                  Mã có hiệu lực trong vòng 5 phút
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? 'Đang xác thực...' : '✅ Xác nhận & Hoàn tất đăng ký'}
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterStep('FORM');
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="text-slate-500 hover:text-slate-800"
                >
                  ← Đổi email / Sửa thông tin
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || isLoading}
                  onClick={handleResendOtp}
                  className={`font-semibold ${
                    countdown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-indigo-600 hover:text-indigo-800'
                  }`}
                >
                  {countdown > 0 ? `Gửi lại sau (${countdown}s)` : 'Gửi lại mã OTP'}
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Toggle between Login / Register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setRegisterStep('FORM');
              setError(null);
              setInfoMessage(null);
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            {isRegister
              ? 'Đã có tài khoản? Đăng nhập ngay'
              : 'Chưa có tài khoản? Đăng ký tài khoản mới'}
          </button>
        </div>

        {/* Quick Demo Logins */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5 text-center">
            ⚡ Đăng nhập nhanh tài khoản mẫu (Demo)
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
