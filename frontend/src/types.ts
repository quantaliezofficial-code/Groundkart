// Presentation-shaped types the existing components were already built
// against — kept stable so component JSX/props don't need a rewrite.
// src/lib/adapters.ts converts real backend responses (src/lib/api/types.ts)
// into these shapes. Two fields are deliberately NOT kept as they were,
// both flagged in HANDOFF.md §3 as needing reconciliation before Phase D
// could wire anything real:
//
// - AppBooking.status used to be 'pending' | 'approved' | 'declined' |
//   'cancelled' — the pre-decisions, owner-approval-model enum. Now the
//   real backend enum (booking_status): pending_payment | confirmed |
//   cancelled | completed | expired | refunded.
// - BookingState/AppBooking.paymentMethod used to be 'razorpay' |
//   'pay_at_venue' — Razorpay was never built and was explicitly dropped
//   (PHASE_C6_SUMMARY.md): payment is confirmed offline by an admin.
//   Removed rather than reconciled to a new value, since there's no
//   payment *method* choice for the customer to make anymore at all.

export interface Review {
  id: string;
  authorName: string;
  role: string;
  rating: number;
  content: string;
  avatarInitials: string;
}

export type VenueCategoryLabel =
  | 'Turfs'
  | 'Banquet Halls'
  | 'Courts'
  | 'Pools'
  | 'Farmhouses'
  | 'Corporate Hubs'
  | 'Community Halls';

// hour | half_day | full_day — mirrors the real backend's unit_type
// exactly (renamed from the old implicit "always hourly" assumption).
export type UnitType = 'hour' | 'half_day' | 'full_day';

export interface Venue {
  id: string;
  name: string;
  city: string;
  district: string;
  distanceKm?: number;
  image: string;
  gallery?: string[];
  /** The price for one unit of unitType (an hour, a half day, or a full day) — not always "per hour" despite the field name kept for component compatibility. */
  pricePerHour: number;
  unitType: UnitType;
  currency: string;
  rating: number;
  reviewCount: number;
  category: VenueCategoryLabel;
  sportType: string;
  description: string;
  rules?: string[];
  amenities: {
    freeParking: boolean;
    floodlights: boolean;
    airConditioning: boolean;
    lockerRooms: boolean;
    highSpeedWifi: boolean;
    climateControl: boolean;
    fifaCertified: boolean;
    stadiumLighting: boolean;
  };
  capacityGroup: '1-5' | '6-10' | '11-20' | '20+';
  isFullyBookedToday?: boolean;
  isFastFill?: boolean;
}

/** One real, bookable slot for a venue — a date+time-range the customer can actually pick, sourced from the real inventory_units list. */
export interface VenueSlot {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM, null for half_day/full_day units
  endTime: string | null;
  price: number;
  isAvailable: boolean;
}

export interface BookingState {
  venueId: string;
  date: string;
  selectedSlots: string[];
  hoursCount: number;
  basePrice: number;
  totalPrice: number;
}

// The real backend's booking_status enum, verbatim — see the module
// comment above for what this replaced.
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'expired' | 'refunded';

export type RefundTier = 'full_refund' | 'partial_refund' | 'no_refund';

export interface AppBooking {
  id: string;
  venueId: string;
  venueName: string;
  venueCategory: string;
  date: string;
  slot: string;
  hoursCount: number;
  totalPrice: number;
  clientName: string;
  clientEmail: string;
  status: BookingStatus;
  createdAt: string;
  cancellationReason: string | null;
  /** Only populated once a cancellation has actually happened. */
  refundAmount?: number;
  refundTier?: RefundTier;
}
