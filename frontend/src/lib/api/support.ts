import { api } from './client';
import type { 
  ApiSupportTicket, 
  ApiTicketDetail, 
  ApiTicketEvent, 
  TicketCreateRequest, 
  TicketCommentRequest, 
  TicketUpdateRequest, 
  TicketsParams 
} from './types';

export const supportApi = {
  createTicket: (body: TicketCreateRequest) =>
    api.post<ApiSupportTicket>('/api/v1/support/tickets', body),

  listTickets: (params?: TicketsParams) =>
    api.get<ApiSupportTicket[]>('/api/v1/support/tickets', { query: params as Record<string, any> }),

  getTicket: (id: string) =>
    api.get<ApiTicketDetail>(`/api/v1/support/tickets/${id}`),

  addComment: (ticketId: string, body: TicketCommentRequest) =>
    api.post<ApiTicketEvent>(`/api/v1/support/tickets/${ticketId}/comments`, body),

  adminListTickets: (params?: TicketsParams) =>
    api.get<ApiSupportTicket[]>('/api/v1/admin/support/tickets', { query: params as Record<string, any> }),

  adminUpdateTicket: (ticketId: string, body: TicketUpdateRequest) =>
    api.patch<ApiTicketDetail>(`/api/v1/admin/support/tickets/${ticketId}`, body),
};
