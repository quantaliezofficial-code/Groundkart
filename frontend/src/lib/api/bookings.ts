import { api, generateUUID } from './client';
import type { ApiBookingDetail, BookingCancelResponse, BookingCreateRequest, BookingCreateResponse } from './types';

export const bookingsApi = {
  /** guest_email present -> must NOT also send an auth token, even if
   * one exists — the backend rejects an authenticated request that also
   * carries guest fields (Decision Point C-4), on the reasoning that an
   * authenticated request with guest fields attached is far more likely
   * a frontend bug than real intent. */
  create: (body: BookingCreateRequest, idempotencyKey?: string) =>
    api.post<BookingCreateResponse>('/api/v1/bookings', body, {
      skipAuth: Boolean(body.guest_email),
      headers: { 'Idempotency-Key': idempotencyKey || generateUUID() },
    }),

  listMine: () => api.get<ApiBookingDetail[]>('/api/v1/bookings'),

  get: (bookingId: string) => api.get<ApiBookingDetail>(`/api/v1/bookings/${bookingId}`),

  getByManageToken: (token: string) => api.get<ApiBookingDetail>(`/api/v1/bookings/manage/${token}`, { skipAuth: true }),

  cancel: (bookingId: string, reason?: string, idempotencyKey?: string) =>
    api.post<BookingCancelResponse>(`/api/v1/bookings/${bookingId}/cancel`, { reason }, {
      headers: { 'Idempotency-Key': idempotencyKey || generateUUID() },
    }),

  cancelByManageToken: (token: string, reason?: string, idempotencyKey?: string) =>
    api.post<BookingCancelResponse>(`/api/v1/bookings/manage/${token}/cancel`, { reason }, {
      skipAuth: true,
      headers: { 'Idempotency-Key': idempotencyKey || generateUUID() },
    }),

  requestAction: (bookingId: string, data: { action_type: string, reason_code: string, notes?: string, new_inventory_unit_id?: string }) => {
    if (data.action_type === 'reschedule') {
      return api.post<any>(`/api/v1/bookings/${bookingId}/reschedule-requests`, {
        new_inventory_unit_id: data.new_inventory_unit_id,
        reason_code: data.reason_code,
        notes: data.notes
      });
    }
    return api.post<any>(`/api/v1/bookings/${bookingId}/cancellation-requests`, data);
  },
    
  requestActionByManageToken: (token: string, body: { action_type: string, reason_code: string, notes?: string }) =>
    api.post<any>(`/api/v1/bookings/manage/${token}/cancellation-requests`, body, { skipAuth: true }),
};
