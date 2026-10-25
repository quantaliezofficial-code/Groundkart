import { Bell, ChevronDown, LogOut, Menu, PlusCircle, Search, User, X, ShieldCheck, CalendarDays } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadNotificationCount, useDeleteNotification, useDeleteAllNotifications } from '../hooks/useNotifications';
import { useAuth } from '../lib/auth';
import type { ApiNotification } from '../lib/api/types';

/* ─── Notification Navigation Helper ─────────────────────────────────── */

function getNotificationTarget(n: ApiNotification, role?: string): { url: string; label: string } | null {
  const type = n.type || '';
  const entityType = n.entity_type || '';
  const entityId = n.entity_id;

  if (entityType === 'support_ticket' || type.startsWith('support_ticket') || type === 'support') {
    if (role === 'admin') {
      return {
        url: entityId ? `/admin?tab=Support&ticketId=${entityId}` : '/admin?tab=Support',
        label: 'View Ticket',
      };
    }
    return {
      url: entityId ? `/support?ticketId=${entityId}` : '/support',
      label: 'View Ticket',
    };
  }

  if (entityType === 'booking' || type.startsWith('booking')) {
    if (role === 'owner') {
      return { url: '/owner', label: 'View Bookings' };
    }
    if (role === 'admin') {
      return { url: '/admin?tab=Bookings', label: 'View Bookings' };
    }
    return { url: '/my-bookings', label: 'View Booking' };
  }

  if (entityType === 'venue' || type.startsWith('venue')) {
    if (type === 'venue_rejected' || type === 'venue_suspended') {
      return { url: '/owner', label: 'Manage Venue' };
    }
    if (role === 'admin') {
      return { url: '/admin?tab=Venues', label: 'View Venues' };
    }
    if (entityId) {
      return { url: `/venues/${entityId}`, label: 'View Venue' };
    }
    return { url: role === 'owner' ? '/owner' : '/search', label: 'View Venues' };
  }

  if (entityType === 'owner_verification' || type.startsWith('verification')) {
    if (role === 'admin') {
      return { url: '/admin?tab=ApprovalQueue', label: 'Review Verification' };
    }
    return { url: '/owner', label: 'Check Status' };
  }

  if (entityType === 'payout' || type.startsWith('payout')) {
    if (role === 'admin') {
      return { url: '/admin?tab=Payouts', label: 'View Payouts' };
    }
    return { url: '/owner', label: 'View Payouts' };
  }

  if (entityType === 'user' || type.startsWith('account')) {
    if (role === 'admin') {
      return { url: '/admin?tab=Users', label: 'View User' };
    }
  }

  return null;
}

/* ─── Notification Bell ──────────────────────────────────────────────── */

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: unreadData } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const deleteAllNotifications = useDeleteAllNotifications();
  const unreadCount = unreadData?.unread_count ?? 0;

  const handleNotificationClick = (n: ApiNotification) => {
    if (!n.read_at) {
      markRead.mutate(n.id);
    }
    setIsOpen(false);
    const target = getNotificationTarget(n, user?.role);
    if (target) {
      navigate(target.url);
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 rounded-full text-chalk/70 hover:text-marigold hover:bg-white/10 transition duration-200 cursor-pointer ease-out"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-marigold opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-marigold border border-pitch" />
          </span>
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
            className="absolute right-0 top-full mt-3 max-h-[420px] w-80 overflow-y-auto rounded-2xl bg-chalk py-2 shadow-2xl ring-1 ring-ink/10 z-50 custom-scrollbar overscroll-contain"
            data-lenis-prevent
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink/5">
              <span className="font-sans text-sm font-bold text-ink tracking-tight">Notifications</span>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    disabled={markAllRead.isPending}
                    className="font-sans text-xs font-medium text-pitch hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => deleteAllNotifications.mutate()}
                    disabled={deleteAllNotifications.isPending}
                    className="font-sans text-xs font-medium text-clay hover:underline disabled:opacity-50 cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell size={28} className="mx-auto mb-2 text-ink/15" />
                <p className="font-sans text-sm text-on-surface-variant">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const target = getNotificationTarget(n, user?.role);
                return (
                  <div
                    key={n.id}
                    className={`relative flex items-start justify-between w-full px-4 py-3 text-left transition-colors hover:bg-mist/60 group ${n.read_at ? 'opacity-50' : 'bg-pitch/[0.03]'} ease-out`}
                  >
                    <button
                      onClick={() => handleNotificationClick(n)}
                      className="flex-grow text-left pr-6 cursor-pointer"
                    >
                      <p className="font-sans text-[13px] text-ink leading-snug">{n.message}</p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-sans text-[11px] text-on-surface-variant">
                          {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {target && (
                          <span className="font-sans text-[11px] font-medium text-emerald-700 group-hover:underline flex items-center gap-0.5">
                            {target.label} →
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification.mutate(n.id);
                      }}
                      disabled={deleteNotification.isPending}
                      className="absolute right-3 top-3 p-1 text-ink/30 hover:text-clay hover:bg-clay/10 rounded-full opacity-0 group-hover:opacity-100 transition cursor-pointer disabled:opacity-50 ease-out"
                      aria-label="Clear notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

type HeaderView = 'home' | 'search' | 'detail' | 'checkout' | 'my-bookings' | 'support' | 'about' | 'contact' | 'terms' | 'privacy' | '404';

interface HeaderProps {
  currentView: HeaderView;
  onNavigate: (view: HeaderView) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onListVenue: () => void;
  onRequestAuth: () => void;
  isMobileFilteredOpened?: boolean;
}

const NAV_ITEMS = [
  { label: 'Explore', view: 'home' as const },
  { label: 'Find Venues', view: 'search' as const },
  { label: 'My Bookings', view: 'my-bookings' as const, requireAuth: true },
  { label: 'Support', view: 'support' as const, requireAuth: true },
];

export default function Header({
  currentView,
  onNavigate,
  searchQuery,
  onSearchChange,
  onListVenue,
  onRequestAuth,
}: HeaderProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Main dark nav */}
        <div className={`transition-colors duration-300 ease-out ${
          currentView === 'home' 
            ? 'bg-[#032017]/72 backdrop-blur-md border-b border-white/5' 
            : 'bg-[#06281D]/85 backdrop-blur-md border-b border-white/10'
        }`}>
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[72px]">

              {/* ── Logo ── */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  if (user?.role === 'admin') {
                    window.dispatchEvent(new CustomEvent('navigate-admin-tab', { detail: 'Overview' }));
                  } else if (user?.role === 'owner') {
                    window.dispatchEvent(new CustomEvent('navigate-owner-tab', { detail: 'Listings' }));
                  } else {
                    onNavigate('home');
                  }
                }}
                className="flex items-center flex-shrink-0 cursor-pointer"
                id="logo"
              >
                <img src="/logo-full.png" alt="GroundKart" className="h-14 sm:h-16 w-auto object-contain py-1" />
              </motion.button>

              {/* ── Center search ── */}
              {currentView !== 'detail' && user?.role !== 'owner' && (
                <motion.div 
                  layout
                  className={`relative hidden md:block mx-4 lg:mx-8 w-[280px] lg:w-[320px] transition duration-200 ${isSearchFocused ? 'w-[320px] lg:w-[360px]' : ''} ease-out`}
                >
                  <div className={`relative rounded-full transition duration-200 ${isSearchFocused ? 'ring-2 ring-marigold/40 bg-white/15' : 'bg-white/10 hover:bg-white/[0.13]'} ease-out`}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-chalk/40">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder={user?.role === "admin" ? "Search bookings, venues, users, tickets..." : "Search venues, sports, cities..."}
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      className="w-full bg-transparent rounded-full pl-11 pr-4 py-2.5 text-[13px] text-chalk placeholder:text-chalk/35 focus:outline-none transition ease-out"
                    />
                  </div>
                </motion.div>
              )}

              {/* ── Right section ── */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Desktop nav links */}
                <nav className="hidden lg:flex items-center gap-0.5 mr-3 relative">
                  {(user?.role === 'admin' || user?.role === 'owner' ? [] : NAV_ITEMS).map(({ label, view, requireAuth }) => {
                    const isActive = currentView === view;
                    return (
                      <button
                        key={view}
                        onClick={() => (requireAuth && !user ? onRequestAuth() : onNavigate(view))}
                        className={`relative px-3.5 py-2 rounded-full text-[13px] font-medium transition duration-200 cursor-pointer ${
                          isActive
                            ? 'text-marigold bg-white/10'
                            : 'text-chalk/70 hover:text-chalk hover:bg-white/[0.07]'
                        } ease-out`}
                      >
                        {label}
                        {isActive && (
                          <motion.span 
                            layoutId="navIndicator"
                            className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-marigold" 
                          />
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Separator */}
                <div className="hidden lg:block w-px h-5 bg-chalk/15 mx-1" />

                {/* List a Venue CTA */}
                {user?.role !== 'customer' && (
                  <button
                    onClick={onListVenue}
                    className="hidden sm:flex items-center gap-1.5 bg-marigold hover:bg-[#e5952e] text-pitch px-4 py-[7px] rounded-full text-[13px] font-semibold active:scale-[0.97] transition cursor-pointer shadow-[0_2px_8px_rgba(242,163,59,0.25)] ease-out"
                  >
                    <PlusCircle size={14} strokeWidth={2.5} />
                    <span>{user?.role === 'owner' || user?.role === 'admin' ? 'Dashboard' : 'List a Venue'}</span>
                  </button>
                )}

                {/* Notifications */}
                {user && <NotificationBell />}

                {/* Auth */}
                {user ? (
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setShowProfileMenu((v) => !v)}
                      aria-label="Account menu"
                      className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-chalk/80 transition duration-200 hover:bg-white/10 cursor-pointer ml-0.5 ease-out"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-[#e5952e] text-[11px] font-bold text-pitch shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="hidden sm:inline text-[13px] font-medium">{user.name.split(' ')[0]}</span>
                      <ChevronDown size={13} className={`hidden sm:block transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''} ease-out`} />
                    </button>
                    <AnimatePresence>
                      {showProfileMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                          className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-chalk py-1.5 shadow-2xl ring-1 ring-ink/10 overflow-hidden"
                        >
                          {/* User info */}
                          <div className="px-4 py-3 border-b border-ink/5">
                            <p className="text-sm font-semibold text-ink truncate">{user.name}</p>
                            <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                          </div>
                          {user.role === 'admin' ? (
                            <button
                              onClick={() => { 
                                setShowProfileMenu(false); 
                                sessionStorage.setItem('initialAdminTab', 'ApprovalQueue');
                                onListVenue(); 
                                window.dispatchEvent(new CustomEvent('navigate-admin-tab', { detail: 'ApprovalQueue' })); // fallback if already mounted
                              }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors ease-out"
                            >
                              <ShieldCheck size={15} className="text-on-surface-variant" /> Approval Queue
                            </button>
                          ) : user.role === 'owner' ? (
                            <button
                              onClick={() => { 
                                setShowProfileMenu(false); 
                                sessionStorage.setItem('initialOwnerTab', 'Calendars');
                                onListVenue(); 
                                window.dispatchEvent(new CustomEvent('navigate-owner-tab', { detail: 'Calendars' })); // fallback if already mounted
                              }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors ease-out"
                            >
                              <CalendarDays size={15} className="text-on-surface-variant" /> My Bookings
                            </button>
                          ) : (
                            <button
                              onClick={() => { setShowProfileMenu(false); onNavigate('my-bookings'); }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors ease-out"
                            >
                              <User size={15} className="text-on-surface-variant" /> My Bookings
                            </button>
                          )}
                          <div className="border-t border-ink/5 mt-0.5 pt-0.5">
                            <button
                              onClick={() => { setShowProfileMenu(false); void logout(); }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-clay hover:bg-clay/5 transition-colors ease-out"
                            >
                              <LogOut size={15} /> Log out
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <button
                    onClick={onRequestAuth}
                    className="rounded-full border border-chalk/25 px-4 py-[7px] text-[13px] font-semibold text-chalk transition hover:bg-chalk hover:text-pitch cursor-pointer active:scale-[0.97] ml-0.5 ease-out"
                  >
                    Log in
                  </button>
                )}

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className="lg:hidden p-2 text-chalk/70 hover:text-chalk rounded-full hover:bg-white/10 transition cursor-pointer ml-0.5 ease-out"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Gradient accent line */}
          
        </div>

        {/* ── Mobile menu ── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="lg:hidden bg-[#143828] border-t border-white/5 shadow-2xl overflow-hidden"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 space-y-2">
                {/* Mobile search */}
                {currentView !== 'detail' && user?.role !== 'owner' && (
                  <div className="relative mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-chalk/40">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder={user?.role === "admin" ? "Search bookings, venues, users, tickets..." : "Search venues, sports, cities..."}
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full bg-white/10 rounded-full pl-11 pr-4 py-3 text-sm text-chalk placeholder:text-chalk/35 focus:outline-none focus:ring-2 focus:ring-marigold/40 transition ease-out"
                    />
                  </div>
                )}
                {(user?.role === 'admin' || user?.role === 'owner' ? [] : NAV_ITEMS).map(({ label, view, requireAuth }) => (
                  <button
                    key={view}
                    onClick={() => {
                      if (requireAuth && !user) onRequestAuth();
                      else onNavigate(view);
                      setMobileMenuOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition ${
                      currentView === view
                        ? 'text-marigold bg-white/10'
                        : 'text-chalk/70 hover:text-chalk hover:bg-white/[0.06]'
                    } ease-out`}
                  >
                    {label}
                  </button>
                ))}
                {user?.role !== 'customer' && (
                  <button
                    onClick={() => { onListVenue(); setMobileMenuOpen(false); }}
                    className="flex sm:hidden items-center gap-2 w-full bg-marigold hover:bg-[#e5952e] text-pitch px-4 py-3 rounded-xl text-sm font-semibold transition mt-3 ease-out"
                  >
                    <PlusCircle size={16} />
                    <span>{user?.role === 'owner' || user?.role === 'admin' ? 'Dashboard' : 'List a Venue'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {currentView !== 'home' && <div className="h-[72px]" />}
    </>
  );
}
