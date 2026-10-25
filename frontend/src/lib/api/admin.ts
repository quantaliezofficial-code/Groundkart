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
  ApiDatabaseStats,
  ApiTableData,
  ApiSafeQueryResponse,
  ApiDatabaseAnalytics,
} from './types';

export const adminApi = {
  // ---- Audit log / overview ----------------------------------------------
  getAuditLog: (params: AdminAuditLogParams = {}) =>
    api.get<ApiAuditLogEntry[]>('/api/v1/admin/audit-log', { query: { ...params } }),

  getOverview: () => api.get<ApiPlatformOverview>('/api/v1/admin/overview'),
  getDashboardOverview: () => api.get<ApiDashboardOverview>('/api/v1/admin/dashboard/overview'),

  // ---- Venues: list + suspend/reactivate + approve/reject -----------------
  listVenues: (params: AdminVenuesParams = {}) =>
    api.get<ApiAdminVenueView[]>('/api/v1/admin/venues', { query: { ...params } }),

  suspendVenue: (venueId: string, reason: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/suspend`, { reason }),

  reactivateVenue: (venueId: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/reactivate`, {}),

  approveVenue: (venueId: string) => api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/approve`, {}),

  rejectVenue: (venueId: string, reason: string) =>
    api.post<ApiVenue>(`/api/v1/admin/venues/${venueId}/reject`, { reason } satisfies VenueRejectRequest),

  // ---- Users: list + suspend/reactivate ------------------------------------
  listUsers: (params: AdminUsersParams = {}) =>
    api.get<ApiAdminUserView[]>('/api/v1/admin/users', { query: { ...params } }),

  suspendUser: (userId: string, reason: string) =>
    api.post<ApiAdminUserView>(`/api/v1/admin/users/${userId}/suspend`, { reason }),

  reactivateUser: (userId: string) =>
    api.post<ApiAdminUserView>(`/api/v1/admin/users/${userId}/reactivate`, {}),

  // ---- Owner verification: list + approve/reject ---------------------------
  listVerifications: (params: AdminVerificationsParams = {}) =>
    api.get<ApiAdminOwnerVerificationView[]>('/api/v1/admin/owner-verifications', { query: { ...params } }),

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

  approveVerification: (verificationId: string) =>
    api.post<ApiOwnerVerification>(`/api/v1/admin/owner-verifications/${verificationId}/approve`, {}),

  rejectVerification: (verificationId: string, reason: string) =>
    api.post<ApiOwnerVerification>(
      `/api/v1/admin/owner-verifications/${verificationId}/reject`,
      { reason } satisfies RejectVerificationRequest
    ),

  // ---- Bookings: list + offline payment confirmation / pending cancellation
  listBookings: (params: AdminBookingsParams = {}) =>
    api.get<ApiBookingDetail[]>('/api/v1/admin/bookings', { query: { ...params } }),

  getBookingById: (bookingId: string) => api.get<ApiBookingDetail>(`/api/v1/bookings/${bookingId}`),

  confirmBookingPayment: (bookingId: string, body: AdminConfirmPaymentRequest) =>
    api.post<ApiBookingDetail>(`/api/v1/admin/bookings/${bookingId}/confirm-payment`, body),

  cancelPendingBooking: (bookingId: string, reason: string) =>
    api.post<ApiBookingDetail>(
      `/api/v1/admin/bookings/${bookingId}/cancel-pending`,
      { reason } satisfies AdminCancelPendingBookingRequest
    ),

  sweepExpiredHolds: () => api.post<{ swept: number }>('/api/v1/admin/bookings/sweep-expired-holds', {}),

  // ---- Payouts ---------------------------------------------------------
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

  // ---- Database Studio & Analytics ----
  getDatabaseStats: () =>
    api.get<ApiDatabaseStats>('/api/v1/admin/db/stats'),

  getTableData: (
    tableName: string,
    params: {
      limit?: number;
      offset?: number;
      order_by?: string;
      order_dir?: 'asc' | 'desc';
      search?: string;
    } = {}
  ) =>
    api.get<ApiTableData>(`/api/v1/admin/db/tables/${tableName}`, {
      query: { ...params },
    }),

  executeSafeQuery: (sql: string) =>
    api.post<ApiSafeQueryResponse>('/api/v1/admin/db/query', { sql }),

  getDatabaseAnalytics: (days: number = 30) =>
    api.get<ApiDatabaseAnalytics>('/api/v1/admin/db/analytics', {
      query: { days },
    }),

  exportTableCsv: async (tableName: string, limit: number = 5000): Promise<string> => {
    const token = getAccessToken();
    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';
    // If VITE_API_URL has /api/v1 at end, remove it
    const rootUrl = API_URL.replace(/\/api\/v1\/?$/, '');
    const res = await fetch(`${rootUrl}/api/v1/admin/db/export/${tableName}?limit=${limit}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`Failed to export CSV: ${res.statusText}`);
    }
    return res.text();
  },
};
