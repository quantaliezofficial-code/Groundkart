import { AlertTriangle, CalendarDays, CheckCircle, Clock, MapPin, XCircle, CheckCheck, CalendarX2 } from 'lucide-react';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppBooking, BookingStatus, Venue } from '../types';

interface MyBookingsProps {
  bookings: AppBooking[];
  venues: Venue[];
  onCancelBooking: (id: string) => void;
  onBookAgain: (venueId: string) => void;
}

const STATUS_BADGE: Record<BookingStatus, { label: string; className: string; icon: React.ReactNode; borderClass: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-pitch/10 text-pitch', icon: <CheckCircle size={14} />, borderClass: 'bg-pitch' },
  pending_payment: { label: 'Awaiting Payment', className: 'bg-marigold/10 text-marigold', icon: <Clock size={14} />, borderClass: 'bg-marigold' },
  completed: { label: 'Completed', className: 'bg-ink/10 text-on-surface-variant', icon: <CheckCheck size={14} />, borderClass: 'bg-ink/20' },
  cancelled: { label: 'Cancelled', className: 'bg-clay/10 text-clay', icon: <XCircle size={14} />, borderClass: 'bg-clay' },
  expired: { label: 'Expired', className: 'bg-clay/10 text-clay', icon: <AlertTriangle size={14} />, borderClass: 'bg-clay' },
  refunded: { label: 'Refunded', className: 'bg-clay/10 text-clay', icon: <XCircle size={14} />, borderClass: 'bg-clay' },
};

export default function MyBookings({
  bookings,
  venues,
  onCancelBooking,
  onBookAgain
}: MyBookingsProps) {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past' | 'Cancelled'>('Upcoming');
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);

  const filterBookings = (tab: string) => bookings.filter((booking) => {
    if (tab === 'Cancelled') {
      return booking.status === 'cancelled' || booking.status === 'refunded' || booking.status === 'expired';
    } else if (tab === 'Upcoming') {
      return booking.status === 'pending_payment' || booking.status === 'confirmed';
    } else {
      return booking.status === 'completed';
    }
  });

  const filteredBookings = filterBookings(activeTab);

  const getVenueImage = (venueId: string) => {
    const venue = venues.find((v) => v.id === venueId);
    return venue ? venue.image : 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&q=80&w=600';
  };

  const getVenueAddress = (venueId: string) => {
    const venue = venues.find((v) => v.id === venueId);
    return venue ? `${venue.district}, ${venue.city}` : '';
  };

  return (
    <div className="w-full space-y-8 animate-fade-in pb-16">
      {/* Page Header */}
      <motion.div 
        className="space-y-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
          My Bookings
        </h1>
        <p className="font-sans text-on-surface-variant max-w-lg">
          Manage your upcoming sessions, review past bookings, and check cancellation statuses.
        </p>
        <div className="w-12 h-1 rounded-full bg-gradient-to-r from-pitch to-marigold" />
      </motion.div>

      {/* Tab Bar */}
      <div className="inline-flex bg-mist rounded-full p-1 items-center">
        {(['Upcoming', 'Past', 'Cancelled'] as const).map((tab) => {
          const count = filterBookings(tab).length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-all duration-300 cursor-pointer ${
                isActive
                  ? 'text-pitch font-semibold'
                  : 'text-on-surface-variant hover:text-ink font-medium'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-chalk rounded-full shadow-sm"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-mono transition-colors ${
                    isActive ? 'bg-pitch/10 text-pitch' : 'bg-ink/5 text-on-surface-variant'
                  }`}>
                    {count}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {filteredBookings.length === 0 ? (
            /* Empty State */
            <motion.div
              key="empty-state"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
              className="bg-chalk rounded-2xl ring-1 ring-ink/5 py-16 px-6 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-sm"
            >
              <div className="w-16 h-16 bg-mist rounded-full flex items-center justify-center mb-6">
                <CalendarX2 size={32} className="text-on-surface-variant/50" />
              </div>
              <h3 className="font-sans text-lg font-semibold text-ink mb-2">No bookings yet</h3>
              <p className="font-sans text-sm text-on-surface-variant max-w-md mb-6">
                You do not have any {activeTab.toLowerCase()} reservations. It's a great day to get active!
              </p>
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
                className="px-6 py-2.5 bg-gradient-to-r from-pitch to-marigold text-chalk font-semibold rounded-xl hover:shadow-lg transition-all cursor-pointer"
              >
                Explore Venues
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {filteredBookings.map((booking, index) => {
                const badge = STATUS_BADGE[booking.status];
                return (
                  /* Booking Cards */
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, ease: 'easeOut' }}
                    className="relative bg-chalk rounded-2xl ring-1 ring-ink/5 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col sm:flex-row group"
                  >
                    {/* Left colored accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${badge.borderClass}`} />
                    
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-5 flex-grow ml-1">
                      {/* Venue thumbnail */}
                      <div className="w-full sm:w-20 h-32 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-mist">
                        <img
                          src={getVenueImage(booking.venueId)}
                          alt={booking.venueName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-grow flex flex-col gap-3 justify-center">
                        <div className="flex justify-between items-start gap-4 flex-wrap">
                          <div>
                            <h3 className="font-sans text-base font-bold text-ink group-hover:text-pitch transition-colors">
                              {booking.venueName}
                            </h3>
                            {/* Reference ID */}
                            <div className="mt-1">
                               <span className="font-mono text-xs bg-mist rounded px-2 py-0.5 text-on-surface-variant">
                                 Ref: #{booking.id.slice(0, 8)}
                               </span>
                            </div>
                          </div>
                          {/* Status badge */}
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 ${badge.className}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </motion.span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 flex-wrap">
                          <p className="font-sans text-sm text-ink flex items-center gap-1.5">
                            <CalendarDays size={16} className="text-on-surface-variant" />
                            <span>{booking.date}</span>
                          </p>
                          {booking.slot && (
                            <p className="font-sans text-sm text-ink flex items-center gap-1.5">
                              <Clock size={16} className="text-on-surface-variant" />
                              <span>{booking.slot}</span>
                            </p>
                          )}
                          {getVenueAddress(booking.venueId) && (
                            <p className="font-sans text-sm text-ink flex items-center gap-1.5">
                              <MapPin size={16} className="text-on-surface-variant" />
                              <span>{getVenueAddress(booking.venueId)}</span>
                            </p>
                          )}
                        </div>
                        
                        {booking.status === 'refunded' && booking.refundTier && (
                          <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/50 mt-1">
                             <p className="font-sans text-sm text-emerald-700 flex items-center gap-2">
                               <CheckCircle size={14} className="text-emerald-600" />
                               <span>
                                 Refunded: {booking.refundTier === 'full_refund' ? '100%' : booking.refundTier === 'partial_refund' ? '50%' : '0%'}
                                 {booking.refundAmount !== undefined ? <strong className="ml-1">₹{booking.refundAmount}</strong> : ''}
                               </span>
                             </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Actions & Price */}
                    <div className="bg-mist/30 sm:bg-transparent p-4 sm:p-5 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 sm:border-l border-ink/5 sm:w-40 shrink-0">
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="font-sans text-xs text-on-surface-variant font-medium">
                          Total Amount
                        </span>
                        <p className="font-sans text-lg font-bold text-pitch">
                          ₹{booking.totalPrice}
                        </p>
                      </div>

                      {booking.status === 'confirmed' && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setBookingToCancel(booking.id)}
                          className="px-4 py-2 border border-clay/20 text-clay hover:bg-clay/5 rounded-lg text-sm font-semibold transition-colors cursor-pointer w-full"
                        >
                          Cancel
                        </motion.button>
                      )}
                      {(booking.status === 'cancelled' || booking.status === 'refunded' || booking.status === 'expired' || booking.status === 'completed') && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => onBookAgain(booking.venueId)}
                          className="px-4 py-2 bg-pitch hover:bg-pitch/90 text-chalk rounded-lg text-sm font-semibold transition-colors cursor-pointer w-full"
                        >
                          Book Again
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {bookingToCancel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm" 
              onClick={() => setBookingToCancel(null)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
              className="relative bg-chalk rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-clay/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-clay" />
              </div>
              <h3 className="font-sans text-xl font-bold text-ink mb-2">Cancel Booking?</h3>
              <p className="font-sans text-sm text-on-surface-variant mb-8">
                Are you sure you want to cancel this booking? Your refund will depend on how close it is to your slot time.
              </p>
              <div className="flex gap-3 w-full">
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setBookingToCancel(null)}
                  className="flex-1 px-4 py-2.5 border border-ink/10 text-ink hover:bg-mist rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Keep Booking
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    onCancelBooking(bookingToCancel);
                    setBookingToCancel(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-clay hover:bg-clay/90 text-chalk rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Yes, Cancel
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
