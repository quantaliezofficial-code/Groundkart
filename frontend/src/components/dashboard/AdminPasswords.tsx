import { useState, useMemo, useRef } from 'react';
import {
  useAdminUsersPaginated,
  useAdminResetPassword,
  useAdminPasswordResetRequests,
  useAdminCancelPasswordResetRequest,
} from '../../hooks/useAdmin';
import type { ApiAdminUserView, ApiAdminPasswordResetRequestView } from '../../lib/api/types';
import type { AdminPasswordResetMethod, AdminPasswordResetResponse } from '../../lib/api/types';

import { Search, Loader2, Key, Copy, Check, ExternalLink, RefreshCw, Clock, X } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export default function AdminPasswords() {
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'owner'>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsersPaginated(
    roleFilter === 'all' ? {} : { role: roleFilter }
  );
  const users = useMemo(() => data?.pages.flat() ?? [], [data]);

  const filtered = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const [resetUser, setResetUser] = useState<ApiAdminUserView | null>(null);
  const [initialDialogResult, setInitialDialogResult] = useState<ResetResult | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const { data: pendingRequests, isLoading: isLoadingPending } = useAdminPasswordResetRequests?.() ?? { data: [] };
  const resetMutation = useAdminResetPassword();
  const cancelMutation = useAdminCancelPasswordResetRequest();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleGenerateLink = async (req: ApiAdminPasswordResetRequestView) => {
    try {
      setGeneratingId(req.id);
      const res = await resetMutation.mutateAsync({
        userId: req.user_id,
        data: {
          method: 'link',
          reason: 'User requested password recovery',
          source_type: 'user',
          source_id: req.id,
        },
      });
      setResetUser({
        id: req.user_id,
        name: req.name,
        email: req.contact,
        role: 'customer' as any,
        created_at: req.created_at,
        suspended_at: null,
        suspension_reason: null,
      });
      setInitialDialogResult({ ...res, method: 'link' });
    } catch (err) {
      console.error('Failed to generate reset link:', err);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm('Are you sure you want to cancel this password reset request?')) {
      return;
    }
    try {
      setCancellingId(requestId);
      await cancelMutation.mutateAsync({ requestId });
    } catch (err) {
      console.error('Failed to cancel reset request:', err);
      alert('Failed to cancel request. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-display text-midnight">Password Management</h1>
        <p className="text-chalk-600 mt-2 font-sans">Secure account recovery and administrator-assisted password resets.</p>
      </div>

      {/* Pending Reset Requests Section */}
      <div className="rounded-2xl border border-chalk-300 bg-white overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-chalk-200 bg-chalk-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-grass" />
            <h2 className="text-lg font-bold font-display text-midnight">Pending Reset Requests</h2>
            {pendingRequests && pendingRequests.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-grass/10 text-grass-800 rounded-full">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <p className="text-xs text-chalk-500 hidden sm:block">
            Verify caller out-of-band before issuing recovery link
          </p>
        </div>

        {isLoadingPending ? (
          <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-grass" size={20} /></div>
        ) : !pendingRequests || pendingRequests.length === 0 ? (
          <div className="p-6 text-center text-sm text-chalk-600">No pending password reset requests.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead className="bg-chalk-100/50 border-b border-chalk-200 text-xs font-semibold text-midnight">
                <tr>
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Masked Contact</th>
                  <th className="px-6 py-3">Requested At</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk-200 text-sm">
                {pendingRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-chalk-50">
                    <td className="px-6 py-4 font-medium text-midnight">{req.name}</td>
                    <td className="px-6 py-4 text-chalk-600 font-mono text-xs">{req.contact}</td>
                    <td className="px-6 py-4 text-chalk-500 text-xs">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="px-3.5 py-1.5 bg-grass text-white text-xs font-semibold rounded-lg hover:bg-grass-600 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-colors cursor-pointer"
                          onClick={() => handleGenerateLink(req)}
                          disabled={generatingId === req.id || cancellingId === req.id}
                        >
                          {generatingId === req.id ? (
                            <><Loader2 size={13} className="animate-spin" /> Generating...</>
                          ) : (
                            <><Key size={13} /> Generate link</>
                          )}
                        </button>
                        <button
                          type="button"
                          title="Cancel request"
                          aria-label="Cancel request"
                          className="p-1.5 text-chalk-500 hover:text-clay hover:bg-clay/10 rounded-lg border border-chalk-200 hover:border-clay/30 transition-colors disabled:opacity-50 cursor-pointer inline-flex items-center justify-center"
                          onClick={() => handleCancelRequest(req.id)}
                          disabled={generatingId === req.id || cancellingId === req.id}
                        >
                          {cancellingId === req.id ? (
                            <Loader2 size={14} className="animate-spin text-clay" />
                          ) : (
                            <X size={14} className="text-current" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-chalk-500" size={20} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border rounded-md pl-10"
            />
          </div>
          <select className="w-40 px-3 py-2 border rounded-md" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
            <option value="all">All Roles</option>
            <option value="customer">Customers</option>
            <option value="owner">Owners</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-chalk-300 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-grass" size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-chalk-600">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead className="bg-chalk-100 border-b border-chalk-300 text-sm font-semibold text-midnight">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-chalk-200">
                {filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-chalk-50">
                    <td className="px-6 py-4">
                      {/* Name only — UUID removed from primary display */}
                      <div className="font-medium text-midnight">{user.name}</div>
                      <div className="text-xs text-chalk-400 mt-0.5 capitalize">{user.role}</div>
                    </td>
                    <td className="px-6 py-4">
                      {/* Email once, followed by phone only when a real number exists */}
                      <div className="text-sm text-midnight">{user.email}</div>
                      {user.phone && (
                        <div className="text-sm text-chalk-600">{user.phone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-sm font-medium">{user.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.suspended_at ? 'suspended' : 'active'} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="px-3.5 py-2 bg-grass text-white text-xs font-semibold rounded-lg hover:bg-grass-600 disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shadow-sm transition-colors cursor-pointer"
                        onClick={() => setResetUser(user)}
                      >
                        <Key size={14} />
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasNextPage && (
          <div className="p-4 border-t border-chalk-300 bg-chalk-50 flex justify-center">
            <button
              className="px-5 py-2 bg-grass text-white text-sm font-semibold rounded-lg hover:bg-grass-600 disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          initialResult={initialDialogResult}
          onClose={() => {
            setResetUser(null);
            setInitialDialogResult(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reset Password Dialog
// ---------------------------------------------------------------------------

const REASON_OPTIONS = [
  'User requested password recovery',
  'Account setup after approval',
  'Support request',
  'Suspected account compromise',
  'Administrative correction',
  'Other',
] as const;

type ResetResult = AdminPasswordResetResponse & { method: AdminPasswordResetMethod };

function ResetPasswordDialog({
  user,
  initialResult = null,
  onClose,
}: {
  user: ApiAdminUserView;
  initialResult?: ResetResult | null;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<AdminPasswordResetMethod>(initialResult?.method || 'link');
  const [reason, setReason] = useState<string>(REASON_OPTIONS[0]);
  const [result, setResult] = useState<ResetResult | null>(initialResult);
  const [copied, setCopied] = useState(false);
  const resetMutation = useAdminResetPassword();
  const linkInputRef = useRef<HTMLInputElement>(null);

  const primaryLabel =
    method === 'link' ? 'Generate Reset Link' :
    method === 'temporary' ? 'Generate Temporary Password' :
    'Require Reset at Next Login';

  const handleReset = async () => {
    try {
      const res = await resetMutation.mutateAsync({
        userId: user.id,
        data: { method, reason, source_type: 'admin_dashboard' },
      });
      setResult({ ...res, method });
    } catch (e: any) {
      // Error is surfaced via resetMutation.error below
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API failed — the input field remains visible and selectable
      linkInputRef.current?.select();
    }
  };

  // Close handler — clears result (and therefore the reset URL from memory)
  const handleClose = () => {
    setResult(null);
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-chalk-200 flex justify-between items-center bg-chalk-50">
          <h2 className="text-xl font-bold font-display text-midnight flex items-center gap-2">
            <Key size={20} className="text-grass" />
            Reset Password
          </h2>
          <button onClick={handleClose} className="text-chalk-500 hover:text-midnight" aria-label="Close dialog">
            ✕
          </button>
        </div>

        <div className="flex-1 min-h-0 p-6 overflow-y-auto custom-scrollbar" data-lenis-prevent>
          {result ? (
            /* ---- Result state ---- */
            <div className="space-y-5">
              {/* User summary */}
              <div className="bg-chalk-50 border border-chalk-200 rounded-xl p-4">
                <p className="text-xs text-chalk-500 uppercase font-semibold tracking-wide mb-2">
                  {result.method === 'link' ? 'Password Reset Link Ready' :
                   result.method === 'temporary' ? 'Temporary Password Generated' :
                   'Password Reset Required'}
                </p>
                <div className="text-sm text-midnight space-y-1">
                  <div><span className="font-semibold">User:</span> {user.name}</div>
                  <div><span className="font-semibold">Email:</span> {user.email}</div>
                  <div><span className="font-semibold">Role:</span> <span className="capitalize">{user.role}</span></div>
                </div>
              </div>

              {result.reset_url && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-midnight">Reset Link</p>
                  <p className="text-xs text-chalk-600">
                    Copy this link and share it directly with the user. This link is valid for 24 hours and can only be used once.
                  </p>
                  {/* Selectable URL field — clipboard fallback if writeText fails */}
                  <div className="relative">
                    <input
                      ref={linkInputRef}
                      readOnly
                      value={result.reset_url}
                      aria-label="Password reset link"
                      className="w-full px-3 py-2.5 pr-12 border border-chalk-300 rounded-xl bg-chalk-50 text-sm font-mono text-midnight select-all focus:outline-none focus:ring-2 focus:ring-grass"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                  <button
                    onClick={() => handleCopy(result.reset_url!)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-grass text-white rounded-xl hover:bg-grass-600 font-semibold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <><Check size={16} /> Link Copied</>
                    ) : (
                      <><Copy size={16} /> Copy Reset Link</>
                    )}
                  </button>
                </div>
              )}

              {result.temp_password && (
                <div className="bg-chalk-100 p-4 rounded-xl border border-chalk-300">
                  <p className="text-sm font-bold text-midnight mb-2">Temporary Password (reveal once):</p>
                  <div className="relative">
                    <input
                      readOnly
                      value={result.temp_password}
                      aria-label="Temporary password"
                      className="w-full px-3 py-2.5 pr-12 border border-chalk-300 bg-white rounded-lg text-lg font-mono text-center select-all focus:outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                  </div>
                  <button
                    onClick={() => handleCopy(result.temp_password!)}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 bg-grass text-white rounded-lg hover:bg-grass-600 font-semibold text-sm shadow-sm transition-colors cursor-pointer"
                  >
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy Password</>}
                  </button>
                  <p className="text-xs text-chalk-600 mt-2 text-center">User must change this upon next login.</p>
                </div>
              )}

              {result.method === 'force' && (
                <div className="bg-grass/10 border border-grass/30 text-grass-800 p-4 rounded-xl">
                  <p className="font-medium text-sm">
                    The user will be prompted to change their password the next time they sign in with their current credentials.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t border-chalk-200">
                <button
                  className="flex items-center gap-1.5 px-4 py-2 bg-chalk-100 text-ink rounded-lg hover:bg-chalk-200 text-sm font-semibold transition-colors cursor-pointer"
                  onClick={() => { setResult(null); setCopied(false); }}
                >
                  <RefreshCw size={14} /> Generate New Link
                </button>
                <button className="px-4 py-2 bg-grass text-white text-sm font-semibold rounded-lg hover:bg-grass-600 shadow-sm transition-colors cursor-pointer" onClick={handleClose}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* ---- Form state ---- */
            <div className="space-y-6">
              {/* Target user */}
              <div className="bg-chalk-50 border border-chalk-200 rounded-xl p-4">
                <p className="text-xs text-chalk-500 uppercase font-semibold tracking-wide mb-2">Resetting password for</p>
                <p className="font-semibold text-midnight">{user.name}</p>
                <p className="text-sm text-chalk-600">{user.email}</p>
                <p className="text-xs text-chalk-500 mt-1 capitalize">{user.role} Account</p>
              </div>

              {/* Recovery method */}
              <div className="space-y-3">
                <label className="font-medium text-sm text-midnight block">Recovery method</label>

                <label htmlFor="method-link" className="flex items-start gap-3 p-3 border border-chalk-300 rounded-xl cursor-pointer hover:bg-chalk-50 has-[:checked]:border-grass has-[:checked]:bg-grass/5 transition-colors">
                  <input id="method-link" type="radio" name="method" checked={method === 'link'} onChange={() => setMethod('link')} className="mt-1 accent-grass" />
                  <div>
                    <span className="block font-medium text-midnight">Generate reset link</span>
                    <span className="block text-xs text-chalk-600">Creates a secure, single-use link you copy and share with the user. Valid for 24 hours.</span>
                  </div>
                </label>

                <label htmlFor="method-temp" className="flex items-start gap-3 p-3 border border-chalk-300 rounded-xl cursor-pointer hover:bg-chalk-50 has-[:checked]:border-grass has-[:checked]:bg-grass/5 transition-colors">
                  <input id="method-temp" type="radio" name="method" checked={method === 'temporary'} onChange={() => setMethod('temporary')} className="mt-1 accent-grass" />
                  <div>
                    <span className="block font-medium text-midnight">Generate temporary password</span>
                    <span className="block text-xs text-chalk-600">Sets a one-time password the user must change after their next login.</span>
                  </div>
                </label>

                <label htmlFor="method-force" className="flex items-start gap-3 p-3 border border-chalk-300 rounded-xl cursor-pointer hover:bg-chalk-50 has-[:checked]:border-grass has-[:checked]:bg-grass/5 transition-colors">
                  <input id="method-force" type="radio" name="method" checked={method === 'force'} onChange={() => setMethod('force')} className="mt-1 accent-grass" />
                  <div>
                    <span className="block font-medium text-midnight">Require reset at next login</span>
                    <span className="block text-xs text-chalk-600">Flags the account so the user is prompted to change their password on their next sign-in.</span>
                  </div>
                </label>
              </div>

              {/* Audit reason */}
              <div>
                <label htmlFor="reset-reason" className="font-medium text-sm text-midnight block mb-2">Audit reason</label>
                <select
                  id="reset-reason"
                  className="w-full px-3 py-2 border border-chalk-300 rounded-xl text-sm text-midnight bg-white focus:outline-none focus:ring-2 focus:ring-grass"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Error feedback */}
              {resetMutation.isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
                  {(resetMutation.error as any)?.message || 'Failed to process the password reset. Please try again.'}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-chalk-200">
                <button
                  className="px-4 py-2 bg-chalk-100 text-ink rounded-lg hover:bg-chalk-200 disabled:opacity-50 text-sm font-semibold transition-colors cursor-pointer"
                  onClick={handleClose}
                  disabled={resetMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 bg-grass text-white rounded-lg hover:bg-grass-600 disabled:opacity-50 font-semibold text-sm flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                  onClick={handleReset}
                  disabled={resetMutation.isPending || !reason}
                >
                  {resetMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Processing...</>
                  ) : (
                    <><Key size={16} /> {primaryLabel}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
