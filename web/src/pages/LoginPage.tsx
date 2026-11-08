import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT';
type ForgotStep = 'EMAIL' | 'OTP' | 'NEW_PASSWORD';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [registerStep, setRegisterStep] = useState<'FORM' | 'OTP'>('FORM');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('EMAIL');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI status
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Resend cooldown timer
  const [countdown, setCountdown] = useState(0);

  const {
    login,
    sendRegisterOtp,
    verifyRegisterOtp,
    resendRegisterOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setRegisterStep('FORM');
    setForgotStep('EMAIL');
    setOtp('');
    setResetToken(null);
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setCountdown(0);
  };

  // ─── LOGIN SUBMIT ───────────────────────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/projects');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Đăng nhập không thành công, vui lòng kiểm tra lại email và mật khẩu',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── REGISTER SUBMIT ────────────────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (registerStep === 'FORM') {
        const res = await sendRegisterOtp(email, fullName, password);
        setInfoMessage(res.message);
        if (res.devOtp) {
          setOtp(res.devOtp);
        }
        setRegisterStep('OTP');
        setCountdown(60);
      } else {
        if (!otp || otp.trim().length !== 6) {
          setError('Vui lòng nhập đúng 6 chữ số mã OTP');
          setIsLoading(false);
          return;
        }
        await verifyRegisterOtp(email, otp.trim());
        navigate('/projects');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (registerStep === 'OTP'
            ? 'Xác thực OTP thất bại'
            : 'Gửi mã OTP đăng ký thất bại'),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD: BƯỚC 1 - GỬI OTP VỀ EMAIL ─────────────────────────────
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await forgotPassword(email);
      setInfoMessage(res.message);
      if (res.devOtp) {
        setOtp(res.devOtp);
      }
      setForgotStep('OTP');
      setCountdown(60);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD: BƯỚC 2 - XÁC THỰC MÃ OTP ─────────────────────────────
  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);

    if (!otp || otp.trim().length !== 6) {
      setError('Vui lòng nhập đầy đủ 6 chữ số mã OTP');
      return;
    }

    setIsLoading(true);

    try {
      // Chỉ khi verify OTP thành công trên máy chủ mới cấp resetToken và chuyển sang bước 3
      const res = await verifyResetOtp(email, otp.trim());
      setResetToken(res.resetToken);
      setInfoMessage('Xác thực OTP thành công! Vui lòng thiết lập mật khẩu mới.');
      setForgotStep('NEW_PASSWORD');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Mã xác thực OTP không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── FORGOT PASSWORD: BƯỚC 3 - LƯU MẬT KHẨU MỚI & VỀ TRANG ĐĂNG NHẬP ────────
  const handleForgotSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);

    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không trùng khớp');
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPassword({
        newPassword,
        resetToken: resetToken || undefined,
        email,
        otp: otp.trim(),
      });

      // Đổi mật khẩu thành công:
      // Chuyển ngay về màn hình ĐĂNG NHẬP, giữ lại email và hiển thị thông báo thành công xanh lá
      const rememberedEmail = res.email || email;
      switchMode('LOGIN');
      setEmail(rememberedEmail);
      setPassword('');
      setSuccessMessage(
        res.message || 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.',
      );
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Đổi mật khẩu thất bại. Vui lòng thử lại từ đầu.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── RESEND OTP ─────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (countdown > 0 || isLoading) return;
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'REGISTER') {
        const res = await resendRegisterOtp(email);
        setInfoMessage(res.message);
        if (res.devOtp) setOtp(res.devOtp);
      } else if (mode === 'FORGOT') {
        const res = await forgotPassword(email);
        setInfoMessage(res.message);
        if (res.devOtp) setOtp(res.devOtp);
      }
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── QUICK DEMO LOGINS ──────────────────────────────────────────────────────
  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    switchMode('LOGIN');
    setError(null);
    setInfoMessage(null);
    setSuccessMessage(null);
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
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-3xl shadow-lg mb-3 ${
              mode === 'FORGOT' ? 'bg-amber-600' : 'bg-indigo-600'
            }`}
          >
            {mode === 'FORGOT' ? '🔐' : '🧪'}
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Test Management Platform</h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'LOGIN' && 'Đăng nhập vào hệ thống kiểm thử'}
            {mode === 'REGISTER' &&
              (registerStep === 'OTP'
                ? 'Nhập mã xác thực gửi về hộp thư'
                : 'Đăng ký tài khoản mới bằng Email thực tế')}
            {mode === 'FORGOT' &&
              (forgotStep === 'EMAIL'
                ? 'Bước 1: Nhập email tài khoản cần khôi phục'
                : forgotStep === 'OTP'
                ? 'Bước 2: Xác nhận mã OTP đã gửi về hòm thư'
                : 'Bước 3: Thiết lập mật khẩu mới')}
          </p>
        </div>

        {/* Success message banner */}
        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded flex items-center gap-2">
            <span>✅</span>
            <span className="leading-relaxed font-medium">{successMessage}</span>
          </div>
        )}

        {/* Info message banner */}
        {infoMessage && (
          <div className="mb-4 p-3 bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800 text-xs rounded flex items-center gap-2">
            <span>📩</span>
            <span className="leading-relaxed">{infoMessage}</span>
          </div>
        )}

        {/* Error message banner */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs rounded leading-relaxed">
            {error}
          </div>
        )}

        {/* ─── VIEW 1: FORM ĐĂNG NHẬP (LOGIN) ─── */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Địa chỉ Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Mật khẩu *</label>
                <button
                  type="button"
                  onClick={() => switchMode('FORGOT')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* ─── VIEW 2: FORM ĐĂNG KÝ (REGISTER) ─── */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {registerStep === 'FORM' ? (
              <>
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ Email (Gmail thực tế) *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Hệ thống sẽ gửi mã xác thực 6 số về địa chỉ email này.
                  </p>
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
                  {isLoading ? 'Đang xử lý...' : '📩 Gửi mã OTP xác thực Email'}
                </button>
              </>
            ) : (
              /* Register Step OTP */
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
                    className="text-slate-500 hover:text-slate-800 transition"
                  >
                    ← Sửa thông tin
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
        )}

        {/* ─── VIEW 3: LUỒNG QUÊN MẬT KHẨU 3 BƯỚC (FORGOT PASSWORD) ─── */}
        {mode === 'FORGOT' && (
          <div className="space-y-4">
            {/* Visual Step Indicator */}
            <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100 text-[11px]">
              <div
                className={`flex items-center gap-1 font-semibold ${
                  forgotStep === 'EMAIL' ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    forgotStep === 'EMAIL'
                      ? 'bg-amber-600 text-white'
                      : forgotStep === 'OTP' || forgotStep === 'NEW_PASSWORD'
                      ? 'bg-emerald-100 text-emerald-700 font-bold'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {forgotStep === 'OTP' || forgotStep === 'NEW_PASSWORD' ? '✓' : '1'}
                </span>
                <span>Nhập Email</span>
              </div>

              <span className="text-slate-300">→</span>

              <div
                className={`flex items-center gap-1 font-semibold ${
                  forgotStep === 'OTP' ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    forgotStep === 'OTP'
                      ? 'bg-amber-600 text-white'
                      : forgotStep === 'NEW_PASSWORD'
                      ? 'bg-emerald-100 text-emerald-700 font-bold'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {forgotStep === 'NEW_PASSWORD' ? '✓' : '2'}
                </span>
                <span>Nhập OTP</span>
              </div>

              <span className="text-slate-300">→</span>

              <div
                className={`flex items-center gap-1 font-semibold ${
                  forgotStep === 'NEW_PASSWORD' ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    forgotStep === 'NEW_PASSWORD'
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  3
                </span>
                <span>Mật khẩu mới</span>
              </div>
            </div>

            {/* BƯỚC 1: NHẬP EMAIL */}
            {forgotStep === 'EMAIL' && (
              <form onSubmit={handleForgotSendOtp} className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Nhập địa chỉ email tài khoản của bạn. Hệ thống sẽ gửi mã xác thực OTP 6 số để bạn tiến hành đặt lại mật khẩu.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Địa chỉ Email của tài khoản *
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full mt-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Đang gửi mã...' : '📩 Gửi mã OTP xác thực'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('LOGIN')}
                    className="text-xs text-slate-500 hover:text-slate-800 transition font-medium"
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            )}

            {/* BƯỚC 2: NHẬP OTP XÁC NHẬN (ĐÚNG MỚI CHUYỂN SANG BƯỚC 3) */}
            {forgotStep === 'OTP' && (
              <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                  <span className="text-[11px] text-amber-700">Mã OTP đặt lại mật khẩu đã gửi tới:</span>
                  <div className="text-xs font-bold text-amber-900 font-mono mt-0.5">{email}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                    Nhập mã OTP 6 số từ email *
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full px-4 py-3 text-center tracking-[10px] font-mono text-2xl font-bold rounded-xl border-2 border-amber-500 bg-amber-50/20 text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                  <p className="text-[11px] text-slate-400 text-center mt-1">
                    Mã có hiệu lực trong vòng 5 phút
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Đang kiểm tra OTP...' : '✅ Xác nhận mã OTP →'}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('EMAIL');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-slate-500 hover:text-slate-800 transition"
                  >
                    ← Đổi email
                  </button>

                  <button
                    type="button"
                    disabled={countdown > 0 || isLoading}
                    onClick={handleResendOtp}
                    className={`font-semibold ${
                      countdown > 0
                        ? 'text-slate-400 cursor-not-allowed'
                        : 'text-amber-600 hover:text-amber-800'
                    }`}
                  >
                    {countdown > 0 ? `Gửi lại sau (${countdown}s)` : 'Gửi lại mã OTP'}
                  </button>
                </div>

                <div className="text-center pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => switchMode('LOGIN')}
                    className="text-xs text-slate-400 hover:text-slate-600 transition"
                  >
                    Hủy & Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            )}

            {/* BƯỚC 3: NHẬP MẬT KHẨU MỚI (CHỈ XUẤT HIỆN SAU KHI OTP ĐÃ ĐÚNG) */}
            {forgotStep === 'NEW_PASSWORD' && (
              <form onSubmit={handleForgotSetNewPassword} className="space-y-3.5">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[11px] text-emerald-700">✓ Mã OTP đã được xác thực thành công cho:</span>
                  <div className="text-xs font-bold text-emerald-900 font-mono mt-0.5">{email}</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mật khẩu mới *
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự (chữ hoa, chữ thường, số)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Xác nhận lại mật khẩu mới *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới vừa điền"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? 'Đang cập nhật...' : '💾 Lưu mật khẩu mới & Đăng nhập'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => switchMode('LOGIN')}
                    className="text-xs text-slate-500 hover:text-slate-800 transition font-medium"
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Chuyển đổi giữa Đăng nhập / Đăng ký */}
        {mode !== 'FORGOT' && (
          <div className="mt-6 text-center">
            <button
              onClick={() => switchMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
            >
              {mode === 'LOGIN'
                ? 'Chưa có tài khoản? Đăng ký tài khoản mới'
                : 'Đã có tài khoản? Đăng nhập ngay'}
            </button>
          </div>
        )}

        {mode === 'FORGOT' && (
          <div className="mt-4 text-center border-t border-slate-100 pt-3">
            <button
              onClick={() => switchMode('LOGIN')}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition"
            >
              ← Quay lại màn hình Đăng nhập
            </button>
          </div>
        )}

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
