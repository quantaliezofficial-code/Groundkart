import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListingBuilder from './ListingBuilder';
import { ownerApi } from '../../../lib/api/owner';
import { ApiError } from '../../../lib/api/client';
import { ToastProvider } from '../../ui/Toast';

vi.mock('../../../lib/api/owner', () => ({
  ownerApi: {
    getVenue: vi.fn(),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    uploadVenueMedia: vi.fn(),
    deleteVenueImage: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {ui}
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('ListingBuilder 3-photo rule and toast integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('disables Next on Step 4 when fewer than 3 photos exist and shows warning', async () => {
    // venue with only 2 photos
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-123',
      owner_id: 'owner-1',
      name: 'Test Venue',
      display_name: null,
      tagline: null,
      slug: 'test-venue',
      address: '123 St',
      city: 'City',
      state: null,
      pincode: null,
      capacity: null,
      unit_type: 'hour',
      base_price: '1000',
      status: 'draft',
      rejection_reason: null,
      suspension_reason: null,
      avg_rating: '0',
      amenities: [],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: null,
      media: [
        { id: '1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: '2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
      ],
    });

    renderWithProviders(
      <ListingBuilder venueId="venue-123" onClose={() => {}} onComplete={() => {}} />
    );

    // Advance to Step 4 (MediaStep)
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 4

    await waitFor(() => {
      expect(screen.getByText(/Showcase your venue/i)).toBeInTheDocument();
    });

    // Warning is visible
    expect(screen.getByRole('alert')).toHaveTextContent(/Add at least 1 more photo to proceed/i);

    // Next button is disabled
    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it('enables Next on Step 4 when at least 3 photos exist', async () => {
    // venue with 3 photos
    vi.mocked(ownerApi.getVenue).mockResolvedValue({
      id: 'venue-123',
      owner_id: 'owner-1',
      name: 'Test Venue',
      display_name: null,
      tagline: null,
      slug: 'test-venue',
      address: '123 St',
      city: 'City',
      state: null,
      pincode: null,
      capacity: null,
      unit_type: 'hour',
      base_price: '1000',
      status: 'draft',
      rejection_reason: null,
      suspension_reason: null,
      avg_rating: '0',
      amenities: [],
      content_blocks: [],
      created_at: new Date().toISOString(),
      description: null,
      media: [
        { id: '1', url: 'https://example.com/1.jpg', is_cover: true, sort_order: 0 },
        { id: '2', url: 'https://example.com/2.jpg', is_cover: false, sort_order: 1 },
        { id: '3', url: 'https://example.com/3.jpg', is_cover: false, sort_order: 2 },
      ],
    });

    renderWithProviders(
      <ListingBuilder venueId="venue-123" onClose={() => {}} onComplete={() => {}} />
    );

    // Advance to Step 4
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // to step 4

    await waitFor(() => {
      expect(screen.getByText('Photos: 3/3 required')).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: /next/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it('shows real server ApiError message in a toast instead of window.alert on draft creation failure', async () => {
    vi.mocked(ownerApi.createVenue).mockRejectedValueOnce(
      new ApiError(422, 'City is not currently supported')
    );

    renderWithProviders(
      <ListingBuilder onClose={() => {}} onComplete={() => {}} />
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    // Step 3 -> attempts createVenue
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      // Toast with role="alert" has the real server message
      expect(screen.getByRole('alert')).toHaveTextContent('City is not currently supported');
    });

    // window.alert was NOT called
    expect(window.alert).not.toHaveBeenCalled();
  });
});
