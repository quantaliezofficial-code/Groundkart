import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptInventoryUnit, adaptVenue } from '../lib/adapters';
import { venuesApi, type VenueSearchParams } from '../lib/api/venues';
import type { ReviewCreateRequest } from '../lib/api/types';
import type { Venue, VenueSlot } from '../types';

export function useVenues(params: VenueSearchParams = {}) {
  const query = useQuery({
    queryKey: ['venues', params],
    queryFn: () => venuesApi.search(params),
  });

  const venues: Venue[] = (query.data?.data ?? []).map(adaptVenue);
  return { venues, total: query.data?.total ?? 0, isLoading: query.isLoading, error: query.error };
}

export function useVenue(venueId: string | undefined) {
  const query = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venuesApi.get(venueId!),
    enabled: Boolean(venueId),
  });

  const venue: Venue | undefined = query.data ? adaptVenue(query.data) : undefined;
  return { venue, isLoading: query.isLoading, error: query.error };
}

export function useVenueSlots(venueId: string | undefined) {
  const query = useQuery({
    queryKey: ['venue-slots', venueId],
    queryFn: () => venuesApi.listInventoryUnits(venueId!),
    enabled: Boolean(venueId),
  });

  const slots: VenueSlot[] = (query.data ?? []).map(adaptInventoryUnit);
  return { slots, isLoading: query.isLoading, error: query.error };
}

export function useVenueReviews(venueId: string | undefined) {
  return useQuery({
    queryKey: ['venue-reviews', venueId],
    queryFn: () => venuesApi.getReviews(venueId!),
    enabled: Boolean(venueId),
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ venueId, body }: { venueId: string; body: ReviewCreateRequest }) =>
      venuesApi.createReview(venueId, body),
    onSuccess: (_data, { venueId }) => {
      queryClient.invalidateQueries({ queryKey: ['venue-reviews', venueId] });
      // Invalidate the venue itself so avg_rating updates in the booking card
      queryClient.invalidateQueries({ queryKey: ['venue', venueId] });
    },
  });
}

export function useHomepage() {
  return useQuery({
    queryKey: ["homepage"],
    queryFn: () => venuesApi.getHomepage(),
  });
}
