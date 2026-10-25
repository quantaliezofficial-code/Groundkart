import { SafeImage } from './dashboard';
import GroundSelect from './ui/GroundSelect';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Star,
  Zap,
  Wind,
  ShieldCheck,
  Car,
  Bath,
  Wifi,
  CalendarDays,
  CheckCircle,
  Clock,
  Shield,
  Send,
  Loader2,
  Trash2,
  X,
  Users,
  FileText,
  Check,
  Tv,
  Volume2,
  BatteryCharging,
  Armchair,
  Sparkles,
  Utensils,
  Wine,
  Presentation,
  Music,
  Phone,
  Waves,
  Droplets,
  HeartPulse,
  Play,
  HelpCircle,
  Layers,
  Maximize2,
  Minus,
  Plus,
  Share2,
  Heart,
  Award,
} from 'lucide-react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Venue, VenueSlot, AppBooking, UnitType } from '../types';
import { useVenueReviews, useCreateReview } from '../hooks/useVenues';
import { useAdminDeleteReview } from '../hooks/useAdmin';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api/client';
import { venuesApi } from '../lib/api/venues';
import SEOHead from './SEOHead';
import { generateVenueSchema, generateBreadcrumbSchema } from '../lib/schema';
import { SITE_NAME, absUrl } from '../lib/site';
import VenueImageLightbox from './VenueImageLightbox';

export interface BookingMeta {
  purposeId?: string;
  purposeName?: string;
  rentalMode?: UnitType;
  price?: number;
  maxGuests?: number | null;
  durationHours?: number;
}

interface DetailViewProps {
  venue: Venue;
  slots: VenueSlot[];
  onBack: () => void;
  onSupport?: (venueId: string) => void;
  onInitiateBooking: (selectedSlot: string, date: string, slotId: string, meta?: BookingMeta) => void;
  onRequestAuth?: () => void;
  waitingBooking?: AppBooking;
  onGoToBookings?: () => void;
}

function FadeInWhenVisible({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
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
          className="cursor-pointer p-0.5 rounded transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-pitch/30"
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
  'valet parking': Car,
  'wifi': Wifi,
  'high-speed wifi': Wifi,
  'air conditioning': Wind,
  'climate control': Wind,
  'stadium lighting': Zap,
  'floodlights / lighting': Zap,
  'floodlights': Zap,
  'restrooms': Bath,
  'locker rooms': Bath,
  'shower & changing rooms': Bath,
  'changing rooms': Bath,
  'shower': Bath,
  'showers': Bath,
  'fifa certified': ShieldCheck,
  'verified': ShieldCheck,
  'sound system / speakers': Volume2,
  'sound system': Volume2,
  'speakers': Volume2,
  'projector / av screen': Tv,
  'projector': Tv,
  'av / screen': Tv,
  'cctv security': Shield,
  'security guards': Shield,
  'security': Shield,
  'power backup': BatteryCharging,
  'generator backup': BatteryCharging,
  'seating / chairs': Armchair,
  'tables & chairs': Armchair,
  'in-house catering': Utensils,
  'catering': Utensils,
  'kitchen area': Utensils,
  'kitchen': Utensils,
  'bar counter': Wine,
  'bar': Wine,
  'stage & podium': Presentation,
  'stage': Presentation,
  'podium': Presentation,
  'dj setup': Music,
  'music': Music,
  'conference phone': Phone,
  'conference': Phone,
  'whiteboard': Presentation,
  'swimming pool': Waves,
  'pool': Waves,
  'drinking water': Droplets,
  'water': Droplets,
  'first aid': HeartPulse,
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
  const headerRef = useRef<HTMLDivElement>(null);
  const reviewsSectionRef = useRef<HTMLElement>(null);
  const bookingCardRef = useRef<HTMLDivElement>(null);

  // ── Sticky Context Bar Observer (Enhancement 1) ───────────────────────────
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [hasScrolledPastBooking, setHasScrolledPastBooking] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setShowStickyHeader(scrollY > 380);
      if (bookingCardRef.current) {
        const rect = bookingCardRef.current.getBoundingClientRect();
        setHasScrolledPastBooking(rect.bottom < 120);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToReviews = () => {
    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBooking = () => {
    bookingCardRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Amenities parsing ─────────────────────────────────────────────────────
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

  // ── Multi-Purpose Configuration ───────────────────────────────────────────
  const approvedPurposes = useMemo(() => {
    return (venue.purposes || []).filter(
      (p: any) => p.is_custom_approved !== false && p.enabled !== false
    );
  }, [venue.purposes]);

  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(() => {
    return approvedPurposes.length > 0 ? approvedPurposes[0].id : null;
  });

  const selectedPurpose = useMemo(() => {
    return approvedPurposes.find((p: any) => p.id === selectedPurposeId) || approvedPurposes[0] || null;
  }, [approvedPurposes, selectedPurposeId]);

  // ── Flexible Rental Modes ──────────────────────────────────────────────────
  const availableModes: UnitType[] = useMemo(() => {
    if (selectedPurpose?.allowed_modes && selectedPurpose.allowed_modes.length > 0) {
      return selectedPurpose.allowed_modes as UnitType[];
    }
    if (venue.rentalOptions && venue.rentalOptions.length > 0) {
      const enabled = venue.rentalOptions
        .filter((o: any) => o.enabled)
        .map((o: any) => o.mode as UnitType);
      if (enabled.length > 0) return enabled;
    }
    return [venue.unitType || 'hour'];
  }, [selectedPurpose, venue.rentalOptions, venue.unitType]);

  const [selectedRentalMode, setSelectedRentalMode] = useState<UnitType>(() => availableModes[0] || 'hour');

  useEffect(() => {
    if (!availableModes.includes(selectedRentalMode)) {
      setSelectedRentalMode(availableModes[0] || 'hour');
    }
  }, [availableModes, selectedRentalMode]);

  // ── Base & Active Unit Price ───────────────────────────────────────────────
  const activePrice = useMemo(() => {
    if (selectedPurpose?.price_override && Number(selectedPurpose.price_override) > 0) {
      return Number(selectedPurpose.price_override);
    }
    if (venue.rentalOptions && venue.rentalOptions.length > 0) {
      const match = venue.rentalOptions.find((o: any) => o.mode === selectedRentalMode);
      if (match && Number(match.price) > 0) {
        return Number(match.price);
      }
    }
    return venue.basePrice;
  }, [selectedPurpose, venue.rentalOptions, selectedRentalMode, venue.basePrice]);

  // ── Duration Presets & Quantity Stepper (Enhancement 3) ───────────────────
  // Default to 1 hour (or 1 unit); can be 1, 2, 3, 4, etc.
  const [durationQuantity, setDurationQuantity] = useState<number>(1);

  // Preset options for hourly mode: 1 hr, 2 hrs (Popular), 3 hrs, 4 hrs
  const hourlyPresets = [1, 2, 3, 4];

  // Calculated total price based on active unit price and selected quantity
  const calculatedTotalPrice = useMemo(() => {
    if (selectedRentalMode === 'hour') {
      return activePrice * durationQuantity;
    }
    return activePrice;
  }, [activePrice, durationQuantity, selectedRentalMode]);

  // ── Availability Calendar & Date Picker ──────────────────────────────────
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysLaterStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }, []);

  const { data: availability = [] } = useQuery({
    queryKey: ['venue-availability', venue.id, selectedPurpose?.id],
    queryFn: () =>
      venuesApi.getAvailability(
        venue.id,
        todayStr,
        thirtyDaysLaterStr,
        selectedPurpose?.id
      ),
    enabled: Boolean(venue.id),
  });

  const availableDates = useMemo(() => {
    const datesWithSlots = new Set<string>();
    for (const s of slots) {
      if (!datesWithSlots.has(s.date)) datesWithSlots.add(s.date);
    }
    if (availability.length > 0) {
      const availSet = new Set<string>();
      for (const a of availability) {
        const isFree =
          selectedRentalMode === 'hour'
            ? (a.hourly_slots_available ?? (a as any).hourly_free_count ?? 0) > 0
            : Boolean(a.is_full_day_available ?? (a as any).full_day_free);
        if (isFree && datesWithSlots.has(a.date)) {
          availSet.add(a.date);
        }
      }
      if (availSet.size > 0) {
        return [...availSet].sort();
      }
    }
    return [...datesWithSlots].sort();
  }, [slots, availability, selectedRentalMode]);

  const [selectedDate, setSelectedDate] = useState(() => availableDates[0] ?? new Date().toISOString().slice(0, 10));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const slotsForDate = useMemo(() => {
    const dateSlots = slots
      .filter((s) => s.date === selectedDate)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    if (selectedRentalMode === 'hour') {
      return dateSlots.filter((s) => s.startTime !== null);
    } else {
      const wholeDay = dateSlots.filter((s) => s.startTime === null);
      return wholeDay.length > 0 ? wholeDay : dateSlots;
    }
  }, [slots, selectedDate, selectedRentalMode]);

  const selectedSlotObj = slotsForDate.find((s) => s.id === selectedSlotId) ?? null;

  const handleSlotClick = (slot: VenueSlot) => {
    if (!slot.isAvailable) return;
    setSelectedSlotId(slot.id);
  };

  const handleBookNow = () => {
    if (!selectedSlotObj && slotsForDate.length === 0) return;
    const targetSlot = selectedSlotObj || slotsForDate[0];
    const durationSuffix = selectedRentalMode === 'hour' && durationQuantity > 1 ? ` (${durationQuantity} hrs)` : '';
    const label = targetSlot.startTime
      ? `${targetSlot.startTime}${targetSlot.endTime ? `–${targetSlot.endTime}` : ''}${durationSuffix}`
      : selectedRentalMode === 'half_day'
      ? 'Half Day'
      : 'Full Day';
    onInitiateBooking(label, selectedDate, targetSlot.id, {
      purposeId: selectedPurpose?.id,
      purposeName: selectedPurpose?.custom_name || selectedPurpose?.name,
      rentalMode: selectedRentalMode,
      price: calculatedTotalPrice,
      maxGuests: selectedPurpose?.max_guests ?? venue.capacity ?? null,
      durationHours: selectedRentalMode === 'hour' ? durationQuantity : undefined,
    });
  };

  // ── Videos & Content Blocks ───────────────────────────────────────────────
  const videoMedia = useMemo(() => {
    const mediaList = venue.media || [];
    return mediaList.filter(
      (m: any) =>
        m.media_type === 'video' ||
        m.url?.toLowerCase().endsWith('.mp4') ||
        m.url?.toLowerCase().endsWith('.webm') ||
        m.url?.includes('youtube.com') ||
        m.url?.includes('youtu.be') ||
        m.url?.includes('vimeo.com')
    );
  }, [venue.media]);

  const contentBlocks = useMemo(() => {
    const blocks = (venue.contentBlocks || []).filter((b: any) => b.enabled !== false);
    return [...blocks].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [venue.contentBlocks]);

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
      await createReview.mutateAsync({
        venueId: venue.id,
        body: { booking_id: '', rating: reviewRating, content: reviewContent },
      });
      setReviewRating(0);
      setReviewContent('');
      setReviewSuccess(true);
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.detail : 'Failed to submit review.');
    }
  };

  // ── Image gallery ─────────────────────────────────────────────────────────
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number = 0) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const isVideoUrl = (url: string = '') => {
    const clean = url.toLowerCase().split('?')[0];
    return (
      clean.endsWith('.mp4') ||
      clean.endsWith('.webm') ||
      clean.endsWith('.ogg') ||
      clean.endsWith('.mov') ||
      clean.endsWith('.mkv') ||
      clean.includes('youtube.com') ||
      clean.includes('youtu.be') ||
      clean.includes('vimeo.com')
    );
  };

  const galleryImages = useMemo(() => {
    const raw = venue.gallery?.filter(Boolean) ?? (venue.image ? [venue.image] : []);
    return raw.filter((u) => !isVideoUrl(u));
  }, [venue.gallery, venue.image]);
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

  const schemas = [generateVenueSchema(venue), generateBreadcrumbSchema(breadcrumbItems)];

  const currencySymbol = venue.currency || '₹';
  const unitLabel =
    selectedRentalMode === 'hour' ? 'hour' : selectedRentalMode === 'half_day' ? 'half day' : 'day';

  return (
    <div className="w-full max-w-full overflow-x-hidden pb-28 lg:pb-16">
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        canonicalUrl={canonicalUrl}
        ogImage={venue.image}
        ogType="place"
        jsonLd={schemas}
      />

      {/* ── ENHANCEMENT 1: Sticky Top Context Header ─────────────────────── */}
      <AnimatePresence>
        {showStickyHeader && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-0 inset-x-0 z-40 bg-chalk/95 backdrop-blur-md border-b border-ink/10 shadow-sm"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={onBack}
                  aria-label="Back to venues"
                  className="p-1.5 rounded-full hover:bg-mist text-ink/70 hover:text-ink transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>
                {galleryImages[0] && (
                  <img
                    src={galleryImages[0]}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover border border-ink/10 shrink-0 hidden sm:block"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-bold text-ink truncate leading-tight">
                    {venue.name}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant font-sans">
                    <span className="flex items-center gap-0.5 text-marigold font-semibold">
                      <Star size={13} className="fill-marigold" />
                      {venue.rating > 0 ? venue.rating.toFixed(1) : 'New'}
                    </span>
                    <span>·</span>
                    <span className="truncate">{venue.district}, {venue.city}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="font-sans text-sm font-bold text-ink">
                    {currencySymbol}{calculatedTotalPrice}
                  </div>
                  <div className="text-2xs text-on-surface-variant">
                    {selectedRentalMode === 'hour' && durationQuantity > 1
                      ? `for ${durationQuantity} hrs`
                      : `per ${unitLabel}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={scrollToBooking}
                  className="bg-pitch hover:bg-[#124230] text-chalk px-4 py-2 rounded-xl font-sans text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  Book Now
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Breadcrumb & Back Navigation (Fix 1 & Fix 3) ────────────────────── */}
      <div className="mb-5 flex items-center gap-3 min-w-0 max-w-full">
        <button
          onClick={onBack}
          aria-label="Back to venue search"
          className="shrink-0 flex items-center justify-center p-2 rounded-xl bg-chalk border border-ink/8 hover:bg-mist hover:border-ink/20 transition-all cursor-pointer text-ink shadow-xs ease-out focus:outline-none focus:ring-2 focus:ring-pitch/20"
        >
          <ArrowLeft size={18} />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <ol className="flex items-center gap-2 text-xs sm:text-sm min-w-0 max-w-full">
            <li className="shrink-0">
              <button
                onClick={onBack}
                className="text-on-surface-variant hover:text-pitch transition-colors font-sans ease-out cursor-pointer"
              >
                Venues
              </button>
            </li>
            <ChevronRight size={14} className="text-on-surface-variant/40 shrink-0" />
            <li className="shrink-0">
              <span className="text-on-surface-variant font-sans">{venue.category}</span>
            </li>
            <ChevronRight size={14} className="text-on-surface-variant/40 shrink-0" />
            <li aria-current="page" className="min-w-0 truncate">
              <span className="text-pitch font-semibold font-sans truncate block">
                {venue.name}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* ── Main Grid Container (Fix 3) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">

        {/* ── LEFT COLUMN: Imagery & Details ───────────────────────────────── */}
        <div className="lg:col-span-8 space-y-8">

          {/* ── Product Header & Social Proof (Fix 4, 6, 7, 9, 13, 14) ──────── */}
          <header ref={headerRef} className="space-y-3">
            {/* Badges row (Fix 6) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-pitch/8 text-pitch border border-pitch/15">
                {venue.venueType || venue.category}
              </span>
              {venue.environment && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-mist text-ink border border-ink/10 capitalize">
                  {venue.environment} space
                </span>
              )}
              {venue.capacity && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-mist text-on-surface-variant border border-ink/10">
                  <Users size={13} className="text-on-surface-variant" />
                  <span>Up to {venue.capacity} guests</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <ShieldCheck size={13} className="text-emerald-700" />
                <span>Verified Listing</span>
              </span>
            </div>

            {/* Product Title (Fix 7) */}
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-tight leading-tight">
              {venue.displayName || venue.name}
            </h1>

            {venue.displayName && venue.displayName !== venue.name && (
              <p className="font-sans text-xs text-on-surface-variant font-medium">
                Official registration: {venue.name}
              </p>
            )}

            {venue.tagline && (
              <p className="font-sans text-sm sm:text-base text-pitch/90 font-medium">
                {venue.tagline}
              </p>
            )}

            {/* Venue Use Cases */}
            {venue.useCases && venue.useCases.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {venue.useCases.map((uc) => (
                  <span
                    key={uc}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pitch/8 text-pitch border border-pitch/15"
                  >
                    {uc}
                  </span>
                ))}
              </div>
            )}

            {/* Rating, Reviews Link, Location & Price preview (Fix 9, Fix 13) */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-1 font-sans text-xs sm:text-sm text-on-surface-variant">
              {/* Star rating with review count link (Fix 9) */}
              <button
                type="button"
                onClick={scrollToReviews}
                className="inline-flex items-center gap-1.5 text-ink hover:text-pitch transition-colors font-medium cursor-pointer group"
                aria-label={`Rated ${venue.rating.toFixed(1)} stars from ${venue.reviewCount} reviews. Click to view reviews.`}
              >
                <div className="flex items-center text-marigold">
                  <Star size={15} className="fill-marigold" />
                </div>
                <span className="font-bold text-ink">
                  {venue.rating > 0 ? venue.rating.toFixed(1) : 'New'}
                </span>
                <span className="text-on-surface-variant group-hover:underline underline-offset-2">
                  ({venue.reviewCount} {venue.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </button>

              <span className="text-ink/20">|</span>

              {/* Location (Fix 3) */}
              <div className="inline-flex items-center gap-1.5 text-on-surface-variant">
                <MapPin size={15} className="text-pitch shrink-0" />
                <span>{venue.district}, {venue.city}</span>
                {venue.latitude && venue.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-pitch hover:underline text-xs inline-flex items-center gap-0.5 font-medium"
                    title="View on Google Maps"
                  >
                    (Map)
                  </a>
                )}
              </div>

              <span className="text-ink/20">|</span>

              {/* Price preview chip (Fix 13, 14) */}
              <div className="inline-flex items-center gap-1 font-semibold text-pitch">
                <span>From</span>
                <span className="font-bold text-ink">{currencySymbol}{activePrice}</span>
                <span className="text-on-surface-variant font-normal">/ {unitLabel}</span>
              </div>
            </div>
          </header>

          {/* ── Product Imagery System (Fix 1, Fix 2) ────────────────────────── */}
          <div className="relative">
            {imageCount === 0 ? (
              <div className="h-[280px] sm:h-[400px] rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-pitch/5 via-mist to-marigold/10 flex flex-col items-center justify-center border border-ink/8 p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-chalk shadow-sm flex items-center justify-center text-pitch/60 mb-3">
                  <Layers size={24} />
                </div>
                <h3 className="font-display text-base font-bold text-ink mb-1">Photography in Progress</h3>
                <p className="font-sans text-xs text-on-surface-variant max-w-sm">
                  Verified photos of {venue.name} will be uploaded soon. The venue details and amenities below are confirmed by venue staff.
                </p>
              </div>
            ) : imageCount === 1 ? (
              <div
                className="h-[300px] sm:h-[420px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-ink/10 relative group cursor-pointer bg-mist"
                role="button"
                tabIndex={0}
                aria-label={`Open photo of ${venue.name} in zoom mode`}
                onClick={() => openLightbox(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLightbox(0);
                  }
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="w-full h-full relative"
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[0]}
                    alt={`${venue.name} — Main photography`}
                    referrerPolicy="no-referrer"
                  />
                  {/* Overlay zoom badge with guaranteed contrast (Fix 1) */}
                  <div className="absolute inset-0 bg-ink/10 group-hover:bg-ink/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                    <div className="bg-pitch/90 text-chalk backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg border border-chalk/10">
                      <Maximize2 size={14} className="text-marigold" />
                      <span>Click to open in zoom mode</span>
                    </div>
                  </div>
                  {/* Subtle persistent pill in corner for touch/mobile (Fix 1) */}
                  <div className="absolute bottom-3 right-3 z-20 bg-chalk/90 text-ink backdrop-blur-md px-3 py-1.5 rounded-xl text-2xs font-semibold shadow-md border border-ink/10 sm:hidden">
                    Tap to expand
                  </div>
                </motion.div>
              </div>
            ) : imageCount === 2 ? (
              <div className="grid grid-cols-2 gap-3 h-[300px] sm:h-[420px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-ink/10 relative bg-mist">
                <motion.div
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="relative overflow-hidden group cursor-pointer h-full"
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo 1 of ${venue.name} in zoom mode`}
                  onClick={() => openLightbox(0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(0);
                    }
                  }}
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[0]}
                    alt={`${venue.name} — Main field view`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-ink/10 group-hover:bg-ink/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                    <div className="bg-pitch/90 text-chalk backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg border border-chalk/10">
                      <Maximize2 size={13} className="text-marigold" />
                      <span>Zoom photo</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.015 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="relative overflow-hidden group cursor-pointer h-full"
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo 2 of ${venue.name} in zoom mode`}
                  onClick={() => openLightbox(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(1);
                    }
                  }}
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[1]}
                    alt={`${venue.name} — Playing surface and facility view`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-ink/10 group-hover:bg-ink/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                    <div className="bg-pitch/90 text-chalk backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg border border-chalk/10">
                      <Maximize2 size={13} className="text-marigold" />
                      <span>Zoom photo</span>
                    </div>
                  </div>
                </motion.div>

                {/* Floating explore button with guaranteed contrast container (Fix 1) */}
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  aria-label="Explore all 2 photos in zoom mode"
                  className="absolute bottom-3.5 right-3.5 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-chalk/95 hover:bg-chalk text-ink backdrop-blur-md shadow-md border border-ink/10 text-xs font-semibold tracking-wide transition-all cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-pitch/30"
                >
                  <Layers size={14} className="text-pitch" />
                  <span>Explore Photos (2)</span>
                </button>
              </div>
            ) : (
              /* 3+ Photos Gallery (Fix 1, Fix 2) */
              <div className="grid grid-cols-4 grid-rows-2 gap-2.5 sm:gap-3 h-[300px] sm:h-[430px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm border border-ink/10 relative bg-mist">
                {/* Main Large Photo */}
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="col-span-3 row-span-2 relative overflow-hidden group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`View main photo of ${venue.name} in zoom mode`}
                  onClick={() => openLightbox(0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(0);
                    }
                  }}
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[0]}
                    alt={`${venue.name} — Main arena and pitch overview`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-ink/10 group-hover:bg-ink/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                    <div className="bg-pitch/90 text-chalk backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg border border-chalk/10">
                      <Maximize2 size={15} className="text-marigold" />
                      <span>Click to open in zoom mode</span>
                    </div>
                  </div>
                </motion.div>

                {/* Thumbnail 1 */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="col-span-1 row-span-1 relative overflow-hidden group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo 2 of ${venue.name} in zoom mode`}
                  onClick={() => openLightbox(1)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(1);
                    }
                  }}
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[1]}
                    alt={`${venue.name} — Facility exterior and seating area`}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                    <Maximize2 size={18} className="text-chalk drop-shadow" />
                  </div>
                </motion.div>

                {/* Thumbnail 2 or +N overlay badge */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="col-span-1 row-span-1 relative overflow-hidden group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`View photo 3 of ${venue.name} in zoom mode`}
                  onClick={() => openLightbox(2)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox(2);
                    }
                  }}
                >
                  <SafeImage
                    className="w-full h-full object-cover"
                    src={galleryImages[2]}
                    alt={`${venue.name} — Pitch lighting and turf details`}
                    referrerPolicy="no-referrer"
                  />
                  {imageCount > 3 ? (
                    <div
                      className="absolute inset-0 bg-ink/40 group-hover:bg-ink/55 flex items-center justify-center transition-colors ease-out"
                      role="button"
                      tabIndex={0}
                      aria-label={`View remaining ${imageCount - 3} photos`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox(3);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          openLightbox(3);
                        }
                      }}
                    >
                      <div className="bg-chalk/95 group-hover:bg-chalk text-ink backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-ink/10 flex items-center gap-1.5 transition-transform group-hover:scale-105">
                        <Layers size={13} className="text-pitch" />
                        <span className="font-sans text-xs font-bold">+{imageCount - 3} Photos</span>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 pointer-events-none">
                      <Maximize2 size={18} className="text-chalk drop-shadow" />
                    </div>
                  )}
                </motion.div>

                {/* Floating explore button with guaranteed contrast (Fix 1) */}
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  aria-label={`Explore all ${imageCount} photos in zoom mode`}
                  className="absolute bottom-3.5 right-3.5 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-chalk/95 hover:bg-chalk text-ink backdrop-blur-md shadow-md border border-ink/10 text-xs font-semibold tracking-wide transition-all cursor-pointer hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-pitch/30"
                >
                  <Layers size={14} className="text-pitch" />
                  <span>Explore all {imageCount} photos</span>
                </button>
              </div>
            )}
          </div>

          {/* ── ENHANCEMENT 1: Scrollable Details Card Surface ───────────────── */}
          <div className="bg-chalk rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-ink/8 shadow-xs space-y-8">

            {/* ── About the Venue (Fix 8, Fix 11) ──────────────────────────── */}
            <section className="space-y-3">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                About the Venue
              </h2>
              <div className="font-sans text-sm sm:text-base text-on-surface-variant leading-relaxed max-w-3xl space-y-3">
                <p>{venue.description}</p>
              </div>
            </section>

            {/* ── Video Tour Section (if available) ────────────────────────── */}
            {videoMedia.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-ink/8">
                <FadeInWhenVisible>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                    <Play size={20} className="text-pitch" />
                    <span>Video Tour & Walkthrough</span>
                  </h2>
                </FadeInWhenVisible>
                <div className="grid grid-cols-1 gap-4">
                  {videoMedia.map((vItem: any, idx: number) => {
                    const isYt = vItem.url.includes('youtube.com') || vItem.url.includes('youtu.be');
                    const isVimeo = vItem.url.includes('vimeo.com');
                    let embedUrl = vItem.url;
                    if (isYt) {
                      const videoId = vItem.url.includes('youtu.be/')
                        ? vItem.url.split('youtu.be/')[1]?.split('?')[0]
                        : new URLSearchParams(vItem.url.split('?')[1] || '').get('v');
                      embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : vItem.url;
                    } else if (isVimeo) {
                      const vimeoId = vItem.url.split('/').filter(Boolean).pop();
                      embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
                    }
                    return (
                      <div
                        key={idx}
                        className="rounded-2xl overflow-hidden shadow-sm border border-ink/10 bg-black aspect-video max-h-[420px]"
                      >
                        {isYt || isVimeo ? (
                          <iframe
                            src={embedUrl}
                            title={`${venue.name} Video Tour`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            controls
                            src={vItem.url}
                            poster={vItem.thumbnail_url || undefined}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Custom Content Blocks (Highlights, FAQ, Rules, Checklist) ── */}
            {contentBlocks.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-ink/8">
                {contentBlocks.map((block: any, bIdx: number) => {
                  const rawType = (block.type || '').trim();
                  const blockType = rawType.toLowerCase();
                  
                  const settingsItems: any[] = Array.isArray(block.settings?.items)
                    ? block.settings.items
                    : Array.isArray(block.settings?.highlights)
                    ? block.settings.highlights
                    : [];

                  const isFaq = blockType === 'faq' || blockType.includes('question');
                  const faqItems = isFaq
                    ? settingsItems.filter((it: any) => typeof it === 'object' && it !== null && (it.q || it.question))
                    : [];

                  const textItems = settingsItems.filter((it: any) => typeof it === 'string' && it.trim());

                  return (
                    <FadeInWhenVisible key={bIdx} delay={bIdx * 0.04}>
                      <div className="bg-mist/50 p-5 sm:p-6 rounded-2xl border border-ink/8 space-y-3">
                        <h3 className="font-sans text-base font-bold text-ink flex items-center gap-2">
                          {(blockType.includes('highlight') || blockType.includes('feature')) && (
                            <Sparkles size={18} className="text-pitch" />
                          )}
                          {(blockType.includes('rule') || blockType.includes('policy')) && (
                            <FileText size={18} className="text-pitch" />
                          )}
                          {isFaq && (
                            <HelpCircle size={18} className="text-pitch" />
                          )}
                          {(blockType.includes('purpose') || blockType.includes('suitable')) && (
                            <Users size={18} className="text-pitch" />
                          )}
                          {(blockType.includes('checklist') || blockType.includes('things to know')) && (
                            <CheckCircle size={18} className="text-pitch" />
                          )}
                          {!['highlight', 'feature', 'rule', 'policy', 'faq', 'question', 'purpose', 'suitable', 'checklist', 'things to know'].some(t => blockType.includes(t)) && (
                            <Layers size={18} className="text-pitch" />
                          )}
                          <span>{block.title || rawType}</span>
                        </h3>

                        {block.body && (
                          <p className="font-sans text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                            {block.body}
                          </p>
                        )}

                        {/* FAQ Q&A rendering */}
                        {isFaq && faqItems.length > 0 && (
                          <div className="space-y-2.5 pt-1">
                            {faqItems.map((item: any, qIdx: number) => (
                              <div key={qIdx} className="bg-chalk p-3.5 rounded-xl border border-ink/5 space-y-1">
                                <p className="font-sans text-xs sm:text-sm font-semibold text-ink flex items-start gap-2">
                                  <span className="text-pitch font-bold">Q:</span>
                                  <span>{item.q || item.question}</span>
                                </p>
                                <p className="font-sans text-xs sm:text-sm text-on-surface-variant pl-5">
                                  {item.a || item.answer}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* String items rendering (Highlights, Rules, Checklist, Suitable For) */}
                        {textItems.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {textItems.map((item: string, hIdx: number) => (
                              <div
                                key={hIdx}
                                className="flex items-center gap-2 text-xs font-sans text-ink bg-chalk px-3 py-2 rounded-xl border border-ink/5"
                              >
                                <Check size={14} className="text-pitch shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </FadeInWhenVisible>
                  );
                })}
              </section>
            )}

            {/* ── Rental Options & Pricing Rates ─────────────────────────────── */}
            {venue.rentalOptions && venue.rentalOptions.length > 0 && (
              <section className="space-y-4 pt-6 border-t border-ink/8">
                <FadeInWhenVisible>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                      Rental Options &amp; Rates
                    </h2>
                    <span className="text-xs font-sans text-on-surface-variant">
                      {venue.rentalOptions.length} available {venue.rentalOptions.length === 1 ? 'mode' : 'modes'}
                    </span>
                  </div>
                </FadeInWhenVisible>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {venue.rentalOptions.map((opt: any, idx: number) => {
                    const modeLabel = opt.mode === 'hour' ? 'Hourly Rental' : opt.mode === 'half_day' ? 'Half Day' : opt.mode === 'full_day' ? 'Full Day' : opt.mode;
                    return (
                      <div key={idx} className="bg-mist/50 p-4 rounded-xl border border-ink/8 flex flex-col justify-between space-y-2">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-pitch bg-pitch/10 px-2.5 py-0.5 rounded-full">
                              {modeLabel}
                            </span>
                            <span className="font-sans text-base font-bold text-ink">
                              {currencySymbol}{opt.price}
                              <span className="text-xs font-normal text-on-surface-variant">
                                /{opt.mode === 'hour' ? 'hr' : opt.mode === 'half_day' ? 'half-day' : 'day'}
                              </span>
                            </span>
                          </div>
                          {opt.weekend_price && (
                            <p className="text-xs text-on-surface-variant mt-1.5 font-medium">
                              Weekend rate: {currencySymbol}{opt.weekend_price}
                            </p>
                          )}
                        </div>
                        {opt.note && (
                          <p className="text-xs text-on-surface-variant font-sans border-t border-ink/5 pt-2 italic">
                            {opt.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Venue Amenities (Fix 10, Fix 11) ─────────────────────────── */}
            <section className="space-y-4 pt-6 border-t border-ink/8">
              <FadeInWhenVisible>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                    Venue Amenities
                  </h2>
                  <span className="text-xs font-sans text-on-surface-variant">
                    {parsedAmenities.length} facilities available
                  </span>
                </div>
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
                      <FadeInWhenVisible key={amenity + index} delay={index * 0.02}>
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-mist/50 border border-ink/8 hover:border-pitch/30 hover:bg-mist transition-all duration-200">
                          <div className="w-9 h-9 rounded-xl bg-pitch/8 flex items-center justify-center shrink-0 text-pitch">
                            <Icon size={18} />
                          </div>
                          <span className="font-sans text-xs sm:text-sm font-semibold text-ink leading-tight">
                            {amenity}
                          </span>
                        </div>
                      </FadeInWhenVisible>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── House Rules & Cancellation (Fix 11) ───────────────────────── */}
            {((venue.rules && venue.rules.length > 0) || venue.cancellationPolicy) && (
              <section className="space-y-4 pt-6 border-t border-ink/8">
                <FadeInWhenVisible>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                    House Rules &amp; Cancellation Policy
                  </h2>
                </FadeInWhenVisible>

                <div className="space-y-3">
                  {venue.cancellationPolicy && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
                      <ShieldCheck size={20} className="text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-emerald-950">
                          {venue.cancellationPolicy} Cancellation Guarantee
                        </h4>
                        <p className="text-xs text-emerald-900/80 mt-0.5 leading-relaxed">
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
                    <div className="bg-mist/50 p-4 rounded-2xl border border-ink/8 space-y-2">
                      <h4 className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-2">
                        <FileText size={15} className="text-pitch" />
                        <span>Space Guidelines</span>
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

            {/* ── Reviews Section (Fix 9, Fix 11) ──────────────────────────── */}
            <section ref={reviewsSectionRef} id="reviews-section" className="space-y-5 pt-6 border-t border-ink/8">
              <FadeInWhenVisible>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                      Customer Reviews
                    </h2>
                    <div className="flex items-center gap-2 mt-1 font-sans text-xs sm:text-sm text-on-surface-variant">
                      <div className="flex items-center text-marigold">
                        <Star size={15} className="fill-marigold" />
                      </div>
                      <span className="font-bold text-ink">
                        {venue.rating > 0 ? venue.rating.toFixed(1) : 'New'}
                      </span>
                      <span>·</span>
                      <span>{venue.reviewCount} total customer ratings</span>
                    </div>
                  </div>
                </div>
              </FadeInWhenVisible>

              {user ? (
                <FadeInWhenVisible>
                  <form
                    onSubmit={handleSubmitReview}
                    className="bg-mist/40 rounded-2xl border border-ink/8 p-5 space-y-3"
                  >
                    <p className="font-sans text-sm font-bold text-ink">Write a Review</p>
                    <StarRatingInput value={reviewRating} onChange={setReviewRating} />
                    <textarea
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      required
                      placeholder="Share your experience with this ground, pitch condition, or amenities…"
                      rows={3}
                      className="w-full rounded-xl border border-ink/10 bg-chalk px-4 py-2.5 text-sm font-sans text-ink focus:outline-none focus:ring-2 focus:ring-pitch/20 resize-none"
                    />
                    {reviewError && (
                      <p className="text-xs text-clay flex items-center gap-1.5 font-medium">
                        <X size={14} />
                        {reviewError}
                      </p>
                    )}
                    {reviewSuccess && (
                      <p className="text-xs text-pitch flex items-center gap-1.5 font-medium">
                        <CheckCircle size={14} /> Review submitted successfully!
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={createReview.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-pitch hover:bg-[#124230] text-chalk text-xs sm:text-sm font-semibold rounded-xl transition active:scale-95 disabled:opacity-60 cursor-pointer ease-out"
                    >
                      {createReview.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      <span>Submit Review</span>
                    </button>
                  </form>
                </FadeInWhenVisible>
              ) : (
                <FadeInWhenVisible>
                  <div className="bg-mist/40 rounded-2xl p-5 text-center space-y-2 border border-ink/8">
                    <p className="font-sans text-xs sm:text-sm text-on-surface-variant">
                      Played here recently? Log in to leave a verified rating and review.
                    </p>
                    <button
                      onClick={onRequestAuth}
                      className="px-5 py-2 bg-pitch hover:bg-[#124230] text-chalk text-xs sm:text-sm font-semibold rounded-full shadow-xs inline-flex items-center gap-2 cursor-pointer ease-out transition-all"
                    >
                      Log In to Review
                    </button>
                  </div>
                </FadeInWhenVisible>
              )}

              {/* Review cards */}
              {reviewsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2].map((skeleton) => (
                    <div key={skeleton} className="bg-mist/30 rounded-2xl p-4 animate-pulse space-y-3 border border-ink/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-ink/10 rounded-full" />
                        <div className="flex flex-col gap-1.5 flex-1">
                          <div className="w-24 h-3 bg-ink/10 rounded-full" />
                          <div className="w-16 h-2 bg-ink/10 rounded-full" />
                        </div>
                      </div>
                      <div className="w-full h-10 bg-ink/10 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-xs sm:text-sm text-on-surface-variant italic text-center py-4">
                  No written reviews yet. Be the first to share your experience at {venue.name}!
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {reviews.map((review, index) => {
                    const initials = review.user_name
                      .split(' ')
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const isAdmin = user?.role === 'admin';
                    return (
                      <FadeInWhenVisible key={review.id} delay={index * 0.05}>
                        <div className="bg-mist/30 p-4 sm:p-5 rounded-2xl border border-ink/8 hover:border-pitch/20 transition duration-200 relative group">
                          {isAdmin && (
                            <button
                              onClick={() => deleteReview.mutate({ reviewId: review.id, venueId: venue.id })}
                              disabled={deleteReview.isPending}
                              title="Remove review"
                              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-clay hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="w-9 h-9 rounded-full bg-pitch text-chalk flex items-center justify-center font-sans font-bold text-xs shadow-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-sans text-xs sm:text-sm font-bold text-ink">
                                {review.user_name}
                              </p>
                              <div className="flex text-marigold">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    size={12}
                                    className={i < review.rating ? 'fill-marigold text-marigold' : 'text-ink/15'}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <p className="font-sans text-xs sm:text-sm text-on-surface-variant leading-relaxed">
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
        </div>

        {/* ── RIGHT COLUMN: Primary Booking & Purchase Controls (Fix 13, 14, 15) ─ */}
        <div ref={bookingCardRef} id="booking-card" className="lg:col-span-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="lg:sticky lg:top-[85px] lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto bg-chalk rounded-2xl sm:rounded-3xl shadow-lg border border-ink/10 custom-scrollbar overscroll-contain"
            data-lenis-prevent
          >
            {/* Price Header (Fix 4, Fix 13, Fix 14) */}
            <div className="bg-pitch p-5 sm:p-6 text-chalk">
              <div className="flex justify-between items-end">
                <div>
                  <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                    {currencySymbol}{activePrice}
                  </div>
                  <div className="font-sans text-xs text-chalk/80 mt-0.5">
                    per {unitLabel}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-marigold bg-chalk/10 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-chalk/10">
                  <Star size={14} className="fill-marigold" />
                  <span className="font-sans text-xs sm:text-sm font-bold text-chalk">
                    {venue.rating > 0 ? venue.rating.toFixed(1) : 'New'}
                  </span>
                  <span className="font-sans text-2xs text-chalk/70">
                    ({venue.reviewCount})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Event Purpose Selector (if applicable) */}
              {approvedPurposes.length > 0 && (
                <div>
                  <label className="block font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Hosting Purpose
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {approvedPurposes.map((p: any) => {
                      const isSelected = p.id === selectedPurpose?.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPurposeId(p.id);
                            setSelectedSlotId(null);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-pitch text-chalk shadow-xs'
                              : 'bg-mist text-ink hover:bg-ink/5 border border-ink/8'
                          }`}
                        >
                          {p.name || p.custom_name}
                        </button>
                      );
                    })}
                  </div>
                  {selectedPurpose && (
                    <div className="mt-2.5 p-3 rounded-xl bg-mist/60 border border-ink/8 text-xs text-on-surface-variant space-y-1">
                      {selectedPurpose.description && (
                        <p className="text-ink font-medium leading-relaxed">{selectedPurpose.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 pt-0.5 text-2xs">
                        {selectedPurpose.max_guests && (
                          <span className="inline-flex items-center gap-1 font-semibold text-pitch">
                            <Users size={12} /> Max {selectedPurpose.max_guests} guests
                          </span>
                        )}
                        {selectedPurpose.price_override && Number(selectedPurpose.price_override) > 0 && (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            Custom rate: ₹{selectedPurpose.price_override}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rental Duration Mode Selector (Fix 14) */}
              {availableModes.length > 1 && (
                <div>
                  <label className="block font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Rental Duration
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableModes.map((mode) => {
                      const isSelected = selectedRentalMode === mode;
                      const label = mode === 'hour' ? 'Hourly' : mode === 'half_day' ? 'Half Day' : 'Full Day';
                      let modePrice = venue.basePrice;
                      if (selectedPurpose?.price_override && Number(selectedPurpose.price_override) > 0) {
                        modePrice = Number(selectedPurpose.price_override);
                      } else if (venue.rentalOptions) {
                        const opt = venue.rentalOptions.find((o: any) => o.mode === mode);
                        if (opt && Number(opt.price) > 0) modePrice = Number(opt.price);
                      }
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            setSelectedRentalMode(mode);
                            setSelectedSlotId(null);
                            if (mode !== 'hour') setDurationQuantity(1);
                          }}
                          className={`py-2 px-1.5 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-pitch text-chalk shadow-xs ring-2 ring-pitch/20'
                              : 'bg-mist text-ink hover:bg-ink/5 border border-ink/8'
                          }`}
                        >
                          <div>{label}</div>
                          <div className="text-2xs opacity-80 mt-0.5 font-normal">₹{modePrice}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ENHANCEMENT 3: Predefined Duration & Quantity Presets ───── */}
              {selectedRentalMode === 'hour' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      Booking Duration
                    </label>
                    <span className="text-2xs text-pitch font-semibold">
                      {durationQuantity} {durationQuantity === 1 ? 'hour' : 'hours'} selected
                    </span>
                  </div>

                  {/* Preset chips */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                    {hourlyPresets.map((hrs) => {
                      const isSelected = durationQuantity === hrs;
                      return (
                        <button
                          key={hrs}
                          type="button"
                          onClick={() => setDurationQuantity(hrs)}
                          className={`py-2 px-1 rounded-xl text-xs font-semibold text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-pitch text-chalk shadow-xs font-bold'
                              : 'bg-mist text-ink hover:bg-ink/5 border border-ink/8'
                          }`}
                        >
                          {hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quantity stepper for custom hours (Fix 14, Fix 15) */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-mist/50 border border-ink/8">
                    <span className="text-xs font-medium text-ink">Custom hours:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDurationQuantity((prev) => Math.max(1, prev - 1))}
                        disabled={durationQuantity <= 1}
                        aria-label="Decrease hours"
                        className="w-7 h-7 rounded-lg bg-chalk border border-ink/10 flex items-center justify-center text-ink hover:bg-mist disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="font-mono text-xs font-bold text-ink w-8 text-center">
                        {durationQuantity}h
                      </span>
                      <button
                        type="button"
                        onClick={() => setDurationQuantity((prev) => Math.min(12, prev + 1))}
                        disabled={durationQuantity >= 12}
                        aria-label="Increase hours"
                        className="w-7 h-7 rounded-lg bg-chalk border border-ink/10 flex items-center justify-center text-ink hover:bg-mist disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step indicator guidance for first-time bookers */}
              <div className="bg-pitch/5 border border-pitch/10 rounded-xl p-3 flex items-start gap-2.5">
                <Sparkles size={16} className="text-pitch shrink-0 mt-0.5" />
                <div className="text-2xs text-on-surface-variant font-sans leading-relaxed">
                  <span className="font-semibold text-pitch block">How booking works:</span>
                  Step 1: Pick a date &nbsp;·&nbsp; Step 2: Select an available slot &nbsp;·&nbsp; Step 3: Confirm & pay
                </div>
              </div>

              {/* Availability Date Picker (GroundSelect) */}
              <div>
                <label className="block font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                  Select Date
                </label>
                <div className="relative">
                  {availableDates.length === 0 ? (
                    <div className="w-full bg-mist border border-ink/10 rounded-xl py-3 px-4 font-mono text-xs text-on-surface-variant">
                      No availability listed yet
                    </div>
                  ) : (
                    <GroundSelect
                      value={selectedDate}
                      onValueChange={(val) => {
                        setSelectedDate(val);
                        setSelectedSlotId(null);
                      }}
                      options={availableDates.map((d) => ({ value: d, label: `${d}` }))}
                      icon={<CalendarDays size={16} className="text-pitch" />}
                      triggerClassName="w-full py-2.5"
                    />
                  )}
                </div>
              </div>

              {/* Slot Selection Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Available Time Slots
                  </label>
                  {slotsForDate.length > 0 && (
                    <span className="text-2xs text-on-surface-variant">
                      {slotsForDate.filter((s) => s.isAvailable).length} open
                    </span>
                  )}
                </div>

                {slotsForDate.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-3 text-center italic bg-mist/40 rounded-xl border border-ink/5">
                    No time slots listed for this date yet.
                  </p>
                ) : (
                  <div
                    data-testid="time-slots-grid"
                    data-lenis-prevent
                    className="grid grid-cols-2 gap-2 max-h-[196px] overflow-y-auto pr-1.5 custom-scrollbar overscroll-contain"
                  >
                    {slotsForDate.map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      const isBooked = !slot.isAvailable;
                      const label = slot.startTime ? slot.startTime : 'Full day';

                      if (isBooked) {
                        return (
                          <button
                            key={slot.id}
                            disabled
                            aria-label={`${label} - Already Booked`}
                            className="py-2 px-3 rounded-xl text-xs font-mono font-medium text-center select-none bg-ink/5 text-ink/30 cursor-not-allowed border border-ink/5"
                          >
                            {label} (Booked)
                          </button>
                        );
                      }

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => handleSlotClick(slot)}
                          className={`py-2 px-3 rounded-xl text-xs font-mono font-semibold transition text-center select-none cursor-pointer ${
                            isSelected
                              ? 'bg-pitch text-chalk shadow-xs ring-2 ring-pitch/20'
                              : 'bg-mist text-ink hover:bg-ink/10 border border-ink/8'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total Price Summary & Breakdown (Fix 14) */}
              <div className="pt-3 border-t border-ink/8 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-on-surface-variant font-sans">
                  <span>
                    Rate ({selectedRentalMode === 'hour' ? `${currencySymbol}${activePrice} × ${durationQuantity}h` : unitLabel})
                  </span>
                  <span className="font-mono">{currencySymbol}{calculatedTotalPrice}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-ink font-sans pt-1">
                  <span>Estimated Total</span>
                  <span className="font-display text-lg text-pitch">{currencySymbol}{calculatedTotalPrice}</span>
                </div>
              </div>

              {/* Primary Action Button (Fix 15) */}
              {waitingBooking ? (
                <button
                  type="button"
                  onClick={onGoToBookings}
                  className="w-full font-sans text-sm font-bold py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 cursor-pointer transition-all bg-marigold hover:bg-yellow-500 text-ink shadow-sm active:scale-98"
                >
                  <Clock size={18} />
                  <span>Waiting (Check Status)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleBookNow}
                  disabled={venue.isFullyBookedToday || (!selectedSlotObj && slotsForDate.length === 0)}
                  className={`w-full font-sans text-sm font-bold py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 transition-all shadow-sm ${
                    venue.isFullyBookedToday || (!selectedSlotObj && slotsForDate.length === 0)
                      ? 'bg-mist text-on-surface-variant/50 border border-ink/10 cursor-not-allowed'
                      : 'bg-pitch hover:bg-[#124230] text-chalk active:scale-98 cursor-pointer'
                  }`}
                >
                  <span>
                    {venue.isFullyBookedToday
                      ? 'Fully Booked Today'
                      : selectedRentalMode === 'hour' && durationQuantity > 1
                      ? `Book ${durationQuantity} Hours · ${currencySymbol}${calculatedTotalPrice}`
                      : `Book Now · ${currencySymbol}${calculatedTotalPrice}`}
                  </span>
                </button>
              )}

              <p className="text-center font-sans text-2xs text-on-surface-variant">
                {waitingBooking
                  ? 'You have a pending reservation request for this space'
                  : 'You will review booking details before payment is confirmed'}
              </p>

              {/* Trust Assurances (Fix 10) */}
              <div className="space-y-2.5 pt-3 border-t border-ink/8">
                {[
                  { icon: CheckCircle, label: 'Instant slot reservation hold' },
                  { icon: ShieldCheck, label: 'Verified venue with secure offline payment' },
                  {
                    icon: Clock,
                    label:
                      venue.cancellationPolicy?.toLowerCase() === 'flexible'
                        ? 'Free cancellation up to 24h prior'
                        : venue.cancellationPolicy?.toLowerCase() === 'strict'
                        ? 'Strict cancellation policy applies'
                        : 'Free cancellation up to 48h prior',
                  },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 font-sans text-2xs text-on-surface-variant">
                      <Icon size={14} className="text-pitch shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      {/* ── ENHANCEMENT 2: Persistent Bottom Purchase Area ────────────────── */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-chalk/95 backdrop-blur-md border-t border-ink/10 shadow-2xl p-3 sm:px-6 lg:hidden"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-2xs font-semibold text-on-surface-variant truncate">
              <span>{selectedDate}</span>
              <span>·</span>
              <span className="truncate">
                {selectedSlotObj?.startTime || slotsForDate[0]?.startTime || 'Pick slot'}
              </span>
              {selectedRentalMode === 'hour' && (
                <>
                  <span>·</span>
                  <span>{durationQuantity}h</span>
                </>
              )}
            </div>
            <div className="font-display text-lg font-bold text-ink leading-tight">
              {currencySymbol}{calculatedTotalPrice}
              <span className="text-2xs font-sans font-normal text-on-surface-variant ml-1">
                {selectedRentalMode === 'hour' && durationQuantity > 1 ? `total` : `per ${unitLabel}`}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBookNow}
            disabled={venue.isFullyBookedToday || (!selectedSlotObj && slotsForDate.length === 0)}
            className={`px-5 py-3 rounded-xl font-sans text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 shrink-0 ${
              venue.isFullyBookedToday || (!selectedSlotObj && slotsForDate.length === 0)
                ? 'bg-mist text-on-surface-variant/50 cursor-not-allowed border border-ink/10'
                : 'bg-pitch hover:bg-[#124230] text-chalk cursor-pointer'
            }`}
          >
            {waitingBooking ? 'Check Status' : 'Book Now'}
          </button>
        </div>
      </div>

      {/* Photo Gallery Zoom & Exploration Lightbox */}
      <VenueImageLightbox
        isOpen={isLightboxOpen}
        images={galleryImages}
        initialIndex={lightboxIndex}
        venueName={venue.name}
        onClose={() => setIsLightboxOpen(false)}
      />
    </div>
  );
}
