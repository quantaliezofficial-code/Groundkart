/**
 * Owner-dashboard hooks. Deliberately return the raw Api* types (see
 * lib/api/types.ts) rather than running them through lib/adapters.ts the
 * way useVenues.ts/useBookings.ts do for the customer-facing components.
 * Those adapters exist to reshape backend data into the presentation
 * shape components were already built against (Venue, AppBooking) without
 * exposing backend field names to code that shouldn't need to know them.
 * OwnerLayout is the management surface for exactly those backend fields
 * (status, rejection_reason, base_price, unit_type, ...) — there's no
 * separate presentation shape to adapt into here, so working with the
 * real API types directly is the right level of abstraction, not a
 * shortcut.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownerApi, getAnalytics, type OwnerBookingsParams } from '../lib/api/owner';
import type { InventoryUnitCreateRequest, VenueCreateRequest, VenueUpdateRequest } from '../lib/api/types';
import { useAuth } from '../lib/auth';

export function useOwnerVenues() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owner-venues'],
    queryFn: () => ownerApi.listMyVenues(),
    enabled: Boolean(user),
  });
}

export function useOwnerInventory(venueId: string | undefined) {
  return useQuery({
    queryKey: ['owner-inventory', venueId],
    queryFn: () => ownerApi.listInventoryUnits(venueId!),
    enabled: Boolean(venueId),
  });
}

export function useOwnerBookings(params: OwnerBookingsParams = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owner-bookings', params],
    queryFn: () => ownerApi.listMyBookings(params),
    enabled: Boolean(user),
  });
}

export function useOwnerPayouts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owner-payouts'],
    queryFn: () => ownerApi.listMyPayouts(),
    enabled: Boolean(user),
  });
}

export function useOwnerVerification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owner-verification'],
    queryFn: () => ownerApi.getMyVerification(),
    enabled: Boolean(user),
  });
}

export function useCreateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: VenueCreateRequest) => ownerApi.createVenue(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-venues'] }),
  });
}

export function useUpdateVenue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, body }: { venueId: string; body: VenueUpdateRequest }) =>
      ownerApi.updateVenue(venueId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-venues'] }),
  });
}

export function useUploadVenueImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, file, isCover }: { venueId: string; file: File; isCover: boolean }) =>
      ownerApi.uploadVenueMedia(venueId, file, isCover),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-venues'] }),
  });
}

export function useAddInventoryUnits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, units }: { venueId: string; units: InventoryUnitCreateRequest[] }) =>
      ownerApi.addInventoryUnits(venueId, units),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['owner-inventory', variables.venueId] });
    },
  });
}



export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ document, businessName, identificationType, identificationNumber }: { document: File; businessName?: string; identificationType?: string; identificationNumber?: string }) =>
      ownerApi.submitVerification(document, businessName, identificationType, identificationNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-verification'] }),
  });
}

export function useOwnerOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['owner-overview'],
    queryFn: () => ownerApi.getOverview(),
    enabled: Boolean(user),
  });
}

export function useOwnerVenueStats(venueId: string | undefined) {
  return useQuery({
    queryKey: ['owner-venue-stats', venueId],
    queryFn: () => ownerApi.getVenueStats(venueId!),
    enabled: Boolean(venueId),
  });
}

export function useOwnerAnalytics(params?: { start_date?: string; end_date?: string; venue_id?: string }) {
  const { user } = useAuth();
  const defaultStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const defaultEndDate = new Date().toISOString().split('T')[0];
  const queryParams = {
    start_date: params?.start_date || defaultStartDate,
    end_date: params?.end_date || defaultEndDate,
    venue_id: params?.venue_id,
  };

  return useQuery({
    queryKey: ['owner-analytics', queryParams],
    queryFn: () => getAnalytics(queryParams),
    enabled: Boolean(user),
  });
}

