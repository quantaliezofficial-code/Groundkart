import { Bell, ChevronDown, LogOut, Menu, PlusCircle, Search, User, X, ShieldCheck, CalendarDays } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadNotificationCount, useDeleteNotification, useDeleteAllNotifications } from '../hooks/useNotifications';
import { useAuth } from '../lib/auth';

/* ─── Notification Bell ──────────────────────────────────────────────── */

function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: unreadData } = useUnreadNotificationCount();
  const { data: notifications = [] } = useNotifications({ limit: 20 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const deleteAllNotifications = useDeleteAllNotifications();
  const unreadCount = unreadData?.unread_count ?? 0;

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
        className="relative p-2 rounded-full text-chalk/70 hover:text-marigold hover:bg-white/10 transition-all duration-200 cursor-pointer"
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
            className="absolute right-0 top-full mt-3 max-h-[420px] w-80 overflow-y-auto rounded-2xl bg-chalk py-2 shadow-2xl ring-1 ring-ink/10 z-50"
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
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`relative flex items-start justify-between w-full px-4 py-3 text-left transition-colors hover:bg-mist/60 group ${n.read_at ? 'opacity-50' : 'bg-pitch/[0.03]'}`}
                >
                  <button
                    onClick={() => !n.read_at && markRead.mutate(n.id)}
                    className="flex-grow text-left pr-6 cursor-pointer"
                  >
                    <p className="font-sans text-[13px] text-ink leading-snug">{n.message}</p>
                    <p className="mt-1 font-sans text-[11px] text-on-surface-variant">
                      {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification.mutate(n.id);
                    }}
                    disabled={deleteNotification.isPending}
                    className="absolute right-3 top-3 p-1 text-ink/30 hover:text-clay hover:bg-clay/10 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:opacity-50"
                    aria-label="Clear notification"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────── */

interface HeaderProps {
  currentView: 'home' | 'search' | 'detail' | 'checkout' | 'my-bookings';
  onNavigate: (view: 'home' | 'search' | 'detail' | 'checkout' | 'my-bookings') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onListVenue: () => void;
  onRequestAuth: () => void;
  isMobileFilteredOpened?: boolean;
}

const NAV_ITEMS = [
  { label: 'Explore', view: 'home' as const },
  { label: 'Find Space', view: 'search' as const },
  { label: 'My Bookings', view: 'my-bookings' as const, requireAuth: true },
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
  const profileRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();

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
        <div className="bg-gradient-to-r from-[#143828] via-pitch to-[#1a5438]">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-[64px]">

              {/* ── Logo ── */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (user?.role === 'admin') {
                    window.dispatchEvent(new CustomEvent('navigate-admin-tab', { detail: 'Overview' }));
                  } else if (user?.role === 'owner') {
                    window.dispatchEvent(new CustomEvent('navigate-owner-tab', { detail: 'Listings' }));
                  } else {
                    onNavigate('home');
                  }
                }}
                className="flex items-center gap-2 flex-shrink-0 cursor-pointer group"
                id="logo"
              >
                {/* Logo icon */}
                <div className="w-8 h-8 rounded-lg bg-marigold/20 flex items-center justify-center group-hover:bg-marigold/30 transition-colors">
                  <span className="text-marigold font-display text-lg font-bold leading-none">G</span>
                </div>
                <span className="font-display text-[22px] sm:text-2xl text-chalk tracking-tight leading-none group-hover:text-chalk/90 transition-colors">
                  Ground<span className="text-marigold">Booking</span>
                </span>
              </motion.button>

              {/* ── Center search ── */}
              {currentView !== 'detail' && user?.role !== 'admin' && user?.role !== 'owner' && (
                <motion.div 
                  layout
                  className={`relative hidden md:block mx-6 lg:mx-10 flex-1 max-w-lg transition-all duration-300 ${isSearchFocused ? 'max-w-xl' : ''}`}
                >
                  <div className={`relative rounded-full transition-all duration-300 ${isSearchFocused ? 'ring-2 ring-marigold/40 bg-white/15' : 'bg-white/10 hover:bg-white/[0.13]'}`}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-chalk/40">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search venues, sports, cities..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      className="w-full bg-transparent rounded-full pl-11 pr-4 py-2.5 text-[13px] text-chalk placeholder:text-chalk/35 focus:outline-none transition-all"
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
                        className={`relative px-3.5 py-2 rounded-full text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                          isActive
                            ? 'text-marigold bg-white/10'
                            : 'text-chalk/70 hover:text-chalk hover:bg-white/[0.07]'
                        }`}
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
                    className="hidden sm:flex items-center gap-1.5 bg-marigold hover:bg-[#e5952e] text-pitch px-4 py-[7px] rounded-full text-[13px] font-semibold active:scale-[0.97] transition-all cursor-pointer shadow-[0_2px_8px_rgba(242,163,59,0.25)]"
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
                      className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-chalk/80 transition-all duration-200 hover:bg-white/10 cursor-pointer ml-0.5"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-marigold to-[#e5952e] text-[11px] font-bold text-pitch shadow-sm">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="hidden sm:inline text-[13px] font-medium">{user.name.split(' ')[0]}</span>
                      <ChevronDown size={13} className={`hidden sm:block transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
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
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors"
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
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors"
                            >
                              <CalendarDays size={15} className="text-on-surface-variant" /> My Bookings
                            </button>
                          ) : (
                            <button
                              onClick={() => { setShowProfileMenu(false); onNavigate('my-bookings'); }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink hover:bg-mist transition-colors"
                            >
                              <User size={15} className="text-on-surface-variant" /> My Bookings
                            </button>
                          )}
                          <div className="border-t border-ink/5 mt-0.5 pt-0.5">
                            <button
                              onClick={() => { setShowProfileMenu(false); void logout(); }}
                              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-clay hover:bg-clay/5 transition-colors"
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
                    className="rounded-full border border-chalk/25 px-4 py-[7px] text-[13px] font-semibold text-chalk transition-all hover:bg-chalk hover:text-pitch cursor-pointer active:scale-[0.97] ml-0.5"
                  >
                    Log in
                  </button>
                )}

                {/* Mobile hamburger */}
                <button
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  className="lg:hidden p-2 text-chalk/70 hover:text-chalk rounded-full hover:bg-white/10 transition-all cursor-pointer ml-0.5"
                  aria-label="Toggle menu"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Gradient accent line */}
          <div className="h-[2px] w-full bg-gradient-to-r from-marigold/0 via-marigold/60 to-marigold/0" />
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
                {currentView !== 'detail' && user?.role !== 'admin' && user?.role !== 'owner' && (
                  <div className="relative mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-chalk/40">
                      <Search size={16} />
                    </span>
                    <input
                      type="text"
                      placeholder="Search venues, sports, cities..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full bg-white/10 rounded-full pl-11 pr-4 py-3 text-sm text-chalk placeholder:text-chalk/35 focus:outline-none focus:ring-2 focus:ring-marigold/40 transition-all"
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
                    className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      currentView === view
                        ? 'text-marigold bg-white/10'
                        : 'text-chalk/70 hover:text-chalk hover:bg-white/[0.06]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {user?.role !== 'customer' && (
                  <button
                    onClick={() => { onListVenue(); setMobileMenuOpen(false); }}
                    className="flex sm:hidden items-center gap-2 w-full bg-marigold hover:bg-[#e5952e] text-pitch px-4 py-3 rounded-xl text-sm font-semibold transition-all mt-3"
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

      {/* Spacer */}
      <div className="h-[66px]" />
    </>
  );
}
