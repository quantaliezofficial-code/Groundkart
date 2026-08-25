import { AlertCircle, Calendar, Check, Clock, Copy, Info, Lock, ShieldCheck, User, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { ApiError } from '../lib/api/client';
import type { BookingCreateResponse } from '../lib/api/types';
import type { UserMe } from '../lib/api/types';
import { Venue } from '../types';

interface ReviewPayProps {
  venue: Venue;
  selectedSlot: string;
  selectedSlotId: string | null;
  selectedDate: string;
  currentUser: UserMe | null;
  onNavigateHome: () => void;
  onSubmitBooking: (guestName?: string, guestEmail?: string, guestPhone?: string) => Promise<BookingCreateResponse>;
}

export default function ReviewPay({
  venue,
  selectedSlot,
  selectedSlotId,
  selectedDate,
  currentUser,
  onNavigateHome,
  onSubmitBooking,
}: ReviewPayProps) {
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingCreateResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const estimatedPrice = venue.pricePerHour;
  const canSubmit = Boolean(selectedSlotId) && (currentUser || (guestName.trim() && guestEmail.trim()));

  const lineRef = useRef<HTMLDivElement>(null);
  const successCircleRef = useRef<HTMLDivElement>(null);
  const checkIconRef = useRef<SVGSVGElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const successCardsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!result && lineRef.current) {
      gsap.fromTo(lineRef.current, { width: '0%' }, { width: '50%', duration: 1, ease: 'power2.out' });
    }
  }, [result]);

  useEffect(() => {
    if (result) {
      const tl = gsap.timeline();
      if (successCircleRef.current) {
        tl.from(successCircleRef.current, { scale: 0, ease: 'elastic.out(1, 0.5)', duration: 0.8 }, 0);
      }
      if (checkIconRef.current) {
        tl.fromTo(checkIconRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.3);
      }
      if (successTitleRef.current) {
        tl.from(successTitleRef.current, { y: 20, opacity: 0, duration: 0.5 }, 0.5);
      }
      if (successCardsRef.current.length > 0) {
        tl.from(successCardsRef.current, { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 }, 0.7);
      }
    }
  }, [result]);

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsProcessing(true);
    try {
      const res = await onSubmitBooking(
        currentUser ? undefined : guestName.trim(),
        currentUser ? undefined : guestEmail.trim(),
        currentUser ? undefined : guestPhone.trim(),
      );
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not submit your booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (result) {
    const minutesHeld = Math.round(result.expires_in / 60);
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-md mx-auto bg-chalk border border-ink/5 rounded-2xl p-8 text-center shadow-2xl my-12 transition-all"
      >
        <div ref={successCircleRef} className="w-20 h-20 rounded-full bg-pitch text-chalk flex items-center justify-center mx-auto mb-6 shadow-lg shadow-pitch/20">
          <Check ref={checkIconRef} size={40} className="stroke-[3]" />
        </div>
        <h2 ref={successTitleRef} className="font-display text-3xl sm:text-4xl text-ink font-bold mb-3">Booking Requested!</h2>
        <div ref={(el) => { if(el) successCardsRef.current[0] = el; }}>
          <p className="font-sans text-sm text-on-surface-variant mb-6 leading-relaxed">
            Your slot at <span className="font-semibold text-pitch">{venue.name}</span> is held for you. Payment for
            this booking is confirmed by our team once it's received.
          </p>
        </div>

        <div ref={(el) => { if(el) successCardsRef.current[1] = el; }} className="bg-mist rounded-xl p-5 mb-6 text-left space-y-3">
          <div className="flex justify-between items-center font-sans text-sm">
            <span className="text-on-surface-variant">Booking ID</span>
            <span className="font-mono text-ink font-semibold bg-chalk px-2 py-1 rounded-md border border-ink/5">{result.booking_id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between items-center font-sans text-sm">
            <span className="text-on-surface-variant">Status</span>
            <span className="font-sans text-[11px] text-marigold bg-marigold/10 border border-marigold/20 px-2 py-1 rounded-full font-bold uppercase tracking-wider">Awaiting Payment</span>
          </div>
          <div className="flex justify-between items-center font-sans text-sm">
            <span className="text-on-surface-variant">Held for</span>
            <span className="font-mono text-ink font-medium">{minutesHeld} mins</span>
          </div>
          <div className="flex justify-between items-center font-sans text-sm border-t border-ink/10 pt-3 mt-1">
            <span className="text-on-surface-variant font-medium">Amount</span>
            <span className="font-display text-xl text-ink font-bold">₹{result.amount}</span>
          </div>
        </div>

        {result.manage_token && (
          <div ref={(el) => { if(el) successCardsRef.current[2] = el; }} className="bg-pitch/5 rounded-xl p-5 mb-6 border border-pitch/10 text-left">
            <p className="font-sans text-sm font-semibold text-pitch mb-2 flex items-center gap-1.5">
              <Info size={16} /> Guest Booking Link
            </p>
            <p className="font-sans text-xs text-on-surface-variant mb-3">
              Save this link to view or cancel this booking later.
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                readOnly 
                value={result.manage_token} 
                className="w-full bg-chalk border border-ink/10 rounded-lg px-3 py-2 font-mono text-xs text-ink outline-none"
              />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(result.manage_token ?? '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-pitch text-chalk px-3 py-2 text-xs font-semibold hover:bg-[#15462E] transition-colors"
              >
                <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div ref={(el) => { if(el) successCardsRef.current[3] = el; }}>
          <button
            onClick={onNavigateHome}
            className="w-full bg-transparent hover:bg-mist text-pitch border border-pitch/20 font-sans text-sm font-semibold py-3.5 rounded-xl transition-all cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-5xl mx-auto"
    >
      
      {/* 3-Step Modern Progress Stepper */}
      <div className="w-full max-w-lg mx-auto mb-10">
        <div className="flex justify-between items-center relative">
          
          <div className="absolute inset-x-0 top-3 -z-10 flex px-8">
            <div ref={lineRef} className="h-0.5 bg-pitch w-0" />
            <div className="h-0.5 bg-ink/10 flex-1" />
          </div>

          {/* Step 1 */}
          <div className="flex flex-col items-center bg-mist px-2 z-10">
            <div className="w-6 h-6 rounded-full bg-pitch text-chalk flex items-center justify-center shadow-sm">
              <Check size={12} className="stroke-[3]" />
            </div>
            <span className="mt-2 font-sans text-xs text-pitch font-medium">Select Slot</span>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center bg-mist px-2 z-10">
            <div className="w-6 h-6 rounded-full bg-pitch text-chalk flex items-center justify-center ring-4 ring-pitch/20">
              <span className="font-mono text-xs font-bold">2</span>
            </div>
            <span className="mt-2 font-sans text-xs text-pitch font-bold">Review</span>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center bg-mist px-2 z-10">
            <div className="w-6 h-6 rounded-full bg-chalk text-on-surface-variant border-2 border-ink/10 flex items-center justify-center">
              <span className="font-mono text-xs font-medium">3</span>
            </div>
            <span className="mt-2 font-sans text-xs text-on-surface-variant">Confirm</span>
          </div>

        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-clay/10 p-4 text-sm text-clay border border-clay/20">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-chalk rounded-2xl ring-1 ring-ink/5 p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-ink mb-2">
              Review &amp; Request
            </h1>
            <p className="font-sans text-sm text-on-surface-variant mb-6">
              This holds your slot. You'll receive confirmation once payment is verified.
            </p>

            {!currentUser && (
              <div className="space-y-5">
                <div className="h-px bg-ink/10 w-full" />
                <h2 className="font-sans text-sm font-bold text-ink">Guest Details</h2>
                
                <div className="space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="relative"
                  >
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <User size={18} className="text-on-surface-variant" />
                    </div>
                    <input
                      id="guest-name"
                      type="text"
                      required
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-mist border border-ink/10 rounded-xl py-3 pl-10 pr-4 font-sans text-sm text-ink focus:ring-2 focus:ring-pitch/15 focus:border-pitch/30 outline-none transition-all"
                      placeholder="Full name"
                    />
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative"
                  >
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Mail size={18} className="text-on-surface-variant" />
                    </div>
                    <input
                      id="guest-email"
                      type="email"
                      required
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full bg-mist border border-ink/10 rounded-xl py-3 pl-10 pr-4 font-sans text-sm text-ink focus:ring-2 focus:ring-pitch/15 focus:border-pitch/30 outline-none transition-all"
                      placeholder="Email address"
                    />
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="relative"
                  >
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-surface-variant"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                    </div>
                    <input
                      id="guest-phone"
                      type="tel"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full bg-mist border border-ink/10 rounded-xl py-3 pl-10 pr-4 font-sans text-sm text-ink focus:ring-2 focus:ring-pitch/15 focus:border-pitch/30 outline-none transition-all"
                      placeholder="Phone number (optional)"
                    />
                  </motion.div>
                  
                  <motion.p 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="font-sans text-xs text-on-surface-variant bg-mist p-3 rounded-lg border border-ink/5"
                  >
                    Booking without an account? You'll get a private link to manage or cancel it. Or <span className="font-semibold text-pitch cursor-pointer hover:underline">log in</span> first.
                  </motion.p>
                </div>
              </div>
            )}
          </div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-chalk rounded-2xl ring-1 ring-ink/5 p-6 shadow-sm space-y-6"
          >
            <div>
              <h2 className="font-sans text-sm font-bold text-ink mb-3">Payment Info</h2>
              <div className="bg-pitch/5 border-l-4 border-pitch rounded-r-xl p-4 flex gap-3">
                <Info size={20} className="text-pitch shrink-0" />
                <p className="font-sans text-xs sm:text-sm text-pitch leading-relaxed">
                  This isn't an instant card checkout. Submitting this request holds your slot; our team confirms payment and finalizes your booking from there.
                </p>
              </div>
            </div>

            <div className="border border-ink/10 rounded-xl overflow-hidden">
              <button 
                onClick={() => setShowPolicy(!showPolicy)}
                className="w-full flex items-center justify-between p-4 bg-mist hover:bg-ink/5 transition-colors cursor-pointer"
              >
                <span className="font-sans text-sm font-bold text-ink">Cancellation Policy</span>
                {showPolicy ? <ChevronUp size={18} className="text-ink" /> : <ChevronDown size={18} className="text-ink" />}
              </button>
              
              <AnimatePresence>
                {showPolicy && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-chalk"
                  >
                    <div className="p-4">
                      <ul className="space-y-3 font-sans text-sm text-on-surface-variant">
                        <li className="flex justify-between border-b border-ink/5 pb-2">
                          <span>Up to 48 hours before</span>
                          <span className="font-medium text-pitch">Free Cancellation</span>
                        </li>
                        <li className="flex justify-between border-b border-ink/5 pb-2">
                          <span>24–48 hours before</span>
                          <span className="font-medium text-marigold">50% Refund</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Inside 24 hours</span>
                          <span className="font-medium text-clay">No Refund</span>
                        </li>
                      </ul>
                      <p className="font-sans text-xs mt-4 italic">Refunds are calculated automatically the moment you cancel.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Summary Card (Right column) */}
        <div className="lg:col-span-5">
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="bg-chalk rounded-2xl ring-1 ring-ink/5 overflow-hidden shadow-xl lg:sticky lg:top-[95px]"
          >
            
            <div className="bg-gradient-to-r from-[#143828] via-pitch to-[#1a5438] p-6 text-chalk relative overflow-hidden">
              <div className="relative z-10 flex gap-4">
                <div className="w-20 h-20 rounded-xl bg-surface-container shrink-0 overflow-hidden border-2 border-chalk/20 shadow-md">
                  <img
                    src={venue.image}
                    alt={venue.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <h3 className="font-display text-lg font-bold">{venue.name}</h3>
                  <div className="flex flex-col gap-1 mt-2">
                    <p className="font-sans text-xs text-chalk/80 flex items-center gap-1.5 font-medium">
                      <Calendar size={14} className="text-marigold" />
                      <span>{selectedDate}</span>
                    </p>
                    <p className="font-sans text-xs text-chalk/80 flex items-center gap-1.5 font-medium">
                      <Clock size={14} className="text-marigold" />
                      <span>{selectedSlot}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 font-sans text-sm text-on-surface-variant">
                <div className="flex justify-between items-center">
                  <span>{venue.unitType === 'hour' ? 'Hourly rate' : venue.unitType === 'half_day' ? 'Half-day rate' : 'Full-day rate'}</span>
                  <span className="font-mono text-ink font-medium">₹{estimatedPrice.toFixed(2)}</span>
                </div>
              </div>

              <div className="h-px bg-ink/10 w-full my-5" />

              <div className="flex justify-between items-end mb-6 bg-marigold/5 p-4 rounded-xl border border-marigold/10">
                <span className="font-sans text-sm font-bold text-ink">Total Amount</span>
                <span className="font-display text-2xl text-marigold font-bold">₹{estimatedPrice.toFixed(2)}</span>
              </div>

              <motion.button
                whileHover={!isProcessing && canSubmit ? { scale: 1.02 } : {}}
                whileTap={!isProcessing && canSubmit ? { scale: 0.97 } : {}}
                onClick={handleConfirm}
                disabled={isProcessing || !canSubmit}
                className="w-full bg-gradient-to-r from-pitch to-[#15462E] hover:shadow-lg hover:shadow-pitch/20 text-chalk font-sans text-sm font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span>Requesting…</span>
                ) : (
                  <>
                    <span>Request Booking</span>
                    <ShieldCheck size={18} />
                  </>
                )}
              </motion.button>

              <p className="text-center font-sans text-[11px] text-on-surface-variant mt-4 flex items-center justify-center gap-1.5 font-medium">
                <Lock size={12} className="text-on-surface-variant" />
                <span>Secure SSL encrypted connection</span>
              </p>
            </div>

          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
