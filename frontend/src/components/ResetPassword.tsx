/**
 * Public password-reset page — opened by the link an administrator
 * generates and shares with a user.
 *
 * Security notes:
 * - The one-time token is read from the URL query string via useSearchParams.
 * - It is never stored in localStorage, sessionStorage, or any state store
 *   other than this component's own local state for the duration of the
 *   form submission.
 * - It is never logged to the console.
 * - The Referrer-Policy header (set server-side in main.py) restricts
 *   referrer leakage; this page also avoids any external resources that
 *   would receive the token via the Referer header.
 * - This route does not require the user to be logged in.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
} from 'lucide-react';
import { api } from '../lib/api/client';
import AuthNavbar from './AuthNavbar';

type PageState = 'form' | 'success' | 'invalid_token' | 'error';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  // Token is read from the query string. It is held only in this component's
  // local state and submitted once to the reset endpoint — never logged,
  // never stored externally.
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageState, setPageState] = useState<PageState>(token ? 'form' : 'invalid_token');
  const [serverError, setServerError] = useState<string | null>(null);

  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const canSubmit = !isSubmitting && newPassword.length >= 8 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      await api.post('/api/v1/auth/reset-password', {
        token,
        new_password: newPassword,
      });
      // Clear the password from state on success — it has been submitted
      setNewPassword('');
      setConfirmPassword('');
      setPageState('success');
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('expired') ||
        msg.toLowerCase().includes('token')
      ) {
        setPageState('invalid_token');
      } else {
        setServerError(msg || 'We could not update your password. Please try again.');
        setPageState('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#041D15] flex flex-col relative overflow-x-hidden font-sans pt-[72px]">
      <Helmet>
        <title>Create a New Password — GroundKart</title>
        {/* Prevent search engines from indexing reset pages */}
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Navigation with logo only */}
      <AuthNavbar logoOnly />

      {/* Atmospheric background matching homepage */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <img
          src="/hero-party.webp"
          alt=""
          className="w-full h-full object-cover object-center opacity-30 filter blur-[1.5px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#032017]/90 via-[#06281D]/80 to-[#032017]/95" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[360px] bg-marigold/10 rounded-full blur-[120px]" />
      </div>

      {/* Main card viewport */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 sm:px-6 relative z-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/50 border border-white/20 overflow-hidden backdrop-blur-sm transition-all">

          {/* ---- Success State ---- */}
          {pageState === 'success' && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-in zoom-in-95 duration-200">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold font-display text-midnight tracking-tight">Password Updated</h1>
                <p className="text-chalk-600 text-sm leading-relaxed max-w-sm mx-auto">
                  Your password has been changed successfully. You can now sign in to GroundKart with your new password.
                </p>
              </div>
              <a
                href="/"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-pitch/20 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                Return to Login
              </a>
            </div>
          )}

          {/* ---- Invalid / expired token ---- */}
          {pageState === 'invalid_token' && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-500 shadow-sm animate-in zoom-in-95 duration-200">
                <AlertCircle size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold font-display text-midnight tracking-tight">Link Invalid or Expired</h1>
                <p className="text-chalk-600 text-sm leading-relaxed max-w-sm mx-auto">
                  This password-reset link is no longer valid. Links expire after 24 hours and can only be used once.
                </p>
                <p className="text-chalk-500 text-xs mt-2 max-w-xs mx-auto">
                  Please contact support or ask an administrator to issue a new recovery link.
                </p>
              </div>
              <a
                href="/"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-pitch/20 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                Return to Login
              </a>
            </div>
          )}

          {/* ---- Server error (non-token) ---- */}
          {pageState === 'error' && (
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-sm animate-in zoom-in-95 duration-200">
                <AlertCircle size={36} />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold font-display text-midnight tracking-tight">Something Went Wrong</h1>
                <p className="text-chalk-600 text-sm leading-relaxed max-w-sm mx-auto">
                  {serverError || 'We could not update your password. Please try again.'}
                </p>
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setPageState('form'); setServerError(null); }}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-pitch/20 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                >
                  Try Again
                </button>
                <a
                  href="/"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-chalk-600 hover:text-midnight transition-colors"
                >
                  <ArrowLeft size={14} /> Return to Login
                </a>
              </div>
            </div>
          )}

          {/* ---- Password Form ---- */}
          {pageState === 'form' && (
            <>
              {/* Card top banner matching AuthModal */}
              <div className="relative h-24 bg-gradient-to-br from-[#06281D] via-pitch to-[#145A3E] px-6 py-5 flex items-center justify-between overflow-hidden">
                <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-marigold/15 pointer-events-none" />
                <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <img src="/logo-icon.png" alt="GroundKart" className="w-5 h-5 object-contain drop-shadow" />
                    <span className="text-marigold text-[11px] font-bold tracking-wider uppercase">Account Recovery</span>
                  </div>
                  <p className="text-white font-display text-base font-bold">Secure Credential Reset</p>
                </div>
                <div className="relative z-10 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/15 shadow-sm">
                  <KeyRound size={20} />
                </div>
              </div>

              {/* Form body */}
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold font-display text-midnight tracking-tight mb-1.5">
                    Create a New Password
                  </h1>
                  <p className="text-chalk-600 text-sm leading-relaxed">
                    Enter and confirm your new password to regain access to your account.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {/* New Password */}
                  <div>
                    <label htmlFor="new-password" className="block text-xs font-semibold text-midnight uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chalk-400 group-focus-within:text-pitch transition-colors pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={255}
                        className={`w-full pl-10 pr-11 py-3 bg-chalk-50/70 focus:bg-white border rounded-xl text-sm text-midnight placeholder:text-chalk-400 focus:outline-none transition-all duration-150 ${
                          passwordTooShort
                            ? 'border-red-400 bg-red-50/40 focus:ring-4 focus:ring-red-500/10 focus:border-red-500'
                            : 'border-chalk-300 focus:border-pitch focus:ring-4 focus:ring-pitch/10'
                        }`}
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-chalk-400 hover:text-midnight hover:bg-chalk-100 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {passwordTooShort && (
                      <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>Password must be at least 8 characters.</span>
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirm-password" className="block text-xs font-semibold text-midnight uppercase tracking-wider mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative group">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-chalk-400 group-focus-within:text-pitch transition-colors pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <input
                        id="confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        className={`w-full pl-10 pr-11 py-3 bg-chalk-50/70 focus:bg-white border rounded-xl text-sm text-midnight placeholder:text-chalk-400 focus:outline-none transition-all duration-150 ${
                          confirmMismatch
                            ? 'border-red-400 bg-red-50/40 focus:ring-4 focus:ring-red-500/10 focus:border-red-500'
                            : 'border-chalk-300 focus:border-pitch focus:ring-4 focus:ring-pitch/10'
                        }`}
                        placeholder="Repeat your new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-chalk-400 hover:text-midnight hover:bg-chalk-100 transition-colors cursor-pointer"
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmMismatch && (
                      <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1.5 animate-in fade-in duration-150" role="alert">
                        <AlertCircle size={13} className="shrink-0" />
                        <span>Passwords do not match.</span>
                      </p>
                    )}
                  </div>

                  {/* Password requirements pill */}
                  <div className="bg-chalk-50 border border-chalk-200/90 rounded-xl p-3 text-xs space-y-2">
                    <span className="font-semibold text-chalk-600 block">Password requirements:</span>
                    <ul className="space-y-1.5">
                      <li className={`flex items-center gap-2 transition-colors ${newPassword.length >= 8 ? 'text-grass font-medium' : 'text-chalk-500'}`}>
                        {newPassword.length >= 8 ? (
                          <CheckCircle2 size={14} className="text-grass shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-chalk-400 ml-1 mr-0.5" />
                        )}
                        <span>At least 8 characters</span>
                      </li>
                      {confirmPassword.length > 0 && (
                        <li className={`flex items-center gap-2 transition-colors ${!confirmMismatch && newPassword.length >= 8 ? 'text-grass font-medium' : 'text-chalk-500'}`}>
                          {!confirmMismatch && newPassword.length >= 8 ? (
                            <CheckCircle2 size={14} className="text-grass shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-chalk-400 ml-1 mr-0.5" />
                          )}
                          <span>Passwords match</span>
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="group w-full py-3.5 px-5 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-pitch/25 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ease-out"
                  >
                    {isSubmitting ? (
                      <><Loader2 size={18} className="animate-spin" /> Updating Password...</>
                    ) : (
                      <>
                        <ShieldCheck size={18} className="transition-transform group-hover:scale-110" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Return link */}
                <div className="pt-2 text-center">
                  <a
                    href="/"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-chalk-600 hover:text-pitch transition-colors"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to Login</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
