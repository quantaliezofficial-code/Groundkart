import { CheckCircle, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api/client';
import AuthNavbar from './AuthNavbar';

interface ForgotPasswordProps {
  onBackToLogin?: () => void;
  inModal?: boolean;
}

export default function ForgotPassword({ onBackToLogin, inModal = false }: ForgotPasswordProps) {
  const [loginId, setLoginId] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ message: string }>('/api/v1/auth/forgot-password', {
        login_id: loginId.trim(),
      });
      setMessage(res.message || 'If an account exists, our support team will contact you to complete the reset.');
      setIsSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = isSubmitted ? (
    <div className="text-center py-4 space-y-4">
      <CheckCircle size={48} className="text-pitch mx-auto text-green-600 animate-in zoom-in-95 duration-200" />
      <h2 className="text-xl font-bold font-display text-gray-900">Request Received</h2>
      <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
        {message}
      </p>
      <p className="text-xs text-gray-500">
        Please expect a support representative to reach out to verify your account out-of-band.
      </p>
      <div className="pt-4">
        {onBackToLogin ? (
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl text-sm font-semibold hover:shadow-md transition cursor-pointer"
          >
            Return to login
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-pitch to-[#1a5438] text-white rounded-xl text-sm font-semibold hover:shadow-md transition"
          >
            Return to home
          </Link>
        )}
      </div>
    </div>
  ) : (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-gray-900 mb-1.5">Forgot password?</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Enter your phone or email to request a password reset.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl animate-in fade-in duration-150">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login_id" className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5">
            Phone or email
          </label>
          <input
            id="login_id"
            type="text"
            required
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50/70 focus:bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-pitch focus:ring-4 focus:ring-pitch/10 text-sm text-gray-900 placeholder:text-gray-400 transition-all duration-150"
            placeholder="Enter phone number or email address"
            autoComplete="username"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !loginId.trim()}
          className="w-full bg-gradient-to-r from-pitch to-[#1a5438] text-white py-3.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:shadow-pitch/20 active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </>
          ) : (
            'Request password reset'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        {onBackToLogin ? (
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-pitch transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} /> Back to login
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-pitch transition-colors"
          >
            <ArrowLeft size={13} /> Back to home
          </Link>
        )}
      </div>
    </>
  );

  if (inModal) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <div className="min-h-screen bg-[#041D15] flex flex-col relative overflow-hidden font-sans pt-[72px]">
      <Helmet>
        <title>Forgot Password — GroundKart</title>
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

      <main className="flex-grow flex items-center justify-center px-4 py-12 sm:px-6 relative z-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-black/50 border border-white/20 overflow-hidden backdrop-blur-sm transition-all">
          {/* Card top banner matching AuthModal */}
          <div className="relative h-24 bg-gradient-to-br from-[#06281D] via-pitch to-[#145A3E] px-6 py-5 flex items-center justify-between overflow-hidden">
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-marigold/15 pointer-events-none" />
            <div className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <img src="/logo-icon.webp" alt="GroundKart" className="w-5 h-5 object-contain drop-shadow" />
                <span className="text-marigold text-[11px] font-bold tracking-wider uppercase">Account Recovery</span>
              </div>
              <p className="text-white font-display text-base font-bold">Forgot Your Password?</p>
            </div>
            <div className="relative z-10 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/15 shadow-sm">
              <KeyRound size={20} />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {content}
          </div>
        </div>
      </main>
    </div>
  );
}
