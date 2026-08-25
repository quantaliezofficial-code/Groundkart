import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { api } from '../lib/api/client';

export default function ForgotPassword() {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ message: string; dev_token?: string }>(
        '/api/v1/auth/forgot-password',
        { email }
      );
      if (res.dev_token) setDevToken(res.dev_token);
      setStep('reset');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post('/api/v1/auth/reset-password', { token, new_password: newPassword });
      setStep('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid or expired token';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <Helmet>
        <title>Reset Password — GroundBooking</title>
      </Helmet>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {step === 'request' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot password?</h1>
            <p className="text-gray-500 mb-6">Enter your email and we'll send a reset link.</p>
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <form onSubmit={handleRequest} className="space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        {step === 'reset' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h1>
            <p className="text-gray-500 mb-4">Enter the reset token from your email and your new password.</p>
            {devToken && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Dev mode — token (remove in production):</p>
                <code className="text-xs text-yellow-900 break-all">{devToken}</code>
              </div>
            )}
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label htmlFor="reset-token" className="block text-sm font-medium text-gray-700 mb-1">Reset token</label>
                <input
                  id="reset-token"
                  type="text"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                  placeholder="Paste your reset token"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="At least 8 characters"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="text-center">
            <p className="text-4xl mb-4">✅</p>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h1>
            <p className="text-gray-500 mb-6">You can now log in with your new password.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors"
            >
              Go to home
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link to="/" className="text-green-600 hover:underline">Back to home</Link>
          </p>
        )}
      </div>
    </div>
  );
}
