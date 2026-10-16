import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Header from './Header';
import SupportTickets from './SupportTickets';

const mockNotifications = [
  {
    id: 'notif-1',
    type: 'support_ticket.comment',
    message: 'New reply on your ticket: Payment Issue',
    entity_type: 'support_ticket',
    entity_id: 'ticket-999',
    read_at: null,
    created_at: '2026-10-15T10:00:00Z',
  },
  {
    id: 'notif-2',
    type: 'booking_requested',
    message: 'New booking request for Grand Turf',
    entity_type: 'booking',
    entity_id: 'booking-888',
    read_at: null,
    created_at: '2026-10-15T09:00:00Z',
  },
];

const notificationsApiMock = vi.hoisted(() => ({
  list: vi.fn(),
  getUnreadCount: vi.fn(),
  markRead: vi.fn().mockResolvedValue({ id: 'notif-1', read_at: '2026-10-15T10:05:00Z' }),
  markAllRead: vi.fn().mockResolvedValue({ marked_read: 2 }),
  delete: vi.fn().mockResolvedValue(undefined),
  deleteAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/api/notifications', () => ({
  notificationsApi: notificationsApiMock,
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'customer' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

const supportApiMock = vi.hoisted(() => ({
  listTickets: vi.fn().mockResolvedValue([]),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  addComment: vi.fn(),
}));

vi.mock('../lib/api/support', () => ({
  supportApi: supportApiMock,
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

describe('Notification click redirection & support ticket deep linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationsApiMock.list.mockResolvedValue(mockNotifications);
    notificationsApiMock.getUnreadCount.mockResolvedValue({ unread_count: 2 });
  });

  it('clicking a support ticket notification marks it read and redirects to /support?ticketId=xyz', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Header
            currentView="home"
            onNavigate={vi.fn()}
            searchQuery=""
            onSearchChange={vi.fn()}
            onListVenue={vi.fn()}
            onRequestAuth={vi.fn()}
          />
          <LocationDisplay />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellButton = await screen.findByLabelText('Notifications');
    fireEvent.click(bellButton);

    const ticketNotif = await screen.findByText('New reply on your ticket: Payment Issue');
    expect(ticketNotif).toBeInTheDocument();
    expect(screen.getByText('View Ticket →')).toBeInTheDocument();

    fireEvent.click(ticketNotif);

    await waitFor(() => {
      expect(notificationsApiMock.markRead).toHaveBeenCalledWith('notif-1');
      expect(screen.getByTestId('location-display')).toHaveTextContent('/support?ticketId=ticket-999');
    });
  });

  it('clicking a booking notification redirects to /my-bookings', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <Header
            currentView="home"
            onNavigate={vi.fn()}
            searchQuery=""
            onSearchChange={vi.fn()}
            onListVenue={vi.fn()}
            onRequestAuth={vi.fn()}
          />
          <LocationDisplay />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bellButton = await screen.findByLabelText('Notifications');
    fireEvent.click(bellButton);

    const bookingNotif = await screen.findByText('New booking request for Grand Turf');
    expect(screen.getByText('View Booking →')).toBeInTheDocument();

    fireEvent.click(bookingNotif);

    await waitFor(() => {
      expect(notificationsApiMock.markRead).toHaveBeenCalledWith('notif-2');
      expect(screen.getByTestId('location-display')).toHaveTextContent('/my-bookings');
    });
  });

  it('SupportTickets component opens the ticket directly when ticketId is in query params', async () => {
    supportApiMock.getTicket.mockResolvedValue({
      id: 'ticket-999',
      creator_id: 'user-1',
      subject: 'Payment Issue',
      description: 'Need help with payment',
      status: 'open',
      priority: 'high',
      category: 'billing',
      created_at: '2026-10-15T09:00:00Z',
      events: [],
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/support?ticketId=ticket-999']}>
          <SupportTickets defaultContext={null} />
          <LocationDisplay />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Payment Issue')).toBeInTheDocument();
    expect(screen.getByText(/Ticket #ticket-9/)).toBeInTheDocument();

    // Clicking "Back to tickets" clears the ticketId from query params
    const backButton = screen.getByText(/Back to tickets/i);
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/support');
      expect(screen.getByTestId('location-display')).not.toHaveTextContent('ticketId=');
    });
  });
});
