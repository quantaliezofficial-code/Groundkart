import { SafeImage } from './dashboard';
import GroundSelect from './ui/GroundSelect';
import React, { useMemo, useState, useRef } from 'react';
import { ArrowLeft, ChevronRight, MapPin, Star, Zap, Wind, ShieldCheck, Car, Bath, Wifi, CalendarDays, CheckCircle, Clock, Shield, Send, Loader2, Trash2, X, Users, FileText, Check, Tv, Volume2, BatteryCharging, Armchair, Sparkles } from 'lucide-react';
import { motion, useInView } from 'framer-motion';
import { Venue, VenueSlot, AppBooking } from '../types';
import { useVenueReviews, useCreateReview } from '../hooks/useVenues';
import { useAdminDeleteReview } from '../hooks/useAdmin';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api/client';
import SEOHead from './SEOHead';
import { generateVenueSchema, generateBreadcrumbSchema } from '../lib/schema';
import { SITE_NAME, absUrl } from '../lib/site';

interface DetailViewProps {
  venue: Venue;
  slots: VenueSlot[];
  onBack: () => void;
  onSupport?: (venueId: string) => void;
  onInitiateBooking: (selectedSlot: string, date: string, slotId: string) => void;
  onRequestAuth?: () => void;
  waitingBooking?: AppBooking;
  onGoToBookings?: () => void;
}

function FadeInWhenVisible({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.5, delay, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(star)}
          className="cursor-pointer"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            size={22}
            className={(hovered || value) >= star ? 'text-marigold fill-marigold' : 'text-ink/20'}
          />
        </button>
      ))}
    </div>
  );
}

const AMENITY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'free parking': Car,
  'parking': Car,
  'dedicated parking': Car,
  'wifi': Wifi,
  'high-speed wifi': Wifi,
  'air conditioning': Wind,
  'climate control': Wind,
  'stadium lighting': Zap,
  'floodlights / lighting': Zap,
  'restrooms': Bath,
  'locker rooms': Bath,
  'shower & changing rooms': Bath,
  'changing rooms': Bath,
  'fifa certified': ShieldCheck,
  'verified': ShieldCheck,
  'sound system / speakers': Volume2,
  'sound system': Volume2,
  'projector / av screen': Tv,
  'av / screen': Tv,
  'cctv security': Shield,
  'power backup': BatteryCharging,
  'seating / chairs': Armchair,
  'tables & chairs': Armchair,
};

export default function DetailView({
  venue,
  slots,
  onBack,
  onInitiateBooking,
  onRequestAuth,
  waitingBooking,
  onGoToBookings,
}: DetailViewProps) {
  const { user } = useAuth();

  const parsedAmenities = useMemo(() => {
    if (Array.isArray(venue.amenities)) {
      return venue.amenities.map((a) => (typeof a === 'string' ? a : String(a)));
    }
    if (venue.amenities && typeof venue.amenities === 'object') {
      return Object.entries(venue.amenities)
        .filter(([_, active]) => Boolean(active))
        .map(([key]) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()));
    }
    return [];
  }, [venue.amenities]);

  // ── Availability date picker ──────────────────────────────────────────────
  // Unique dates that actually have at least one slot — ensures the select
  // dropdown only shows dates with real availability instead of letting the
  // user pick an arbitrary date and see "No slots for this date".
  const availableDates = useMemo(() => {
    const seen = new Set<string>();
    for (const s of slots) {
      if (!seen.has(s.date)) seen.add(s.date);
    }
    return [...seen].sort();
  }, [slots]);

  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] ?? new Date().toISOString().slice(0, 10));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const slotsForDate = useMemo(
    () =>
      slots
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [slots, selectedDate],
  );

  const selectedSlotObj = slotsForDate.find((s) => s.id === selectedSlotId) ?? null;

  const handleSlotClick = (slot: VenueSlot) => {
    if (!slot.isAvailable) return;
    setSelectedSlotId(slot.id);
  };

  const handleBookNow = () => {
    if (!selectedSlotObj) return;
    const label = selectedSlotObj.startTime
      ? `${selectedSlotObj.startTime}–${selectedSlotObj.endTime ?? ''}`
      : 'Full day';
    onInitiateBooking(label, selectedDate, selectedSlotObj.id);
  };

  // ── Reviews ───────────────────────────────────────────────────────────────
  const { data: reviews = [], isLoading: reviewsLoading } = useVenueReviews(venue.id);
  const createReview = useCreateReview();
  const deleteReview = useAdminDeleteReview();

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError(null);
    setReviewSuccess(false);
    if (reviewRating === 0) {
      setReviewError('Please select a rating.');
      return;
    }
    try {
      await createReview.mutateAsync({ venueId: venue.id, body: { booking_id: "", rating: reviewRating, content: reviewContent } });
      setReviewRating(0);
      setReviewContent('');
      setReviewSuccess(true);
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.detail : 'Failed to submit review.');
    }
  };

  // ── Image gallery ─────────────────────────────────────────────────────────
  // Render based on how many actual images exist.
  // 0 images: show a placeholder gradient.
  // 1 image: full-width single image.
  // 2 images: main large + one side panel.
  // 3+ images: main large + two side thumbnails (same layout as before, but
  //   now dynamic — no hardcoded Google URLs).
  const galleryImages = venue.gallery?.filter(Boolean) ?? (venue.image ? [venue.image] : []);
  const imageCount = galleryImages.length;

  const venueSlug = venue.slug || venue.id;
  const canonicalUrl = absUrl(`/venues/${venueSlug}`);
  const pageTitle = `${venue.name} — ${venue.category} in ${venue.city} | ${SITE_NAME}`;
  const pageDescription =
    venue.description && venue.description.length > 20
      ? venue.description.length > 155
        ? `${venue.description.slice(0, 152)}...`
        : venue.description
      : `Book ${venue.name}, a verified ${venue.category} located in ${venue.district}, ${venue.city}. View available time slots, real photos, amenities, and transparent pricing on ${SITE_NAME}.`;

  const breadcrumbItems = [
    { name: 'Home', path: '/' },
    { name: 'Venues', path: '/search' },
    { name: venue.category, path: `/search?category=${encodeURIComponent(venue.category)}` },
    { name: venue.name, path: `/venues/${venueSlug}` },
  ];

  const schemas = [
    generateVenueSchema(venue),
    generateBreadcrumbSchema(breadcrumbItems),
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        ogImage={venue.image}
        ogType="place"
        jsonLd={schemas}
      />

      {/* Back Button and Breadcrumbs */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="Back to venue search"
          className="flex items-center justify-center p-2 rounded-full hover:bg-mist transition-colors cursor-pointer text-ink hover:text-pitch ease-out"
        >
          <ArrowLeft size={20} />
        </button>
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <button onClick={onBack} className="text-on-surface-variant hover:text-pitch transition-colors font-sans ease-out">
                Venues
              </button>
            </li>
            <ChevronRight size={14} className="text-on-surface-variant/50" />
            <li>
              <span className="text-on-surface-variant font-sans">{venue.category}</span>
            </li>
            <ChevronRight size={14} className="text-on-surface-variant/50" />
            <li aria-current="page">
              <span className="text-pitch font-medium font-sans">{venue.name}</span>
            </li>
          </ol>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Column: Content */}
        <div className="lg:col-span-8 space-y-10">

          {/* Title Header */}
          <header>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pitch/10 text-pitch">
                {venue.venueType || venue.category}
              </span>
              {venue.environment && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-mist text-ink capitalize">
                  {venue.environment} space
                </span>
              )}
              {venue.capacity && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-mist text-on-surface-variant flex items-center gap-1">
                  <Users size={12} /> Up to {venue.capacity} guests
                </span>
              )}
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-3xl font-bold text-ink tracking-tight mb-1"
            >
              {venue.name}
            </motion.h1>
            {venue.tagline && (
              <p className="font-sans text-base text-on-surface-variant font-medium mb-2">
                {venue.tagline}
              </p>
            )}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-sans text-sm text-on-surface-variant flex items-center gap-1.5"
            >
              <MapPin size={16} className="text-on-surface-variant" />
              <span>{venue.district}, {venue.city}</span>
            </motion.p>
          </header>

          {/* Image Gallery — dynamic based on actual image count */}
          {imageCount === 0 ? (
            <div className="h-[340px] sm:h-[450px] rounded-2xl overflow-hidden bg-gradient-to-br from-pitch/10 to-marigold/10 flex items-center justify-center">
              <span className="text-on-surface-variant text-sm font-sans">No photos yet</span>
            </div>
          ) : imageCount === 1 ? (
            <div className="h-[340px] sm:h-[450px] rounded-2xl overflow-hidden shadow-lg shadow-pitch/5">
              <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="w-full h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />
                <SafeImage className="w-full h-full object-cover" src={galleryImages[0]} alt={`${venue.name} — Main photography`} referrerPolicy="no-referrer" />
              </motion.div>
            </div>
          ) : imageCount === 2 ? (
            <div className="grid grid-cols-2 gap-3 h-[340px] sm:h-[450px] rounded-2xl overflow-hidden shadow-lg shadow-pitch/5">
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />
                <SafeImage className="w-full h-full object-cover" src={galleryImages[0]} alt={`${venue.name} — Main field view`} referrerPolicy="no-referrer" />
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="relative overflow-hidden">
                <SafeImage className="w-full h-full object-cover" src={galleryImages[1]} alt={`${venue.name} — Playing surface and facility view`} referrerPolicy="no-referrer" />
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-4 grid-rows-2 gap-3 h-[340px] sm:h-[450px] rounded-2xl overflow-hidden shadow-lg shadow-pitch/5">
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="col-span-3 row-span-2 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10 pointer-events-none" />
                <SafeImage className="w-full h-full object-cover" src={galleryImages[0]} alt={`${venue.name} — Main arena and pitch overview`} referrerPolicy="no-referrer" />
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="col-span-1 row-span-1 relative overflow-hidden">
                <SafeImage className="w-full h-full object-cover" src={galleryImages[1]} alt={`${venue.name} — Facility exterior and seating area`} referrerPolicy="no-referrer" />
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className="col-span-1 row-span-1 relative overflow-hidden group">
                <SafeImage className="w-full h-full object-cover" src={galleryImages[2]} alt={`${venue.name} — Pitch lighting and turf details`} referrerPolicy="no-referrer" />
                {imageCount > 3 && (
                  <div className="absolute inset-0 bg-ink/30 flex items-center justify-center transition-colors ease-out">
                    <div className="bg-chalk/80 backdrop-blur-lg px-4 py-2 rounded-full shadow-lg">
                      <span className="text-ink font-sans text-sm font-semibold">+{imageCount - 3} Photos</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {/* About Section */}
          <section className="space-y-4">
            <div>
              <h2 className="font-sans text-lg font-bold text-ink">About the Venue</h2>
              <div className="w-10 h-1 rounded-full bg-gradient-to-r from-pitch to-marigold mt-2" />
            </div>
            <div className="font-sans text-base text-on-surface-variant leading-relaxed space-y-3">
              <p>{venue.description}</p>
            </div>
          </section>

          {/* Venue Amenities Section */}
          <section className="space-y-4">
            <FadeInWhenVisible>
              <h2 className="font-sans text-lg font-bold text-ink">Venue Amenities</h2>
              <div className="w-10 h-1 rounded-full bg-gradient-to-r from-pitch to-marigold mt-2" />
            </FadeInWhenVisible>
            {parsedAmenities.length === 0 ? (
              <div className="p-4 rounded-xl bg-mist text-on-surface-variant text-sm font-sans">
                No specific amenities listed for this space.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {parsedAmenities.map((amenity, index) => {
                  const normalized = amenity.toLowerCase().trim();
                  const Icon = AMENITY_ICONS[normalized] || CheckCircle;
                  return (
                    <FadeInWhenVisible key={amenity + index} delay={index * 0.03}>
                      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-chalk border border-ink/5 shadow-xs hover:border-pitch/30 transition">
                        <div className="w-8 h-8 rounded-lg bg-pitch/5 flex items-center justify-center shrink-0">
                          <Icon size={18} className="text-pitch" />
                        </div>
                        <span className="font-sans text-sm font-medium text-ink">{amenity}</span>
                      </div>
                    </FadeInWhenVisible>
                  );
                })}
              </div>
            )}
          </section>

          {/* House Rules & Policies Section */}
          {((venue.rules && venue.rules.length > 0) || venue.cancellationPolicy) && (
            <section className="space-y-4">
              <FadeInWhenVisible>
                <h2 className="font-sans text-lg font-bold text-ink">House Rules & Policies</h2>
                <div className="w-10 h-1 rounded-full bg-gradient-to-r from-pitch to-marigold mt-2" />
              </FadeInWhenVisible>

              <div className="space-y-4">
                {venue.cancellationPolicy && (
                  <div className="p-4 rounded-2xl bg-surface-container/60 border border-ink/5 flex items-start gap-3">
                    <ShieldCheck size={20} className="text-pitch shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-ink">
                        {venue.cancellationPolicy} Cancellation Policy
                      </h4>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {venue.cancellationPolicy.toLowerCase() === 'flexible'
                          ? 'Full refund for cancellations made up to 24 hours before the booked slot.'
                          : venue.cancellationPolicy.toLowerCase() === 'strict'
                          ? '50% refund for cancellations made up to 7 days before. Non-refundable thereafter.'
                          : 'Full refund for cancellations made up to 48 hours before the booked slot.'}
                      </p>
                    </div>
                  </div>
                )}

                {venue.rules && venue.rules.length > 0 && (
                  <div className="bg-chalk p-4 rounded-2xl border border-ink/5 shadow-xs space-y-2.5">
                    <h4 className="text-sm font-semibold text-ink flex items-center gap-2">
                      <FileText size={16} className="text-pitch" /> Space Guidelines & Rules
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {venue.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
                          <Check size={14} className="text-pitch shrink-0" />
                          <span>{rule}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Reviews Section — live data */}
          <section className="space-y-4">
            <FadeInWhenVisible>
              <h2 className="font-sans text-lg font-bold text-ink">Reviews</h2>
              <div className="w-10 h-1 rounded-full bg-gradient-to-r from-pitch to-marigold mt-2" />
            </FadeInWhenVisible>

            {user ? (
              <FadeInWhenVisible>
                <form
                  onSubmit={handleSubmitReview}
                  className="bg-chalk rounded-2xl ring-1 ring-ink/5 shadow p-5 space-y-3"
                >
                  <p className="font-sans text-sm font-semibold text-ink">Leave a Review</p>
                  <StarRatingInput value={reviewRating} onChange={setReviewRating} />
                  <textarea
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    required
                    placeholder="Share your experience at this venue…"
                    rows={3}
                    className="w-full rounded-xl border border-ink/10 bg-mist px-4 py-2.5 text-sm font-sans text-ink focus:outline-none focus:ring-2 focus:ring-pitch/20 resize-none"
                  />
                  {reviewError && (
                    <p className="text-sm text-clay flex items-center gap-1.5">
                      <X size={14} />{reviewError}
                    </p>
                  )}
                  {reviewSuccess && (
                    <p className="text-sm text-pitch flex items-center gap-1.5">
                      <CheckCircle size={14} /> Review submitted successfully!
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={createReview.isPending}
                    className="flex items-center gap-2 px-5 py-2 bg-pitch hover:bg-[#15462E] text-chalk text-sm font-semibold rounded-xl transition active:scale-[0.97] disabled:opacity-60 cursor-pointer ease-out"
                  >
                    {createReview.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Submit Review
                  </button>
                </form>
              </FadeInWhenVisible>
            ) : (
              <FadeInWhenVisible>
                <div className="bg-surface-container rounded-2xl p-6 text-center space-y-3">
                  <p className="font-sans text-sm text-on-surface-variant">Log in to leave a review</p>
                  <button
                    onClick={onRequestAuth}
                    className="px-6 py-2 bg-pitch text-chalk text-sm font-bold rounded-full hover:bg-pitch/90 transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer ease-out"
                  >
                    Log In
                  </button>
                </div>
              </FadeInWhenVisible>
            )}

            {/* Review cards */}
            {reviewsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map(skeleton => (
                  <div key={skeleton} className="bg-chalk rounded-2xl ring-1 ring-ink/5 shadow-sm p-4 animate-pulse flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-mist rounded-full" />
                      <div className="flex flex-col gap-1.5 flex-1">
                        <div className="w-24 h-3 bg-mist rounded-full" />
                        <div className="w-16 h-2 bg-mist rounded-full" />
                      </div>
                    </div>
                    <div className="w-full h-12 bg-mist rounded-lg mt-1" />
                  </div>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-on-surface-variant italic text-center py-4">
                No reviews yet. Be the first to share your experience!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reviews.map((review, index) => {
                  const initials = review.user_name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const isAdmin = user?.role === 'admin';
                  return (
                    <FadeInWhenVisible key={review.id} delay={index * 0.08}>
                      <div className="bg-chalk p-5 rounded-2xl ring-1 ring-ink/5 shadow-lg shadow-pitch/5 hover:-translate-y-1 transition duration-200 relative group ease-out">
                        {isAdmin && (
                          <button
                            onClick={() => deleteReview.mutate({ reviewId: review.id, venueId: venue.id })}
                            disabled={deleteReview.isPending}
                            title="Remove review"
                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-clay hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40 ease-out"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pitch to-marigold text-chalk flex items-center justify-center font-sans font-bold text-sm shadow-md">
                            {initials}
                          </div>
                          <div>
                            <p className="font-sans text-sm font-semibold text-ink">{review.user_name}</p>
                            <div className="flex text-marigold">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className={i < review.rating ? 'fill-marigold text-marigold' : 'text-ink/20'}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="font-sans text-sm text-on-surface-variant italic leading-relaxed">
                          "{review.content}"
                        </p>
                      </div>
                    </FadeInWhenVisible>
                  );
                })}
              </div>
            )}
          </section>

        </div>

        {/* Right Column: Sticky Booking Card */}
        <div className="lg:col-span-4 relative">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="lg:sticky lg:top-[95px] bg-chalk rounded-2xl shadow-xl ring-1 ring-ink/5 overflow-hidden transition duration-200 ease-out"
          >

            {/* Price tag & reviews rating */}
            <div className="bg-gradient-to-r from-[#143828] via-pitch to-[#1a5438] p-6 text-chalk">
              <div className="flex justify-between items-end">
                <div>
                  <span className="font-display text-3xl font-bold">{venue.currency || '₹'}{venue.basePrice}</span>
                  <span className="font-sans text-sm text-chalk/80">/ {venue.unitType === 'hour' ? 'hour' : venue.unitType === 'half_day' ? 'half day' : 'day'}</span>
                </div>

                <div className="flex items-center gap-1 text-marigold bg-chalk/10 backdrop-blur-md px-2 py-1 rounded-lg">
                  <Star size={14} className="fill-marigold" />
                  <span className="font-sans text-sm font-semibold">{venue.rating.toFixed(1)}</span>
                  <span className="font-sans text-xs text-chalk/80 ml-1">
                    ({venue.reviewCount})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Availability date picker — select-based, only shows dates with real slots */}
              <h3 className="font-sans text-sm font-bold text-ink mb-3">Availability Calendar</h3>
              <div className="relative mb-6">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <CalendarDays size={18} className="text-pitch" />
                </div>
                {availableDates.length === 0 ? (
                  <div className="w-full bg-mist border border-ink/10 rounded-xl py-3 pl-10 pr-4 font-mono text-sm text-on-surface-variant">
                    No availability listed yet
                  </div>
                ) : (
                  <GroundSelect
            value={selectedDate}
            onValueChange={(val) => { setSelectedDate(val); setSelectedSlotId(null); }}
            options={availableDates.map((d) => ({ value: d, label: `${d}` }))}
            triggerClassName="w-full sm:w-[200px]"
          />
                )}
              </div>

              {/* Slot buttons grid */}
              {slotsForDate.length === 0 ? (
                <p className="text-sm text-on-surface-variant mb-6 text-center italic">No slots listed for this date yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {slotsForDate.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const isBooked = !slot.isAvailable;
                    const label = slot.startTime ? slot.startTime : 'Full day';

                    if (isBooked) {
                      return (
                        <button
                          key={slot.id}
                          disabled={true}
                          className="py-2 px-3 rounded-full text-xs font-mono font-medium transition text-center select-none bg-clay/10 text-clay/50 cursor-not-allowed opacity-50 ease-out"
                        >
                          {label} (Booked)
                        </button>
                      );
                    }

                    return (
                      <motion.button
                        key={slot.id}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleSlotClick(slot)}
                        className={`py-2 px-3 rounded-full text-xs font-mono font-medium transition text-center select-none ${
                          isSelected
                            ? 'bg-pitch text-chalk shadow-md'
                            : 'bg-mist text-ink hover:bg-pitch hover:text-chalk'
                        } ease-out`}
                      >
                        {label}
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Book Now button */}
              {waitingBooking ? (
                <motion.button
                  onClick={onGoToBookings}
                  whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(234,179,8,0.3)' }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full font-sans text-sm font-semibold py-3.5 rounded-xl mb-3 flex justify-center items-center gap-2 cursor-pointer transition duration-200 bg-gradient-to-r from-marigold to-yellow-600 text-ink shadow-lg shadow-marigold/20 ease-out"
                >
                  <Clock size={18} />
                  <span>Waiting (Check Status)</span>
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleBookNow}
                  disabled={venue.isFullyBookedToday || !selectedSlotObj}
                  whileHover={!venue.isFullyBookedToday && selectedSlotObj ? { scale: 1.03, boxShadow: '0 8px 30px rgba(28,94,63,0.3)' } : {}}
                  whileTap={!venue.isFullyBookedToday && selectedSlotObj ? { scale: 0.97 } : {}}
                  className={`w-full font-sans text-sm font-semibold py-3.5 rounded-xl mb-3 flex justify-center items-center gap-2 cursor-pointer transition duration-200 ${
                    venue.isFullyBookedToday
                      ? 'bg-mist text-on-surface-variant cursor-not-allowed'
                      : 'bg-gradient-to-r from-pitch to-[#15462E] text-chalk shadow-lg shadow-pitch/20'
                  } ease-out`}
                >
                  <span>Book Now</span>
                </motion.button>
              )}
              <p className="text-center font-sans text-xs text-on-surface-variant mb-6">
                {waitingBooking ? "You have a pending request for this venue" : "You won't be charged yet"}
              </p>

              {/* Safe assurances badges */}
              <div className="space-y-3 pt-4 border-t border-ink/5">
                {[
                  { icon: CheckCircle, label: 'Instant confirmation' },
                  { icon: Shield, label: 'Secure booking process' },
                  {
                    icon: Clock,
                    label: venue.cancellationPolicy?.toLowerCase() === 'flexible'
                      ? 'Free cancellation up to 24 hours'
                      : venue.cancellationPolicy?.toLowerCase() === 'strict'
                      ? 'Cancellation policy applies (strict)'
                      : 'Free cancellation up to 48 hours',
                  },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + (i * 0.15) }}
                      className="flex items-center gap-2 font-sans text-xs text-ink"
                    >
                      <Icon size={16} className="text-pitch" />
                      <span>{item.label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
