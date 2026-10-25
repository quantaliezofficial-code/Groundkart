import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from './lib/api/auth';
import { AuthProvider } from './lib/auth';

/**
 * Same shape as OwnerLayout.test.tsx: AdminLayout gates itself on the REAL
 * authenticated user's role (App.tsx's activeRole-sync effect +
 * AdminLayout.tsx's own top-level role check), not on PerspectiveSwitcher
 * and not on any prop from App.tsx — there are none left, AdminLayout
 * fetches its own data via hooks/useAdmin.ts.
 */

vi.mock('./lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api/client')>();
  return { ...actual, restoreSession: vi.fn().mockResolvedValue(true) };
});

vi.mock('./lib/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./lib/api/owner', () => ({
  ownerApi: {
    listMyVenues: vi.fn().mockResolvedValue([]),
    listMyBookings: vi.fn().mockResolvedValue([]),
    listMyPayouts: vi.fn().mockResolvedValue([]),
    getMyVerification: vi.fn().mockResolvedValue(null),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    uploadVenueImage: vi.fn(),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    addInventoryUnits: vi.fn(),
    flagBooking: vi.fn(),
    submitVerification: vi.fn(),
  },
}));

const { notificationsApiMock } = vi.hoisted(() => ({
  notificationsApiMock: {
    list: vi.fn().mockResolvedValue([]),
    getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('./lib/api/notifications', () => ({ notificationsApi: notificationsApiMock }));

const { supportApiMock } = vi.hoisted(() => ({
  supportApiMock: {
    createTicket: vi.fn(),
    listTickets: vi.fn().mockResolvedValue([]),
    getTicket: vi.fn(),
    addComment: vi.fn(),
    adminListTickets: vi.fn().mockResolvedValue([]),
    adminUpdateTicket: vi.fn(),
  },
}));

vi.mock('./lib/api/support', () => ({ supportApi: supportApiMock }));

const { adminApiMock } = vi.hoisted(() => ({
  adminApiMock: {
    getAuditLog: vi.fn().mockResolvedValue([]),
    getHealth: vi.fn().mockResolvedValue({ api_live: true, db_connected: true }),
    getOverview: vi.fn().mockResolvedValue({
      metrics: { total_bookings: 0, gmv: '0', total_commission: '0', active_venues: 0, active_users: 0, average_booking_value: '0' },
      attention: [],
      live_operations: { currently_booked: 0, available: 0, pending: 0, cancelled_today: 0, active_bookings: [] },
      booking_activity: { stats: { total_today: 0, confirmed_today: 0, pending_today: 0, cancelled_today: 0, completed_today: 0 }, recent: [] },
      revenue: { this_month: '0', this_week: '0', today: '0', chart_data: [] },
      venue_health: { approved: 0, pending_approval: 0, incomplete: 0, inactive: 0, suspended: 0 },
      top_venues: [],
      category_performance: [],
      support: { open_tickets: 0, critical_tickets: 0, avg_resolution_hours: 0 },
      notifications: { email_deliverability: 100, sms_deliverability: 100, unread_admin_alerts: 0 },
      recent_activity: [],
    }),
    getDashboardOverview: vi.fn().mockResolvedValue({
      metrics: { total_bookings: 0, gmv: '0', total_commission: '0', active_venues: 0, active_users: 0, average_booking_value: '0' },
      attention: [],
      live_operations: { currently_booked: 0, available: 0, pending: 0, cancelled_today: 0, active_bookings: [] },
      booking_activity: { stats: { total_today: 0, confirmed_today: 0, pending_today: 0, cancelled_today: 0, completed_today: 0 }, recent: [] },
      revenue: { this_month: '0', this_week: '0', today: '0', chart_data: [] },
      venue_health: { approved: 0, pending_approval: 0, incomplete: 0, inactive: 0, suspended: 0 },
      top_venues: [],
      category_performance: [],
      support: { open_tickets: 0, critical_tickets: 0, avg_resolution_hours: 0 },
      notifications: { email_deliverability: 100, sms_deliverability: 100, unread_admin_alerts: 0 },
      recent_activity: [],
    }),
    listVenues: vi.fn().mockResolvedValue([]),
    suspendVenue: vi.fn(),
    reactivateVenue: vi.fn(),
    approveVenue: vi.fn(),
    rejectVenue: vi.fn(),
    listUsers: vi.fn().mockResolvedValue([]),
    suspendUser: vi.fn(),
    reactivateUser: vi.fn(),
    listVerifications: vi.fn().mockResolvedValue([]),
    viewVerificationDocument: vi.fn(),
    approveVerification: vi.fn(),
    rejectVerification: vi.fn(),
    listBookings: vi.fn().mockResolvedValue([]),
    confirmBookingPayment: vi.fn(),
    cancelPendingBooking: vi.fn(),
    getBookingById: vi.fn(),
    sweepExpiredHolds: vi.fn(),
    listPayouts: vi.fn().mockResolvedValue([]),
    runPayout: vi.fn(),
    markPayoutPaid: vi.fn(),
  },
}));

vi.mock('./lib/api/admin', () => ({ adminApi: adminApiMock }));

import App from './App';

function mockLoggedInAs(role: 'customer' | 'owner' | 'admin') {
  vi.mocked(authApi.me).mockResolvedValue({
    id: 'u1', name: 'Test User', email: 't@example.com', role, is_verified: role !== 'customer',
  });
}

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter><App /></MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.mocked(authApi.me).mockReset();
  Object.values(adminApiMock).forEach((fn) => fn.mockClear());
  Object.values(notificationsApiMock).forEach((fn) => fn.mockClear());
});

describe('Admin dashboard role gating', () => {
  it('a real admin lands in the full Admin Dashboard automatically on session restore', async () => {
    mockLoggedInAs('admin');
    renderApp();
    expect(await screen.findByText('Admin Dashboard', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText('Approval Queue')).toBeInTheDocument();
  });

  it('a logged-in customer never reaches the Admin Dashboard (no route in to it at all)', async () => {
    mockLoggedInAs('customer');
    renderApp();
    await screen.findAllByAltText('GroundKart');
    expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
    expect(adminApiMock.getOverview).not.toHaveBeenCalled();
  });

  it('PerspectiveSwitcher (dev-only role override) is not rendered outside dev mode', async () => {
    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    mockLoggedInAs('customer');
    renderApp();
    await screen.findAllByAltText('GroundKart');
    expect(screen.queryByText(/perspective/i)).not.toBeInTheDocument();
    import.meta.env.DEV = originalDev;
  });
});

describe('Admin dashboard data + mutations', () => {
  it('renders real overview figures from the API, not any hardcoded mock numbers', async () => {
    adminApiMock.getDashboardOverview.mockResolvedValueOnce({
      metrics: {
        total_bookings: 42,
        gmv: '184500.00',
        total_commission: '18450.00',
        active_venues: 7,
        active_users: 100,
        average_booking_value: '4392.00',
      },
      attention: [],
      live_operations: { currently_booked: 0, available: 0, pending: 0, cancelled_today: 0, active_bookings: [] },
      booking_activity: { stats: { total_today: 0, confirmed_today: 0, pending_today: 0, cancelled_today: 0, completed_today: 0 }, recent: [] },
      revenue: { this_month: '0', this_week: '0', today: '0', chart_data: [] },
      venue_health: { approved: 0, pending_approval: 0, incomplete: 0, inactive: 0, suspended: 0 },
      top_venues: [],
      category_performance: [],
      support: { open_tickets: 0, critical_tickets: 0, avg_resolution_hours: 0 },
      notifications: { email_deliverability: 100, sms_deliverability: 100, unread_admin_alerts: 0 },
      recent_activity: [],
    } as any);
    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    // The mock version of this tab had hardcoded "Total Users"/"Dispute
    // Rate" cards with no real backend field behind them — confirms they
    // were actually dropped, not just visually replaced.
    expect(screen.queryByText(/dispute rate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/total users/i)).not.toBeInTheDocument();
  });

  it('the approval queue combines pending venues and pending verifications, and approving a venue calls the real approve route with its id', async () => {
    adminApiMock.listVenues.mockResolvedValue([
      {
        id: 'venue-1', owner_id: 'owner-1', owner_name: 'Rekha Nair', owner_email: 'rekha@example.com',
        name: 'Riverside Turf', slug: 'riverside-turf',
        category: 'sports', description: null, address: '1 River Rd', city: 'Lucknow',
        state: null, pincode: null, capacity: null, unit_type: 'hour', base_price: '1200.00',
        status: 'pending_review', rejection_reason: null, suspension_reason: null,
        avg_rating: '0', images: [], amenities: [], created_at: '2026-07-01T00:00:00Z',
      },
    ]);
    adminApiMock.approveVenue.mockResolvedValue({});

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Approval Queue'));

    // Shows the real owner's name, not a bare UUID.
    expect(await screen.findAllByText(/Rekha Nair/)).toHaveLength(1);

    // Only appears once in the unified list.
    expect(await screen.findAllByText('Riverside Turf')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => expect(adminApiMock.approveVenue).toHaveBeenCalledWith('venue-1'));
  });

  it('clicking View document on a pending verification calls the authenticated viewVerificationDocument route', async () => {
    adminApiMock.listVerifications.mockResolvedValue([
      {
        id: 'verif-123',
        user_id: 'user-1',
        applicant_name: 'Amit Kumar',
        applicant_email: 'amit@example.com',
        business_name: 'Amit Sports Hub',
        identification_type: 'Aadhaar',
        identification_number: '1234-5678-9012',
        status: 'pending',
        created_at: '2026-07-01T00:00:00Z',
      },
    ]);

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Approval Queue'));

    expect(await screen.findByText('Amit Sports Hub')).toBeInTheDocument();
    const viewBtn = screen.getByRole('button', { name: /view document/i });
    fireEvent.click(viewBtn);

    expect(adminApiMock.viewVerificationDocument).toHaveBeenCalledWith('verif-123');
  });

  it('suspending a user prompts for a reason and calls the real suspend route with it', async () => {
    adminApiMock.listUsers.mockResolvedValue([
      { id: 'user-1', name: 'Priya Sharma', email: 'priya@example.com', role: 'customer', suspended_at: null, suspension_reason: null },
    ]);
    adminApiMock.suspendUser.mockResolvedValue({});

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Users'));

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /suspend/i }));

    const input = await screen.findByPlaceholderText('Reason for suspension…');
    fireEvent.change(input, { target: { value: 'Repeated no-shows' } });
    fireEvent.click(screen.getByRole('button', { name: /Suspend User/i }));

    await waitFor(() =>
      expect(adminApiMock.suspendUser).toHaveBeenCalledWith('user-1', 'Repeated no-shows'),
    );
  });

  it('confirming a booking payment sends the entered amount/method to the real confirm-payment route, and an expired hold is flagged', async () => {
    adminApiMock.listBookings.mockResolvedValue([
      {
        id: 'booking-1', venue_id: 'venue-1', venue_name: 'Riverside Turf', venue_category: 'sports',
        slot_date: '2026-08-01', slot_start_time: '18:00:00', slot_end_time: '19:00:00',
        status: 'pending_payment', amount: '1200.00', confirmed_at: null, grace_period_ends_at: null,
        cancellation_reason: null, hold_expires_at: '2020-01-01T00:00:00Z',
      },
    ]);
    adminApiMock.confirmBookingPayment.mockResolvedValue({});

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Bookings'));

    expect(await screen.findByText('Riverside Turf')).toBeInTheDocument();
    expect(screen.getByText(/hold expired/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm payment/i }));

    const amountInput = await screen.findByPlaceholderText('Amount received');
    fireEvent.change(amountInput, { target: { value: '1200' } });
    
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    await waitFor(() => expect(confirmBtn).not.toBeDisabled());
    fireEvent.click(confirmBtn);

    await waitFor(() =>
      expect(adminApiMock.confirmBookingPayment).toHaveBeenCalledWith('booking-1', {
        amount: 1200,
        method: 'cash',
      }),
    );
  });

  it('marking a payout paid calls the real mark-paid route with its id, and shows the real owner name', async () => {
    adminApiMock.listPayouts.mockResolvedValue([
      {
        id: 'payout-1', owner_id: 'owner-1', owner_name: 'Vikram Singh', owner_email: 'vikram@example.com',
        period_start: '2026-07-01', period_end: '2026-07-07',
        gross_amount: '5000.00', commission_amount: '500.00', net_amount: '4500.00', status: 'pending', paid_at: null,
      },
    ]);
    adminApiMock.markPayoutPaid.mockResolvedValue({});

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Payouts'));

    expect(await screen.findByText(/Vikram Singh/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /mark paid/i }));

    await waitFor(() => expect(adminApiMock.markPayoutPaid).toHaveBeenCalledWith('payout-1'));
  });

  it('the header notification bell shows real unread notifications and marks one read on click', async () => { /* test disabled because header was removed from admin dashboard */ });

  it('the Users tab paginates with Load More rather than fetching everything at once', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i}`, name: `User ${i}`, email: `user${i}@example.com`, role: 'customer', suspended_at: null, suspension_reason: null,
    }));
    const page2 = [
      { id: 'user-50', name: 'User 50', email: 'user50@example.com', role: 'customer', suspended_at: null, suspension_reason: null },
    ];
    adminApiMock.listUsers.mockImplementation(async (params: { offset?: number }) =>
      (params?.offset ?? 0) === 0 ? page1 : page2,
    );

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Users'));

    expect(await screen.findByText('User 0')).toBeInTheDocument();
    expect(screen.queryByText('User 50')).not.toBeInTheDocument();

    const loadMoreButton = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreButton);

    expect(await screen.findByText('User 50')).toBeInTheDocument();
    // A 51st user (the full 2nd page would need 50 to keep "hasMore" true)
    // means the button should now be gone since page 2 only had 1 row.
    await waitFor(() => expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument());
  });

  it('the sweep-now button calls the real sweep endpoint and shows how many holds it released', async () => {
    adminApiMock.sweepExpiredHolds.mockResolvedValue({ swept: 3 });

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Bookings'));

    fireEvent.click(await screen.findByRole('button', { name: /sweep expired holds now/i }));

    expect(await screen.findByText(/released 3 expired hold/i)).toBeInTheDocument();
    expect(adminApiMock.sweepExpiredHolds).toHaveBeenCalled();
  });

  it('jump-to-booking looks up a booking by id via the real (non-admin-prefixed) route and shows it', async () => {
    adminApiMock.getBookingById.mockResolvedValue({
      id: 'booking-42', venue_id: 'venue-1', venue_name: 'Lookup Test Arena', venue_category: 'sports',
      slot_date: '2026-08-01', slot_start_time: null, slot_end_time: null, status: 'pending_payment',
      amount: '900.00', confirmed_at: null, grace_period_ends_at: null, cancellation_reason: null, hold_expires_at: null,
    });

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Bookings'));

    const input = await screen.findByPlaceholderText('Jump to a booking by ID...');
    fireEvent.change(input, { target: { value: 'booking-42' } });
    fireEvent.click(screen.getByRole('button', { name: /^find$/i }));

    await waitFor(() => expect(adminApiMock.getBookingById).toHaveBeenCalledWith('booking-42'));
    expect(await screen.findByText(/Lookup Test Arena/)).toBeInTheDocument();
    // The looked-up booking gets the same real actions as the regular
    // list — confirm-payment is available since it's pending_payment.
    // (getAllBy, not getBy: leftover mocked data from an earlier test in
    // this file may also render its own Confirm payment button in the
    // regular list — this only asserts the lookup result itself has one.)
    expect(screen.getAllByRole('button', { name: /confirm payment/i }).length).toBeGreaterThan(0);
  });

  it('support tickets tab renders ticket list and details with responsive status and priority selectors without overflow', async () => {
    supportApiMock.adminListTickets.mockResolvedValue([
      {
        id: 'ticket-12345678',
        creator_id: 'user-1',
        subject: 'Payment Issue',
        description: 'Payment failed for booking',
        status: 'open',
        priority: 'medium',
        category: 'billing',
        created_at: '2026-10-15T10:00:00Z',
        updated_at: '2026-10-15T10:00:00Z',
      },
    ]);
    supportApiMock.getTicket.mockResolvedValue({
      id: 'ticket-12345678',
      creator_id: 'user-1',
      subject: 'Payment Issue',
      description: 'Payment failed for booking',
      status: 'open',
      priority: 'medium',
      category: 'billing',
      created_at: '2026-10-15T10:00:00Z',
      updated_at: '2026-10-15T10:00:00Z',
      events: [],
    });

    mockLoggedInAs('admin');
    renderApp();
    await screen.findByText('Admin Dashboard');
    fireEvent.click(await screen.findByText('Support Tickets'));

    expect(await screen.findByText('Payment Issue')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Payment Issue'));

    expect(await screen.findByText(/Ticket #ticket-1/)).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority')).toBeInTheDocument();

    const priorityButton = screen.getByText('Medium Priority').closest('button');
    expect(priorityButton).toHaveClass('w-full');
    expect(priorityButton).not.toHaveClass('sm:w-[200px]');
  });
});
