import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './lib/auth';
import { venuesApi } from './lib/api/venues';
import type { VenueListResponse, ApiVenue } from './lib/api/types';

vi.mock('./lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api/client')>();
  return {
    ...actual,
    restoreSession: vi.fn().mockResolvedValue(false),
  };
});

const mockVenue1: ApiVenue = {
  id: 'venue-old-cheapest',
  owner_id: 'owner-1',
  name: 'Budget Turf Arena',
  display_name: 'Budget Turf Arena',
  tagline: 'Affordable turf in city',
  slug: 'budget-turf-arena',
  category: 'sports',
  description: 'Outdoor sports ground',
  address: '123 Station Rd',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  unit_type: 'hour',
  capacity: 50,
  base_price: '800.00',
  status: 'active',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '4.2',
  review_count: 10,
  media: [{ id: 'm1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 1 }],
  content_blocks: [
    {
      id: 'cb1',
      venue_id: 'venue-old-cheapest',
      type: 'specifications',
      title: 'Specs',
      subtitle: null,
      body: null,
      media_reference: null,
      settings: { environment: 'Outdoor' },
      sort_order: 1,
      enabled: true,
    },
  ],
  amenities: ['Free Parking', 'Drinking Water'],
  created_at: '2026-01-01T10:00:00Z',
};

const mockVenue2: ApiVenue = {
  id: 'venue-newest-luxury',
  owner_id: 'owner-2',
  name: 'Grand Royal Banquet & Turf',
  display_name: 'Grand Royal Banquet & Turf',
  tagline: 'Brand new luxury indoor turf & banquet',
  slug: 'grand-royal-banquet',
  category: 'banquet_hall',
  description: 'Luxury indoor air-conditioned banquet hall and arena',
  address: '456 Royal Lane',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226010',
  unit_type: 'hour',
  capacity: 200,
  base_price: '5500.00',
  status: 'active',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '4.9',
  review_count: 28,
  media: [{ id: 'm2', url: 'https://example.com/2.jpg', is_cover: true, sort_order: 1 }],
  content_blocks: [
    {
      id: 'cb2',
      venue_id: 'venue-newest-luxury',
      type: 'specifications',
      title: 'Specs',
      subtitle: null,
      body: null,
      media_reference: null,
      settings: { environment: 'Indoor' },
      sort_order: 1,
      enabled: true,
    },
  ],
  amenities: [
    'Free Parking',
    'Air Conditioning',
    'High-Speed WiFi',
    'Stadium Lighting',
    'Locker Rooms',
    'Power Backup',
  ],
  created_at: '2026-10-20T10:00:00Z',
};

const mockVenue3: ApiVenue = {
  id: 'venue-mid-rated',
  owner_id: 'owner-3',
  name: 'City Tennis & Badminton Courts',
  display_name: 'City Tennis Courts',
  tagline: 'Standard tennis court',
  slug: 'city-tennis-courts',
  category: 'sports',
  description: 'Outdoor courts with lighting',
  address: '789 Stadium Ave',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226020',
  unit_type: 'hour',
  capacity: 30,
  base_price: '1800.00',
  status: 'active',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '3.5',
  review_count: 5,
  media: [{ id: 'm3', url: 'https://example.com/3.jpg', is_cover: true, sort_order: 1 }],
  content_blocks: [],
  amenities: ['Floodlights', 'Changing Rooms'],
  created_at: '2026-05-15T10:00:00Z',
};

const mockVenueList: VenueListResponse = {
  data: [mockVenue1, mockVenue2, mockVenue3],
  total: 3,
  limit: 20,
  offset: 0,
};

vi.mock('./lib/api/venues', () => ({
  venuesApi: {
    get: vi.fn(),
    search: vi.fn().mockImplementation(() => Promise.resolve(mockVenueList)),
    getHomepage: vi.fn().mockImplementation(() =>
      Promise.resolve({ featured: [], trending: [], popular: [], recommended: [], new: [] })
    ),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    getReviews: vi.fn().mockResolvedValue([]),
    createReview: vi.fn(),
    deleteVenue: vi.fn(),
  },
}));

function renderSearchApp(initialEntries: string[] = ['/search']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function getRenderedVenueTitles(): string[] {
  const grid = document.getElementById('results-grid');
  if (!grid) return [];
  const headings = Array.from(grid.querySelectorAll('h3'));
  return headings.map((h) => h.textContent?.trim() || '');
}

describe('Catalog Advanced Filtering & Sorting End-to-End', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(venuesApi.search).mockResolvedValue(mockVenueList);
  });

  it('renders all 3 mock venues on initial search page load', async () => {
    renderSearchApp(['/search']);

    expect(await screen.findByText('Budget Turf Arena')).toBeInTheDocument();
    expect(screen.getByText('Grand Royal Banquet & Turf')).toBeInTheDocument();
    expect(screen.getByText('City Tennis Courts')).toBeInTheDocument();
  });

  it('sorts by "Newest Venues" and places the newly created venue first', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    const sortSelect = screen.getByLabelText(/sort venues/i);
    fireEvent.change(sortSelect, { target: { value: 'newest' } });

    const venueTitles = getRenderedVenueTitles();
    expect(venueTitles[0]).toBe('Grand Royal Banquet & Turf');
    expect(venueTitles[1]).toBe('City Tennis Courts');
    expect(venueTitles[2]).toBe('Budget Turf Arena');
  });

  it('sorts by "Price: Low to High" and places the cheapest venue first', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    const sortSelect = screen.getByLabelText(/sort venues/i);
    fireEvent.change(sortSelect, { target: { value: 'price_asc' } });

    const venueTitles = getRenderedVenueTitles();
    expect(venueTitles[0]).toBe('Budget Turf Arena'); // ₹800
    expect(venueTitles[1]).toBe('City Tennis Courts'); // ₹1800
    expect(venueTitles[2]).toBe('Grand Royal Banquet & Turf'); // ₹5500
  });

  it('sorts by "Price: High to Low" and places the most expensive venue first', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    const sortSelect = screen.getByLabelText(/sort venues/i);
    fireEvent.change(sortSelect, { target: { value: 'price_desc' } });

    const venueTitles = getRenderedVenueTitles();
    expect(venueTitles[0]).toBe('Grand Royal Banquet & Turf'); // ₹5500
    expect(venueTitles[1]).toBe('City Tennis Courts'); // ₹1800
    expect(venueTitles[2]).toBe('Budget Turf Arena'); // ₹800
  });

  it('sorts by "Highest Rated" and places the highest rated venue first', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    const sortSelect = screen.getByLabelText(/sort venues/i);
    fireEvent.change(sortSelect, { target: { value: 'rating_desc' } });

    const venueTitles = getRenderedVenueTitles();
    expect(venueTitles[0]).toBe('Grand Royal Banquet & Turf'); // 4.9 rating
    expect(venueTitles[1]).toBe('Budget Turf Arena'); // 4.2 rating
    expect(venueTitles[2]).toBe('City Tennis Courts'); // 3.5 rating
  });

  it('filters by amenity (Air Conditioning) and only shows the matching venue', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    // Find Air Conditioning checkbox in the sidebar
    const acCheckbox = screen.getAllByRole('checkbox')[2]; // Free Parking (0), Floodlights (1), AC (2)
    fireEvent.click(acCheckbox);

    // Only Grand Royal Banquet has AC
    expect(screen.getByText('Grand Royal Banquet & Turf')).toBeInTheDocument();
    expect(screen.queryByText('Budget Turf Arena')).not.toBeInTheDocument();
    expect(screen.queryByText('City Tennis Courts')).not.toBeInTheDocument();

    // Active filter tag appears
    expect(screen.getByText('Active:')).toBeInTheDocument();
    expect(screen.getByLabelText(/remove air conditioning filter/i)).toBeInTheDocument();

    // Clicking X on the active tag removes the filter and restores all venues
    const removeTagBtn = screen.getByLabelText(/remove air conditioning filter/i);
    fireEvent.click(removeTagBtn);

    expect(screen.getByText('Budget Turf Arena')).toBeInTheDocument();
    expect(screen.getByText('City Tennis Courts')).toBeInTheDocument();
  });

  it('filters by setting (Indoor) and only shows indoor venues', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    const indoorBtn = screen.getByRole('button', { name: 'Indoor' });
    fireEvent.click(indoorBtn);

    expect(screen.getByText('Grand Royal Banquet & Turf')).toBeInTheDocument();
    expect(screen.queryByText('Budget Turf Arena')).not.toBeInTheDocument();
  });

  it('shows friendly empty state with Clear All button when no venues match filter criteria', async () => {
    renderSearchApp(['/search']);

    await screen.findByText('Budget Turf Arena');

    // Enter a very high min price (₹99999) so no venue matches
    const minInput = screen.getAllByPlaceholderText('Min')[0];
    fireEvent.change(minInput, { target: { value: '99999' } });

    expect(await screen.findByText('No venues match your current filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear all active filters/i })).toBeInTheDocument();

    // Clicking Clear All resets filters and restores venues
    const clearBtn = screen.getByRole('button', { name: /clear all active filters/i });
    fireEvent.click(clearBtn);

    expect(await screen.findByText('Budget Turf Arena')).toBeInTheDocument();
  });
});
