import { api } from './client';
import type {
  ApiAnalyticsMetrics,
  ApiBookingDetail,
  ApiInventoryUnit,
  ApiOwnerVerification,
  ApiPayout,
  ApiVenue,
  BookingStatus,
  InventoryUnitCreateRequest,
  MediaLinkCreateRequest,
  OwnerOverview,
  OwnerVenueStats,
  VenueCreateRequest,
  VenuePurpose,
  VenuePurposeCreate,
  VenuePurposeUpdate,
  VenueRentalOption,
  VenueRentalOptionCreate,
  VenueRentalOptionUpdate,
  VenueUpdateRequest,
} from './types';

export interface OwnerBookingsParams {
  venue_id?: string;
  status?: BookingStatus;
  date_from?: string; // YYYY-MM-DD
  date_to?: string;
}

export const ownerApi = {
  // ---- Venues ----------------------------------------------------------
  listMyVenues: () => api.get<ApiVenue[]>('/api/v1/owner/venues'),
  getVenue: (venueId: string) => api.get<ApiVenue>(`/api/v1/venues/${venueId}`),
  createVenue: (body: VenueCreateRequest) => api.post<ApiVenue>('/api/v1/venues', body),
  updateVenue: (venueId: string, body: VenueUpdateRequest) =>
    api.patch<ApiVenue>(`/api/v1/venues/${venueId}`, body),
  uploadVenueMedia: (venueId: string, file: File, isCover: boolean, duration?: number) => {
    const form = new FormData();
    form.append('image', file);
    form.append('is_cover', String(isCover));
    if (duration !== undefined && duration !== null) {
      form.append('duration', String(duration));
    }
    return api.postForm<ApiVenue>(`/api/v1/venues/${venueId}/images`, form);
  },
  deleteVenueImage: (venueId: string, imageId: string) =>
    api.delete<void>(`/api/v1/venues/${venueId}/images/${imageId}`),
  setVenueCoverImage: (venueId: string, imageId: string) =>
    api.patch<any>(`/api/v1/venues/${venueId}/images/${imageId}/cover`),

  // ---- Inventory -------------------------------------------------------
  listInventoryUnits: (venueId: string) =>
    api.get<ApiInventoryUnit[]>(`/api/v1/venues/${venueId}/inventory-units`),
  listBlocks: (venueId: string) => api.get<any[]>(`/api/v1/venues/${venueId}/blocks`),
  createBlock: (venueId: string, body: any) => api.post<any>(`/api/v1/venues/${venueId}/blocks`, body),
  updateBlock: (venueId: string, blockId: string, status: string) => api.patch<any>(`/api/v1/venues/${venueId}/blocks/${blockId}`, { status }),
  addInventoryUnits: (venueId: string, units: InventoryUnitCreateRequest[]) =>
    api.post<ApiInventoryUnit[]>(`/api/v1/venues/${venueId}/inventory-units`, { units }),

  // ---- Bookings --------------------------------------------------------
  listMyBookings: (params: OwnerBookingsParams = {}) =>
    api.get<ApiBookingDetail[]>('/api/v1/owner/bookings', { query: { ...params } }),
  requestAction: (bookingId: string, body: { action_type: string, reason_code: string, notes?: string }) =>
    api.post<any>(`/api/v1/owner/bookings/${bookingId}/cancellation-requests`, body),

  // ---- Payouts ---------------------------------------------------------
  listMyPayouts: () => api.get<ApiPayout[]>('/api/v1/owner/payouts'),

  // ---- Rental Options --------------------------------------------------
  listRentalOptions: (venueId: string) =>
    api.get<VenueRentalOption[]>(`/api/v1/venues/${venueId}/rental-options`),
  createRentalOption: (venueId: string, body: VenueRentalOptionCreate) =>
    api.post<VenueRentalOption>(`/api/v1/owner/venues/${venueId}/rental-options`, body),
  updateRentalOption: (venueId: string, optionId: string, body: VenueRentalOptionUpdate) =>
    api.patch<VenueRentalOption>(`/api/v1/owner/venues/${venueId}/rental-options/${optionId}`, body),
  deleteRentalOption: (venueId: string, optionId: string) =>
    api.delete<void>(`/api/v1/owner/venues/${venueId}/rental-options/${optionId}`),

  // ---- Purposes --------------------------------------------------------
  listPurposes: (venueId: string) =>
    api.get<VenuePurpose[]>(`/api/v1/venues/${venueId}/purposes`),
  createPurpose: (venueId: string, body: VenuePurposeCreate) =>
    api.post<VenuePurpose>(`/api/v1/owner/venues/${venueId}/purposes`, body),
  updatePurpose: (venueId: string, purposeId: string, body: VenuePurposeUpdate) =>
    api.patch<VenuePurpose>(`/api/v1/owner/venues/${venueId}/purposes/${purposeId}`, body),
  deletePurpose: (venueId: string, purposeId: string) =>
    api.delete<void>(`/api/v1/owner/venues/${venueId}/purposes/${purposeId}`),

  // ---- Media (Reorder & Video Link) ------------------------------------
  addVideoLink: (venueId: string, body: MediaLinkCreateRequest) =>
    api.post<any>(`/api/v1/owner/venues/${venueId}/media/link`, body),
  reorderMedia: (venueId: string, orderedIds: string[]) =>
    api.put<any>(`/api/v1/owner/venues/${venueId}/media/reorder`, { ordered_ids: orderedIds }),

  // ---- Overview & Workspace Stats ---------------------------------------
  getOverview: () => api.get<OwnerOverview>('/api/v1/owner/overview'),
  getVenueStats: (venueId: string) =>
    api.get<OwnerVenueStats>(`/api/v1/owner/venues/${venueId}/stats`),

  // ---- Verification ----------------------------------------------------
  getMyVerification: () => api.get<ApiOwnerVerification | null>('/api/v1/owner/verification'),
  submitVerification: (document: File, businessName?: string, identificationType?: string, identificationNumber?: string) => {
    const form = new FormData();
    form.append('document', document);
    if (businessName) form.append('business_name', businessName);
    if (identificationType) form.append('identification_type', identificationType);
    if (identificationNumber) form.append('identification_number', identificationNumber);
    return api.postForm<ApiOwnerVerification>('/api/v1/owner/verification', form);
  },
};

export async function getAnalytics(params?: { start_date?: string; end_date?: string; venue_id?: string }): Promise<ApiAnalyticsMetrics> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.append('start_date', params.start_date);
  if (params?.end_date) searchParams.append('end_date', params.end_date);
  if (params?.venue_id) searchParams.append('venue_id', params.venue_id);
  
  const res = await api.get<ApiAnalyticsMetrics>(`/api/v1/owner/analytics?${searchParams.toString()}`);
  return res;
}
