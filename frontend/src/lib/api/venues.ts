import { api } from './client';
import type {
  ApiHomepageResponse,
  ApiInventoryUnit,
  ApiReview,
  ApiVenue,
  DateAvailability,
  ReviewCreateRequest,
  VenueListResponse,
  VenuePurpose,
  VenueRentalOption,
} from './types';

export interface VenueSearchParams {
  city?: string;
  category?: string;
  available_on?: string; // YYYY-MM-DD
  price_max?: number;
  sort_by?: string;
  limit?: number;
  offset?: number;
}

export const venuesApi = {
  getHomepage: () => api.get<ApiHomepageResponse>("/api/v1/homepage", { skipAuth: true }),

  search: (params: VenueSearchParams = {}) =>
    api.get<VenueListResponse>('/api/v1/venues', { query: { ...params }, skipAuth: true }),

  get: (venueId: string) => api.get<ApiVenue>(`/api/v1/venues/${venueId}`, { skipAuth: true }),

  listInventoryUnits: (venueId: string, dateFrom?: string, dateTo?: string) =>
    api.get<ApiInventoryUnit[]>(`/api/v1/venues/${venueId}/inventory-units`, {
      query: { date_from: dateFrom, date_to: dateTo },
      skipAuth: true,
    }),

  getReviews: (venueId: string, limit = 20, offset = 0) =>
    api.get<ApiReview[]>(`/api/v1/venues/${venueId}/reviews`, {
      query: { limit, offset },
      skipAuth: true,
    }),

  createReview: (venueId: string, body: ReviewCreateRequest) =>
    api.post<ApiReview>(`/api/v1/venues/${venueId}/reviews`, body),

  deleteVenue: (id: string) =>
    api.delete<void>(`/api/v1/venues/${id}`),

  getAvailability: (venueId: string, from: string, to: string, purposeId?: string) =>
    api.get<DateAvailability[]>(`/api/v1/venues/${venueId}/availability`, {
      query: { from, to, ...(purposeId ? { purpose_id: purposeId } : {}) },
      skipAuth: true,
    }),

  getPurposes: (venueId: string) =>
    api.get<VenuePurpose[]>(`/api/v1/venues/${venueId}/purposes`, { skipAuth: true }),

  getRentalOptions: (venueId: string) =>
    api.get<VenueRentalOption[]>(`/api/v1/venues/${venueId}/rental-options`, { skipAuth: true }),
};

