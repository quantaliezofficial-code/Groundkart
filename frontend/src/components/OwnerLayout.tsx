import GroundSelect from './ui/GroundSelect';
import { DashboardShell, MetricCard, SafeImage, EmptyState, StatusBadge as DashboardStatusBadge } from './dashboard';
import { Home, CalendarDays, Wallet, LayoutGrid, Plus, ShieldCheck, Activity, Building2, LifeBuoy } from 'lucide-react';
import {
  AlertCircle,
    ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Flag,
    Loader2,
  MapPin,
    RefreshCw,
    } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useOwnerBookings, useOwnerPayouts, useOwnerVenues, useOwnerVerification, useSubmitVerification } from '../hooks/useOwner';
import { ApiError } from '../lib/api/client';
import type { ApiBookingDetail, ApiOwnerVerification, ApiPayout, ApiVenue } from '../lib/api/types';
import { useAuth } from '../lib/auth';
import ListingBuilder from './owner/listing-builder/ListingBuilder';
import OwnerCalendar from './owner/calendar/OwnerCalendar';
import SupportTickets from './SupportTickets';

type Tab = 'Overview' | 'Listings' | 'Calendars' | 'Payouts' | 'Support' | 'Account';

function money(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.detail;
  return 'Something went wrong. Please try again.';
}

export default function OwnerLayout({ onReturnToSite }: { onReturnToSite?: () => void }) {
  const { user, logout } = useAuth();

  if (!user) {
    // App.tsx's onListVenue already runs requireAuth before switching into
    // this view, so a signed-out visitor shouldn't normally land here —
    // this is a defensive fallback, not the primary gate.
    return (
      <div className="max-w-xl mx-auto py-24 text-center space-y-3">
        <Building2 size={32} className="mx-auto text-ink/40" />
        <p className="font-sans text-on-surface-variant">Please log in to manage your venues.</p>
      </div>
    );
  }

  if (user.role !== 'owner') {
    return <OwnerOnboardingGate />;
  }

  return <OwnerDashboard onReturnToSite={onReturnToSite} />;
}

// ---------------------------------------------------------------------------
// Onboarding gate — shown to any logged-in user who isn't (yet) a verified
// owner. role only ever becomes 'owner' via admin approval of a submission
// here (05_App_Flow.md §3) — there is no separate "create venues" grant.
// ---------------------------------------------------------------------------
function OwnerOnboardingGate() {
  const { refreshUser } = useAuth();
  const { data: verification, isLoading, refetch } = useOwnerVerification();
  const submitVerification = useSubmitVerification();

    const [businessName, setBusinessName] = useState('');
  const [identificationType, setIdentificationType] = useState('National ID');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    await Promise.all([refreshUser(), refetch()]);
    setCheckingStatus(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!file) {
      setFormError('Please attach a business/ID verification document.');
      return;
    }
    try {
            await submitVerification.mutateAsync({ 
        document: file, 
        businessName: businessName || undefined,
        identificationType: identificationType || undefined,
        identificationNumber: identificationNumber || undefined
      });
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-24 space-y-6 animate-pulse">
        <div className="w-16 h-16 bg-mist rounded-full mx-auto" />
        <div className="w-64 h-8 bg-mist rounded-xl mx-auto" />
        <div className="w-48 h-4 bg-mist rounded-lg mx-auto" />
      </div>
    );
  }

  if (verification?.status === 'pending') {
    return (
      <div className="max-w-xl mx-auto py-20 space-y-5 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-marigold/15 flex items-center justify-center mx-auto">
          <Clock size={26} className="text-marigold" />
        </div>
        <h1 className="font-display text-3xl text-pitch font-semibold">Application under review</h1>
        <p className="font-sans text-on-surface-variant max-w-md mx-auto">
          Submitted {new Date(verification.created_at).toLocaleDateString()}
          {verification.business_name ? ` for ${verification.business_name}` : ''}. Our team reviews new owner
          applications manually — this usually doesn't take long.
        </p>
        <button
          onClick={handleCheckStatus}
          disabled={checkingStatus}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-pitch text-pitch rounded-lg text-sm font-semibold hover:bg-pitch hover:text-chalk transition-colors cursor-pointer disabled:opacity-60 ease-out"
        >
          {checkingStatus ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Check status
        </button>
      </div>
    );
  }

  const wasRejected = verification?.status === 'rejected';

  return (
    <div className="max-w-xl mx-auto py-16 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <Building2 size={30} className="mx-auto text-pitch" />
        <h1 className="font-display text-3xl text-pitch font-semibold">List your venue on GroundKart</h1>
        <p className="font-sans text-sm text-on-surface-variant">
          A quick verification step — usually just a business or ID document — and you're set to start listing.
        </p>
      </div>

      {wasRejected && (
        <div className="flex gap-2 items-start bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-clay">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your previous application wasn't approved{verification.rejection_reason ? `: ${verification.rejection_reason}` : '.'}{' '}
            You're welcome to resubmit below.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-chalk border border-ink/10 rounded-2xl p-6 space-y-4 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold text-on-surface-variant">Business name (optional)</span>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Sharma Sports & Recreation"
            className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
          />
        </label>
                <label className="block">
          <span className="text-xs font-semibold text-on-surface-variant">Identification Type</span>
          <GroundSelect
            value={identificationType}
            onValueChange={setIdentificationType}
            options={[
              { value: "National ID", label: "National ID" },
              { value: "Passport", label: "Passport" },
              { value: "Driving License", label: "Driving License" },
              { value: "Business Registration", label: "Business Registration" }
            ]}
            triggerClassName="w-full sm:w-[200px]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-on-surface-variant">Identification Number</span>
          <input
            value={identificationNumber}
            onChange={(e) => setIdentificationNumber(e.target.value)}
            required
            placeholder="Enter ID number"
            className="mt-1 w-full rounded-lg border border-ink/10 bg-mist px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-marigold"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-on-surface-variant">Verification document (PDF, JPEG, or PNG)</span>
          <input
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-pitch file:text-chalk file:text-xs file:font-bold file:cursor-pointer cursor-pointer"
          />
        </label>
        {formError && <p className="text-sm text-clay">{formError}</p>}
        <button
          type="submit"
          disabled={submitVerification.isPending}
          className="w-full px-6 py-3 bg-pitch hover:bg-[#15462E] text-chalk rounded-lg text-sm font-bold transition active:scale-[0.97] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 ease-out"
        >
          {submitVerification.isPending && <Loader2 size={15} className="animate-spin" />}
          Submit for review
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full dashboard — only reachable once user.role === 'owner'.
// ---------------------------------------------------------------------------
function OwnerDashboard({ onReturnToSite }: { onReturnToSite?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const saved = sessionStorage.getItem('initialOwnerTab') as Tab;
    if (saved) {
      sessionStorage.removeItem('initialOwnerTab');
      return saved;
    }
    return 'Overview';
  });
  const [modalVenue, setModalVenue] = useState<ApiVenue | null | 'new'>(null);

  React.useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<Tab>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('navigate-owner-tab', handleNavigate);
    return () => window.removeEventListener('navigate-owner-tab', handleNavigate);
  }, []);

  const { data: venues = [], isLoading: venuesLoading } = useOwnerVenues();
  const { data: bookings = [], isLoading: bookingsLoading } = useOwnerBookings();
  const { data: payouts = [], isLoading: payoutsLoading } = useOwnerPayouts();
  const { data: verification } = useOwnerVerification();
  const { user, logout } = useAuth();

  const activeVenuesCount = venues.filter(v => v.status === 'active').length;
  const pendingRequestsCount = bookings.filter(b => b.status === 'pending_payment').length;
  const totalEarnings = payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.net_amount), 0);

  const navItems = [
    { id: 'Overview', label: 'Overview', icon: Activity, onClick: () => setActiveTab('Overview' as Tab) },
    { id: 'Listings', label: 'Listings', icon: LayoutGrid, onClick: () => setActiveTab('Listings') },
    { id: 'Calendars', label: 'Bookings', icon: CalendarDays, onClick: () => setActiveTab('Calendars') },
    { id: 'Payouts', label: 'Payouts', icon: Wallet, onClick: () => setActiveTab('Payouts') },
    { id: 'Support', label: 'Support Tickets', icon: LifeBuoy, onClick: () => setActiveTab('Support') },
    { id: 'Account', label: 'Account', icon: ShieldCheck, onClick: () => setActiveTab('Account') },
  ];

  const headerActions = (
    <button
      onClick={() => setModalVenue('new')}
      className="flex items-center gap-1.5 bg-pitch hover:bg-[#15462E] text-chalk px-4 py-2 rounded-full font-sans text-sm font-semibold transition active:scale-[0.97] ease-out"
    >
      <Plus size={16} /> List a new venue
    </button>
  );

  const titles: Record<string, { title: string; desc: string }> = {
    Overview: { title: 'Owner Dashboard', desc: 'Manage your venues, bookings and earnings' },
    Listings: { title: 'Venues', desc: 'Manage your property listings' },
    Calendars: { title: 'Bookings', desc: 'View and manage venue reservations' },
    Payouts: { title: 'Payouts', desc: 'Track your earnings and transfers' },
    Support: { title: 'Support Tickets', desc: 'Manage your support requests' },
    Account: { title: 'Account Settings', desc: 'Manage your owner profile and verification' },
  };

  const currentInfo = titles[activeTab] || titles.Overview;

  return (
    <DashboardShell
      title={currentInfo.title}
      description={currentInfo.desc}
      navItems={navItems}
      activeNavId={activeTab}
      headerActions={headerActions}
      userName={user?.name}
      userRole={user?.role}
        onLogout={logout}
        onReturnToSite={onReturnToSite}
    >
      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Active Venues" value={activeVenuesCount} isLoading={venuesLoading} />
            <MetricCard label="Total Bookings" value={bookings.length} isLoading={bookingsLoading} />
            <MetricCard label="Pending Requests" value={pendingRequestsCount} isLoading={bookingsLoading} />
            <MetricCard label="Available Balance" value={`₹${totalEarnings.toLocaleString('en-IN')}`} isLoading={payoutsLoading} />
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
             <div className="rounded-2xl border border-surface-container bg-surface-container-lowest p-5">
               <h3 className="mb-4 font-sans text-sm font-semibold text-ink uppercase tracking-wide">Quick Actions</h3>
               <div className="grid gap-3">
                 <button onClick={() => setActiveTab('Listings')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container/10 text-primary-container">
                      <LayoutGrid size={16} />
                    </div>
                    <span className="font-sans text-sm font-medium text-ink">Manage Venues</span>
                  </button>
                  <button onClick={() => setActiveTab('Calendars')} className="flex items-center gap-3 rounded-xl border border-surface-container p-3 text-left transition-colors hover:bg-surface-container/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-marigold/10 text-marigold">
                      <CalendarDays size={16} />
                    </div>
                    <span className="font-sans text-sm font-medium text-ink">View Bookings</span>
                  </button>
               </div>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'Listings' && (
        <ListingsTab
          venues={venues}
          bookings={bookings}
          isLoading={venuesLoading}
          onManage={(v) => setModalVenue(v)}
        />
      )}
      {activeTab === 'Calendars' && (
        <OwnerCalendar venues={venues} bookings={bookings} isLoading={bookingsLoading} />
      )}
      {activeTab === 'Payouts' && <PayoutsTab payouts={payouts} isLoading={payoutsLoading} />}
      {activeTab === 'Support' && <SupportTickets defaultContext={null} />}
      {activeTab === 'Account' && <AccountTab verification={verification} />}

      {modalVenue !== null && (
        <ListingBuilder venueId={modalVenue === 'new' ? null : modalVenue?.id} onClose={() => setModalVenue(null)} onComplete={() => setModalVenue(null)} />
      )}
    </DashboardShell>
  );
}
// ---------------------------------------------------------------------------
// Listings tab
// ---------------------------------------------------------------------------
function ListingsTab({
  venues,
  bookings,
  isLoading,
  onManage,
}: {
  venues: ApiVenue[];
  bookings: ApiBookingDetail[];
  isLoading: boolean;
  onManage: (venue: ApiVenue) => void;
}) {
  const bookingCountByVenue = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      if (b.status === 'confirmed' || b.status === 'completed') {
        counts[b.venue_id] = (counts[b.venue_id] ?? 0) + 1;
      }
    }
    return counts;
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer aspect-[4/3] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <EmptyState 
        icon={Building2} 
        title="No venues yet" 
        description="Your listed venues will appear here." 
        action={<button onClick={() => onManage({} as any)} className="mt-2 text-primary-container font-medium hover:underline text-sm">Add your first venue</button>}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {venues.map((v) => {
        const media = v.media || [];
        const cover = media.find((i) => i.is_cover) ?? media[0];
        return (
          <div key={v.id} className="bg-surface-container-lowest border border-surface-container rounded-2xl overflow-hidden soft-lift transition ease-out flex flex-col">
            <div className="aspect-[4/3] bg-mist relative">
              {cover ? (
                <SafeImage src={cover.url} alt={v.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-mist text-on-surface-variant/40">
                  <Building2 size={32} />
                </div>
              )}
              <div className="absolute top-2.5 left-2.5">
                <DashboardStatusBadge status={v.status} className="bg-surface-container-lowest" />
              </div>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-sans font-bold text-ink truncate">{v.name}</h3>
              <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-1 truncate">
                <MapPin size={12} className="shrink-0" /> {v.city}
              </p>
              
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="font-semibold text-ink">₹{v.base_price} <span className="font-normal text-xs text-on-surface-variant">/ {v.unit_type.replace('_', ' ')}</span></span>
                <span className="text-xs text-on-surface-variant font-medium">{bookingCountByVenue[v.id] || 0} bookings</span>
              </div>
              
              <div className="mt-4 pt-3 border-t border-surface-container mt-auto">
                <button
                  onClick={() => onManage(v)}
                  className="w-full py-2 bg-surface-container hover:bg-surface-container-high text-ink rounded-lg text-sm font-semibold transition-colors"
                >
                  Manage Venue
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
// ---------------------------------------------------------------------------
// Calendars ("Bookings") tab — a real month grid, populated from real
// bookings. No customer/guest identity is ever available here — see
// list_bookings_for_owner's docstring in the backend for why (BookingDetail
// simply has no such field): this shows what's booked, for how much, and
// in what state, not who booked it.
// ---------------------------------------------------------------------------
function CalendarsTab({
  venues,
  bookings,
  isLoading,
}: {
  venues: ApiVenue[];
  bookings: ApiBookingDetail[];
  isLoading: boolean;
}) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all');
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);


  const filtered = useMemo(
    () => (selectedVenueId === 'all' ? bookings : bookings.filter((b) => b.venue_id === selectedVenueId)),
    [bookings, selectedVenueId],
  );

  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const countsByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of filtered) {
      if (b.status === 'confirmed' || b.status === 'completed') {
        counts[b.slot_date] = (counts[b.slot_date] ?? 0) + 1;
      }
    }
    return counts;
  }, [filtered]);

  const dayBookings = selectedDate ? filtered.filter((b) => b.slot_date === selectedDate) : [];



  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <GroundSelect
            value={selectedVenueId}
            onValueChange={() => {}}
            options={[{ value: "all", label: "All venues" }, ...venues.map((v) => ({ value: v.id, label: `${v.name}` }))]}
            triggerClassName="w-full sm:w-[200px]"
          />
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-mist cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="font-sans text-sm font-bold text-ink w-32 text-center">
            {monthCursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-mist cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="shimmer h-96 rounded-2xl" />
      ) : (
        <div className="bg-chalk border border-ink/10 rounded-2xl p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink/40 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const count = countsByDay[dateStr] ?? 0;
              const isSelected = selectedDate === dateStr;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-pitch text-chalk'
                      : count > 0
                        ? 'bg-marigold/15 text-ink hover:bg-marigold/25'
                        : 'hover:bg-mist text-on-surface-variant'
                  } ease-out`}
                >
                  <span>{day}</span>
                  {count > 0 && <span className="w-1 h-1 rounded-full bg-current" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedDate && (
        <div className="space-y-3">
          <h3 className="font-sans text-sm font-bold text-ink">
            Bookings on {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>

          {dayBookings.length === 0 ? (
            <p className="text-sm text-ink/40">No bookings on this day.</p>
          ) : (
            dayBookings.map((b) => {
              return (
                <div key={b.id} className="bg-chalk border border-ink/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-sans text-sm font-bold text-ink">{b.venue_name}</p>
                    <p className="text-xs text-on-surface-variant font-mono">
                      {b.slot_start_time ? `${b.slot_start_time.slice(0, 5)}–${b.slot_end_time?.slice(0, 5)}` : 'Full-day / half-day'} · {money(b.amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        b.status === 'confirmed'
                          ? 'bg-primary-container text-on-primary-container'
                          : b.status === 'completed'
                            ? 'bg-mist text-on-surface-variant'
                            : 'bg-red-50 text-clay'
                      }`}
                    >
                      {b.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payouts tab — read-only for an owner (run/mark-paid are admin-only
// actions, GET /api/v1/owner/payouts is require_role("owner") only).
// ---------------------------------------------------------------------------
function PayoutsTab({ payouts, isLoading }: { payouts: ApiPayout[]; isLoading: boolean }) {
  const totals = useMemo(() => {
    let paid = 0, pending = 0, gross = 0;
    for (const p of payouts) {
      gross += Number(p.gross_amount);
      if (p.status === 'paid') paid += Number(p.net_amount);
      else pending += Number(p.net_amount);
    }
    return { paid, pending, gross };
  }, [payouts]);

  const handleExportCsv = () => {
    const header = 'Period Start,Period End,Gross,Commission,Net,Status,Paid At';
    const rows = payouts.map((p) =>
      [p.period_start, p.period_end, p.gross_amount, p.commission_amount, p.net_amount, p.status, p.paid_at ?? ''].join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `groundkart-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="shimmer h-64 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-chalk border border-ink/10 rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Paid out</p>
          <p className="font-mono text-2xl font-bold text-pitch mt-1">{money(totals.paid)}</p>
        </div>
        <div className="bg-chalk border border-ink/10 rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Pending</p>
          <p className="font-mono text-2xl font-bold text-marigold mt-1">{money(totals.pending)}</p>
        </div>
        <div className="bg-chalk border border-ink/10 rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Lifetime gross</p>
          <p className="font-mono text-2xl font-bold text-ink mt-1">{money(totals.gross)}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleExportCsv}
          disabled={payouts.length === 0}
          className="flex items-center gap-1.5 text-xs font-semibold text-pitch hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {payouts.length === 0 ? (
        <div className="bg-chalk border border-ink/10 rounded-2xl py-12 text-center text-sm text-on-surface-variant">
          No payout periods have been run yet.
        </div>
      ) : (
        <div className="bg-chalk border border-ink/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold text-right">Gross</th>
                <th className="px-4 py-3 font-semibold text-right">Commission</th>
                <th className="px-4 py-3 font-semibold text-right">Net</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{p.period_start} – {p.period_end}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right">{money(p.gross_amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right text-ink/40">−{money(p.commission_amount)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-right font-bold text-pitch">{money(p.net_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${p.status === 'paid' ? 'bg-primary-container text-on-primary-container' : 'bg-marigold/15 text-marigold'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Account tab — read-only once role === 'owner' (there's nothing left to
// submit; the active form lives in OwnerOnboardingGate, above, for the
// pre-approval state).
// ---------------------------------------------------------------------------
function AccountTab({ verification }: { verification: ApiOwnerVerification | null | undefined }) {
  const { user, logout } = useAuth();
  return (
    <div className="max-w-lg space-y-4">
      <div className="bg-chalk border border-ink/10 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 text-pitch">
          <ShieldCheck size={20} />
          <span className="font-sans font-bold">Verified owner</span>
        </div>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Name</dt>
            <dd className="text-ink font-medium">{user?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Email</dt>
            <dd className="text-ink font-medium">{user?.email}</dd>
          </div>
          {verification?.business_name && (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Business name</dt>
              <dd className="text-ink font-medium">{verification.business_name}</dd>
            </div>
          )}
          {verification?.reviewed_at && (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Verified on</dt>
              <dd className="text-ink font-medium">{new Date(verification.reviewed_at).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}




