/**
 * Types matching the backend's actual Pydantic response shapes exactly
 * (see backend/app/schemas/*.py) — kept separate from src/types.ts, which
 * holds the frontend's own presentation-shaped types that components
 * were already built against. src/lib/adapters.ts converts between the
 * two, so a component never has to know which backend field name maps to
 * which prop.
 */

export type UserRole = 'customer' | 'owner' | 'admin';

export interface UserMe {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
}

export interface AccessTokenResponse {
  access_token: string;
}

export interface SignupResponse {
  id: string;
  email: string;
}

// venue_status: draft | pending_review | active | suspended
export type VenueStatus = 'draft' | 'pending_review' | 'active' | 'suspended';
export type UnitType = 'hour' | 'half_day' | 'full_day';

export interface VenueImage {
  id: string;
  url: string;
  storage_key?: string | null;
  media_type?: 'image' | 'video';
  thumbnail_url?: string | null;
  is_cover: boolean;
  sort_order: number;
}

export interface VenueContentBlock {
  id: string;
  venue_id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  media_reference: string | null;
  settings: Record<string, any> | null;
  sort_order: number;
  enabled: boolean;
}

export interface ApiVenue {
  id: string;
  owner_id: string;
  name: string;
  display_name: string | null;
  tagline: string | null;
  slug: string;
  category?: string;
  category_id?: string;
  venue_type_id?: string;
  venue_type_name?: string | null;
  use_case_ids?: string[];
  use_cases?: string[];
  description: string | null;
  address: string;
  city: string;
  state: string | null;
  pincode: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  capacity: number | null;
  unit_type: UnitType;
  base_price: string; // Decimal serializes as a string
  status: VenueStatus;
  rejection_reason: string | null;
  suspension_reason: string | null;
  avg_rating: string;
  review_count?: number;
  media: VenueImage[];
  content_blocks: VenueContentBlock[];
  amenities: string[];
  rental_options?: VenueRentalOption[];
  purposes?: VenuePurpose[];
  created_at: string;
}

export interface VenueListResponse {
  data: ApiVenue[];
  total: number;
  limit: number;
  offset: number;
}

export interface VenueCreateRequest {
  name: string;
  display_name?: string;
  tagline?: string;
  category?: string;
  category_id?: string;
  venue_type_id?: string;
  use_case_ids?: string[];
  address: string;
  city: string;
  unit_type: UnitType;
  base_price: string;
  description?: string;
  state?: string;
  pincode?: string;
  capacity?: number;
  amenity_names?: string[];
  content_blocks?: Omit<VenueContentBlock, 'id' | 'venue_id'>[];
  status?: VenueStatus;
  save_as_draft?: boolean;
}

// Every field optional — PATCH semantics (backend/app/schemas/catalog.py's
// VenueUpdateRequest). Only send the fields that actually changed.
export type VenueUpdateRequest = Partial<VenueCreateRequest> & { status?: VenueStatus };

export interface InventoryUnitCreateRequest {
  date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM, required for unit_type 'hour', omitted otherwise
  end_time?: string;
  price?: string; // defaults to the venue's base_price server-side if omitted
}

// inventory_status: available | held | booked
export type InventoryUnitStatus = 'available' | 'held' | 'booked';

export interface ApiInventoryUnit {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM:SS, null for half_day/full_day
  end_time: string | null;
  price: string;
  status: InventoryUnitStatus;
}

// booking_status: pending_payment | confirmed | cancelled | completed | expired | refunded
export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'expired' | 'refunded';

export interface BookingCreateRequest {
  inventory_unit_id: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  purpose_id?: string;
  rental_mode?: UnitType;
  guest_count?: number;
  customer_notes?: string;
}

export interface BookingCreateResponse {
  booking_id: string;
  amount: string;
  expires_in: number;
  manage_token: string | null;
}

export interface ApiBookingDetail {
  id: string;
  venue_id: string;
  venue_name: string;
  venue_category?: string;
  category_id?: string;
  venue_type_id?: string;
  use_case_ids?: string[];
  customer_name?: string;
  guest_name?: string;
  slot_date: string; // YYYY-MM-DD
  slot_start_time: string | null; // HH:MM:SS
  slot_end_time: string | null;
  purpose_id?: string | null;
  purpose_name?: string | null;
  rental_mode?: string | null;
  guest_count?: number | null;
  customer_notes?: string | null;
  user_email?: string | null;
  status: BookingStatus;
  amount: string;
  confirmed_at: string | null;
  grace_period_ends_at: string | null;
  cancellation_reason: string | null;
  // Added for the Admin dashboard's Bookings screen — null once
  // confirmed/cancelled (backend clears it on every terminal transition).
  hold_expires_at: string | null;
  created_at?: string;
}

export type ApiAdminBookingView = ApiBookingDetail;

// "full_refund" | "partial_refund" | "no_refund" — Decision Point C-7.
export type RefundTier = 'full_refund' | 'partial_refund' | 'no_refund';

export interface BookingCancelResponse {
  id: string;
  status: BookingStatus;
  cancellation_reason: string | null;
  refund_amount: string;
  refund_tier: RefundTier;
}

export interface ApiErrorBody {
  detail: string;
}

// verification_status: pending | approved | rejected
export type OwnerVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface ApiOwnerVerification {
  id: string;
  status: OwnerVerificationStatus;
  business_name: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// payout_status: pending | paid
export type PayoutStatus = 'pending' | 'paid';

export interface ApiPayout {
  id: string;
  owner_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;
  gross_amount: string;
  commission_amount: string;
  net_amount: string;
  status: PayoutStatus;
  paid_at: string | null;
}

export interface PayoutRunRequest {
  owner_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;
}

// ---------------------------------------------------------------------------
// Admin (backend/app/schemas/admin.py + the admin-prefixed routes in
// catalog.py/owner_verification.py/booking.py) — added while wiring
// AdminLayout.tsx, mirroring the ApiOwnerVerification/ApiPayout additions
// above from the Owner-dashboard slice.
// ---------------------------------------------------------------------------

// Shared by POST .../venues/{id}/suspend and .../users/{id}/suspend —
// structurally identical on the backend (backend/app/schemas/admin.py).
export interface SuspendRequest {
  reason: string;
}

export interface ApiAuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  // Free-form per action (backend/app/models/core.py's AuditLog) — no
  // schema enumerated per action type, so this stays a loose record rather
  // than a union of per-action shapes.
  extra_data: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminAuditLogParams {
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  date_from?: string; // ISO datetime (backend parses as datetime, not just date)
  date_to?: string;
  limit?: number;
  offset?: number;
}

// Deliberately not UserMeResponse — that schema has no suspended_at/
// suspension_reason fields at all (backend/app/schemas/admin.py's own
// docstring on AdminUserView).
export interface ApiAdminUserView {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  suspended_at: string | null;
  suspension_reason: string | null;
  created_at?: string;
}

export interface ApiPlatformOverview {
  total_bookings: number;
  bookings_by_status: Record<string, number>;
  gmv: string; // Decimal serializes as a string, same convention as base_price etc.
  total_commission_collected: string;
  active_venues: number;
  pending_venue_approvals: number;
  pending_owner_verifications: number;
}

export interface VenueRejectRequest {
  reason: string;
}

export interface RejectVerificationRequest {
  reason: string;
}

// POST /api/v1/admin/bookings/{id}/confirm-payment — amount is required and
// checked server-side against the booking's actual total (backend/app/
// schemas/booking.py's AdminConfirmPaymentRequest docstring): a typo here
// can't silently confirm a booking for the wrong amount.
export interface AdminConfirmPaymentRequest {
  amount: string | number;
  method: string;
  reference?: string;
  notes?: string;
}

export interface AdminCancelPendingBookingRequest {
  reason: string;
}

export interface AdminBookingsParams {
  status?: BookingStatus;
  venue_id?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface AdminPayoutsParams {
  status?: PayoutStatus;
  limit?: number;
  offset?: number;
}

// GET /api/v1/admin/payouts — same reasoning as ApiAdminVenueView above.
export interface ApiAdminPayoutView extends ApiPayout {
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  venue_name?: string;
  created_at?: string;
  pending_changes?: any;
  old?: any;
  new?: any;
}

export interface AdminVenuesParams {
  status?: VenueStatus;
  limit?: number;
  offset?: number;
}

// GET /api/v1/admin/venues — deliberately NOT ApiVenue (the public/owner
// shape), which has no owner_name/owner_email at all. See the backend's
// AdminVenueView docstring: those fields are admin-only, not a good fit
// for the shape GET /venues (public) also uses.
export interface ApiAdminVenueView extends ApiVenue {
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  pending_changes?: any;
  old?: any;
  new?: any;
}

// GET /api/v1/admin/owner-verifications — deliberately NOT
// ApiOwnerVerification (the "my own status" shape above), which has no
// user_id/document_url/applicant identity at all. See the backend's
// AdminOwnerVerificationView docstring for why surfacing identity here is
// fine — the document itself IS the applicant's identity proof, submitted
// specifically for an admin to review, unlike customer-identity-on-bookings.
export interface ApiAdminOwnerVerificationView {
  id: string;
  user_id: string;
  applicant_name: string;
  applicant_email: string;
  document_url: string;
  business_name: string | null;
  identification_type?: string | null;
  identification_number?: string | null;
  status: OwnerVerificationStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface ApiAdminReview {
  id: string;
  venue_id: string;
  booking_id: string | null;
  user_name: string;
  rating: number;
  content: string;
  created_at: string;
}

export interface AdminVerificationsParams {
  status?: OwnerVerificationStatus;
  limit?: number;
  offset?: number;
}

export interface AdminUsersParams {
  role?: UserRole;
  suspended?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Notifications — in-app only (see backend/app/models/core.py's
// Notification docstring for why: no email/SMS delivery exists in this
// sandbox). Any authenticated user (owner, admin, or customer) has these;
// always scoped to the caller, no admin override to see someone else's.
// ---------------------------------------------------------------------------

export interface ApiNotification {
  id: string;
  type: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsParams {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}


export interface ApiHomepagePlacement {
  id: string;
  venue_id: string;
  section: string;
  enabled: boolean;
  priority: number;
  badge: string | null;
  custom_title: string | null;
  custom_description: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  venue: {
    id: string;
    name: string;
    slug: string;
    status: string;
    cover_image_url: string | null;
  };
}

export interface ApiHomepageVenueCard {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  city: string;
  avg_rating: number;
  starting_price: number;
  price_unit: string;
  cover_image_url: string | null;
  badge: string | null;
  custom_title: string | null;
  custom_description: string | null;
}

export interface ApiHomepageResponse {
  featured: ApiHomepageVenueCard[];
  trending: ApiHomepageVenueCard[];
  popular: ApiHomepageVenueCard[];
  recommended: ApiHomepageVenueCard[];
  new: ApiHomepageVenueCard[];
}

export interface ApiSupportTicket {
  id: string;
  ticket_number: string;
  creator_id: string;
  subject: string;
  category?: string;
  category_id?: string;
  venue_type_id?: string;
  use_case_ids?: string[];
  priority: string;
  status: string;
  created_at: string;
}

export interface ApiTicketEvent {
  id: string;
  ticket_id: string;
  actor_id: string;
  event_type: string;
  comment?: string;
  old_status?: string;
  new_status?: string;
  internal?: boolean;
  created_at: string;
}

export interface ApiTicketDetail extends ApiSupportTicket {
  description: string;
  events: ApiTicketEvent[];
}

export interface TicketCreateRequest {
  subject: string;
  description: string;
  category?: string;
  category_id?: string;
  venue_type_id?: string;
  use_case_ids?: string[];
  priority: string;
  booking_id?: string;
  venue_id?: string;
}

export interface TicketCommentRequest {
  comment: string;
  internal?: boolean;
}

export interface TicketUpdateRequest {
  status?: string;
  priority?: string;
  assigned_admin_id?: string | null;
}

export interface TicketsParams {
  status?: string;
  category?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface ApiAnalyticsMetrics { [key: string]: any; }

export interface ApiReview { id: string; [key: string]: any; }

export interface ReviewCreateRequest { [key: string]: any; }

export interface ApiBlock {
  id: string;
  venue_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: string;
  inventory_unit_id?: string;
}

export interface BlockCreateRequest {
  start_date: string;
  end_date: string;
  reason?: string;
  inventory_unit_id?: string;
}

export interface ApiDashboardMetrics {
  gmv: string | number;
  total_bookings: number;
  active_venues: number;
  active_users: number;
  total_commission_collected: string | number;
}

export interface ApiAttentionItem {
  type: string;
  count: number;
  label: string;
  action_label: string;
  action_link: string;
}

export interface ApiLiveOperationBooking {
  id: string;
  venue_name: string;
  category: string;
  start_time: string;
  end_time: string;
  customer_name: string;
  status: string;
}

export interface ApiLiveOperations {
  currently_booked: number;
  available: number;
  pending: number;
  cancelled_today: number;
  active_bookings: ApiLiveOperationBooking[];
}

export interface ApiBookingActivityStats {
  total_today: number;
  confirmed_today: number;
  pending_today: number;
  cancelled_today: number;
  completed_today: number;
}

export interface ApiRecentBooking {
  id: string;
  time: string;
  venue_name: string;
  customer_name: string;
  status: string;
  amount: string | number;
}

export interface ApiBookingActivity {
  stats: ApiBookingActivityStats;
  recent: ApiRecentBooking[];
}

export interface ApiRevenueStats {
  this_month: string | number;
  this_week: string | number;
  today: string | number;
  chart_data: { label: string; value: number }[];
}

export interface ApiVenueHealthStats {
  approved: number;
  pending_approval: number;
  incomplete: number;
  inactive: number;
  suspended: number;
}

export interface ApiTopVenue {
  id: string;
  name: string;
  bookings_count: number;
  gmv: string | number;
}

export interface ApiCategoryStats {
  category: string;
  percentage: number;
  count: number;
}

export interface ApiSupportStats {
  open_tickets: number;
  high_priority: number;
  waiting_for_owner: number;
  waiting_for_customer: number;
}

export interface ApiNotificationStats {
  sent_today: number;
  failed: number;
  unread_alerts: number;
}

export interface ApiRecentActivityItem {
  id: string;
  event: string;
  entity_name: string;
  actor_name: string;
  timestamp: string;
  amount: string | number | null;
}

export interface ApiDashboardOverview {
  metrics: ApiDashboardMetrics;
  attention: ApiAttentionItem[];
  live_operations: ApiLiveOperations;
  booking_activity: ApiBookingActivity;
  revenue: ApiRevenueStats;
  venue_health: ApiVenueHealthStats;
  top_venues: ApiTopVenue[];
  category_performance: ApiCategoryStats[];
  support: ApiSupportStats;
  notifications: ApiNotificationStats;
  recent_activity: ApiRecentActivityItem[];
  api_live?: boolean;
  db_connected?: boolean;
  active_users?: number;
  uptime_percent?: number;
  latency_ms?: number;
  total_bookings?: number;
  active_venues?: number;
  web_server_health?: any;
  db_server_health?: any;
}

export interface ApiAdminHealth {
  api_live: boolean;
  db_connected: boolean;
  active_users: number;
  uptime_percent: number;
  latency_ms: number;
  web_server_health: number;
  db_server_health: number;
}

// ---- Admin Password Management -------------------------------------------
// POST /api/v1/admin/users/{id}/reset-password
export type AdminPasswordResetMethod = 'link' | 'temporary' | 'force';

export interface AdminPasswordResetRequest {
  method: AdminPasswordResetMethod;
  reason: string;
  notes?: string;
  source_type?: string;
  source_id?: string;
}

export interface AdminPasswordResetResponse {
  message: string;
  // Full frontend reset URL (e.g. http://localhost:3000/reset-password?token=…).
  // This is the complete link for the admin to copy and share. Treat as a
  // one-time bearer secret: never log, never persist, never re-fetch.
  reset_url?: string;
  temp_password?: string;
}

export interface ApiAdminPasswordResetRequestView {
  id: string;
  user_id: string;
  name: string;
  contact: string;
  created_at: string;
  status: string;
}

// ---- Guide 11 Multi-Purpose, Flexible Rental & Owner Dashboard Types -----

export interface VenueRentalOption {
  id: string;
  venue_id: string;
  mode: UnitType;
  price: string;
  open_time: string | null;
  close_time: string | null;
  slot_minutes: number | null;
  min_minutes: number | null;
  max_minutes: number | null;
  buffer_minutes: number | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VenueRentalOptionCreate {
  mode: UnitType;
  price: string;
  open_time?: string | null;
  close_time?: string | null;
  slot_minutes?: number | null;
  min_minutes?: number | null;
  max_minutes?: number | null;
  buffer_minutes?: number | null;
  enabled?: boolean;
}

export interface VenueRentalOptionUpdate {
  price?: string;
  open_time?: string | null;
  close_time?: string | null;
  slot_minutes?: number | null;
  min_minutes?: number | null;
  max_minutes?: number | null;
  buffer_minutes?: number | null;
  enabled?: boolean;
}

export interface VenuePurpose {
  id: string;
  venue_id: string;
  use_case_id: string | null;
  custom_name: string | null;
  is_custom_approved: boolean;
  description: string | null;
  max_guests: number | null;
  allowed_modes: UnitType[];
  price_override: string | null;
  rules: string | null;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
  name?: string;
}

export interface VenuePurposeCreate {
  use_case_id?: string | null;
  custom_name?: string | null;
  description?: string | null;
  max_guests?: number | null;
  allowed_modes?: UnitType[];
  price_override?: string | null;
  rules?: string | null;
  enabled?: boolean;
}

export interface VenuePurposeUpdate {
  custom_name?: string | null;
  description?: string | null;
  max_guests?: number | null;
  allowed_modes?: UnitType[];
  price_override?: string | null;
  rules?: string | null;
  enabled?: boolean;
}

export interface DateAvailability {
  date: string;
  is_full_day_available: boolean;
  hourly_slots_total: number;
  hourly_slots_available: number;
  available_rental_modes: UnitType[];
}

export interface MediaLinkCreateRequest {
  url: string;
  thumbnail_url?: string | null;
}

export interface MediaReorderRequest {
  ordered_ids: string[];
}

export interface OwnerAttentionItem {
  id?: string;
  type: string;
  title: string;
  message?: string | null;
  description?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  count?: number | null;
  amount?: string | number | null;
  action_url?: string | null;
  action_link?: string;
  severity?: 'high' | 'medium' | 'info';
}

export interface OwnerCounters {
  earnings_this_month: string | number;
  events_next_7_days: number;
  pending_requests: number;
  next_payout_amount: string | number;
}

export interface OwnerBookingStages {
  requested: number;
  awaiting_payment: number;
  confirmed: number;
  completed: number;
  paid_out: number;
}

export interface OwnerListingStage {
  venue_id: string;
  name?: string;
  venue_name?: string;
  status: VenueStatus | string;
  progress_pct?: number;
  progress_percent?: number;
  missing_items: string[];
}

export interface OwnerUpcomingEvent {
  id?: string;
  booking_id: string;
  venue_id: string;
  venue_name: string;
  purpose?: string | null;
  purpose_name?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  guest_count: number | null;
  customer_name: string | null;
  payment_status?: string;
  booking_status?: BookingStatus | string;
  status?: BookingStatus | string;
  amount?: string | number;
}

export interface OwnerOverview {
  attention_items: OwnerAttentionItem[];
  counters: OwnerCounters;
  booking_stages: OwnerBookingStages;
  listing_stages: OwnerListingStage[];
  upcoming_events: OwnerUpcomingEvent[];
}

export interface OwnerVenueStats {
  venue_id: string;
  name?: string;
  revenue_last_30_days?: string | number;
  revenue_30d?: string | number;
  total_revenue?: string | number;
  events_upcoming?: number;
  upcoming_events_count?: number;
  recent_bookings_count?: number;
  total_bookings_count?: number;
  total_bookings?: number;
  avg_rating?: string | number;
  total_reviews?: number;
  active_purposes_count?: number;
  active_rental_options_count?: number;
}


