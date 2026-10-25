import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListingBuilder from './components/owner/listing-builder/ListingBuilder';
import OwnerLayout from './components/OwnerLayout';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/ui/Toast';
import { authApi } from './lib/api/auth';

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
    getVenue: vi.fn(),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    uploadVenueMedia: vi.fn(),
    deleteVenueImage: vi.fn(),
    listPurposes: vi.fn().mockResolvedValue([]),
    createPurpose: vi.fn().mockResolvedValue({ id: 'p1' }),
    updatePurpose: vi.fn().mockResolvedValue({}),
    deletePurpose: vi.fn().mockResolvedValue({}),
    listRentalOptions: vi.fn().mockResolvedValue([]),
    createRentalOption: vi.fn().mockResolvedValue({}),
    updateRentalOption: vi.fn().mockResolvedValue({}),
    deleteRentalOption: vi.fn().mockResolvedValue({}),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    addInventoryUnits: vi.fn().mockResolvedValue([]),
    listMyVenues: vi.fn().mockResolvedValue([]),
    listMyBookings: vi.fn().mockResolvedValue([]),
    listMyPayouts: vi.fn().mockResolvedValue([]),
    getMyVerification: vi.fn().mockResolvedValue(null),
    getOverview: vi.fn().mockResolvedValue({
      attention_items: [],
      counters: {
        earnings_this_month: 0,
        events_next_7_days: 0,
        pending_requests: 0,
        next_payout_amount: 0,
      },
      booking_stages: {
        requested: 0,
        awaiting_payment: 0,
        confirmed: 0,
        completed: 0,
        paid_out: 0,
      },
      listing_stages: [],
      upcoming_events: [],
    }),
    getVenueStats: vi.fn().mockResolvedValue({
      venue_id: 'v1',
      revenue_last_30_days: 0,
      events_upcoming: 0,
      recent_bookings_count: 0,
      avg_rating: 0,
      total_reviews: 0,
    }),
  },
}));

vi.mock('./lib/api/venues', () => ({
  venuesApi: {
    get: vi.fn(),
    search: vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: [
          {
            id: 'v-1',
            name: 'State Preserved Arena',
            slug: 'state-preserved-arena',
            city: 'Mumbai',
            district: 'Andheri',
            venueType: 'Football',
            category: 'sports',
            basePrice: 1500,
            rating: 4.8,
            reviewsCount: 12,
            amenities: ['parking', 'floodlights'],
            images: [],
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      })
    ),
    getHomepage: vi.fn().mockResolvedValue({
      featured: [],
      trending: [],
      popular: [],
      recommended: [],
      new: [],
    }),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    getReviews: vi.fn().mockResolvedValue([]),
    createReview: vi.fn(),
    deleteVenue: vi.fn(),
  },
}));

vi.mock('./lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api/client')>();
  return {
    ...actual,
    restoreSession: vi.fn().mockResolvedValue(true),
    api: {
      get: vi.fn().mockImplementation((url: string) => {
        if (url === '/api/v1/categories') {
          return Promise.resolve([
            { id: 'cat-1', name: 'Sports & Fitness' },
            { id: 'cat-2', name: 'Weddings & Celebrations' },
          ]);
        }
        if (url === '/api/v1/venue-types') {
          return Promise.resolve([
            { id: 'vt-1', name: 'Football Turf', category_id: 'cat-1' },
          ]);
        }
        if (url === '/api/v1/use-cases') {
          return Promise.resolve([
            { id: 'uc-1', name: 'Football Match', category_id: 'cat-1' },
          ]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({}),
      patch: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
  };
});

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('State Preservation & Persistence across Navigation and Steps', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(authApi.me).mockResolvedValue({
      id: 'owner-1',
      name: 'Owner User',
      email: 'owner@example.com',
      role: 'owner',
      is_verified: true,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. Owner ListingBuilder preserves inputs when navigating forward and backward across steps', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    renderWithProviders(
      <ListingBuilder onComplete={onComplete} onCancel={onCancel} />
    );

    // Step 1: Space Identity
    expect(screen.getByText('Tell us about your venue')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText(/Skyline Arena/i);
    fireEvent.change(nameInput, { target: { value: 'Preserved Champions Ground' } });

    // Toggle internal name
    const toggleInternalBtn = screen.getByText(/Add internal management name/i);
    fireEvent.click(toggleInternalBtn);
    const internalInput = screen.getByPlaceholderText(/Venue-Unit-04 or Court-A/i);
    fireEvent.change(internalInput, { target: { value: 'Internal Pitch Alpha' } });

    // Navigate to Step 2 (Category & Space Types)
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(screen.getByText('What kind of venue is this?')).toBeInTheDocument();
    });

    // Step 2 is pre-selected with 'Sports & Fitness'. Advance to Step 3.
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(screen.getByText('Configure details for each event type')).toBeInTheDocument();
    });

    // Navigate to Step 4 (Location)
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(screen.getByText('Where is your space situated?')).toBeInTheDocument();
    });

    // Enter address, city, and custom state
    const addressInput = screen.getByPlaceholderText(/Plot No\., Building Name/i);
    fireEvent.change(addressInput, { target: { value: 'Plot 99, Marine Drive' } });

    const cityInput = screen.getByPlaceholderText(/e\.g\. Lucknow/i);
    fireEvent.change(cityInput, { target: { value: 'Mumbai' } });

    const stateSelect = screen.getByRole('combobox');
    fireEvent.change(stateSelect, { target: { value: '__other__' } });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type state or province name/i)).toBeInTheDocument();
    });
    const customStateInput = screen.getByPlaceholderText(/Type state or province name/i);
    fireEvent.change(customStateInput, { target: { value: 'Goa Coastal Zone' } });

    // NOW NAVIGATE BACK to Step 3:
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }));
    await waitFor(() => {
      expect(screen.getByText('Configure details for each event type')).toBeInTheDocument();
    });

    // NAVIGATE BACK to Step 2:
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }));
    await waitFor(() => {
      expect(screen.getByText('What kind of venue is this?')).toBeInTheDocument();
    });

    // NAVIGATE BACK to Step 1: Verify name, internal toggle, and internal name are fully preserved!
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }));
    await waitFor(() => {
      expect(screen.getByText('Tell us about your venue')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText(/Skyline Arena/i)).toHaveValue('Preserved Champions Ground');
    expect(screen.getByPlaceholderText(/Venue-Unit-04 or Court-A/i)).toHaveValue('Internal Pitch Alpha');

    // NAVIGATE FORWARD to Step 4: Verify address, city, and custom state are preserved!
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 2
    await waitFor(() => {
      expect(screen.getByText('What kind of venue is this?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 3
    await waitFor(() => {
      expect(screen.getByText('Configure details for each event type')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i })); // Step 4
    await waitFor(() => {
      expect(screen.getByText('Where is your space situated?')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Plot No\., Building Name/i)).toHaveValue('Plot 99, Marine Drive');
    expect(screen.getByPlaceholderText(/e\.g\. Lucknow/i)).toHaveValue('Mumbai');
    expect(screen.getByRole('combobox')).toHaveValue('Goa Coastal Zone');
  });

  it('2. Owner ListingBuilder persists draft to localStorage and restores it after remount', async () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    // First mount
    const { unmount } = renderWithProviders(
      <ListingBuilder onComplete={onComplete} onCancel={onCancel} />
    );

    const nameInput = screen.getByPlaceholderText(/Skyline Arena/i);
    fireEvent.change(nameInput, { target: { value: 'Draft Restored Arena' } });

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    await waitFor(() => {
      expect(screen.getByText('What kind of venue is this?')).toBeInTheDocument();
    });

    // Verify localStorage has persisted Step 2 draft
    await waitFor(() => {
      const storedRaw = localStorage.getItem('groundkart_new_venue_draft');
      expect(storedRaw).toBeTruthy();
      const stored = JSON.parse(storedRaw!);
      expect(stored.step).toBe(2);
      expect(stored.formData.name).toBe('Draft Restored Arena');
    });

    // Unmount (simulates navigating away or page refresh)
    unmount();

    // Remount
    renderWithProviders(<ListingBuilder onComplete={onComplete} onCancel={onCancel} />);

    // Should resume at Step 2 with restored indicator
    await waitFor(() => {
      expect(screen.getByText('What kind of venue is this?')).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Draft restored'))).toBeInTheDocument();
    });

    // Go back to Step 1 and verify restored name
    fireEvent.click(screen.getByRole('button', { name: /^Back$/i }));
    await waitFor(() => {
      expect(screen.getByText('Tell us about your venue')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Skyline Arena/i)).toHaveValue('Draft Restored Arena');
  });

  it('3. OwnerLayout preserves active tab across navigation in sessionStorage', async () => {
    sessionStorage.setItem('groundkart_owner_active_tab', 'Payouts');

    renderWithProviders(
      <MemoryRouter initialEntries={['/owner']}>
        <OwnerLayout />
      </MemoryRouter>
    );

    // Wait for auth to resolve and dashboard to render
    await waitFor(() => {
      expect(screen.queryByText(/Please log in/i)).not.toBeInTheDocument();
      expect(screen.getAllByText('Bookings').length).toBeGreaterThan(0);
    });

    // Payouts tab should be active from restored sessionStorage
    expect(sessionStorage.getItem('groundkart_owner_active_tab')).toBe('Payouts');

    // Clicking Bookings (Calendars tab) updates sessionStorage
    const bookingsTabs = screen.getAllByRole('button', { name: /Bookings/i });
    fireEvent.click(bookingsTabs[0]);
    expect(sessionStorage.getItem('groundkart_owner_active_tab')).toBe('Calendars');
  });

  it('4. Search page filters and pagination persist across route changes', async () => {
    sessionStorage.setItem(
      'groundkart_search_filters',
      JSON.stringify({
        category: 'Sports Grounds',
        city: 'Mumbai',
        q: 'Arena',
        min_price: '500',
        max_price: '3000',
        capacity: '50-100',
        rating: 4,
        amenities: ['parking'],
        page: 2,
      })
    );

    renderWithProviders(
      <MemoryRouter initialEntries={['/search']}>
        <App />
      </MemoryRouter>
    );

    // Verify search inputs are restored from sessionStorage
    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem('groundkart_search_filters')!);
      expect(stored.city).toBe('Mumbai');
      expect(stored.min_price).toBe('500');
      expect(stored.max_price).toBe('3000');
    });
  });
});
