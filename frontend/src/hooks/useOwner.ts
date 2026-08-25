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
import { ownerApi, type OwnerBookingsParams } from '../lib/api/owner';
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
      ownerApi.uploadVenueImage(venueId, file, isCover),
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

export function useFlagBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      ownerApi.flagBooking(bookingId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-bookings'] }),
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
