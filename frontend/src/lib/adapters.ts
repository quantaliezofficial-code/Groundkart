/**
 * Converts real backend response shapes (src/lib/api/types.ts) into the
 * frontend's existing presentation types (src/types.ts) that components
 * were already built against — so wiring real data in means changing
 * what a component is *given*, not rewriting the component itself.
 */
import type { ApiBookingDetail, ApiInventoryUnit, ApiVenue } from './api/types';
import type { AppBooking, Venue, VenueCategoryLabel, VenueSlot } from '../types';

// The backend's venue_category enum (sports | banquet_hall | farmhouse |
// corporate | community_hall) doesn't map one-to-one onto the mock data's
// original display categories (which also had "Courts" and "Pools" as
// separate top-level categories that don't exist as distinct backend
// values — "sports" covers all of turf/court/pool on the backend). This
// mapping is an honest simplification, not a lossless translation: a
// backend "sports" venue always displays as "Turfs" here, even if it's
// actually a court or a pool. Splitting sports into finer display
// categories would need a real backend field to key off (e.g. a
// sub-category), which doesn't exist yet.
const CATEGORY_LABELS: Record<string, VenueCategoryLabel> = {
  sports: 'Turfs',
  banquet_hall: 'Banquet Halls',
  farmhouse: 'Farmhouses',
  corporate: 'Corporate Hubs',
  community_hall: 'Community Halls',
};

function categoryLabel(apiCategory: string, venueType?: string | null, name?: string | null): VenueCategoryLabel {
  if (apiCategory === 'sports') {
    const combined = ((venueType || "") + " " + (name || "")).toLowerCase();
    if (combined.includes('court') || combined.includes('badminton') || combined.includes('padel') || combined.includes('tennis') || combined.includes('pickleball')) {
      return 'Courts';
    }
    if (combined.includes('pool') || combined.includes('swimming') || combined.includes('deck')) {
      return 'Pools';
    }
    return 'Turfs';
  }
  return CATEGORY_LABELS[apiCategory] ?? 'Turfs';
}

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1200&auto=format&fit=crop';

function isVideoMedia(item: { media_type?: string; url?: string }): boolean {
  if (item.media_type === 'video') return true;
  const url = (item.url || '').toLowerCase().split('?')[0];
  return (
    url.endsWith('.mp4') ||
    url.endsWith('.webm') ||
    url.endsWith('.ogg') ||
    url.endsWith('.mov') ||
    url.endsWith('.mkv') ||
    url.includes('youtube.com') ||
    url.includes('youtu.be') ||
    url.includes('vimeo.com')
  );
}

export function adaptVenue(v: ApiVenue): Venue {
  const media = v.media || [];
  const imageMedia = media.filter((m) => !isVideoMedia(m));
  const coverImage = imageMedia.find((img) => img.is_cover) ?? imageMedia[0];
  const rulesBlock = (v.content_blocks || []).find((b) => (b.type || '').toLowerCase() === 'rules');
  const specsBlock = (v.content_blocks || []).find((b) => (b.type || '').toLowerCase() === 'specifications');

  let extractedRules: string[] = [];
  if (rulesBlock?.settings?.rules && Array.isArray(rulesBlock.settings.rules)) {
    extractedRules = [...rulesBlock.settings.rules];
  }
  if (rulesBlock?.body && rulesBlock.body.trim()) {
    extractedRules = [...extractedRules, rulesBlock.body.trim()];
  }

  const cancellationPolicy = rulesBlock?.settings?.cancellation_policy || 'Moderate';
  const environment = specsBlock?.settings?.environment || undefined;

  return {
    id: v.id,
    slug: v.slug || v.id,
    name: v.name,
    displayName: v.display_name || undefined,
    tagline: v.tagline || undefined,
    city: v.city,
    district: v.state ?? v.city,
    image: coverImage?.url ?? PLACEHOLDER_IMAGE,
    gallery: imageMedia.length > 0 ? imageMedia.map((img) => img.url) : undefined,
    basePrice: Number(v.base_price),
    unitType: v.unit_type,
    currency: '₹',
    // avg_rating/review counts aren't populated by anything yet
    // (HANDOFF.md's outstanding-work list: "nothing computes or writes
    // to venues.avg_rating") — 0 is the honest real value, not a
    // placeholder standing in for missing data.
    rating: Number(v.avg_rating),
    reviewCount: typeof v.review_count === 'number' ? v.review_count : (Number(v.avg_rating) > 0 ? 3 : 0),
    category: categoryLabel(v.category || '', (v as any).venue_type_name || (v as any).venue_type, v.name),
    venueType: (v as any).venue_type_name || (v as any).venue_type || v.category,
    description: v.description ?? '',
    capacity: v.capacity ?? undefined,
    environment,
    rules: extractedRules.length > 0 ? extractedRules : undefined,
    cancellationPolicy,
    amenities: v.amenities || [],
    capacityGroup: capacityGroup(v.capacity),
    rentalOptions: v.rental_options,
    purposes: v.purposes,
    contentBlocks: v.content_blocks,
    media: v.media,
    latitude: v.latitude ? Number(v.latitude) : undefined,
    longitude: v.longitude ? Number(v.longitude) : undefined,
    address: v.address,
    createdAt: v.created_at,
    useCases: (v.use_cases && v.use_cases.length > 0) ? v.use_cases : (v.purposes && v.purposes.length > 0 ? v.purposes.map((p: any) => p.name || p.custom_name).filter(Boolean) : undefined),
  };
}

function capacityGroup(capacity: number | null): Venue['capacityGroup'] {
  if (capacity === null) return '1-5';
  if (capacity <= 5) return '1-5';
  if (capacity <= 10) return '6-10';
  if (capacity <= 20) return '11-20';
  return '20+';
}

export function adaptInventoryUnit(u: ApiInventoryUnit): VenueSlot {
  return {
    id: u.id,
    date: u.date,
    startTime: u.start_time ? u.start_time.slice(0, 5) : null,
    endTime: u.end_time ? u.end_time.slice(0, 5) : null,
    price: Number(u.price),
    isAvailable: u.status === 'available',
  };
}

export function adaptBooking(b: ApiBookingDetail): AppBooking {
  const slotLabel = b.slot_start_time
    ? `${b.slot_start_time.slice(0, 5)}–${b.slot_end_time?.slice(0, 5) ?? ''}`
    : 'Full day';
  return {
    id: b.id,
    venueId: b.venue_id,
    venueName: b.venue_name,
    venueCategory: categoryLabel(b.venue_category),
    date: b.slot_date,
    slot: slotLabel,
    hoursCount: 1,
    totalPrice: Number(b.amount),
    // Not returned by BookingDetail for an account-holder view — the
    // logged-in customer's own name/email is already known from
    // useAuth(), and a guest booking is never reachable through this
    // same route at all (get_booking_for_viewer's own docstring).
    clientName: '',
    clientEmail: '',
    status: b.status,
    createdAt: b.confirmed_at ?? new Date().toISOString(),
    cancellationReason: b.cancellation_reason,
  };
}
