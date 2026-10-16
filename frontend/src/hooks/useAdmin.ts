/**
 * Admin-dashboard hooks, same shape as useOwner.ts: return the raw Api*
 * types directly rather than routing through lib/adapters.ts — AdminLayout
 * is a management surface for exactly the backend fields it works with
 * (status, suspended_at, gmv, ...), not a presentation shape that needs
 * adapting.
 */
import { useState, useCallback } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../lib/api/admin';
// PATCH /api/v1/venues/{id} is role-gated 'owner' OR 'admin' — the same
// endpoint either way, so this reuses ownerApi.updateVenue rather than
// duplicating an identical function in admin.ts. Only the query-key
// invalidation differs (admin-venues, not owner-venues).
import { ownerApi } from '../lib/api/owner';
import type {
  AdminAuditLogParams,
  AdminBookingsParams,
  AdminConfirmPaymentRequest,
  AdminPasswordResetRequest,
  AdminPayoutsParams,
  AdminUsersParams,
  AdminVenuesParams,
  AdminVerificationsParams,
  PayoutRunRequest,
  VenueUpdateRequest,
} from '../lib/api/types';
import { useAuth } from '../lib/auth';

export function useAuditLog(params: AdminAuditLogParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-audit-log', params],
    queryFn: () => adminApi.getAuditLog(params),
    enabled: Boolean(user),
  });
}

export function useAdminOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminApi.getOverview(),
    enabled: Boolean(user),
  });
}

export function useAdminHealth() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-health'],
    queryFn: () => adminApi.getHealth(),
    enabled: Boolean(user),
  });
}

export function useAdminVenues(params: AdminVenuesParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-venues', params],
    queryFn: () => adminApi.listVenues(params),
    enabled: Boolean(user),
  });
}

const PAGE_SIZE = 50;

// "Load more" pagination for the Venues tab specifically (browsing
// everything, which can genuinely grow large over time) — separate from
// useAdminVenues above, which the approval queue still uses as a single
// bounded fetch (a pending-review queue doesn't accumulate the way a
// full venue list does, so it doesn't need page controls of its own).
export function useAdminVenuesPaginated(baseParams: Omit<AdminVenuesParams, 'offset' | 'limit'> = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['admin-venues-paginated', baseParams],
    queryFn: ({ pageParam }) => adminApi.listVenues({ ...baseParams, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(user),
  });
}

export function useAdminVerifications(params: AdminVerificationsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-verifications', params],
    queryFn: () => adminApi.listVerifications(params),
    enabled: Boolean(user),
  });
}

export function useAdminUsers(params: AdminUsersParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => adminApi.listUsers(params),
    enabled: Boolean(user),
  });
}

export function useAdminUsersPaginated(baseParams: Omit<AdminUsersParams, 'offset' | 'limit'> = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['admin-users-paginated', baseParams],
    queryFn: ({ pageParam }) => adminApi.listUsers({ ...baseParams, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(user),
  });
}

// Venue moderation actions all touch the same two lists an admin is
// looking at (the venues table + the overview's pending-approval counts),
// so every one of them invalidates both.
function invalidateVenueViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-venues'] });
  // Separate key, not a prefix of the one above — invalidateQueries only
  // matches by prefix, so this needs its own explicit call.
  queryClient.invalidateQueries({ queryKey: ['admin-venues-paginated'] });
  queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
}

export function useSuspendVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, reason }: { venueId: string; reason: string }) =>
      adminApi.suspendVenue(venueId, reason),
    onSuccess: () => invalidateVenueViews(queryClient),
  });
}

export function useReactivateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => adminApi.reactivateVenue(venueId),
    onSuccess: () => invalidateVenueViews(queryClient),
  });
}

export function useApproveVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (venueId: string) => adminApi.approveVenue(venueId),
    onSuccess: () => invalidateVenueViews(queryClient),
  });
}

export function useRejectVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, reason }: { venueId: string; reason: string }) => adminApi.rejectVenue(venueId, reason),
    onSuccess: () => invalidateVenueViews(queryClient),
  });
}

export function useAdminUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, body }: { venueId: string; body: VenueUpdateRequest }) =>
      ownerApi.updateVenue(venueId, body),
    onSuccess: () => invalidateVenueViews(queryClient),
  });
}

function invalidateUserViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  queryClient.invalidateQueries({ queryKey: ['admin-users-paginated'] });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) => adminApi.suspendUser(userId, reason),
    onSuccess: () => invalidateUserViews(queryClient),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.reactivateUser(userId),
    onSuccess: () => invalidateUserViews(queryClient),
  });
}

function invalidateVerificationViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-verifications'] });
  queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
}

export function useApproveVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (verificationId: string) => adminApi.approveVerification(verificationId),
    onSuccess: () => invalidateVerificationViews(queryClient),
  });
}

export function useRejectVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ verificationId, reason }: { verificationId: string; reason: string }) =>
      adminApi.rejectVerification(verificationId, reason),
    onSuccess: () => invalidateVerificationViews(queryClient),
  });
}

export function useAdminBookings(params: AdminBookingsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-bookings', params],
    queryFn: () => adminApi.listBookings(params),
    enabled: Boolean(user),
  });
}

export function useAdminBookingsPaginated(baseParams: Omit<AdminBookingsParams, 'offset' | 'limit'> = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['admin-bookings-paginated', baseParams],
    queryFn: ({ pageParam }) => adminApi.listBookings({ ...baseParams, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(user),
  });
}

function invalidateBookingViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  queryClient.invalidateQueries({ queryKey: ['admin-bookings-paginated'] });
  queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
}

export function useConfirmBookingPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, body }: { bookingId: string; body: AdminConfirmPaymentRequest }) =>
      adminApi.confirmBookingPayment(bookingId, body),
    onSuccess: () => invalidateBookingViews(queryClient),
  });
}

export function useCancelPendingBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      adminApi.cancelPendingBooking(bookingId, reason),
    onSuccess: () => invalidateBookingViews(queryClient),
  });
}

export function useSweepExpiredHolds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.sweepExpiredHolds(),
    onSuccess: () => invalidateBookingViews(queryClient),
  });
}

// "Jump to booking by ID" — a mutation rather than a query, deliberately:
// this is a one-off, button-triggered lookup, not something that should
// be cached/refetched reactively the way a list is.
export function useBookingLookup() {
  return useMutation({
    mutationFn: (bookingId: string) => adminApi.getBookingById(bookingId),
  });
}

export function useAdminPayouts(params: AdminPayoutsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-payouts', params],
    queryFn: () => adminApi.listPayouts(params),
    enabled: Boolean(user),
  });
}

export function useAdminPayoutsPaginated(baseParams: Omit<AdminPayoutsParams, 'offset' | 'limit'> = {}) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['admin-payouts-paginated', baseParams],
    queryFn: ({ pageParam }) => adminApi.listPayouts({ ...baseParams, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(user),
  });
}

function invalidatePayoutViews(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
  queryClient.invalidateQueries({ queryKey: ['admin-payouts-paginated'] });
}

export function useRunPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PayoutRunRequest) => adminApi.runPayout(body),
    onSuccess: () => invalidatePayoutViews(queryClient),
  });
}

export function useMarkPayoutPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payoutId: string) => adminApi.markPayoutPaid(payoutId),
    onSuccess: () => invalidatePayoutViews(queryClient),
  });
}

export function useAdminDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId }: { reviewId: string; venueId: string }) => adminApi.deleteReview(reviewId),
    onSuccess: (_data, { venueId }) => {
      queryClient.invalidateQueries({ queryKey: ['venue-reviews', venueId] });
      queryClient.invalidateQueries({ queryKey: ['venue', venueId] });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });
}

export function useAdminReviews(params: { venue_id?: string; limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: ['admin-reviews', params],
    queryFn: () => adminApi.listReviews(params),
  });
}

export function useAdminReviewsPaginated(pageSize: number = 20) {
  const [page, setPage] = useState(1);
  const [venueId, setVenueId] = useState<string | undefined>(undefined);
  const offset = (page - 1) * pageSize;

  const query = useAdminReviews({ limit: pageSize, offset, venue_id: venueId });

  const setVenueFilter = useCallback((vId: string | undefined) => {
    setVenueId(vId);
    setPage(1); // reset to page 1 on filter change
  }, []);

  return {
    ...query,
    page,
    setPage,
    pageSize,
    venueId,
    setVenueFilter,
    hasMore: (query.data?.length ?? 0) === pageSize,
  };
}


// ---- Homepage Management ----
export function useHomepagePlacements(section?: string) {
  return useQuery({
    queryKey: ['admin-homepage-placements', section],
    queryFn: () => adminApi.listHomepagePlacements(section),
  });
}

export function useCreateHomepagePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => adminApi.createHomepagePlacement(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-placements'] }),
  });
}

export function useUpdateHomepagePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => adminApi.updateHomepagePlacement(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-placements'] }),
  });
}

export function useDeleteHomepagePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteHomepagePlacement(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-placements'] }),
  });
}

export function useReorderHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ section, ordered_ids }: { section: string; ordered_ids: string[] }) => adminApi.reorderHomepageSection(section, ordered_ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-homepage-placements'] }),
  });
}

// ---- Image Management ----
export function useSetVenueCoverImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, imageId }: { venueId: string; imageId: string }) => adminApi.setVenueCoverImage(venueId, imageId),
    onSuccess: (_, { venueId }) => qc.invalidateQueries({ queryKey: ['admin-venues'] }),
  });
}

export function useDeleteVenueImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, imageId }: { venueId: string; imageId: string }) => adminApi.deleteVenueImage(venueId, imageId),
    onSuccess: (_, { venueId }) => qc.invalidateQueries({ queryKey: ['admin-venues'] }),
  });
}


export function useAdminDashboardOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-dashboard-overview'],
    queryFn: () => adminApi.getDashboardOverview(),
    enabled: Boolean(user),
  });
}

export function useAdminPasswordResetRequests(status: string = 'pending') {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['admin-password-reset-requests', status],
    queryFn: () => adminApi.listPasswordResetRequests(status),
    enabled: Boolean(user),
  });
}

export function useAdminResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: AdminPasswordResetRequest }) => adminApi.resetPassword(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-password-reset-requests'] });
    },
  });
}

export function useAdminCancelPasswordResetRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      adminApi.cancelPasswordResetRequest(requestId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-password-reset-requests'] });
    },
  });
}

