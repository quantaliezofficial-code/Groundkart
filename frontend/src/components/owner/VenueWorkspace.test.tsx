import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VenueWorkspace from './VenueWorkspace';
import { AuthProvider } from '../../lib/auth';
import { authApi } from '../../lib/api/auth';
import { ownerApi } from '../../lib/api/owner';
import { venuesApi } from '../../lib/api/venues';
import type { ApiVenue } from '../../lib/api/types';

vi.mock('../../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>();
  return { ...actual, restoreSession: vi.fn().mockResolvedValue(true) };
});

vi.mock('../../lib/api/auth', () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({
      id: 'u1',
      name: 'Anita Desai',
      email: 'anita@example.com',
      role: 'owner',
      is_verified: true,
    }),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/api/venues', () => ({
  venuesApi: {
    get: vi.fn(),
    getReviews: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../lib/api/owner', () => ({
  ownerApi: {
    getVenue: vi.fn(),
    getVenueStats: vi.fn().mockResolvedValue({
      venue_id: 'v123',
      name: 'Grand Eden Lawn',
      revenue_last_30_days: '50000',
      events_upcoming: 2,
      recent_bookings_count: 5,
      avg_rating: '4.6',
    }),
    listMyBookings: vi.fn().mockResolvedValue([]),
    updateVenue: vi.fn().mockResolvedValue({}),
    listPurposes: vi.fn().mockResolvedValue([]),
    listRentalOptions: vi.fn().mockResolvedValue([]),
    getContentBlocks: vi.fn().mockResolvedValue([]),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../ui/Toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockVenue: ApiVenue = {
  id: 'v123',
  owner_id: 'u1',
  name: 'Grand Eden Lawn',
  display_name: 'Grand Eden Premium Pavilion',
  tagline: 'Best turf for cricket and events',
  slug: 'grand-eden-lawn',
  description: 'Lush green outfield and modern pavilion',
  category: 'Sports & Turf',
  address: '123 Stadium Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  pincode: '400001',
  capacity: 350,
  base_price: '5000.00',
  unit_type: 'hour',
  status: 'active',
  rejection_reason: null,
  suspension_reason: null,
  avg_rating: '4.8',
  content_blocks: [],
  amenities: ['High-Speed Wi-Fi', 'Free On-site Parking', 'Night Floodlights'],
  created_at: '2026-01-01T00:00:00Z',
  media: [],
};

function renderWorkspace(venue = mockVenue) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const onClose = vi.fn();
  const onOpenListingBuilder = vi.fn();

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <VenueWorkspace
            venue={venue}
            onClose={onClose}
            onOpenListingBuilder={onOpenListingBuilder}
          />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );

  return { ...rendered, onClose, onOpenListingBuilder };
}

describe('VenueWorkspace - Space Details and Amenities Editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ownerApi.getVenue).mockResolvedValue(mockVenue);
  });

  it('renders Overview tab with Features & Amenities and Space & Location Info cards', async () => {
    renderWorkspace();

    expect(screen.getByText('Grand Eden Lawn')).toBeInTheDocument();
    expect(screen.getByText('Features & Amenities')).toBeInTheDocument();
    expect(screen.getByText('High-Speed Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Free On-site Parking')).toBeInTheDocument();
    expect(screen.getByText('Night Floodlights')).toBeInTheDocument();

    expect(screen.getByText('Space & Location Info')).toBeInTheDocument();
    expect(screen.getByText('350 guests/players')).toBeInTheDocument();
    expect(screen.getByText(/123 Stadium Road, Mumbai/i)).toBeInTheDocument();
  });

  it('navigates to Space Details tab and updates venue details via ownerApi.updateVenue', async () => {
    renderWorkspace();

    // Click Space Details tab
    const detailsTab = screen.getByRole('button', { name: /^Space Details$/i });
    fireEvent.click(detailsTab);

    // Form inputs should be populated with existing venue values
    const nameInput = screen.getByPlaceholderText('e.g. Grand Eden Lawn');
    expect(nameInput).toHaveValue('Grand Eden Lawn');

    const addressInput = screen.getByPlaceholderText('e.g. Plot 14, Main Stadium Road');
    expect(addressInput).toHaveValue('123 Stadium Road');

    // Update name and tagline
    fireEvent.change(nameInput, { target: { value: 'Grand Eden Sports Arena' } });
    const taglineInput = screen.getByPlaceholderText('e.g. Premier floodlit turf and pavilion');
    fireEvent.change(taglineInput, { target: { value: 'World class turf and sports amenities' } });

    // Click Save Space Details
    const saveButtons = screen.getAllByRole('button', { name: /Save Space Details/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(ownerApi.updateVenue).toHaveBeenCalledWith('v123', expect.objectContaining({
        name: 'Grand Eden Sports Arena',
        tagline: 'World class turf and sports amenities',
        address: '123 Stadium Road',
        city: 'Mumbai',
      }));
    });
  });

  it('clicking Edit Details from Overview jumps directly to Space Details tab', async () => {
    renderWorkspace();

    const editDetailsBtn = screen.getByRole('button', { name: /^Edit Details$/i });
    fireEvent.click(editDetailsBtn);

    expect(await screen.findByRole('heading', { level: 3, name: /Space Details & Location/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Grand Eden Lawn')).toBeInTheDocument();
  });

  it('navigates to Amenities tab and allows editing and saving amenities', async () => {
    renderWorkspace();

    // Click Amenities tab
    const amenitiesTab = screen.getByRole('button', { name: /^Amenities$/i });
    fireEvent.click(amenitiesTab);

    expect(await screen.findByRole('heading', { level: 3, name: /Venue Amenities & Equipment/i })).toBeInTheDocument();

    // Air Conditioning can be selected
    const acCheckbox = screen.getByText('Air Conditioning');
    fireEvent.click(acCheckbox);

    // Save Amenities button
    const saveButtons = screen.getAllByRole('button', { name: /Save Amenities/i });
    expect(saveButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(ownerApi.updateVenue).toHaveBeenCalledWith('v123', expect.objectContaining({
        amenity_names: expect.arrayContaining(['High-Speed Wi-Fi', 'Air Conditioning']),
      }));
    });
  });

  it('clicking Manage Amenities from Overview jumps directly to Amenities tab', async () => {
    renderWorkspace();

    const manageAmenitiesBtn = screen.getByRole('button', { name: /^Manage Amenities$/i });
    fireEvent.click(manageAmenitiesBtn);

    expect(await screen.findByRole('heading', { level: 3, name: /Venue Amenities & Equipment/i })).toBeInTheDocument();
  });
});
