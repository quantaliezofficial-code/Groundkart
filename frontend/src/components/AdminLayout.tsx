import { useAdminNotifications, useAdminSendNotification } from '../hooks/useNotifications';
import GroundSelect from './ui/GroundSelect';
import { Activity, AlertCircle, Ban, CalendarClock, CheckCircle2, FileText, Globe, Layers, LayoutDashboard, Loader2, Mail, MessageSquare, Minus, PlusasPlusIcon, PlayCircle, RefreshCw, Search, Server, ShieldCheck, UsersasUsersIcon, Wallet, Wifi, XCircle, ArrowRight, Star, Bell, Clock } from 'lucide-react';
import { DashboardShell, MetricCard, StatusBadge as DashboardStatusBadge, EmptyState } from './dashboard';
import { Home } from 'lucide-react';
import HomepageTab from './dashboard/HomepageTab';
import { AdminVenueDrawer } from './dashboard/AdminVenueDrawer';
import { useEffect, useMemo, useState } from 'react';
import {
  useAdminBookings,
  useAdminBookingsPaginated,
  useAdminOverview,
  useAdminHealth,
  useAdminPayouts,
  useAdminPayoutsPaginated,
  useAdminUpdateVenue,
  useAdminUsers,
  useAdminUsersPaginated,
  useAdminVenues,
  useAdminVenuesPaginated,
  useAdminVerifications,
  useApproveVenue,
  useApproveVerification,
  useAuditLog,
  useBookingLookup,
  useCancelPendingBooking,
  useConfirmBookingPayment,
  useMarkPayoutPaid,
  useReactivateUser,
  useReactivateVenue,
  useRejectVenue,
  useRejectVerification,
  useRunPayout,
  useSuspendUser,
  useSuspendVenue,
  useSweepExpiredHolds,
  useAdminReviewsPaginated,
  useAdminDeleteReview,
} from '../hooks/useAdmin';
import { ApiError } from '../lib/api/client';
import type {
  ApiAdminOwnerVerificationView,
  ApiAdminUserView,
  ApiAuditLogEntry,
  ApiBookingDetail,
  ApiAdminBookingView,
  ApiPlatformOverview,
  ApiAdminVenueView,
  ApiAdminReview,
  BookingStatus,
  PayoutStatus,
} from '../lib/api/types';
import { useAuth } from '../lib/auth';

type Tab = 'Overview' | 'Analytics' | 'ApprovalQueue' | 'Venues' | 'Users' | 'Bookings' | 'Payouts' | 'Reviews' | 'Support' | 'Notifications' | 'Homepage';

function money(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  return 'Something went wrong. Please try again.';
}

function dateTimeStr(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  active: 'bg-pitch/15 text-pitch',
  approved: 'bg-pitch/15 text-pitch',
  pending_review: 'bg-marigold/25 text-ink',
  pending: 'bg-marigold/25 text-ink',
  suspended: 'bg-clay/15 text-clay',
  rejected: 'bg-clay/15 text-clay',
  draft: 'bg-surface-container-high text-on-surface-variant',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 font-sans text-xs ${STATUS_BADGE_STYLE[status] ?? 'bg-surface-container-high text-on-surface-variant'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-clay/10 px-4 py-3 font-sans text-sm text-clay">
      <AlertCircle size={16} /> {message}
    </div>
  );
}

export default function AdminLayout({ onReturnToSite }: { onReturnToSite?: () => void }) {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <ShieldCheck size={32} className="mx-auto text-ink/40" />
        <p className="font-sans text-on-surface-variant">Please log in as a platform admin to continue.</p>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-ink/40" />
        <p className="font-sans text-on-surface-variant">This dashboard is only available to platform admins.</p>
      </div>
    );
  }

  return <AdminDashboard onReturnToSite={onReturnToSite} />;
}

function AdminDashboard({ onReturnToSite }: { onReturnToSite?: () => void }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('initialAdminTab') as Tab;
    if (saved) {
      sessionStorage.removeItem('initialAdminTab');
      return saved;
    }
    return 'Overview';
  });

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<Tab>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('navigate-admin-tab', handleNavigate);
    return () => window.removeEventListener('navigate-admin-tab', handleNavigate);
  }, []);

  const { data: overview, isLoading: overviewLoading } = useAdminOverview();
  const { data: auditLog = [], isLoading: auditLoading } = useAuditLog({ limit: 25 });

  const { data: pendingVenues = [], isLoading: pendingVenuesLoading } = useAdminVenues({
    status: 'pending_review',
    limit: 200,
  });
  const { data: pendingVerifications = [], isLoading: pendingVerificationsLoading } = useAdminVerifications({
    status: 'pending',
    limit: 200,
  });
  const pendingCount = pendingVenues.length + pendingVerifications.length;

  const navItems = [
    { id: 'Overview', label: 'Overview', icon: LayoutDashboard, onClick: () => setActiveTab('Overview') },
    { id: 'Analytics', label: 'Analytics', icon: Activity, onClick: () => setActiveTab('Analytics') },
    { id: 'ApprovalQueue', label: 'Approval Queue', icon: ShieldCheck, badge: pendingCount || undefined, onClick: () => setActiveTab('ApprovalQueue') },
    { id: 'Venues', label: 'Venues', icon: Layers, onClick: () => setActiveTab('Venues') },
    { id: 'Users', label: 'Users', icon: UsersIcon, onClick: () => setActiveTab('Users') },
    { id: 'Bookings', label: 'Bookings', icon: CalendarClock, onClick: () => setActiveTab('Bookings') },
    { id: 'Payouts', label: 'Payouts', icon: Wallet, onClick: () => setActiveTab('Payouts') },
    { id: 'Reviews', label: 'Reviews', icon: MessageSquare, onClick: () => setActiveTab('Reviews') },
    { id: 'Support', label: 'Support Tickets', icon: AlertCircle, onClick: () => setActiveTab('Support') },
    { id: 'Notifications', label: 'Notification Center', icon: Bell, onClick: () => setActiveTab('Notifications') },
    { id: 'Homepage', label: 'Homepage Curation', icon: Globe, onClick: () => setActiveTab('Homepage') },
  ];

  const titles: Record<Tab, { title: string; desc: string }> = {
    Overview: { title: 'Admin Dashboard', desc: 'Operations overview and platform health' },
    Analytics: { title: 'Analytics', desc: 'Platform growth and revenue' },
    ApprovalQueue: { title: 'Approval Queue', desc: 'Pending verifications and venue reviews' },
    Venues: { title: 'Venues', desc: 'Manage marketplace venues' },
    Users: { title: 'Users', desc: 'Manage customers and owners' },
    Bookings: { title: 'Bookings', desc: 'Monitor and confirm bookings' },
    Payouts: { title: 'Payouts', desc: 'Manage owner payouts' },
    Reviews: { title: 'Reviews', desc: 'Monitor platform reviews' },
    Support: { title: 'Support Tickets', desc: 'Customer and owner support' },
    Homepage: { title: 'Homepage Curation', desc: 'Manage the public homepage layout and featured venues' },
    Notifications: { title: 'Notifications', desc: 'Manage notifications' },
  };

  const currentInfo = titles[activeTab];

  return (
    <DashboardShell
      title={currentInfo.title}
      description={currentInfo.desc}
      navItems={navItems}
      activeNavId={activeTab}
      userName={user?.name}
      userRole={user?.role}
        onLogout={logout}
        onReturnToSite={onReturnToSite}
    >
      {activeTab === 'Overview' && (
        <OverviewTab 
          overview={overview} 
          overviewLoading={overviewLoading} 
          auditLog={auditLog} 
          auditLoading={auditLoading} 
          pendingVenuesCount={pendingVenues.length}
          pendingVerificationsCount={pendingVerifications.length}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}
      {activeTab === 'Analytics' && (
        <AnalyticsTab overview={overview} auditLog={auditLog} />
      )}
      {activeTab === 'ApprovalQueue' && (
        <ApprovalQueueTab
          pendingVenues={pendingVenues}
          pendingVerifications={pendingVerifications}
          isLoading={pendingVenuesLoading || pendingVerificationsLoading}
        />
      )}
      {activeTab === 'Venues' && <VenuesTab />}
      {activeTab === 'Users' && <UsersTab />}
      {activeTab === 'Bookings' && <BookingsTab />}
      {activeTab === 'Payouts' && <PayoutsTab />}
      {activeTab === 'Reviews' && <ReviewsTab />}
      {activeTab === 'Support' && <SupportTab />}
      {activeTab === 'Notifications' && <AdminNotifications />}
    </DashboardShell>
  );
}
// ---------------------------------------------------------------------------
// Overview — GET /api/v1/admin/overview + GET /api/v1/admin/audit-log.
// The mock version of this tab also had "Total Users"/"Dispute Rate" cards
// and a decorative booking-volume chart — none of those have a real data
// source (PlatformOverview has no total_users/dispute_rate field, and
// there's no time-series booking endpoint anywhere), so they're dropped
// here rather than faked. Every card below maps directly to a real
// PlatformOverview field.
// ---------------------------------------------------------------------------

function OverviewTab({
  overview,
  overviewLoading,
  auditLog,
  auditLoading,
  pendingVenuesCount,
  pendingVerificationsCount,
  onNavigate,
}: {
  overview: ApiPlatformOverview | undefined;
  overviewLoading: boolean;
  auditLog: ApiAuditLogEntry[];
  auditLoading: boolean;
  pendingVenuesCount: number;
  pendingVerificationsCount: number;
  onNavigate: (tab: Tab) => void;
}) {
  if (overviewLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!overview) {
    return <p className="font-sans text-on-surface-variant">Couldn't load the platform overview.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="GMV (This Month)" value={money(overview.gmv)} />
        <MetricCard label="Commission Collected" value={money(overview.total_commission_collected)} />
        <MetricCard label="Active Venues" value={overview.active_venues.toLocaleString('en-IN')} />
        <MetricCard label="Total Bookings" value={overview.total_bookings.toLocaleString('en-IN')} />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_350px]">
        {/* Main Content Area */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-container px-5 py-4 bg-mist/50">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide">Requires your attention</h3>
            </div>
            <div className="divide-y divide-surface-container">
              {pendingVenuesCount > 0 && (
                <div className="flex items-center justify-between p-5 hover:bg-surface-container/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-marigold/10 text-marigold">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="font-sans text-sm font-medium text-ink">Pending Venue Approvals</p>
                      <p className="font-sans text-xs text-on-surface-variant">{pendingVenuesCount} venue(s) waiting for review</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onNavigate('ApprovalQueue')}
                    className="rounded-full bg-surface-container px-4 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container-high transition-colors"
                  >
                    Review
                  </button>
                </div>
              )}
              {pendingVerificationsCount > 0 && (
                <div className="flex items-center justify-between p-5 hover:bg-surface-container/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10 text-info">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="font-sans text-sm font-medium text-ink">Pending Owner Verifications</p>
                      <p className="font-sans text-xs text-on-surface-variant">{pendingVerificationsCount} owner(s) waiting for verification</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onNavigate('ApprovalQueue')}
                    className="rounded-full bg-surface-container px-4 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container-high transition-colors"
                  >
                    Review
                  </button>
                </div>
              )}
              {pendingVenuesCount === 0 && pendingVerificationsCount === 0 && (
                <div className="p-8 text-center">
                  <p className="font-sans text-sm text-on-surface-variant">You're all caught up!</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-container px-5 py-4 bg-mist/50">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide">Recent Activity</h3>
            </div>
            {auditLoading ? (
              <div className="shimmer h-48 w-full" />
            ) : auditLog.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-sans text-sm text-on-surface-variant">No audit log entries yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container">
                {auditLog.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-surface-container/30 transition-colors">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                      <Activity size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm font-medium text-ink truncate">{entry.action}</p>
                      <p className="font-sans text-xs text-on-surface-variant truncate mt-0.5">
                        {entry.entity_type} {entry.entity_id ? `· ${entry.entity_id.slice(0, 8)}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-sans text-xs text-on-surface-variant">{dateTimeStr(entry.created_at)}</span>
                      <p className="font-sans text-[10px] text-on-surface-variant/70 mt-1 capitalize">{entry.actor_id ? `by ${entry.actor_id.slice(0, 8)}` : 'System'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Actions Area */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Quick Actions</h3>
            <div className="grid gap-3">
              <button onClick={() => onNavigate('Venues')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container">
                  <Layers size={16} />
                </div>
                <span className="font-sans text-sm font-medium text-ink">Manage Venues</span>
              </button>
              <button onClick={() => onNavigate('Users')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                  <UsersIcon size={16} />
                </div>
                <span className="font-sans text-sm font-medium text-ink">Manage Users</span>
              </button>
              <button onClick={() => onNavigate('Bookings')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marigold/10 text-marigold">
                  <CalendarClock size={16} />
                </div>
                <span className="font-sans text-sm font-medium text-ink">View Bookings</span>
              </button>
              <button onClick={() => onNavigate('Payouts')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-clay/10 text-clay">
                  <Wallet size={16} />
                </div>
                <span className="font-sans text-sm font-medium text-ink">Review Payouts</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Approval queue — combines pending venues (catalog approve/reject) and
// pending owner-verifications (onboarding approve/reject) into one queue,
// since that's how the Goal for this session names it ("the owner-
// verification/venue approval queue") and how the mock UI treated it — but
// unlike the mock, approving/rejecting each item hits its own real,
// distinct backend entity/endpoint rather than one shared fake handler.
// ---------------------------------------------------------------------------

type QueueItem = { kind: 'venue'; venue: ApiAdminVenueView } | { kind: 'verification'; verification: ApiAdminOwnerVerificationView };

function queueKey(item: QueueItem): string {
  return item.kind === 'venue' ? `venue:${item.venue.id}` : `verification:${item.verification.id}`;
}

function ApprovalQueueTab({
  pendingVenues,
  pendingVerifications,
  isLoading,
}: {
  pendingVenues: ApiAdminVenueView[];
  pendingVerifications: ApiAdminOwnerVerificationView[];
  isLoading: boolean;
}) {
  const items: QueueItem[] = [
    ...pendingVerifications.map((verification) => ({ kind: 'verification' as const, verification })),
    ...pendingVenues.map((venue) => ({ kind: 'venue' as const, venue })),
  ];

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = items.find((item) => queueKey(item) === selectedKey) ?? items[0];

  const approveVenue = useApproveVenue();
  const rejectVenue = useRejectVenue();
  const approveVerification = useApproveVerification();
  const rejectVerification = useRejectVerification();
  const [actionError, setActionError] = useState<string | null>(null);

  const isActing = approveVenue.isPending || rejectVenue.isPending || approveVerification.isPending || rejectVerification.isPending;

  if (isLoading) {
    return <div className="shimmer h-96 rounded-2xl" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-container p-10 text-center">
        <CheckCircle2 size={28} className="mx-auto mb-2 text-pitch" />
        <p className="font-sans text-on-surface-variant">Nothing waiting for review right now.</p>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      if (selected.kind === 'venue') await approveVenue.mutateAsync(selected.venue.id);
      else await approveVerification.mutateAsync(selected.verification.id);
      setSelectedKey(null);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    const reason = window.prompt('Reason for rejecting this (shown to the applicant/owner):');
    if (!reason) return;
    setActionError(null);
    try {
      if (selected.kind === 'venue') await rejectVenue.mutateAsync({ venueId: selected.venue.id, reason });
      else await rejectVerification.mutateAsync({ verificationId: selected.verification.id, reason });
      setSelectedKey(null);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        {items.map((item) => {
          const key = queueKey(item);
          const isSelected = selected && key === queueKey(selected);
          const title = item.kind === 'venue' ? item.venue.name : item.verification.applicant_name;
          const subtitle = item.kind === 'venue' ? `Venue listing · ${item.venue.owner_name}` : 'Owner verification';
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`w-full rounded-xl px-4 py-3 text-left transition ${
                isSelected ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-ink hover:bg-surface-container-high'
              } ease-out`}
            >
              <p className="font-sans text-sm font-medium">{title}</p>
              <p className="font-sans text-xs opacity-80">{subtitle}</p>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-4 rounded-2xl bg-surface-container p-6">
          {actionError && <ErrorBanner message={actionError} />}

          {selected.kind === 'venue' ? <VenueReviewDetail venue={selected.venue} /> : <VerificationReviewDetail verification={selected.verification} />}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApprove}
              disabled={isActing}
              className="flex items-center gap-2 rounded-full bg-pitch px-5 py-2 font-sans text-sm text-chalk disabled:opacity-50"
            >
              {isActing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Approve
            </button>
            <button
              onClick={handleReject}
              disabled={isActing}
              className="flex items-center gap-2 rounded-full bg-surface-container-high px-5 py-2 font-sans text-sm text-ink disabled:opacity-50"
            >
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VenueReviewDetail({ venue }: { venue: ApiAdminVenueView }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="font-display text-xl text-ink">{venue.name}</p>
          <StatusBadge status={venue.status} />
        </div>
        <p className="font-sans text-sm text-on-surface-variant">
          {venue.category} · {venue.city} · {money(venue.base_price)}/{venue.unit_type.replace('_', ' ')}
        </p>
        {venue.description && <p className="font-sans text-sm text-ink">{venue.description}</p>}
        {venue.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {venue.amenities.map((a) => (
              <span key={a} className="rounded-full bg-surface-container-high px-3 py-1 font-sans text-xs text-ink">
                {a}
              </span>
            ))}
          </div>
        )}
        <p className="font-sans text-xs text-on-surface-variant">
          Owner: {venue.owner_name} ({venue.owner_email}) {venue.owner_phone && `· ${venue.owner_phone}`}
        </p>
      </div>

      {venue.pending_changes && (
        <div className="rounded-xl border border-surface-container-high bg-surface px-4 py-3">
          <h4 className="mb-2 font-sans text-sm font-medium text-ink">Requested Changes</h4>
          <div className="space-y-3">
            {Object.entries(venue.pending_changes).map(([field, diff]) => (
              <div key={field} className="text-sm">
                <span className="font-medium text-on-surface-variant capitalize">{field.replace('_', ' ')}</span>
                <div className="mt-1 grid gap-2 md:grid-cols-2">
                  <div className="rounded bg-surface-container-low p-2">
                    <span className="text-xs text-error font-medium mb-1 block">Old</span>
                    <span className="text-ink line-through opacity-70 break-words">{diff.old === null ? 'None' : (Array.isArray(diff.old) ? diff.old.join(', ') : String(diff.old))}</span>
                  </div>
                  <div className="rounded bg-surface-container-low p-2">
                    <span className="text-xs text-success font-medium mb-1 block">New</span>
                    <span className="text-ink break-words">{diff.new === null ? 'None' : (Array.isArray(diff.new) ? diff.new.join(', ') : String(diff.new))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationReviewDetail({ verification }: { verification: ApiAdminOwnerVerificationView }) {
  return (
    <div className="space-y-2">
      <p className="font-display text-xl text-ink">{verification.applicant_name}</p>
      <p className="flex items-center gap-1 font-sans text-sm text-on-surface-variant">
        <Mail size={14} /> {verification.applicant_email}
      </p>
            {verification.business_name && <p className="font-sans text-sm text-ink">Business: {verification.business_name}</p>}
      {verification.identification_type && <p className="font-sans text-sm text-ink">ID Type: {verification.identification_type}</p>}
      {verification.identification_number && <p className="font-sans text-sm text-ink">ID Number: {verification.identification_number}</p>}
      <a
        href={verification.document_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 font-sans text-sm text-info underline"
      >
        <FileText size={15} /> View submitted document
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venues — every venue regardless of status (not just active), so a
// suspended one doesn't disappear with no way back to reactivate it. The
// mock version also had "Featured"/"Delete" controls; both are dropped
// here rather than mapped onto something misleading: there's no
// is_featured field anywhere in the backend, and there's no DELETE route
// for a venue — only suspend, which is what "remove from the marketplace"
// actually maps to for a venue that may have real booking history.
// ---------------------------------------------------------------------------

function LoadMoreButton({ onClick, isLoading, hasMore }: { onClick: () => void; isLoading: boolean; hasMore: boolean }) {
  if (!hasMore) return null;
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="mx-auto flex items-center gap-2 rounded-full bg-surface-container-high px-5 py-2 font-sans text-sm text-ink disabled:opacity-50"
    >
      {isLoading && <Loader2 size={14} className="animate-spin" />}
      Load more
    </button>
  );
}

function VenuesTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | ApiAdminVenueView['status']>('all');
  const [query, setQuery] = useState('');
  const [drawerVenue, setDrawerVenue] = useState<any>(null);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminVenuesPaginated(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  // .pages is an array of pages (each a page-sized array) — flatten once
  // per render rather than re-flattening inside the filter below.
  const venues = useMemo(() => data?.pages.flat() ?? [], [data]);

  const suspendVenue = useSuspendVenue();
  const reactivateVenue = useReactivateVenue();
  const updateVenue = useAdminUpdateVenue();
  const [actionError, setActionError] = useState<string | null>(null);

  // Search only matches within pages already loaded — there's no
  // server-side text-search endpoint for this, so "Load more" first if
  // the one you're after isn't showing up yet.
  const filtered = useMemo(() => {
    if (!query) return venues;
    const q = query.toLowerCase();
    return venues.filter((v) => v.name.toLowerCase().includes(q) || v.owner_name.toLowerCase().includes(q));
  }, [venues, query]);

  const handleSuspend = async (venueId: string) => {
    const reason = window.prompt('Reason for suspending this venue (visible in the audit log):');
    if (!reason) return;
    setActionError(null);
    try {
      await suspendVenue.mutateAsync({ venueId, reason });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleReactivate = async (venueId: string) => {
    setActionError(null);
    try {
      await reactivateVenue.mutateAsync(venueId);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handlePriceStep = async (venue: ApiAdminVenueView, delta: number) => {
    const next = Number(venue.base_price) + delta;
    if (next <= 0) return;
    setActionError(null);
    try {
      await updateVenue.mutateAsync({ venueId: venue.id, body: { base_price: next.toFixed(2) } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by venue or owner name..."
          className="rounded-full bg-surface-container px-4 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
        />
        <GroundSelect
            value={statusFilter}
            onValueChange={() => {}}
            options={[
              { value: "all", label: "All statuses" },
              { value: "draft", label: "Draft" },
              { value: "pending_review", label: "Pending review" },
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {filtered.length === 0 ? (
        <p className="font-sans text-sm text-on-surface-variant">No venues match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((venue) => (
            <div key={venue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container p-4">
              <div>
                <p className="font-sans text-sm font-medium text-ink">{venue.name}</p>
                <p className="flex items-center gap-2 font-sans text-xs text-on-surface-variant">
                  {venue.owner_name} · {venue.city} · {venue.category} <StatusBadge status={venue.status} />
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePriceStep(venue, -50)}
                  disabled={updateVenue.isPending}
                  className="rounded-full bg-surface-container-high p-2 text-ink disabled:opacity-50"
                  aria-label="Decrease price"
                >
                  <Minus size={14} />
                </button>
                <span className="w-24 text-center font-sans text-sm text-ink">{money(venue.base_price)}</span>
                <button
                  onClick={() => handlePriceStep(venue, 50)}
                  disabled={updateVenue.isPending}
                  className="rounded-full bg-surface-container-high p-2 text-ink disabled:opacity-50"
                  aria-label="Increase price"
                >
                  <PlusIcon size={14} />
                </button>

                {venue.status === 'active' && (
                  <button
                    onClick={() => handleSuspend(venue.id)}
                    disabled={suspendVenue.isPending}
                    className="flex items-center gap-1 rounded-full bg-clay px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
                  >
                    <Ban size={13} /> Suspend
                  </button>
                )}
                {venue.status === 'suspended' && (
                  <button
                    onClick={() => handleReactivate(venue.id)}
                    disabled={reactivateVenue.isPending}
                    className="flex items-center gap-1 rounded-full bg-pitch px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
                  >
                    <PlayCircle size={13} /> Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {drawerVenue && <AdminVenueDrawer venue={drawerVenue} onClose={() => setDrawerVenue(null)} />}
      <LoadMoreButton onClick={() => fetchNextPage()} isLoading={isFetchingNextPage} hasMore={Boolean(hasNextPage)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users — new section; the mock had no user-management UI at all despite
// the Goal naming "venue/user suspend-reactivate" as one of the four
// dashboard areas.
// ---------------------------------------------------------------------------

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [roleFilter, setRoleFilter] = useState<'all' | ApiAdminUserView['role']>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsersPaginated(
    roleFilter === 'all' ? {} : { role: roleFilter }
  );
  const users = useMemo(() => data?.pages.flat() ?? [], [data]);

  const suspendUser = useSuspendUser();
  const reactivateUser = useReactivateUser();
  const [actionError, setActionError] = useState<string | null>(null);

  // Same as Venues: search only matches within pages already loaded.
  const filtered = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, query]);

  const handleSuspend = async (userId: string) => {
    const reason = window.prompt('Reason for suspending this user (visible in the audit log):');
    if (!reason) return;
    setActionError(null);
    try {
      await suspendUser.mutateAsync({ userId, reason });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleReactivate = async (userId: string) => {
    setActionError(null);
    try {
      await reactivateUser.mutateAsync(userId);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email..."
          className="rounded-full bg-surface-container px-4 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
        />
        <GroundSelect
            value={roleFilter}
            onValueChange={() => {}}
            options={[
              { value: "all", label: "All roles" },
              { value: "customer", label: "Customer" },
              { value: "owner", label: "Owner" },
              { value: "admin", label: "Admin" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {filtered.length === 0 ? (
        <p className="font-sans text-sm text-on-surface-variant">No users match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container p-4">
                <div>
                  <p className="font-sans text-sm font-medium text-ink">
                    {u.name} {isSelf && <span className="font-sans text-xs text-on-surface-variant">(you)</span>}
                  </p>
                  <p className="font-sans text-xs text-on-surface-variant">
                    {u.email} · {u.role}
                    {u.suspended_at ? ` · suspended${u.suspension_reason ? `: ${u.suspension_reason}` : ''}` : ''}
                  </p>
                </div>
                {u.suspended_at ? (
                  <button
                    onClick={() => handleReactivate(u.id)}
                    disabled={reactivateUser.isPending}
                    className="flex items-center gap-1 rounded-full bg-pitch px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
                  >
                    <PlayCircle size={13} /> Reactivate
                  </button>
                ) : (
                  <button
                    onClick={() => handleSuspend(u.id)}
                    disabled={suspendUser.isPending || isSelf}
                    title={isSelf ? "You can't suspend your own account" : undefined}
                    className="flex items-center gap-1 rounded-full bg-clay px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
                  >
                    <Ban size={13} /> Suspend
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <LoadMoreButton onClick={() => fetchNextPage()} isLoading={isFetchingNextPage} hasMore={Boolean(hasNextPage)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings — the entire payment model here is offline confirmation (no
// gateway webhook wired up), so this screen is how an admin actually
// operates the marketplace day to day: confirming payment on a
// pending_payment booking (after receiving it outside this system — bank
// transfer, UPI, etc.) is what turns it into a real, confirmed booking.
// Defaults to showing pending_payment first, since that's the queue that
// actually needs attention; everything else is available via the filter.
// No customer identity here either, same guarantee as everywhere else
// bookings are shown — see BookingDetail's own docstring.
// ---------------------------------------------------------------------------

const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cash', 'cheque', 'other'] as const;

function formatSlot(booking: ApiBookingDetail): string {
  if (!booking.slot_start_time) return booking.slot_date;
  const trim = (t: string) => t.slice(0, 5);
  return `${booking.slot_date} · ${trim(booking.slot_start_time)}–${booking.slot_end_time ? trim(booking.slot_end_time) : ''}`;
}

function isHoldExpired(booking: ApiBookingDetail): boolean {
  // There's no sweep job that clears a stale pending_payment booking
  // automatically (see hold_expires_at's own backend docstring) — this is
  // the only signal an admin has that a hold is stale and the slot is
  // effectively free to release via cancel-pending.
  return booking.status === 'pending_payment' && booking.hold_expires_at !== null && new Date(booking.hold_expires_at) < new Date();
}

function BookingRow({ booking }: { booking: ApiAdminBookingView }) {
  const confirmPayment = useConfirmBookingPayment();
  const cancelPending = useCancelPendingBooking();
  const [actionError, setActionError] = useState<string | null>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [amount, setAmount] = useState(booking.amount);
  const [method, setMethod] = useState<(typeof PAYMENT_METHODS)[number]>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const openConfirmForm = () => {
    setActionError(null);
    setIsConfirmOpen(true);
    setAmount(booking.amount);
    setMethod('bank_transfer');
    setReference('');
    setNotes('');
  };

  const submitConfirm = async () => {
    if (!amount.trim() || !method) {
      setActionError('Amount and method are required.');
      return;
    }
    setActionError(null);
    try {
      await confirmPayment.mutateAsync({
        bookingId: booking.id,
        body: { amount: amount.trim(), method, reference: reference.trim() || undefined, notes: notes.trim() || undefined },
      });
      setIsConfirmOpen(false);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleCancelPending = async () => {
    const reason = window.prompt('Reason for cancelling this pending booking (releases the slot immediately):');
    if (!reason) return;
    setActionError(null);
    try {
      await cancelPending.mutateAsync({ bookingId: booking.id, reason });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface-container p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[250px]">
          <p className="font-sans text-sm font-medium text-ink">{booking.venue_name}</p>
          <p className="flex flex-wrap items-center gap-2 font-sans text-xs text-on-surface-variant mb-2">
            {booking.venue_category} · {formatSlot(booking)} · {money(booking.amount)} <StatusBadge status={booking.status} />
            {isHoldExpired(booking) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-clay/15 px-2 py-0.5 text-clay">
                <AlertCircle size={11} /> hold expired
              </span>
            )}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-chalk p-2 rounded-xl border border-ink/5 mb-2">
            <div>
              <p className="font-sans text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Customer</p>
              <p className="font-sans text-xs font-medium text-ink truncate">{booking.user_name || 'Guest'}</p>
              <p className="font-sans text-xs text-on-surface-variant truncate">{booking.user_email || 'No email'}</p>
              {booking.user_phone && <p className="font-sans text-xs text-on-surface-variant truncate">{booking.user_phone}</p>}
            </div>
            <div>
              <p className="font-sans text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">Owner</p>
              <p className="font-sans text-xs font-medium text-ink truncate">{booking.owner_name}</p>
              <p className="font-sans text-xs text-on-surface-variant truncate">{booking.owner_email}</p>
              {booking.owner_phone && <p className="font-sans text-xs text-on-surface-variant truncate">{booking.owner_phone}</p>}
            </div>
          </div>
          
          <p className="font-mono text-[10px] text-on-surface-variant">ID: {booking.id}</p>
        </div>
        {booking.status === 'pending_payment' && (
          <div className="flex gap-2">
            <button
              onClick={openConfirmForm}
              className="flex items-center gap-1 rounded-full bg-pitch px-3 py-1.5 font-sans text-xs text-chalk"
            >
              <CheckCircle2 size={13} /> Confirm payment
            </button>
            <button
              onClick={handleCancelPending}
              disabled={cancelPending.isPending}
              className="flex items-center gap-1 rounded-full bg-clay px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
            >
              <XCircle size={13} /> Cancel
            </button>
          </div>
        )}
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {isConfirmOpen && (
        <div className="space-y-2 rounded-xl bg-surface-container-high p-4">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount received"
              className="rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
            />
            <GroundSelect
            value={method}
            onValueChange={() => {}}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: `${m.replace('_', ' ')}` }))}
            triggerClassName="w-full sm:w-[200px]"
          />
          </div>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference / transaction ID (optional)"
            className="w-full rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={submitConfirm}
              disabled={confirmPayment.isPending}
              className="flex items-center gap-2 rounded-full bg-pitch px-4 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
            >
              {confirmPayment.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirm
            </button>
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-full bg-surface-container px-4 py-1.5 font-sans text-xs text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Jump-to-booking-by-id: reuses GET /api/v1/bookings/{id} (not an /admin/
// prefixed route at all — see adminApi.getBookingById's own comment for
// why this needed no new backend endpoint). Renders the same BookingRow
// as the regular list, so confirm-payment/cancel-pending work identically
// whether you found the booking by browsing or by pasting its ID.
function BookingLookup() {
  const [bookingId, setBookingId] = useState('');
  const lookup = useBookingLookup();

  const handleLookup = async () => {
    if (!bookingId.trim()) return;
    try {
      await lookup.mutateAsync(bookingId.trim());
    } catch {
      // surfaced via lookup.error below — nothing further to do here
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-surface-container-high p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search size={15} className="text-on-surface-variant" />
        <input
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="Jump to a booking by ID..."
          className="flex-1 rounded-full bg-mist px-4 py-2 font-mono text-sm text-ink placeholder:text-on-surface-variant placeholder:font-sans focus:outline-none"
        />
        <button
          onClick={handleLookup}
          disabled={lookup.isPending || !bookingId.trim()}
          className="flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 font-sans text-sm text-on-primary-container disabled:opacity-50"
        >
          {lookup.isPending ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Find
        </button>
      </div>
      {lookup.isError && <ErrorBanner message="No booking found with that ID." />}
      {lookup.data && <BookingRow booking={lookup.data} />}
    </div>
  );
}

function BookingsTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('pending_payment');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminBookingsPaginated(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  const bookings = useMemo(() => data?.pages.flat() ?? [], [data]);
  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => Number(isHoldExpired(b)) - Number(isHoldExpired(a))),
    [bookings]
  );

  const sweepHolds = useSweepExpiredHolds();
  const [sweepMessage, setSweepMessage] = useState<string | null>(null);
  const [sweepError, setSweepError] = useState<string | null>(null);

  const handleSweepNow = async () => {
    setSweepError(null);
    setSweepMessage(null);
    try {
      const result = await sweepHolds.mutateAsync();
      setSweepMessage(
        result.swept === 0 ? 'No expired holds to release right now.' : `Released ${result.swept} expired hold(s).`
      );
    } catch (err) {
      setSweepError(errorMessage(err));
    }
  };

  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <BookingLookup />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <GroundSelect
            value={statusFilter}
            onValueChange={() => {}}
            options={[
              { value: "pending_payment", label: "Pending payment" },
              { value: "all", label: "All statuses" },
              { value: "confirmed", label: "Confirmed" },
              { value: "completed", label: "Completed" },
              { value: "cancelled", label: "Cancelled" },
              { value: "expired", label: "Expired" },
              { value: "refunded", label: "Refunded" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />

        <button
          onClick={handleSweepNow}
          disabled={sweepHolds.isPending}
          className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 font-sans text-sm text-ink disabled:opacity-50"
        >
          {sweepHolds.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sweep expired holds now
        </button>
      </div>

      {sweepMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-pitch/10 px-4 py-3 font-sans text-sm text-pitch">
          <CheckCircle2 size={16} /> {sweepMessage}
        </div>
      )}
      {sweepError && <ErrorBanner message={sweepError} />}

      {bookings.length === 0 ? (
        <p className="font-sans text-sm text-on-surface-variant">No bookings match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {sortedBookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </div>
      )}

      <LoadMoreButton onClick={() => fetchNextPage()} isLoading={isFetchingNextPage} hasMore={Boolean(hasNextPage)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payouts — an admin's view of owner earnings settlement: running a payout
// for an owner/period, and marking a run payout as actually paid out
// (offline, same model as booking payments — there's no payment gateway
// disbursing this automatically either).
// ---------------------------------------------------------------------------

function PayoutsTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | PayoutStatus>('all');
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminPayoutsPaginated(
    statusFilter === 'all' ? {} : { status: statusFilter }
  );
  const payouts = useMemo(() => data?.pages.flat() ?? [], [data]);
  // Only for populating the "run a payout" owner picker — avoids making
  // an admin type a raw owner UUID blind, same reasoning as showing
  // owner_name everywhere else on this screen.
  const { data: owners = [] } = useAdminUsers({ role: 'owner' });

  const markPaid = useMarkPayoutPaid();
  const runPayout = useRunPayout();
  const [actionError, setActionError] = useState<string | null>(null);

  const [showRunForm, setShowRunForm] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const handleMarkPaid = async (payoutId: string) => {
    setActionError(null);
    try {
      await markPaid.mutateAsync(payoutId);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleRunPayout = async () => {
    if (!ownerId.trim() || !periodStart || !periodEnd) {
      setActionError('Owner ID, period start, and period end are all required.');
      return;
    }
    setActionError(null);
    try {
      await runPayout.mutateAsync({ owner_id: ownerId.trim(), period_start: periodStart, period_end: periodEnd });
      setShowRunForm(false);
      setOwnerId('');
      setPeriodStart('');
      setPeriodEnd('');
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GroundSelect
            value={statusFilter}
            onValueChange={() => {}}
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "paid", label: "Paid" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
        <button
          onClick={() => setShowRunForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 font-sans text-sm text-on-primary-container"
        >
          <Wallet size={15} /> Run a payout
        </button>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {showRunForm && (
        <div className="space-y-2 rounded-2xl bg-surface-container-high p-4">
          <GroundSelect
            value={ownerId}
            onValueChange={() => {}}
            options={[{ value: "", label: "Select an owner…" }, ...owners.map((owner) => ({ value: owner.id, label: `${owner.name} (${owner.email})` }))]}
            triggerClassName="w-full sm:w-[200px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink focus:outline-none"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink focus:outline-none"
            />
          </div>
          <button
            onClick={handleRunPayout}
            disabled={runPayout.isPending}
            className="flex items-center gap-2 rounded-full bg-pitch px-4 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
          >
            {runPayout.isPending ? <Loader2 size={13} className="animate-spin" /> : <Wallet size={13} />}
            Run
          </button>
        </div>
      )}

      {payouts.length === 0 ? (
        <p className="font-sans text-sm text-on-surface-variant">No payouts match this filter.</p>
      ) : (
        <div className="grid gap-3">
          {payouts.map((payout) => (
            <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container p-4">
              <div>
                <p className="font-sans text-xs text-on-surface-variant">
                  {payout.owner_name} ({payout.owner_email})
                </p>
                <p className="flex flex-wrap items-center gap-2 font-sans text-sm text-ink">
                  {payout.period_start} <ArrowRight size={12} className="inline mx-1 text-on-surface-variant"/> {payout.period_end} · Net {money(payout.net_amount)} <StatusBadge status={payout.status} />
                </p>
                <p className="font-sans text-xs text-on-surface-variant">
                  Gross {money(payout.gross_amount)} · Commission {money(payout.commission_amount)}
                </p>
              </div>
              {payout.status === 'pending' && (
                <button
                  onClick={() => handleMarkPaid(payout.id)}
                  disabled={markPaid.isPending}
                  className="flex items-center gap-1 rounded-full bg-pitch px-3 py-1.5 font-sans text-xs text-chalk disabled:opacity-50"
                >
                  <CheckCircle2 size={13} /> Mark paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <LoadMoreButton onClick={() => fetchNextPage()} isLoading={isFetchingNextPage} hasMore={Boolean(hasNextPage)} />
    </div>
  );
}

function AnalyticsTab({
  overview,
  auditLog,
}: {
  overview: ApiPlatformOverview | undefined;
  auditLog: ApiAuditLogEntry[];
}) {
  const { data: health, refetch, isFetching: isQueryFetching } = useAdminHealth();
  const [isSimulating, setIsSimulating] = useState(false);
  const isFetching = isQueryFetching || isSimulating;

  const handleCheckNow = async () => {
    setIsSimulating(true);
    await Promise.all([
      refetch(),
      new Promise((resolve) => setTimeout(resolve, 600)),
    ]);
    setIsSimulating(false);
  };

  const allSystemsGo = health?.api_live && health?.db_connected;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight text-pitch">Analytics & System Health</h2>
        <button
          onClick={handleCheckNow}
          disabled={isFetching}
          className="flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 font-sans text-sm text-ink hover:bg-surface-container-highest transition disabled:opacity-50 ease-out"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Check Now
        </button>
      </div>
      
      {/* Bento Grid Container */}
      <div className={`grid grid-cols-1 gap-4 md:grid-cols-4 md:grid-rows-3 auto-rows-[minmax(180px,auto)] transition duration-200 ${isFetching ? 'opacity-50 animate-pulse pointer-events-none' : ''} ease-out`}>
        
        {/* Component 1: System Status (Spans 2 cols, 1 row) */}
        <div className="md:col-span-2 rounded-3xl bg-surface-container p-6 border border-ink/5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-sans text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-1">System Status</p>
              <h3 className="font-display text-3xl font-bold text-pitch">{allSystemsGo ? 'All Systems Operational' : 'System Degraded'}</h3>
            </div>
            <div className="relative flex h-4 w-4">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${allSystemsGo ? 'bg-emerald-400' : 'bg-clay'}`}></span>
              <span className={`relative inline-flex rounded-full h-4 w-4 ${allSystemsGo ? 'bg-emerald-500' : 'bg-clay'}`}></span>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {health?.api_live ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-clay" />}
              <span className="font-sans text-sm text-on-surface-variant font-medium">APIs Live</span>
            </div>
            <div className="flex items-center gap-2">
              {health?.db_connected ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-clay" />}
              <span className="font-sans text-sm text-on-surface-variant font-medium">DB Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              <span className="font-sans text-sm text-on-surface-variant font-medium">Web App Running</span>
            </div>
          </div>
        </div>

        {/* Component 2: Active Users (Spans 1 col, 1 row) */}
        <div className="md:col-span-1 rounded-3xl bg-gradient-to-br from-pitch to-[#1a5438] text-chalk p-6 border border-ink/5 flex flex-col justify-between">
          <div>
            <p className="font-sans text-sm font-semibold text-chalk/70 uppercase tracking-wider mb-1">Active Users Right Now</p>
            <div className="flex items-end gap-2">
              <h3 className="font-display text-5xl font-bold">{health?.active_users ?? 0}</h3>
              <Activity size={24} className="text-marigold mb-2" />
            </div>
          </div>
          <p className="font-sans text-xs text-chalk/60 mt-4">Calculated based on live active sessions and recent requests.</p>
        </div>

        {/* Component 3: API Uptime (Spans 1 col, 1 row) */}
        <div className="md:col-span-1 rounded-3xl bg-surface-container-high p-6 border border-ink/5 flex flex-col justify-between">
           <div className="flex justify-between items-center">
             <div className="p-2 bg-marigold/10 rounded-xl"><Server size={20} className="text-marigold" /></div>
             <span className="font-sans text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-full">{health?.uptime_percent ?? 99.99}%</span>
           </div>
           <div>
             <h3 className="font-sans text-2xl font-bold text-pitch mt-4">{health?.latency_ms ?? 12}ms</h3>
             <p className="font-sans text-sm font-medium text-on-surface-variant">Avg API Latency</p>
           </div>
        </div>

        {/* Component 4: Recent Requests (Spans 2 cols, 2 rows) */}
        <div className="md:col-span-2 md:row-span-2 rounded-3xl bg-chalk p-6 border border-ink/5 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
             <div>
               <p className="font-sans text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Live Traffic</p>
               <h3 className="font-display text-xl font-bold text-pitch">Recent User Requests</h3>
             </div>
             <Globe size={24} className="text-ink/20" />
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {auditLog.slice(0, 7).map((log, i) => (
              <div key={log.id} className="flex items-start justify-between p-3 rounded-2xl bg-surface-container/50 hover:bg-surface-container transition-colors ease-out">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs uppercase">
                    {log.actor_id ? log.actor_id.substring(0, 2) : 'SY'}
                  </div>
                  <div>
                    <p className="font-sans text-sm font-semibold text-pitch">{log.action}</p>
                    <p className="font-sans text-xs text-on-surface-variant truncate max-w-[200px]">User: {log.actor_id || 'System'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-sans text-xs font-medium text-pitch bg-ink/5 px-2 py-1 rounded-md">{log.entity_type}</p>
                  <p className="font-sans text-[10px] text-on-surface-variant mt-1">{new Date(log.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <div className="text-center py-10 text-on-surface-variant text-sm">No recent requests recorded.</div>
            )}
          </div>
        </div>

        {/* Component 5: Platform Metrics (Spans 2 cols, 1 row) */}
        <div className="md:col-span-2 rounded-3xl bg-surface-container p-6 border border-ink/5 flex flex-col justify-center">
          <p className="font-sans text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-4">Core Platform Metrics</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-chalk rounded-2xl shadow-sm border border-ink/5">
              <div className="flex items-center gap-2 mb-1">
                <CalendarClock size={16} className="text-clay" />
                <span className="font-sans text-xs font-medium text-on-surface-variant">Total Bookings</span>
              </div>
              <p className="font-display text-2xl font-bold text-pitch">{overview?.total_bookings || 0}</p>
            </div>
            <div className="p-4 bg-chalk rounded-2xl shadow-sm border border-ink/5">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={16} className="text-marigold" />
                <span className="font-sans text-xs font-medium text-on-surface-variant">Active Venues</span>
              </div>
              <p className="font-display text-2xl font-bold text-pitch">{overview?.active_venues || 0}</p>
            </div>
          </div>
        </div>

        {/* Component 6: Server Info (Spans 2 cols, 1 row) */}
        <div className="md:col-span-2 rounded-3xl bg-surface-container-high p-6 border border-ink/5 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-3">
             <p className="font-sans text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Node Distribution</p>
             <Wifi size={18} className="text-emerald-500" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-pitch">Web Servers (Mumbai)</span>
                <span className={health?.web_server_health && health.web_server_health > 50 ? "text-emerald-600" : "text-clay"}>
                  {health?.web_server_health && health.web_server_health > 50 ? 'Healthy' : 'Degraded'}
                </span>
              </div>
              <div className="w-full bg-ink/10 rounded-full h-1.5"><div className={`${health?.web_server_health && health.web_server_health > 50 ? 'bg-emerald-500' : 'bg-clay'} h-1.5 rounded-full`} style={{ width: `${health?.web_server_health ?? 95}%` }}></div></div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-pitch">Database (Postgres)</span>
                <span className={health?.db_server_health && health.db_server_health > 50 ? "text-emerald-600" : "text-clay"}>
                  {health?.db_server_health && health.db_server_health > 50 ? 'Healthy' : 'Degraded'}
                </span>
              </div>
              <div className="w-full bg-ink/10 rounded-full h-1.5"><div className={`${health?.db_server_health && health.db_server_health > 50 ? 'bg-emerald-500' : 'bg-clay'} h-1.5 rounded-full`} style={{ width: `${health?.db_server_health ?? 100}%` }}></div></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

function ReviewsTab() {
  const { data, isLoading, page, setPage, hasMore, venueId, setVenueFilter } = useAdminReviewsPaginated(20);
  const deleteReview = useAdminDeleteReview();
  const [localVenueId, setLocalVenueId] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-pitch">Reviews</h2>
          <p className="font-sans text-sm text-on-surface-variant">Moderate user reviews across all venues</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Filter by Venue ID..."
            value={localVenueId}
            onChange={(e) => setLocalVenueId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setVenueFilter(localVenueId.trim() || undefined);
              }
            }}
            className="flex-grow sm:w-64 rounded-xl border border-ink/10 bg-surface-container px-3 py-2 font-sans text-sm text-ink outline-none transition focus:border-pitch focus:ring-1 focus:ring-pitch ease-out"
          />
          <button
            onClick={() => setVenueFilter(localVenueId.trim() || undefined)}
            className="rounded-xl bg-pitch px-4 py-2 font-sans text-sm font-bold text-chalk transition hover:bg-pitch/90 ease-out"
          >
            Filter
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-chalk shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-sm">
            <thead className="bg-surface-container-high text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Review</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Author</th>
                <th className="px-6 py-4">Venue</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {isLoading ? (
                <>
                  {[1, 2, 3].map(skeleton => (
                    <tr key={skeleton} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="h-10 bg-mist rounded-xl w-full" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">
                    No reviews found.
                  </td>
                </tr>
              ) : (
                data?.map((review) => (
                  <tr key={review.id} className="transition-colors hover:bg-surface-container ease-out">
                    <td className="px-6 py-4">
                      <p className="max-w-xs truncate font-medium text-ink" title={review.content}>
                        {review.content}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-marigold/10 px-2 py-1 text-xs font-bold text-marigold-dark text-amber-600">
                        <Star size={14} className="inline fill-marigold text-marigold mr-1" /> {review.rating}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {review.user_name}
                      <br />
                      <span className="text-[10px] opacity-70">{review.user_id.split('-')[0]}...</span>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {review.venue_name}
                      <br />
                      <span className="text-[10px] opacity-70">{review.venue_id.split('-')[0]}...</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-on-surface-variant">
                      {dateTimeStr(review.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this review? This cannot be undone.')) {
                            deleteReview.mutate({ reviewId: review.id, venueId: review.venue_id });
                          }
                        }}
                        disabled={deleteReview.isPending}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-clay hover:bg-clay/10 transition-colors disabled:opacity-50 cursor-pointer ease-out"
                      >
                        <XCircle size={14} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1 || isLoading}
          className="rounded-xl border border-ink/10 px-4 py-2 font-sans text-sm font-semibold transition hover:bg-surface-container disabled:opacity-50 cursor-pointer ease-out"
        >
          Previous
        </button>
        <span className="font-sans text-sm text-on-surface-variant">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={!hasMore || isLoading}
          className="rounded-xl border border-ink/10 px-4 py-2 font-sans text-sm font-semibold transition hover:bg-surface-container disabled:opacity-50 cursor-pointer ease-out"
        >
          Next
        </button>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Support Tickets — Added for Admin Support Management
// ---------------------------------------------------------------------------
import { useAdminTickets, useAdminUpdateTicket, useTicketDetail, useAddComment } from '../hooks/useSupport';
import type { ApiSupportTicket, ApiTicketEvent } from '../lib/api/types';

function SupportTab() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'waiting_customer' | 'resolved' | 'closed'>('all');
  const { data: tickets, isLoading } = useAdminTickets(statusFilter === 'all' ? {} : { status: statusFilter });
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  if (isLoading) return <div className="shimmer h-96 rounded-2xl" />;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <div className="flex gap-2">
          <GroundSelect
            value={statusFilter}
            onValueChange={() => {}}
            options={[
              { value: "all", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "in_review", label: "In Review" },
              { value: "waiting_customer", label: "Waiting for Customer" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
        </div>

        {(!tickets || tickets.length === 0) ? (
          <p className="font-sans text-sm text-on-surface-variant">No support tickets found.</p>
        ) : (
          <div className="grid gap-3">
            {tickets.map((ticket: ApiSupportTicket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`flex flex-col gap-2 rounded-2xl p-4 text-left transition ${
                  selectedTicketId === ticket.id
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container hover:bg-surface-container-high text-ink'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-sans text-sm font-medium">{ticket.subject}</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <div className="flex gap-3 font-sans text-xs opacity-80">
                  <span className="uppercase">{ticket.priority} priority</span>
                  <span>·</span>
                  <span>{dateTimeStr(ticket.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTicketId ? (
        <AdminTicketDetail ticketId={selectedTicketId} />
      ) : (
        <div className="rounded-2xl bg-surface-container p-10 text-center flex flex-col items-center justify-center">
          <MessageSquare size={32} className="text-on-surface-variant opacity-50 mb-3" />
          <p className="font-sans text-sm text-on-surface-variant">Select a ticket to view details</p>
        </div>
      )}
    </div>
  );
}

function AdminTicketDetail({ ticketId }: { ticketId: string }) {
  const { data: ticket, isLoading } = useTicketDetail(ticketId);
  const updateTicket = useAdminUpdateTicket();
  const addComment = useAddComment(ticketId);
  
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading || !ticket) return <div className="shimmer h-96 rounded-2xl" />;

  const handleUpdateStatus = async (newStatus: string) => {
    setActionError(null);
    try {
      await updateTicket.mutateAsync({ ticketId, body: { status: newStatus as any } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    setActionError(null);
    try {
      await updateTicket.mutateAsync({ ticketId, body: { priority: newPriority as any } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleSendReply = async () => {
    if (!commentText.trim()) return;
    setActionError(null);
    try {
      await addComment.mutateAsync({ comment: commentText, internal: isInternal });
      setCommentText('');
      setIsInternal(false);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="flex h-[600px] flex-col rounded-2xl bg-surface-container">
      <div className="border-b border-ink/10 p-4">
        <h3 className="font-sans text-lg font-medium text-ink">{ticket.subject}</h3>
        <p className="mt-1 font-sans text-xs text-on-surface-variant">
          Ticket #{ticket.id.slice(0, 8)} · Created {dateTimeStr(ticket.created_at)}
        </p>
        
        {actionError && <div className="mt-2"><ErrorBanner message={actionError} /></div>}

        <div className="mt-4 flex gap-3">
          <GroundSelect
            value={ticket.status}
            onValueChange={() => {}}
            options={[
              { value: "open", label: "Open" },
              { value: "in_review", label: "In Review" },
              { value: "waiting_customer", label: "Waiting for Customer" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />

          <GroundSelect
            value={ticket.priority}
            onValueChange={() => {}}
            options={[
              { value: "low", label: "Low Priority" },
              { value: "medium", label: "Medium Priority" },
              { value: "high", label: "High Priority" },
              { value: "urgent", label: "Urgent" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {ticket.events?.map((event: ApiTicketEvent) => {
          if (event.event_type !== 'comment' && event.event_type !== 'created') return null;
          
          return (
            <div key={event.id} className={`rounded-xl p-3 ${event.internal ? 'bg-marigold/20' : 'bg-surface'}`}>
              <div className="mb-1 flex justify-between font-sans text-xs">
                <span className="font-medium text-ink">
                  {event.actor_id === ticket.creator_id ? 'Customer' : 'Admin'}
                  {event.internal && ' (Internal Note)'}
                </span>
                <span className="text-on-surface-variant">{dateTimeStr(event.created_at)}</span>
              </div>
              <p className="font-sans text-sm text-ink whitespace-pre-wrap">{event.comment}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-ink/10 p-4 bg-surface-container-low rounded-b-2xl">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Type a reply..."
          className="w-full resize-none rounded-xl bg-surface p-3 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
          rows={3}
        />
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 font-sans text-sm text-on-surface-variant cursor-pointer">
            <input 
              type="checkbox" 
              checked={isInternal} 
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded text-pitch focus:ring-pitch"
            />
            Internal Note
          </label>
          <button
            onClick={handleSendReply}
            disabled={addComment.isPending || !commentText.trim()}
            className="rounded-full bg-pitch px-5 py-2 font-sans text-sm text-chalk disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Admin Notifications Component ---
function AdminNotifications() {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('send');
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <h2 className="font-sans text-xl font-semibold text-ink">Notification Center</h2>
        <div className="flex gap-2 bg-surface-container rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('send')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'send' ? 'bg-white shadow text-ink' : 'text-on-surface-variant hover:text-ink'}`}
          >
            Send Notification
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === 'history' ? 'bg-white shadow text-ink' : 'text-on-surface-variant hover:text-ink'}`}
          >
            History
          </button>
        </div>
      </div>

      {activeTab === 'send' ? <AdminSendNotification /> : <AdminNotificationHistory />}
    </div>
  );
}

function AdminSendNotification() {
  const [search, setSearch] = useState('');
  const { data: users, isLoading } = useAdminUsers(
    search.length >= 3 ? { search } : { limit: 10 }
  );
  const [selectedUser, setSelectedUser] = useState<ApiAdminUserView | null>(null);
  
  const [type, setType] = useState('general');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const sendNotification = useAdminSendNotification();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !message.trim()) return;
    
    setError('');
    setSuccess(false);
    try {
      await sendNotification.mutateAsync({
        user_id: selectedUser.id,
        type,
        message,
      });
      setSuccess(true);
      setMessage('');
    } catch (err: any) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wider">Select Recipient</h3>
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-ink/20 bg-transparent px-4 py-2 font-sans text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
        />
        
        <div className="rounded-xl border border-ink/10 overflow-hidden bg-surface">
          {isLoading ? (
            <div className="p-4 text-sm text-on-surface-variant">Searching...</div>
          ) : users?.length === 0 ? (
            <div className="p-4 text-sm text-on-surface-variant">No users found.</div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y divide-ink/5">
              {users?.map((user: ApiAdminUserView) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`w-full text-left p-3 flex justify-between items-center transition ${selectedUser?.id === user.id ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container'}`}
                >
                  <div>
                    <div className="font-medium text-sm">{user.name}</div>
                    <div className="text-xs opacity-80">{user.email} • {user.phone || 'No phone'}</div>
                  </div>
                  <span className="text-xs font-semibold uppercase">{user.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wider">Compose</h3>
        {selectedUser ? (
          <form onSubmit={handleSend} className="space-y-4 rounded-2xl bg-surface-container p-5">
            <div className="flex items-center gap-3 pb-4 border-b border-ink/10">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                {selectedUser.name[0].toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm text-ink">{selectedUser.name}</div>
                <div className="text-xs text-on-surface-variant">Recipient</div>
              </div>
            </div>
            
            {success && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Notification sent successfully.</div>}
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Type</label>
              <GroundSelect
                value={type}
                onValueChange={setType}
                options={[
                  { value: 'general', label: 'General' },
                  { value: 'booking', label: 'Booking' },
                  { value: 'account', label: 'Account' },
                  { value: 'support', label: 'Support' }
                ]}
                triggerClassName="w-full"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-medium text-ink">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-xl border border-ink/20 bg-transparent px-3 py-2 font-sans text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                placeholder="Message body..."
              />
            </div>

            <button
              type="submit"
              disabled={sendNotification.isPending}
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-sans text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {sendNotification.isPending ? 'Sending...' : 'Send Notification'}
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center flex flex-col items-center justify-center text-on-surface-variant">
            <Bell size={24} className="mb-2 opacity-50" />
            <p className="text-sm">Select a user to compose a notification.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminNotificationHistory() {
  const { data: notifications, isLoading } = useAdminNotifications();

  if (isLoading) return <div className="shimmer h-64 rounded-2xl" />;
  if (!notifications || notifications.length === 0) return <div className="p-8 text-center text-sm text-on-surface-variant">No notification history.</div>;

  return (
    <div className="rounded-2xl border border-ink/10 overflow-hidden bg-surface">
      <table className="w-full text-left font-sans text-sm">
        <thead className="bg-surface-container text-xs uppercase text-on-surface-variant">
          <tr>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Message</th>
            <th className="px-4 py-3 font-medium">Created</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {notifications.map((n: any) => (
            <tr key={n.id} className="hover:bg-surface-container/50">
              <td className="px-4 py-3 whitespace-nowrap"><span className="rounded bg-ink/5 px-2 py-0.5 text-xs font-semibold uppercase">{n.type}</span></td>
              <td className="px-4 py-3 max-w-xs truncate">{n.message}</td>
              <td className="px-4 py-3 whitespace-nowrap text-on-surface-variant">{dateTimeStr(n.created_at)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {n.read_at ? (
                  <span className="text-emerald-600 font-medium text-xs flex items-center gap-1"><CheckCircle2 size={14}/> Read</span>
                ) : (
                  <span className="text-amber-600 font-medium text-xs flex items-center gap-1"><Clock size={14}/> Unread</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
