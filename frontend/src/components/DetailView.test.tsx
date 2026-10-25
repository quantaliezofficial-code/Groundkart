import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import DetailView from './DetailView';
import { Venue, VenueSlot } from '../types';

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../hooks/useVenues', () => ({
  useVenueReviews: () => ({ data: [], isLoading: false }),
  useCreateReview: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../hooks/useAdmin', () => ({
  useAdminDeleteReview: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../lib/api/venues', () => ({
  venuesApi: {
    getAvailability: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('react-helmet-async', () => ({
  Helmet: ({ children }: any) => <>{children}</>,
  HelmetProvider: ({ children }: any) => <>{children}</>,
}));

const mockVenue: Venue = {
  id: 'venue-skyline',
  slug: 'skyline',
  name: 'Skyline Arena',
  city: 'Lucknow',
  district: 'Lucknow',
  image: 'https://example.com/photo-1.jpg',
  gallery: [
    'https://example.com/photo-1.jpg',
    'https://example.com/photo-2.jpg',
    'https://example.com/photo-3.jpg',
    'https://example.com/photo-4.jpg',
  ],
  basePrice: 2000,
  unitType: 'hour',
  currency: '₹',
  rating: 4.9,
  reviewCount: 12,
  category: 'Sports & Fitness',
  venueType: 'Cricket Ground & Nets',
  description: 'Top cricket ground in Lucknow with floodlights and turf nets.',
  capacity: 30,
  capacityGroup: '20+',
  amenities: ['Free Parking', 'Floodlights / Lighting', 'Changing Rooms'],
};

const mockSlots: VenueSlot[] = [
  {
    id: 'slot-1',
    date: '2026-10-20',
    startTime: '09:00',
    endTime: '10:00',
    price: 2000,
    isAvailable: true,
  },
  {
    id: 'slot-2',
    date: '2026-10-20',
    startTime: '10:00',
    endTime: '11:00',
    price: 2000,
    isAvailable: true,
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('DetailView image gallery and zoom exploration', () => {
  it('renders gallery images and explore photos button', () => {
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Skyline Arena' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view main photo of skyline arena in zoom mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view remaining 1 photos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /explore all 4 photos in zoom mode/i })).toBeInTheDocument();
  });

  it('opens lightbox in zoom mode when clicking main photo', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const mainPhoto = screen.getByRole('button', { name: /view main photo of skyline arena in zoom mode/i });
    await user.click(mainPhoto);

    expect(screen.getByRole('dialog', { name: /photo gallery for skyline arena/i })).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('opens lightbox at remaining photos index when clicking +N Photos badge', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const plusBadge = screen.getByRole('button', { name: /view remaining 1 photos/i });
    await user.click(plusBadge);

    expect(screen.getByRole('dialog', { name: /photo gallery for skyline arena/i })).toBeInTheDocument();
    expect(screen.getByText('Photo 4 of 4')).toBeInTheDocument();
  });

  it('opens lightbox when clicking Explore all photos button', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const exploreBtn = screen.getByRole('button', { name: /explore all 4 photos in zoom mode/i });
    await user.click(exploreBtn);

    expect(screen.getByRole('dialog', { name: /photo gallery for skyline arena/i })).toBeInTheDocument();
  });

  it('filters out video URLs from gallery so video files do not break image zoom mode', () => {
    const venueWithVideo = {
      ...mockVenue,
      gallery: [
        'https://example.com/video-tour.mp4',
        'https://example.com/photo-1.jpg',
        'https://example.com/photo-2.jpg',
      ],
    };

    renderWithProviders(
      <DetailView
        venue={venueWithVideo}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    // Only 2 real photos should be counted and explored
    expect(screen.getByRole('button', { name: /explore all 2 photos in zoom mode/i })).toBeInTheDocument();
  });
});

describe('DetailView UI/UX Fixes and Enhancements', () => {
  it('Fix 9: positions ratings and reviews count near the product title with link to reviews', () => {
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    // Rating and review count near title
    const ratingBtn = screen.getByRole('button', {
      name: /rated 4.9 stars from 12 reviews\. click to view reviews\./i,
    });
    expect(ratingBtn).toBeInTheDocument();
    expect(ratingBtn).toHaveTextContent('4.9');
    expect(ratingBtn).toHaveTextContent('(12 reviews)');
  });

  it('Fix 9: handles unrated venue gracefully without fabricating reviews', () => {
    const unratedVenue: Venue = {
      ...mockVenue,
      rating: 0,
      reviewCount: 0,
    };

    renderWithProviders(
      <DetailView
        venue={unratedVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const ratingBtn = screen.getByRole('button', {
      name: /rated 0.0 stars from 0 reviews/i,
    });
    expect(ratingBtn).toBeInTheDocument();
    expect(ratingBtn).toHaveTextContent('New');
    expect(ratingBtn).toHaveTextContent('(0 reviews)');
  });

  it('Enhancement 3 & Fix 14/15: updates total price and button text when selecting predefined quantity chips', async () => {
    const user = userEvent.setup();
    const handleInitiateBooking = vi.fn();

    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={handleInitiateBooking}
      />
    );

    // Initially 1 hour @ ₹2000
    expect(screen.getByRole('button', { name: /book now · ₹2000/i })).toBeInTheDocument();

    // Click 2 Hours preset chip
    const twoHoursChip = screen.getByRole('button', { name: '2 Hours' });
    await user.click(twoHoursChip);

    // Total price updates to ₹4000 (2 × ₹2000) and CTA reflects selected duration and total
    expect(screen.getByRole('button', { name: /book 2 hours · ₹4000/i })).toBeInTheDocument();

    // Click 3 Hours preset chip
    const threeHoursChip = screen.getByRole('button', { name: '3 Hours' });
    await user.click(threeHoursChip);

    expect(screen.getByRole('button', { name: /book 3 hours · ₹6000/i })).toBeInTheDocument();
  });

  it('Enhancement 3 & Fix 14/15: custom stepper increments and decrements hours and updates total', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const plusBtn = screen.getByRole('button', { name: /increase hours/i });
    await user.click(plusBtn);

    // 2 hours selected -> ₹4000
    expect(screen.getByRole('button', { name: /book 2 hours · ₹4000/i })).toBeInTheDocument();

    const minusBtn = screen.getByRole('button', { name: /decrease hours/i });
    await user.click(minusBtn);

    // Back to 1 hour -> ₹2000
    expect(screen.getByRole('button', { name: /book now · ₹2000/i })).toBeInTheDocument();
  });

  it('Fix 15: initiates booking with selected slot, duration, and calculated total price', async () => {
    const user = userEvent.setup();
    const handleInitiateBooking = vi.fn();

    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={handleInitiateBooking}
      />
    );

    // Pick 2 Hours duration preset
    await user.click(screen.getByRole('button', { name: '2 Hours' }));

    // Pick slot 10:00
    const slotBtn = screen.getByRole('button', { name: '10:00' });
    await user.click(slotBtn);

    // Click Book Now button
    const bookBtn = screen.getByRole('button', { name: /book 2 hours · ₹4000/i });
    await user.click(bookBtn);

    expect(handleInitiateBooking).toHaveBeenCalledTimes(1);
    expect(handleInitiateBooking).toHaveBeenCalledWith(
      '10:00–11:00 (2 hrs)',
      '2026-10-20',
      'slot-2',
      expect.objectContaining({
        price: 4000,
        durationHours: 2,
        rentalMode: 'hour',
      })
    );
  });

  it('Enhancement 2: persistent bottom bar initiates booking with synchronized state', async () => {
    const user = userEvent.setup();
    const handleInitiateBooking = vi.fn();

    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={handleInitiateBooking}
      />
    );

    // The persistent bottom bar has a Book Now button
    const bottomBookBtns = screen.getAllByRole('button', { name: /book now/i });
    expect(bottomBookBtns.length).toBeGreaterThan(1);

    // Clicking the bottom button triggers booking with slot-1
    await user.click(bottomBookBtns[bottomBookBtns.length - 1]);

    expect(handleInitiateBooking).toHaveBeenCalledTimes(1);
    expect(handleInitiateBooking).toHaveBeenCalledWith(
      '09:00–10:00',
      '2026-10-20',
      'slot-1',
      expect.objectContaining({
        price: 2000,
        rentalMode: 'hour',
      })
    );
  });

  it('renders time slots container with scroll support and Lenis interception prevention', () => {
    renderWithProviders(
      <DetailView
        venue={mockVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    const slotsGrid = screen.getByTestId('time-slots-grid');
    expect(slotsGrid).toBeInTheDocument();
    expect(slotsGrid).toHaveAttribute('data-lenis-prevent');
    expect(slotsGrid.className).toContain('overflow-y-auto');
    expect(slotsGrid.className).toContain('custom-scrollbar');
    expect(slotsGrid.className).not.toContain('no-scrollbar');
  });

  it('renders display_name, tagline, use cases, map link, FAQ Q&A, and rental options', () => {
    const enrichedVenue: Venue = {
      ...mockVenue,
      name: 'Registered Legal Turf Entity',
      displayName: 'Gomti Greens Lawn',
      tagline: 'One big green lawn for weddings and cricket days',
      latitude: 26.8467,
      longitude: 81.0182,
      useCases: ['Wedding', 'Cricket Match', 'Corporate Gala'],
      rentalOptions: [
        { mode: 'full_day', price: 65000, weekend_price: 85000, note: '6 AM to midnight' },
        { mode: 'hour', price: 2000, note: 'Minimum 2 hours' },
      ],
      contentBlocks: [
        {
          type: 'FAQ',
          title: 'Frequently Asked Questions',
          settings: {
            items: [
              { q: 'Can we bring our own caterer?', a: 'Yes, full outside catering permitted.' },
            ],
          },
        },
        {
          type: 'Highlights',
          title: 'Why people book us',
          settings: {
            items: ['Two acres of fenced grass', 'Dedicated floodlit parking'],
          },
        },
      ],
    };

    renderWithProviders(
      <DetailView
        venue={enrichedVenue}
        slots={mockSlots}
        onBack={vi.fn()}
        onInitiateBooking={vi.fn()}
      />
    );

    // Display Name and Official Name
    expect(screen.getByText('Gomti Greens Lawn')).toBeInTheDocument();
    expect(screen.getByText(/Official registration: Registered Legal Turf Entity/i)).toBeInTheDocument();
    expect(screen.getByText('One big green lawn for weddings and cricket days')).toBeInTheDocument();

    // Use cases
    expect(screen.getByText('Wedding')).toBeInTheDocument();
    expect(screen.getByText('Cricket Match')).toBeInTheDocument();

    // Google Maps link
    const mapLink = screen.getByRole('link', { name: '(Map)' });
    expect(mapLink).toHaveAttribute('href', expect.stringContaining('26.8467,81.0182'));

    // FAQ Q&A
    expect(screen.getByText('Can we bring our own caterer?')).toBeInTheDocument();
    expect(screen.getByText('Yes, full outside catering permitted.')).toBeInTheDocument();

    // Highlights items
    expect(screen.getByText('Two acres of fenced grass')).toBeInTheDocument();
    expect(screen.getByText('Dedicated floodlit parking')).toBeInTheDocument();

    // Rental options
    expect(screen.getByText('Rental Options & Rates')).toBeInTheDocument();
    expect(screen.getByText('Full Day')).toBeInTheDocument();
    expect(screen.getByText('Hourly Rental')).toBeInTheDocument();
    expect(screen.getByText(/65000/)).toBeInTheDocument();
  });
});
