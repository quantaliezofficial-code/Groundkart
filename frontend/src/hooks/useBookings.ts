import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptBooking } from '../lib/adapters';
import { bookingsApi } from '../lib/api/bookings';
import type { BookingCreateRequest } from '../lib/api/types';
import { useAuth } from '../lib/auth';
import type { AppBooking } from '../types';

export function useMyBookings() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['my-bookings'],
    queryFn: () => bookingsApi.listMine(),
    enabled: Boolean(user), // guest bookings are never listable this way — get_booking_by_manage_token is the only guest path
  });

  const bookings: AppBooking[] = (query.data ?? []).map((b) => adaptBooking(b));
  return { bookings, isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: BookingCreateRequest & { idempotencyKey?: string }) => {
      const { idempotencyKey, ...body } = variables;
      return bookingsApi.create(body as BookingCreateRequest, idempotencyKey);
    },
    onSuccess: () => {
      // A slot that was just held moves from available -> held for
      // everyone else looking at the same venue, so both the slot list
      // and the venue search (which also reflects availability) need to
      // stop trusting their cached copy.
      queryClient.invalidateQueries({ queryKey: ['venue-slots'] });
      queryClient.invalidateQueries({ queryKey: ['venues'] });
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      bookingsApi.cancel(bookingId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
    },
  });
}
