import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerLayout from './components/OwnerLayout';
import { authApi } from './lib/api/auth';
import { ownerApi, getAnalytics } from './lib/api/owner';
import { venuesApi } from './lib/api/venues';
import { AuthProvider } from './lib/auth';
import type { OwnerOverview, ApiVenue } from './lib/api/types';

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

vi.mock('./lib/api/venues', () => ({
  venuesApi: {
    get: vi.fn(),
    getReviews: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./lib/api/notifications', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue([]),
    getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('./lib/api/owner', () => ({
  ownerApi: {
    listMyVenues: vi.fn(),
    listMyBookings: vi.fn(),
    listMyPayouts: vi.fn(),
    getMyVerification: vi.fn(),
    getOverview: vi.fn(),
    getVenueStats: vi.fn(),
    getVenue: vi.fn(),
    listPurposes: vi.fn().mockResolvedValue([]),
    listRentalOptions: vi.fn().mockResolvedValue([]),
    getContentBlocks: vi.fn().mockResolvedValue([]),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    updateVenue: vi.fn(),
    createVenue: vi.fn(),
    uploadVenueMedia: vi.fn(),
  },
  getAnalytics: vi.fn(),
}));

const mockVenue: ApiVenue = {
  id: 'v123',
  owner_id: 'u1',
  name: 'Grand Eden Lawn',
  display_name: 'Grand Eden Lawn',
  tagline: 'Premier event lawn',
  slug: 'grand-eden-lawn',
  description: 'Lush green lawn for cricket and weddings',
  address: '123 Park Avenue',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  capacity: 500,
  base_price: '5000.00',
  unit_type: 'hour',
  status: 'active',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '4.5',
  content_blocks: [],
  amenities: [],
  created_at: '2026-01-01T00:00:00Z',
  media: [
    {
      id: 'm1',
      url: 'https://images.example.com/lawn.jpg',
      is_cover: true,
      media_type: 'image',
      sort_order: 0,
    },
  ],
};

const mockOverview: OwnerOverview = {
  attention_items: [
    {
      id: 'att1',
      type: 'rejected_venue',
      venue_id: 'v123',
      venue_name: 'Grand Eden Lawn',
      title: 'Venue Listing Rejected',
      message: 'Please provide high-resolution photos of the pavilion.',
      severity: 'high',
    },
    {
      id: 'att2',
      type: 'payout_ready',
      title: 'Payout Ready for Processing',
      message: 'INR 15,000 ready in pending payouts.',
      amount: '15000.00',
      severity: 'medium',
    },
  ],
  counters: {
    earnings_this_month: '42500.00',
    events_next_7_days: 3,
    pending_requests: 2,
    next_payout_amount: '15000.00',
  },
  booking_stages: {
    requested: 2,
    awaiting_payment: 1,
    confirmed: 5,
    completed: 12,
    paid_out: 8,
  },
  listing_stages: [
    {
      venue_id: 'v123',
      name: 'Grand Eden Lawn',
      status: 'active',
      progress_pct: 100,
      missing_items: [],
    },
    {
      venue_id: 'v456',
      name: 'Sunset Terrace',
      status: 'draft',
      progress_pct: 60,
      missing_items: ['pricing', 'inventory'],
    },
  ],
  upcoming_events: [
    {
      booking_id: 'b1',
      venue_id: 'v123',
      venue_name: 'Grand Eden Lawn',
      purpose: 'Wedding Reception',
      purpose_name: 'Wedding Reception',
      date: '2026-10-25',
      start_time: '18:00:00',
      end_time: '23:00:00',
      guest_count: 250,
      customer_name: 'Rahul Sharma',
      payment_status: 'paid',
      booking_status: 'confirmed',
      amount: '35000.00',
    },
  ],
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <OwnerLayout />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Guide 11 Owner Dashboard & Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'u1',
      name: 'Anita Desai',
      email: 'anita@example.com',
      role: 'owner',
      is_verified: true,
    });
    vi.mocked(ownerApi.listMyVenues).mockResolvedValue([mockVenue]);
    vi.mocked(ownerApi.listMyBookings).mockResolvedValue([]);
    vi.mocked(ownerApi.listMyPayouts).mockResolvedValue([]);
    vi.mocked(ownerApi.getMyVerification).mockResolvedValue({
      id: 'verif1',
      status: 'approved',
      created_at: '2026-01-01',
    } as any);
    vi.mocked(ownerApi.getOverview).mockResolvedValue(mockOverview);
    vi.mocked(ownerApi.getVenueStats).mockResolvedValue({
      venue_id: 'v123',
      name: 'Grand Eden Lawn',
      revenue_last_30_days: '35000.00',
      events_upcoming: 3,
      recent_bookings_count: 7,
      avg_rating: '4.8',
      total_reviews: 14,
    });
    vi.mocked(ownerApi.getVenue).mockResolvedValue(mockVenue);
    vi.mocked(getAnalytics).mockResolvedValue({
      gmv: '120000.00',
      retained_gmv: '115000.00',
      refunds: '5000.00',
      platform_revenue: '12000.00',
      owner_payout: '103000.00',
      booking_count: 15,
      average_booking_value: '8000.00',
    });
  });

  it('renders Needs Your Attention banner with action buttons', async () => {
    renderDashboard();

    expect(await screen.findByText(/Needs Your Attention \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('Venue Listing Rejected')).toBeInTheDocument();
    expect(screen.getByText(/Please provide high-resolution photos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fix Listing/i })).toBeInTheDocument();

    expect(screen.getByText('Payout Ready for Processing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /View Payouts/i })).toBeInTheDocument();
  });

  it('renders four key metric counters with formatted values', async () => {
    renderDashboard();

    expect(await screen.findByText('Earnings This Month')).toBeInTheDocument();
    expect(screen.getByText('₹42,500')).toBeInTheDocument();

    expect(screen.getByText('Events in Next 7 Days')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText('Next Payout Amount')).toBeInTheDocument();
    expect(screen.getByText('₹15,000')).toBeInTheDocument();
  });

  it('renders booking stages board and navigates to calendar on stage click', async () => {
    renderDashboard();

    expect(await screen.findByText('Requested')).toBeInTheDocument();
    expect(screen.getByText('Awaiting Payment')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Paid Out')).toBeInTheDocument();

    // Clicking a stage card switches to Calendars (Bookings) tab
    const requestedBtn = screen.getByText('Requested').closest('button');
    expect(requestedBtn).toBeTruthy();
    fireEvent.click(requestedBtn!);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Bookings/i })).toBeInTheDocument();
    });
  });

  it('renders listing stages with progress bar and missing item tags', async () => {
    renderDashboard();

    expect(await screen.findByText('Sunset Terrace')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('+ pricing')).toBeInTheDocument();
    expect(screen.getByText('+ inventory')).toBeInTheDocument();
  });

  it('renders upcoming events timeline for next 14 days', async () => {
    renderDashboard();

    expect(await screen.findByText('Wedding Reception')).toBeInTheDocument();
    expect(screen.getByText(/Rahul Sharma/i)).toBeInTheDocument();
    expect(screen.getByText(/250 guests/i)).toBeInTheDocument();
    expect(screen.getByText('paid')).toBeInTheDocument();
  });

  it('renders 6-month financial performance metrics from analytics', async () => {
    renderDashboard();

    expect(await screen.findByText('₹1,20,000')).toBeInTheDocument(); // Gross Bookings
    expect(screen.getByText('₹1,03,000')).toBeInTheDocument(); // Net Payouts
    expect(screen.getByText('15')).toBeInTheDocument(); // Completed Bookings
    expect(screen.getByText('₹8,000')).toBeInTheDocument(); // Avg Booking Value
  });

  it('opens VenueWorkspace when clicking Manage Venue in Listings tab', async () => {
    renderDashboard();

    // Navigate to Listings tab
    const listingsNav = await screen.findByRole('button', { name: /^Listings$/i });
    fireEvent.click(listingsNav);

    const manageBtn = await screen.findByRole('button', { name: /Manage Venue/i });
    fireEvent.click(manageBtn);

    // Verify VenueWorkspace modal opens with venue name and 9 tabs
    expect(await screen.findByText('Back to Dashboard')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Overview$/i }).length).toBe(2);
    expect(screen.getAllByRole('button', { name: /^Calendar$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: /^Bookings$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /^Rental & Pricing$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Purposes$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Photos & Videos$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Description$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Reviews$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Settings$/i })).toBeInTheDocument();
  });
});
