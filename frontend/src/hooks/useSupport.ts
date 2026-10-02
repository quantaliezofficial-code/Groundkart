import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi } from '../lib/api/support';
import type { 
  TicketCreateRequest, 
  TicketCommentRequest, 
  TicketUpdateRequest, 
  TicketsParams 
} from '../lib/api/types';

export function useMyTickets(params?: TicketsParams) {
  return useQuery({
    queryKey: ['my-tickets', params],
    queryFn: () => supportApi.listTickets(params),
  });
}

export function useTicketDetail(id?: string) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => supportApi.getTicket(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketCreateRequest) => supportApi.createTicket(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
  });
}

export function useAddComment(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketCommentRequest) => supportApi.addComment(ticketId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
    },
  });
}

export function useAdminTickets(params?: TicketsParams) {
  return useQuery({
    queryKey: ['admin-tickets', params],
    queryFn: () => supportApi.adminListTickets(params),
  });
}

export function useAdminUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: TicketUpdateRequest }) =>
      supportApi.adminUpdateTicket(ticketId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket', variables.ticketId] });
      // Invalidate specific ticket without ID if needed elsewhere, though usually with ID
      queryClient.invalidateQueries({ queryKey: ['ticket'] });
    },
  });
}
