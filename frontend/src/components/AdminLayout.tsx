import AdminPasswords from './dashboard/AdminPasswords';
import DatabaseStudioTab from './dashboard/DatabaseStudioTab';
import { useDebounce } from '../hooks/useDebounce';
import { useAdminNotifications, useAdminSendNotification } from '../hooks/useNotifications';
import GroundSelect from './ui/GroundSelect';
import { Activity, AlertCircle, Ban, CalendarClock, CheckCircle2, Database, FileText, Globe, Layers, LayoutDashboard, Key, Loader2, Mail, MessageSquare, Minus, Plus as PlusIcon, PlayCircle, RefreshCw, Search, Server, ShieldCheck, Users as UsersIcon, Wallet, Wifi, XCircle, ArrowRight, Star, Bell, Clock } from 'lucide-react';
import { DashboardShell, MetricCard, StatusBadge as DashboardStatusBadge, EmptyState } from './dashboard';
import { Home } from 'lucide-react';
import HomepageTab from './dashboard/HomepageTab';
import { AdminVenueDrawer } from './dashboard/AdminVenueDrawer';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useAdminBookings,
  useAdminBookingsPaginated,
  useAdminDashboardOverview,
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
import { adminApi } from '../lib/api/admin';
import type {
  ApiAdminOwnerVerificationView,
  ApiAdminUserView,
  ApiAuditLogEntry,
  ApiBookingDetail,
  ApiAdminBookingView,
  ApiDashboardOverview,
  ApiAdminVenueView,
  ApiAdminReview,
  BookingStatus,
  PayoutStatus,
} from '../lib/api/types';
import { useAuth } from '../lib/auth';

type Tab = 'Overview' | 'Analytics' | 'DatabaseStudio' | 'ApprovalQueue' | 'Venues' | 'Users' | 'Bookings' | 'Payouts' | 'Reviews' | 'Support' | 'Notifications' | 'Homepage' | 'Passwords';

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
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (urlTab && ['Overview', 'Analytics', 'ApprovalQueue', 'Venues', 'Users', 'Bookings', 'Payouts', 'Reviews', 'Support', 'Notifications', 'Homepage', 'Passwords'].includes(urlTab)) {
      return urlTab;
    }
    const saved = sessionStorage.getItem('initialAdminTab') as Tab;
    if (saved) {
      sessionStorage.removeItem('initialAdminTab');
      return saved;
    }
    return 'Overview';
  });

  useEffect(() => {
    if (urlTab && ['Overview', 'Analytics', 'ApprovalQueue', 'Venues', 'Users', 'Bookings', 'Payouts', 'Reviews', 'Support', 'Notifications', 'Homepage', 'Passwords'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

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

  const { data: dashboard, isLoading: overviewLoading } = useAdminDashboardOverview();
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
    { id: 'DatabaseStudio', label: 'DB & Analytics', icon: Database, onClick: () => setActiveTab('DatabaseStudio') },
    { id: 'Analytics', label: 'Analytics', icon: Activity, onClick: () => setActiveTab('Analytics') },
    { id: 'ApprovalQueue', label: 'Approval Queue', icon: ShieldCheck, badge: pendingCount || undefined, onClick: () => setActiveTab('ApprovalQueue') },
    { id: 'Venues', label: 'Venues', icon: Layers, onClick: () => setActiveTab('Venues') },
    { id: 'Users', label: 'Users', icon: UsersIcon, onClick: () => setActiveTab('Users') },
    { id: 'Bookings', label: 'Bookings', icon: CalendarClock, onClick: () => setActiveTab('Bookings') },
    { id: 'Payouts', label: 'Payouts', icon: Wallet, onClick: () => setActiveTab('Payouts') },
    { id: 'Reviews', label: 'Reviews', icon: MessageSquare, onClick: () => setActiveTab('Reviews') },
    { id: 'Support', label: 'Support Tickets', icon: AlertCircle, onClick: () => setActiveTab('Support') },
    { id: 'Passwords', label: 'Passwords', icon: Key, onClick: () => setActiveTab('Passwords') },
    { id: 'Notifications', label: 'Notification Center', icon: Bell, onClick: () => setActiveTab('Notifications') },
    { id: 'Homepage', label: 'Homepage Curation', icon: Globe, onClick: () => setActiveTab('Homepage') },
  ];

  const titles: Record<Tab, { title: string; desc: string }> = {
    Overview: { title: 'Admin Dashboard', desc: 'Operations overview and platform health' },
    DatabaseStudio: { title: 'Database Studio & Analytics', desc: 'Live DB monitoring, table browser, safe SQL runner, charts & CSV exports' },
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
    Passwords: { title: 'Password Management', desc: 'Admin password reset and account recovery tools' },
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
          dashboard={dashboard} 
          overviewLoading={overviewLoading} 
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}
      {activeTab === 'DatabaseStudio' && <DatabaseStudioTab />}
      {activeTab === 'Analytics' && (
        <AnalyticsTab overview={dashboard} auditLog={auditLog} />
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
      {activeTab === 'Passwords' && <AdminPasswords />}
      {activeTab === 'Homepage' && <HomepageTab />}
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
  dashboard,
  overviewLoading,
  onNavigate,
}: {
  dashboard: ApiDashboardOverview | undefined;
  overviewLoading: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  if (overviewLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-24 rounded-2xl" />
          ))}
        </div>
        <div className="shimmer h-64 rounded-2xl" />
      </div>
    );
  }

  if (!dashboard) {
    return <p className="font-sans text-on-surface-variant">Couldn't load the platform overview.</p>;
  }

  const { metrics, attention, live_operations, booking_activity, revenue, venue_health, top_venues, category_performance, support, notifications, recent_activity } = dashboard;

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="GMV (This Month)" value={money(metrics.gmv)} />
        <MetricCard label="Total Bookings" value={metrics.total_bookings.toLocaleString('en-IN')} />
        <MetricCard label="Active Venues" value={metrics.active_venues.toLocaleString('en-IN')} />
        <MetricCard label="Users" value={metrics.active_users.toLocaleString('en-IN')} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Attention & Live Ops */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Requires Attention */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-container px-5 py-4 bg-marigold/10">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide flex items-center gap-2"><AlertCircle size={16} className="text-marigold" /> Requires Attention</h3>
            </div>
            <div className="divide-y divide-surface-container">
              {attention.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-sans text-sm text-on-surface-variant">Everything is up to date.</p>
                  <p className="font-sans text-xs text-on-surface-variant mt-1">No urgent operational actions currently require attention.</p>
                </div>
              ) : (
                attention.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 hover:bg-surface-container/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container font-sans text-sm font-medium text-ink">{item.count}</span>
                      <span className="font-sans text-sm font-medium text-ink">{item.label}</span>
                    </div>
                    <button 
                      onClick={() => onNavigate(item.action_link as Tab)}
                      className="rounded-full bg-surface-container px-4 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container-high transition-colors"
                    >
                      [{item.action_label}]
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Live Operations */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="border-b border-surface-container px-5 py-4 bg-mist/50">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide">Live Operations</h3>
            </div>
            <div className="grid grid-cols-4 gap-4 p-5 border-b border-surface-container bg-surface-container-lowest">
              <div className="text-center">
                <p className="font-sans text-xs text-on-surface-variant uppercase">Currently Booked</p>
                <p className="font-sans text-2xl font-semibold text-ink mt-1">{live_operations.currently_booked}</p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-on-surface-variant uppercase">Available</p>
                <p className="font-sans text-2xl font-semibold text-ink mt-1">{live_operations.available}</p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-on-surface-variant uppercase">Pending</p>
                <p className="font-sans text-2xl font-semibold text-ink mt-1">{live_operations.pending}</p>
              </div>
              <div className="text-center">
                <p className="font-sans text-xs text-on-surface-variant uppercase">Cancelled Today</p>
                <p className="font-sans text-2xl font-semibold text-ink mt-1">{live_operations.cancelled_today}</p>
              </div>
            </div>
            <div className="divide-y divide-surface-container">
              {live_operations.active_bookings.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="font-sans text-sm text-on-surface-variant">No bookings are happening right now.</p>
                </div>
              ) : (
                live_operations.active_bookings.map(b => (
                  <div key={b.id} className="p-4 flex items-center justify-between hover:bg-surface-container/30">
                    <div>
                      <p className="font-sans text-sm font-medium text-ink">{b.venue_name}</p>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">{b.category}</p>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">
                        {new Date(b.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(b.end_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">Customer: {b.customer_name}</p>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">Status: <StatusBadge status={b.status} /></p>
                    </div>
                    <button onClick={() => onNavigate('Bookings')} className="text-primary hover:underline font-sans text-xs font-medium">
                      [View Booking]
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Venues & Venue Health */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
              <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Top Venues</h3>
              <div className="space-y-4">
                {top_venues.map((v, i) => (
                  <div key={v.id} className="flex flex-col gap-0.5">
                    <span className="font-sans text-sm font-medium text-ink">{i + 1}. {v.name}</span>
                    <span className="font-sans text-xs text-on-surface-variant">{v.bookings_count} bookings · {money(v.gmv)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
              <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Venue Health</h3>
              <div className="space-y-2">
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Approved</span><span className="font-medium text-ink">{venue_health.approved}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Pending</span><span className="font-medium text-ink">{venue_health.pending_approval}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-marigold font-medium">Incomplete</span><span className="font-medium text-ink">{venue_health.incomplete}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-clay font-medium">Inactive</span><span className="font-medium text-ink">{venue_health.inactive}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-clay font-medium">Suspended</span><span className="font-medium text-ink">{venue_health.suspended}</span></div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="border-b border-surface-container px-5 py-4 bg-mist/50">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide">Recent Activity</h3>
            </div>
            <div className="divide-y divide-surface-container">
              {recent_activity.slice(0, 5).map(item => (
                <div key={item.id} className="p-4 flex gap-4 hover:bg-surface-container/30 transition-colors">
                   <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                      <Activity size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm font-medium text-ink">{item.event}</p>
                      <p className="font-sans text-xs text-on-surface-variant mt-0.5">{item.entity_name} · {item.actor_name}</p>
                      {item.amount && <p className="font-sans text-xs text-ink mt-0.5">{money(item.amount)}</p>}
                      <p className="font-sans text-xs text-on-surface-variant mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Actions & Bookings & Revenue */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Quick Actions</h3>
            <div className="grid gap-2">
              <button onClick={() => onNavigate('ApprovalQueue')} className="flex justify-between items-center w-full px-3 py-2 rounded-lg hover:bg-surface-container text-left font-sans text-sm text-ink transition-colors">
                Review Pending Venues <ArrowRight size={14} className="text-on-surface-variant" />
              </button>
              <button onClick={() => onNavigate('Homepage')} className="flex justify-between items-center w-full px-3 py-2 rounded-lg hover:bg-surface-container text-left font-sans text-sm text-ink transition-colors">
                Manage Homepage <ArrowRight size={14} className="text-on-surface-variant" />
              </button>
              <button onClick={() => onNavigate('Bookings')} className="flex justify-between items-center w-full px-3 py-2 rounded-lg hover:bg-surface-container text-left font-sans text-sm text-ink transition-colors">
                Booking Operations <ArrowRight size={14} className="text-on-surface-variant" />
              </button>
              <button onClick={() => onNavigate('Support')} className="flex justify-between items-center w-full px-3 py-2 rounded-lg hover:bg-surface-container text-left font-sans text-sm text-ink transition-colors">
                Support Tickets <ArrowRight size={14} className="text-on-surface-variant" />
              </button>
              <button onClick={() => onNavigate('Notifications')} className="flex justify-between items-center w-full px-3 py-2 rounded-lg hover:bg-surface-container text-left font-sans text-sm text-ink transition-colors">
                Notification Center <ArrowRight size={14} className="text-on-surface-variant" />
              </button>
            </div>
          </div>

          {/* Booking Activity */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest overflow-hidden">
            <div className="border-b border-surface-container px-5 py-4 bg-mist/50">
              <h3 className="font-sans text-sm font-semibold text-ink uppercase tracking-wide">Today's Booking Activity</h3>
            </div>
            <div className="p-5 border-b border-surface-container space-y-2">
               <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Confirmed</span><span className="font-medium text-ink">{booking_activity.stats.confirmed_today}</span></div>
               <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Pending</span><span className="font-medium text-ink">{booking_activity.stats.pending_today}</span></div>
               <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Cancelled</span><span className="font-medium text-ink">{booking_activity.stats.cancelled_today}</span></div>
               <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Completed</span><span className="font-medium text-ink">{booking_activity.stats.completed_today}</span></div>
            </div>
            <div className="divide-y divide-surface-container">
               {booking_activity.recent.map(r => (
                  <div key={r.id} className="p-4 flex justify-between items-center">
                     <div>
                       <p className="font-sans text-xs text-on-surface-variant mb-1">{new Date(r.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                       <p className="font-sans text-sm font-medium text-ink">{r.venue_name}</p>
                       <p className="font-sans text-xs text-on-surface-variant">{r.customer_name} · <StatusBadge status={r.status} /></p>
                     </div>
                  </div>
               ))}
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Revenue Overview</h3>
            <div className="space-y-4">
               <div>
                  <p className="font-sans text-2xl font-semibold text-ink">{money(revenue.this_month)}</p>
                  <p className="font-sans text-xs text-on-surface-variant uppercase">This Month</p>
               </div>
               <div>
                  <p className="font-sans text-xl font-semibold text-ink">{money(revenue.this_week)}</p>
                  <p className="font-sans text-xs text-on-surface-variant uppercase">This Week</p>
               </div>
               <div>
                  <p className="font-sans text-lg font-semibold text-ink">{money(revenue.today)}</p>
                  <p className="font-sans text-xs text-on-surface-variant uppercase">Today</p>
               </div>
               <div className="mt-4 pt-4 border-t border-surface-container">
                  <div className="flex items-end h-16 gap-1">
                     {revenue.chart_data.map((d, i) => {
                        const maxVal = Math.max(...revenue.chart_data.map(x => x.value)) || 1;
                        const height = Math.max((d.value / maxVal) * 100, 5);
                        return (
                           <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                              <div className="w-full bg-primary/20 rounded-t-sm" style={{height: `${height}%`}}></div>
                              <span className="text-[10px] text-on-surface-variant">{d.label}</span>
                           </div>
                        );
                     })}
                  </div>
               </div>
            </div>
          </div>
          
          {/* Support */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Support</h3>
            <div className="space-y-2">
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Open Tickets</span><span className="font-medium text-ink">{support.open_tickets}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-marigold font-medium">High Priority</span><span className="font-medium text-ink">{support.high_priority}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Waiting for Owner</span><span className="font-medium text-ink">{support.waiting_for_owner}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Waiting for Customer</span><span className="font-medium text-ink">{support.waiting_for_customer}</span></div>
            </div>
          </div>

          {/* Notifications */}
          <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Notifications</h3>
            <div className="space-y-2">
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Sent Today</span><span className="font-medium text-ink">{notifications.sent_today}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-clay font-medium">Failed</span><span className="font-medium text-ink">{notifications.failed}</span></div>
                <div className="flex justify-between font-sans text-sm"><span className="text-on-surface-variant">Unread Alerts</span><span className="font-medium text-ink">{notifications.unread_alerts}</span></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function AnalyticsTab({
  overview,
  auditLog,
}: {
  overview: ApiDashboardOverview | undefined;
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 custom-scrollbar" data-lenis-prevent>
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
              <p className="font-display text-2xl font-bold text-pitch">{overview?.metrics?.total_bookings ?? overview?.total_bookings ?? 0}</p>
            </div>
            <div className="p-4 bg-chalk rounded-2xl shadow-sm border border-ink/5">
              <div className="flex items-center gap-2 mb-1">
                <Layers size={16} className="text-marigold" />
                <span className="font-sans text-xs font-medium text-on-surface-variant">Active Venues</span>
              </div>
              <p className="font-display text-2xl font-bold text-pitch">{overview?.metrics?.active_venues ?? overview?.active_venues ?? 0}</p>
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
// Approval Queue — pending venues + owner verifications
// ---------------------------------------------------------------------------

function ApprovalQueueTab({
  pendingVenues,
  pendingVerifications,
  isLoading,
}: {
  pendingVenues: ApiAdminVenueView[];
  pendingVerifications: ApiAdminOwnerVerificationView[];
  isLoading: boolean;
}) {
  const approveVenue = useApproveVenue();
  const rejectVenue = useRejectVenue();
  const approveVerification = useApproveVerification();
  const rejectVerification = useRejectVerification();
  const [rejectVenueId, setRejectVenueId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  if (isLoading) return <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" />Loading approval queue…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-pitch mb-4">Pending Venues ({pendingVenues.length})</h2>
        {pendingVenues.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No venues pending review" description="All submissions have been processed." />
        ) : (
          <div className="space-y-3">
            {pendingVenues.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-chalk rounded-xl p-4 border border-ink/10 gap-4">
                <div>
                  <p className="font-semibold text-ink">{v.name}</p>
                  <p className="text-sm text-on-surface-variant">{v.owner_name} · {v.category} · {v.city}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => approveVenue.mutate(v.id)}
                    disabled={approveVenue.isPending}
                    className="px-3 py-1 text-sm bg-pitch text-chalk rounded-lg hover:bg-pitch/90 disabled:opacity-50"
                  >Approve</button>
                  <button
                    onClick={() => setRejectVenueId(v.id)}
                    className="px-3 py-1 text-sm border border-ink/20 rounded-lg hover:bg-mist"
                  >Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {rejectVenueId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-chalk rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Rejection Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-ink/20 rounded-lg p-3 text-sm min-h-[100px] mb-4"
              placeholder="Explain why this venue is being rejected…"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setRejectVenueId(null); setRejectReason(''); }} className="px-4 py-2 text-sm border border-ink/20 rounded-lg">Cancel</button>
              <button
                disabled={!rejectReason.trim() || rejectVenue.isPending}
                onClick={() => {
                  if (rejectVenueId) {
                    rejectVenue.mutate({ venueId: rejectVenueId, reason: rejectReason });
                    setRejectVenueId(null); setRejectReason('');
                  }
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >Reject Venue</button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display text-2xl font-bold text-pitch mb-4">Owner Verifications ({pendingVerifications.length})</h2>
        {pendingVerifications.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No verifications pending" description="All owner applications have been reviewed." />
        ) : (
          <div className="space-y-3">
            {pendingVerifications.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-chalk rounded-xl p-4 border border-ink/10 gap-4">
                <div>
                  <p className="font-semibold text-ink">{v.business_name ?? 'No business name'}</p>
                  <p className="text-sm text-on-surface-variant">{v.identification_type} · {v.identification_number}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => adminApi.viewVerificationDocument(v.id)}
                    className="px-3 py-1 text-sm border border-ink/20 rounded-lg hover:bg-mist text-ink"
                  >View document</button>
                  <button
                    onClick={() => approveVerification.mutate(v.id)}
                    disabled={approveVerification.isPending}
                    className="px-3 py-1 text-sm bg-pitch text-chalk rounded-lg hover:bg-pitch/90 disabled:opacity-50"
                  >Approve</button>
                  <button
                    onClick={() => rejectVerification.mutate({ verificationId: v.id, reason: 'Documentation insufficient — please resubmit with valid documents.' })}
                    disabled={rejectVerification.isPending}
                    className="px-3 py-1 text-sm border border-ink/20 rounded-lg hover:bg-mist"
                  >Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Venues — paginated admin venue list (uses infinite query, load-more)
// ---------------------------------------------------------------------------

function VenuesTab() {
  const { data: venuePages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminVenuesPaginated({});
  const suspendVenue = useSuspendVenue();
  const reactivateVenue = useReactivateVenue();
  const [selectedVenue, setSelectedVenue] = useState<ApiAdminVenueView | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const venues = venuePages?.pages.flatMap((p) => p) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-pitch">Venues</h2>
          <p className="font-sans text-sm text-on-surface-variant">Manage all marketplace venues</p>
        </div>
      </div>

      {suspendingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-chalk rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Suspension Reason</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full border border-ink/20 rounded-lg p-3 text-sm min-h-[80px] mb-4"
              placeholder="Reason for venue suspension…"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSuspendingId(null); setSuspendReason(''); }} className="px-4 py-2 text-sm border border-ink/20 rounded-lg">Cancel</button>
              <button
                disabled={!suspendReason.trim() || suspendVenue.isPending}
                onClick={() => {
                  if (suspendingId) { suspendVenue.mutate({ venueId: suspendingId, reason: suspendReason }); setSuspendingId(null); setSuspendReason(''); }
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
              >Suspend</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" />Loading venues…</div>
      ) : venues.length === 0 ? (
        <EmptyState icon={Layers} title="No venues found" description="No venues match the current filter." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-mist">
              <tr>
                {['Name', 'Category', 'City', 'Status', 'Price', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {venues.map((v) => (
                <tr key={v.id} className="hover:bg-mist/50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => setSelectedVenue(v)} className="font-medium text-pitch hover:underline text-left">{v.name}</button>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{v.category}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{v.city}</td>
                  <td className="px-4 py-3"><DashboardStatusBadge status={v.status} /></td>
                  <td className="px-4 py-3">₹{v.base_price}</td>
                  <td className="px-4 py-3">
                    {v.status === 'suspended' ? (
                      <button onClick={() => reactivateVenue.mutate(v.id)} disabled={reactivateVenue.isPending} className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100">Reactivate</button>
                    ) : v.status === 'active' ? (
                      <button onClick={() => setSuspendingId(v.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100">Suspend</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm px-4 py-2 border border-ink/20 rounded-xl hover:bg-mist disabled:opacity-50"
        >
          {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Load More
        </button>
      )}

      {selectedVenue && (
        <AdminVenueDrawer venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users — paginated admin user list (uses infinite query, load-more)
// ---------------------------------------------------------------------------

function UsersTab() {
  const { data: userPages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminUsersPaginated({});
  const suspendUser = useSuspendUser();
  const reactivateUser = useReactivateUser();
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const users = userPages?.pages.flatMap((p) => p) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-pitch">Users</h2>
        <p className="font-sans text-sm text-on-surface-variant">Manage customers and venue owners</p>
      </div>

      {suspendingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-chalk rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Suspension Reason</h3>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="w-full border border-ink/20 rounded-lg p-3 text-sm min-h-[80px] mb-4"
              placeholder="Reason for suspension…"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSuspendingId(null); setSuspendReason(''); }} className="px-4 py-2 text-sm border border-ink/20 rounded-lg">Cancel</button>
              <button
                disabled={!suspendReason.trim() || suspendUser.isPending}
                onClick={() => {
                  if (suspendingId) { suspendUser.mutate({ userId: suspendingId, reason: suspendReason }); setSuspendingId(null); setSuspendReason(''); }
                }}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50"
              >Suspend User</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" />Loading users…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-mist">
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-mist/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{u.email || '—'}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 bg-mist rounded-full">{u.role}</span></td>
                  <td className="px-4 py-3"><DashboardStatusBadge status={u.suspended_at ? 'suspended' : 'active'} /></td>
                  <td className="px-4 py-3 text-on-surface-variant">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    {u.suspended_at ? (
                      <button onClick={() => reactivateUser.mutate(u.id)} disabled={reactivateUser.isPending} className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg">Reactivate</button>
                    ) : (
                      <button onClick={() => setSuspendingId(u.id)} className="text-xs px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg">Suspend</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm px-4 py-2 border border-ink/20 rounded-xl hover:bg-mist disabled:opacity-50"
        >
          {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Load More
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookings — paginated admin booking list with confirm / cancel
// ---------------------------------------------------------------------------

function BookingsTab() {
  const { data: bookingPages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminBookingsPaginated({});
  const confirmPayment = useConfirmBookingPayment();
  const cancelPending = useCancelPendingBooking();
  const sweepHolds = useSweepExpiredHolds();
  const bookingLookup = useBookingLookup();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmMethod, setConfirmMethod] = useState('cash');
  const [lookupId, setLookupId] = useState('');

  const bookings = bookingPages?.pages.flatMap((p) => p) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-pitch">Bookings</h2>
          <p className="font-sans text-sm text-on-surface-variant">Confirm payments and manage booking operations</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 items-center">
            <input
              type="text"
              placeholder="Jump to a booking by ID..."
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              className="text-sm border border-ink/20 rounded-lg px-3 py-1.5 w-44"
            />
            <button
              onClick={() => { if (lookupId) bookingLookup.mutate(lookupId); }}
              disabled={!lookupId || bookingLookup.isPending}
              className="text-sm px-3 py-1.5 bg-pitch text-chalk rounded-lg disabled:opacity-50"
            >Find</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sweepHolds.mutate()}
              disabled={sweepHolds.isPending}
              className="flex items-center gap-1 text-sm px-3 py-1.5 border border-ink/20 rounded-lg hover:bg-mist"
            >
              <RefreshCw className="w-3 h-3" />{sweepHolds.isPending ? 'Sweeping…' : 'Sweep expired holds now'}
            </button>
            {sweepHolds.isSuccess && sweepHolds.data && (
              <span className="text-xs text-green-600">Released {sweepHolds.data.swept} expired holds</span>
            )}
          </div>
        </div>
      </div>

      {bookingLookup.data && (
        <div className="bg-marigold/10 border border-marigold/30 rounded-xl p-4 text-sm">
          <p className="font-semibold text-ink">Booking: {bookingLookup.data.id}</p>
          <p className="text-on-surface-variant">{bookingLookup.data.venue_name} · ₹{bookingLookup.data.amount} · <DashboardStatusBadge status={bookingLookup.data.status} /></p>
        </div>
      )}

      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40">
          <div className="bg-chalk rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-3">Confirm Payment</h3>
            <div className="space-y-3 mb-4">
              <input
                type="number"
                value={confirmAmount}
                onChange={(e) => setConfirmAmount(e.target.value)}
                placeholder="Amount received"
                className="w-full border border-ink/20 rounded-lg p-3 text-sm"
              />
              <select
                value={confirmMethod}
                onChange={(e) => setConfirmMethod(e.target.value)}
                className="w-full border border-ink/20 rounded-lg p-3 text-sm bg-chalk"
              >
                {['cash', 'upi', 'bank_transfer', 'card'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmingId(null); setConfirmAmount(''); }} className="px-4 py-2 text-sm border border-ink/20 rounded-lg">Cancel</button>
              <button
                disabled={!confirmAmount || confirmPayment.isPending}
                onClick={() => {
                  if (confirmingId) {
                    confirmPayment.mutate({
                      bookingId: confirmingId,
                      body: { amount: Number(confirmAmount), method: confirmMethod },
                    });
                    setConfirmingId(null); setConfirmAmount('');
                  }
                }}
                className="px-4 py-2 text-sm bg-pitch text-chalk rounded-lg disabled:opacity-50"
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" />Loading bookings…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-mist">
              <tr>
                {['Venue', 'Customer', 'Amount', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-mist/50">
                  <td className="px-4 py-3 font-medium text-ink">{b.venue_name}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{b.customer_name ?? b.guest_name ?? '—'}</td>
                  <td className="px-4 py-3">₹{b.amount}</td>
                  <td className="px-4 py-3">
                    {b.status === 'pending_payment' && b.hold_expires_at && new Date(b.hold_expires_at) < new Date() ? 'hold expired' : <DashboardStatusBadge status={b.status} />}
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {b.status === 'pending_payment' && (
                        <>
                          <button
                            onClick={() => { setConfirmingId(b.id); setConfirmAmount(String(b.amount)); }}
                            className="text-xs px-2 py-1 bg-pitch text-chalk rounded-lg"
                          >Confirm Payment</button>
                          <button
                            onClick={() => cancelPending.mutate({ bookingId: b.id, reason: 'Admin cancelled pending booking' })}
                            disabled={cancelPending.isPending}
                            className="text-xs px-2 py-1 border border-ink/20 rounded-lg"
                          >Cancel</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm px-4 py-2 border border-ink/20 rounded-xl hover:bg-mist disabled:opacity-50"
        >
          {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Load More
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payouts — paginated admin payout list (uses infinite query)
// ---------------------------------------------------------------------------

function PayoutsTab() {
  const { data: payoutPages, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useAdminPayoutsPaginated({});
  const markPaid = useMarkPayoutPaid();
  const runPayout = useRunPayout();
  const { data: owners = [] } = useAdminUsers({ role: 'owner' });

  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];

  const [periodStart, setPeriodStart] = useState(firstDayStr);
  const [periodEnd, setPeriodEnd] = useState(yesterdayStr);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const payouts = payoutPages?.pages.flatMap((p) => p) ?? [];

  const handleRunPayout = async () => {
    if (!selectedOwnerId) {
      setPayoutError('Please select a venue owner.');
      return;
    }
    setPayoutError(null);
    try {
      await runPayout.mutateAsync({
        owner_id: selectedOwnerId,
        period_start: periodStart,
        period_end: periodEnd,
      });
      setIsRunModalOpen(false);
    } catch (err: any) {
      setPayoutError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-pitch">Payouts</h2>
          <p className="font-sans text-sm text-on-surface-variant">Manage and process owner payouts</p>
        </div>
        <button
          onClick={() => { setPayoutError(null); setIsRunModalOpen(true); }}
          className="flex items-center gap-2 text-sm px-4 py-2 bg-pitch text-chalk rounded-xl hover:bg-pitch/90 transition-colors"
        >
          <PlayCircle className="w-4 h-4" />Run Payouts
        </button>
      </div>

      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div className="bg-chalk rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-display text-lg font-semibold text-ink mb-1">Run Owner Payout</h3>
            <p className="font-sans text-xs text-on-surface-variant mb-4">
              Aggregate settled bookings and calculate net payout after platform commission. Note: Period End must be in the past.
            </p>

            {payoutError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {payoutError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Select Owner</label>
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="w-full border border-ink/20 rounded-xl p-2.5 text-sm bg-chalk"
                >
                  <option value="">-- Choose Venue Owner --</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Period Start</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full border border-ink/20 rounded-xl p-2.5 text-sm bg-chalk"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Period End</label>
                  <input
                    type="date"
                    max={yesterdayStr}
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full border border-ink/20 rounded-xl p-2.5 text-sm bg-chalk"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setIsRunModalOpen(false); setPayoutError(null); }}
                className="px-4 py-2 text-sm border border-ink/20 rounded-xl hover:bg-mist"
              >
                Cancel
              </button>
              <button
                disabled={!selectedOwnerId || !periodStart || !periodEnd || runPayout.isPending}
                onClick={handleRunPayout}
                className="px-4 py-2 text-sm bg-pitch text-chalk rounded-xl hover:bg-pitch/90 disabled:opacity-50"
              >
                {runPayout.isPending ? 'Processing…' : 'Generate Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-on-surface-variant"><Loader2 className="w-4 h-4 animate-spin" />Loading payouts…</div>
      ) : payouts.length === 0 ? (
        <EmptyState icon={Wallet} title="No payouts yet" description="Run payouts to generate owner payout records." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full text-sm">
            <thead className="bg-mist">
              <tr>
                {['Owner', 'Venue', 'Gross', 'Commission', 'Net', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/5">
              {payouts.map((p) => (
                <tr key={p.id} className="hover:bg-mist/50">
                  <td className="px-4 py-3 font-medium text-ink">{p.owner_name ?? '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{p.venue_name}</td>
                  <td className="px-4 py-3">₹{p.gross_amount}</td>
                  <td className="px-4 py-3 text-red-600">-₹{p.commission_amount}</td>
                  <td className="px-4 py-3 font-semibold text-pitch">₹{p.net_amount}</td>
                  <td className="px-4 py-3"><DashboardStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-on-surface-variant">{p.created_at ? new Date(p.created_at).toLocaleDateString('en-CA') : '—'}</td>
                  <td className="px-4 py-3">
                    {p.status === 'pending' && (
                      <button
                        onClick={() => markPaid.mutate(p.id)}
                        disabled={markPaid.isPending}
                        className="text-xs px-2 py-1 bg-pitch text-chalk rounded-lg hover:bg-pitch/90 disabled:opacity-50"
                      >Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm px-4 py-2 border border-ink/20 rounded-xl hover:bg-mist disabled:opacity-50"
        >
          {isFetchingNextPage ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
          Load More
        </button>
      )}
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
  const [searchParams] = useSearchParams();
  const urlTicketId = searchParams.get('ticketId');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_review' | 'waiting_customer' | 'resolved' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const params: any = {};
  if (statusFilter !== 'all') params.status = statusFilter;
  if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
  
  const { data: tickets, isLoading } = useAdminTickets(params);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(urlTicketId);

  useEffect(() => {
    if (urlTicketId) {
      setSelectedTicketId(urlTicketId);
    }
  }, [urlTicketId]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_400px]">
      <div className="space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Ticket ID or Subject..."
            className="w-full rounded-lg bg-mist px-3 py-2 font-sans text-sm text-ink placeholder:text-on-surface-variant focus:outline-none"
          />
          <GroundSelect
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as any)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "in_review", label: "In Review" },
              { value: "waiting_customer", label: "Waiting for Customer" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" }
            ]}
            triggerClassName="w-full sm:w-[200px] shrink-0"
          />
        </div>

        {isLoading ? (
          <div className="shimmer h-96 rounded-2xl" />
        ) : (!tickets || tickets.length === 0) ? (
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
    if (newStatus === ticket.status) return;
    setActionError(null);
    try {
      await updateTicket.mutateAsync({ ticketId, body: { status: newStatus as any } });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    if (newPriority === ticket.priority) return;
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
    <div className="flex h-[600px] flex-col rounded-2xl bg-surface-container min-w-0">
      <div className="border-b border-ink/10 p-4">
        <h3 className="font-sans text-lg font-medium text-ink truncate">{ticket.subject}</h3>
        <p className="mt-1 font-sans text-xs text-on-surface-variant">
          Ticket #{ticket.id.slice(0, 8)} · Created {dateTimeStr(ticket.created_at)}
        </p>
        
        {actionError && <div className="mt-2"><ErrorBanner message={actionError} /></div>}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <GroundSelect
            value={ticket.status}
            onValueChange={(v) => handleUpdateStatus(v)}
            options={[
              { value: "open", label: "Open" },
              { value: "in_review", label: "In Review" },
              { value: "waiting_customer", label: "Waiting for Customer" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" }
            ]}
            className="w-full min-w-0"
            triggerClassName="w-full"
            align="left"
          />

          <GroundSelect
            value={ticket.priority}
            onValueChange={(v) => handleUpdatePriority(v)}
            options={[
              { value: "low", label: "Low Priority" },
              { value: "medium", label: "Medium Priority" },
              { value: "high", label: "High Priority" },
              { value: "urgent", label: "Urgent" }
            ]}
            className="w-full min-w-0"
            triggerClassName="w-full"
            align="right"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 bg-surface-container custom-scrollbar" data-lenis-prevent>
          {ticket.events?.map((event: ApiTicketEvent) => {
            if (event.event_type !== 'comment' && event.event_type !== 'created') return null;
            
            const isCustomer = event.actor_id === ticket.creator_id;

            return (
              <div key={event.id} className={`flex gap-3 ${isCustomer ? '' : 'flex-row-reverse'}`}>
                <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${isCustomer ? 'bg-emerald-600' : 'bg-ink'}`}>
                  {isCustomer ? 'C' : 'A'}
                </div>
                <div className={`flex-1 rounded-2xl p-4 ${isCustomer ? 'rounded-tl-none bg-white border border-ink/5 text-ink' : 'rounded-tr-none text-chalk'} ${event.internal ? 'bg-marigold text-ink' : (isCustomer ? '' : 'bg-ink text-chalk')}`}>
                  <div className="mb-1 flex justify-between font-sans text-xs opacity-70">
                    <span className="font-semibold">
                      {isCustomer ? 'Customer' : 'Admin'}
                      {event.internal && ' (Internal)'}
                    </span>
                    <span>{dateTimeStr(event.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap font-sans text-sm">{event.comment}</p>
                </div>
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
            <div className="max-h-[400px] overflow-y-auto divide-y divide-ink/5 custom-scrollbar" data-lenis-prevent>
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



