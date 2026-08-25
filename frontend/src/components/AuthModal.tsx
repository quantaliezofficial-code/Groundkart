import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User as UserIcon, X } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { ApiError } from '../lib/api/client';
import { useAuth } from '../lib/auth';

interface AuthModalProps {
  mode: 'login' | 'signup';
  onClose: () => void;
  onSwitchMode: (mode: 'login' | 'signup') => void;
  onSuccess: (role?: 'client' | 'owner') => void;
}

export default function AuthModal({ mode, onClose, onSwitchMode, onSuccess }: AuthModalProps) {
  const { login, signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'client' | 'owner'>('client');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const isSignup = mode === 'signup';

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Autofocus first field
  useEffect(() => {
    setTimeout(() => {
      if (isSignup && nameRef.current) nameRef.current.focus();
      else if (emailRef.current) emailRef.current.focus();
    }, 200);
  }, [isSignup]);

  // Clear error on mode switch
  useEffect(() => {
    setError(null);
  }, [mode]);

  function handleClose() {
    setIsVisible(false);
    setTimeout(onClose, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isSignup) {
        await signup(name, email, password, phone ? phone : undefined);
        onSuccess(accountType);
      } else {
        await login(email, password);
        onSuccess();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Password strength indicator
  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', 'bg-clay', 'bg-marigold', 'bg-pitch'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center px-4 transition-all duration-300 ${
        isVisible ? 'bg-ink/50 backdrop-blur-sm' : 'bg-ink/0'
      }`}
      onClick={handleClose}
      role="presentation"
    >
      <div
        className={`relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-chalk shadow-2xl transition-all duration-300 ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        {/* ── Top accent banner ── */}
        <div className="relative h-28 bg-gradient-to-br from-[#143828] via-pitch to-[#1a5438] overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-marigold/10" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5" />
          <div className="absolute top-4 right-4">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="p-1.5 rounded-full bg-white/10 text-chalk/70 hover:bg-white/20 hover:text-chalk transition-all cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="absolute bottom-5 left-7">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-marigold/20 flex items-center justify-center">
                <Sparkles size={16} className="text-marigold" />
              </div>
              <span className="text-chalk/50 text-xs font-medium tracking-wider uppercase">GroundBooking</span>
            </div>
            <h2 id="auth-modal-title" className="font-display text-[22px] font-semibold text-chalk leading-tight">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
          </div>
        </div>

        {/* ── Form body ── */}
        <div className="px-7 pt-6 pb-7">

          {/* Error message */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-clay/8 border border-clay/15 p-3.5 text-[13px] text-clay animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name field (signup only) */}
            {isSignup && (
              <div className="space-y-1.5">
                <label htmlFor="auth-name" className="block text-[13px] font-semibold text-ink/70">
                  Full name
                </label>
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/25 group-focus-within:text-pitch transition-colors">
                    <UserIcon size={16} />
                  </span>
                  <input
                    ref={nameRef}
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-ink/10 bg-mist/50 pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-pitch/30 focus:ring-2 focus:ring-pitch/10 focus:bg-chalk transition-all"
                    placeholder="Your full name"
                  />
                </div>
              </div>
            )}

            {/* Account type field (signup only) */}
            {isSignup && (
              <div className="space-y-1.5">
                <label className="block text-[13px] font-semibold text-ink/70">
                  I want to...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAccountType('client')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                      accountType === 'client'
                        ? 'border-pitch bg-pitch/5 text-pitch'
                        : 'border-ink/10 bg-mist/50 text-ink/50 hover:bg-chalk hover:text-ink/80'
                    }`}
                  >
                    Book Venues
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('owner')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
                      accountType === 'owner'
                        ? 'border-pitch bg-pitch/5 text-pitch'
                        : 'border-ink/10 bg-mist/50 text-ink/50 hover:bg-chalk hover:text-ink/80'
                    }`}
                  >
                    List a Venue
                  </button>
                </div>
              </div>
            )}

                        {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="block text-[13px] font-semibold text-ink/70">
                {isSignup ? 'Email address (optional)' : 'Email or Phone number'}
              </label>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/25 group-focus-within:text-pitch transition-colors">
                  <Mail size={16} />
                </span>
                <input
                  ref={emailRef}
                  id="auth-email"
                  type={isSignup ? "email" : "text"}
                  required={!isSignup}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-mist/50 pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-pitch/30 focus:ring-2 focus:ring-pitch/10 focus:bg-chalk transition-all"
                  placeholder={isSignup ? "you@example.com" : "you@example.com or phone"}
                />
              </div>
            </div>

            {/* Phone field (signup only) */}
            {isSignup && (
              <div className="space-y-1.5">
                <label htmlFor="auth-phone" className="block text-[13px] font-semibold text-ink/70">
                  Phone number
                </label>
                <div className="relative group">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/25 group-focus-within:text-pitch transition-colors">
                    <UserIcon size={16} />
                  </span>
                  <input
                    id="auth-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-ink/10 bg-mist/50 pl-10 pr-4 py-3 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-pitch/30 focus:ring-2 focus:ring-pitch/10 focus:bg-chalk transition-all"
                    placeholder="Your phone number"
                  />
                </div>
              </div>
            )}

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="block text-[13px] font-semibold text-ink/70">
                Password
              </label>
              <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/25 group-focus-within:text-pitch transition-colors">
                  <Lock size={16} />
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink/10 bg-mist/50 pl-10 pr-12 py-3 text-sm text-ink placeholder:text-ink/30 outline-none focus:border-pitch/30 focus:ring-2 focus:ring-pitch/10 focus:bg-chalk transition-all"
                  placeholder={isSignup ? 'Min. 8 characters' : 'Enter your password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink/30 hover:text-ink/60 transition-colors cursor-pointer rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password strength (signup only) */}
              {isSignup && password.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          passwordStrength >= level ? strengthColors[passwordStrength] : 'bg-ink/8'
                        }`}
                      />
                    ))}
                  </div>
                  <span className={`text-[11px] font-medium ${
                    passwordStrength === 1 ? 'text-clay' : passwordStrength === 2 ? 'text-marigold' : 'text-pitch'
                  }`}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pitch to-[#1a5438] py-3.5 font-semibold text-chalk transition-all hover:shadow-lg hover:shadow-pitch/20 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2 cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isSignup ? 'Create account' : 'Log in'}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-ink/8" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-chalk px-3 text-[11px] font-medium text-ink/30 uppercase tracking-widest">or</span>
            </div>
          </div>

          {/* Switch mode */}
          <p className="text-center text-[13px] text-ink/50">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => onSwitchMode(isSignup ? 'login' : 'signup')}
              className="font-semibold text-pitch hover:text-pitch/80 transition-colors cursor-pointer"
            >
              {isSignup ? 'Log in instead' : 'Create one free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}


