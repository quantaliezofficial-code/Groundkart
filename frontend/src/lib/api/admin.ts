import { api, getAccessToken, generateUUID } from './client';
import type { ApiHomepagePlacement, 
  AdminAuditLogParams,
  AdminBookingsParams,
  AdminCancelPendingBookingRequest,
  AdminConfirmPaymentRequest,
  AdminPayoutsParams,
  AdminUsersParams,
  AdminVenuesParams,
  AdminVerificationsParams,
  ApiAdminOwnerVerificationView,
  ApiAdminPayoutView,
  ApiAdminUserView,
  ApiAdminVenueView,
  ApiAdminHealth,
  ApiAuditLogEntry,
  ApiBookingDetail,
  ApiOwnerVerification,
  ApiPayout,
  ApiPlatformOverview,
  ApiDashboardOverview,
  ApiVenue,
  PayoutRunRequest,
  RejectVerificationRequest,
  VenueRejectRequest,
} from './types';

export const adminApi = {
  // ---- Audit log / overview ----------------------------------------------
  // audit_logs has been write-only since it was first built (backend/app/
  // models/core.py's own docstring: "a row, once written, is never
  // changed, only ever read") — this is its first real read path.
  getAuditLog: (params: AdminAuditLogParams = {}) =>
    api.get<ApiAuditLogEntry[]>('/api/v1/admin/audit-log', { query: { ...params } }),

  getOverview: () => api.get<ApiPlatformOverview>('/api/v1/admin/overview'),
  getDashboardOverview: () => api.get<ApiDashboardOverview>('/api/v1/admin/dashboard/overview'),

  // ---- Venues: list + suspend/reactivate + approve/reject -----------------
  // NOT the same as ownerApi.listMyVenues — that route is scoped to the
  // caller's own owner_id even when the caller is an admin (confirmed by
  // reading list_venues_for_owner server-side, not assumed). This is the
  // actual platform-wide list, added specifically because there was no way
  // to discover which venue IDs exist to approve/reject/suspend.
  listVenues: (params: AdminVenuesParams = {}) =>
    api.get<ApiAdminVenueView[]>('/api/v1/admin/venues', { query: { ...params } }),

  // Only a currently-'active' venue can be suspended (backend 409s
  // otherwise) — a listing that isn't live has nothing to pause.
  suspendVenue: (venueId: string, reason: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/suspend`, { reason }),

  reactivateVenue: (venueId: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/reactivate`, {}),

  approveVenue: (venueId: string) => api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/approve`, {}),

  // Rejecting sends the venue back to 'draft', not a new/separate status —
  // the owner edits and resubmits through the normal PATCH flow, there's no
  // distinct "rejected" venue_status value.
  rejectVenue: (venueId: string, reason: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/reject`, { reason } satisfies VenueRejectRequest),

  // ---- Users: list + suspend/reactivate ------------------------------------
  // Added alongside listVenues — nothing else in this codebase lists users
  // at all, so there was no way to discover which user IDs exist to
  // suspend/reactivate.
  listUsers: (params: AdminUsersParams = {}) =>
    api.get<ApiAdminUserView[]>('/api/v1/admin/users', { query: { ...params } }),

  // Blocks future login + revokes every active refresh token; does not
  // invalidate an already-issued access token still inside its 15-minute
  // TTL. Backend rejects an admin suspending their own account (422).
  suspendUser: (userId: string, reason: string) =>
    api.post<ApiAdminUserView>(`/api/v1/admin/users/${userId}/suspend`, { reason }),

  reactivateUser: (userId: string) =>
    api.post<ApiAdminUserView>(`/api/v1/admin/users/${userId}/reactivate`, {}),

  // ---- Owner verification: list + approve/reject ---------------------------
  // NOT the same as ownerApi.getMyVerification — that route only ever
  // returns the caller's own latest submission. This is the admin-facing
  // list, with a response shape that includes the applicant's name/email/
  // document_url (see ApiAdminOwnerVerificationView's docstring in types.ts).
  listVerifications: (params: AdminVerificationsParams = {}) =>
    api.get<ApiAdminOwnerVerificationView[]>('/api/v1/admin/owner-verifications', { query: { ...params } }),

  // View private verification document via authenticated admin endpoint
  viewVerificationDocument: async (verificationId: string): Promise<void> => {
    const token = getAccessToken();
    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
    const res = await fetch(`${API_URL}/api/v1/admin/owner-verifications/${verificationId}/document`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error(`Failed to load document: ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        return;
      }
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  // Approval is the only thing that actually flips role -> 'owner' and
  // is_verified -> true; rejection leaves the role unchanged and allows
  // resubmission.
  approveVerification: (verificationId: string) =>
    api.post<ApiOwnerVerification>(`/api/v1/admin/owner-verifications/${verificationId}/approve`, {}),

  rejectVerification: (verificationId: string, reason: string) =>
    api.post<ApiOwnerVerification>(
      `/api/v1/admin/owner-verifications/${verificationId}/reject`,
      { reason } satisfies RejectVerificationRequest
    ),

  // ---- Bookings: list + offline payment confirmation / pending cancellation
  // NOT the same as ownerApi.listMyBookings — that route is scoped to the
  // caller's own venues, and an admin owns none. This is the platform-wide
  // list, needed to discover which booking IDs need confirm-payment or
  // cancel-pending action.
  listBookings: (params: AdminBookingsParams = {}) =>
    api.get<ApiBookingDetail[]>('/api/v1/admin/bookings', { query: { ...params } }),

  // "Jump to booking by ID" — NOT an /admin/ prefixed route at all. Reuses
  // the general GET /api/v1/bookings/{id}, which already grants an admin
  // access to ANY booking (including guest ones — confirmed by a real
  // test, see backend/tests/test_booking_retrieval.py's
  // test_admin_can_view_a_guest_booking_via_this_route, added after
  // finding this route's own docstring had gone stale on exactly that
  // point). No new backend endpoint was needed for this.
  getBookingById: (bookingId: string) => api.get<ApiBookingDetail>(`/api/v1/bookings/${bookingId}`),

  // The offline equivalent of a verified gateway webhook — this is the real
  // trigger for "instant confirmation" today, not a Razorpay webhook.
  // amount is checked server-side against the booking's actual total, so a
  // typo here can't silently confirm the wrong amount.
  confirmBookingPayment: (bookingId: string, body: AdminConfirmPaymentRequest) =>
    api.post<ApiBookingDetail>(`/api/v1/admin/bookings/${bookingId}/confirm-payment`, body),

  // Releases a pending_payment slot immediately rather than waiting out the
  // configured hold duration.
  cancelPendingBooking: (bookingId: string, reason: string) =>
    api.post<ApiBookingDetail>(
      `/api/v1/admin/bookings/${bookingId}/cancel-pending`,
      { reason } satisfies AdminCancelPendingBookingRequest
    ),

  // Manual/on-demand trigger for the automation that also runs on a timer
  // in the background (backend/app/main.py's lifespan) — same underlying
  // function either way. Lets an admin release stale holds immediately
  // rather than waiting for the next scheduled pass.
  sweepExpiredHolds: () => api.post<{ swept: number }>('/api/v1/admin/bookings/sweep-expired-holds', {}),

  // ---- Payouts ---------------------------------------------------------
  // NOT the same as ownerApi.listMyPayouts — scoped to the caller's own
  // owner_id, and an admin has none. This is the platform-wide list, also
  // useful for seeing which owners are actually due a payout run.
  listPayouts: (params: AdminPayoutsParams = {}) =>
    api.get<ApiAdminPayoutView[]>('/api/v1/admin/payouts', { query: { ...params } }),

  runPayout: (body: PayoutRunRequest, idempotencyKey?: string) =>
    api.post<ApiPayout>('/api/v1/admin/payouts/run', body, {
      headers: { 'Idempotency-Key': idempotencyKey || generateUUID() },
    }),

  markPayoutPaid: (payoutId: string) => api.post<ApiPayout>(`/api/v1/admin/payouts/${payoutId}/mark-paid`, {}),

  // ---- Homepage Management ----
  listHomepagePlacements: (section?: string) =>
    api.get<ApiHomepagePlacement[]>('/api/v1/admin/homepage/placements', { query: section ? { section } : {} }),

  createHomepagePlacement: (body: any) =>
    api.post<ApiHomepagePlacement>('/api/v1/admin/homepage/placements', body),

  updateHomepagePlacement: (id: string, body: any) =>
    api.patch<ApiHomepagePlacement>(`/api/v1/admin/homepage/placements/${id}`, body),

  deleteHomepagePlacement: (id: string) =>
    api.delete<void>(`/api/v1/admin/homepage/placements/${id}`),

  reorderHomepageSection: (section: string, ordered_ids: string[]) =>
    api.patch<ApiHomepagePlacement[]>(`/api/v1/admin/homepage/sections/${section}/reorder`, { ordered_ids }),

  // ---- Image Management ----
  setVenueCoverImage: (venueId: string, imageId: string) =>
    api.patch<any>(`/api/v1/venues/${venueId}/images/${imageId}/cover`),

  deleteVenueImage: (venueId: string, imageId: string) =>
    api.delete<void>(`/api/v1/venues/${venueId}/images/${imageId}`),

  // ---- Reviews ----
  listReviews: (params: any = {}) =>
    api.get<any[]>('/api/v1/admin/reviews', { query: { ...params } }),

  deleteReview: (reviewId: string) =>
    api.delete<void>(`/api/v1/admin/reviews/${reviewId}`),

  // ---- Passwords ----
  resetPassword: (userId: string, data: import('./types').AdminPasswordResetRequest) =>
    api.post<import('./types').AdminPasswordResetResponse>(`/api/v1/admin/users/${userId}/reset-password`, data),

  listPasswordResetRequests: (status: string = 'pending') =>
    api.get<import('./types').ApiAdminPasswordResetRequestView[]>('/api/v1/admin/password-reset-requests', {
      query: { status },
    }),

  cancelPasswordResetRequest: (requestId: string, reason?: string) =>
    api.post<{ message: string }>(`/api/v1/admin/password-reset-requests/${requestId}/cancel`, { reason }),


  // ---- Health ----
  getHealth: () =>
    api.get<ApiAdminHealth>('/api/v1/admin/health'),
};

