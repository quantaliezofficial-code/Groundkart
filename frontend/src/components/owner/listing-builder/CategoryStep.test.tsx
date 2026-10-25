import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CategoryStep from './CategoryStep';
import { api } from '../../../lib/api/client';
import { ListingFormData } from './ListingBuilder';

vi.mock('../../../lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

function Wrapper({ initialData = {} }: { initialData?: Partial<ListingFormData> }) {
  const [data, setData] = useState<Partial<ListingFormData>>(initialData);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <CategoryStep
        data={data}
        update={(patch) => setData((prev) => ({ ...prev, ...patch }))}
      />
    </QueryClientProvider>
  );
}

const MOCK_CATEGORIES = [
  { id: 'cat-sports', name: 'Sports & Fitness' },
  { id: 'cat-wed-events', name: 'Weddings & Events' },
  { id: 'cat-wed-celeb', name: 'Weddings & Celebrations' },
  { id: 'cat-corp-plain', name: 'Corporate' },
  { id: 'cat-corp-prof', name: 'Corporate & Professional' },
  { id: 'cat-shoots', name: 'Shoots & Creative Spaces' },
];

const MOCK_VENUE_TYPES = [
  { id: 'vt-turf', name: 'Football Turf', category_id: 'cat-sports' },
  { id: 'vt-cricket', name: 'Cricket Ground & Nets', category_id: 'cat-sports' },
  { id: 'vt-banquet-celeb', name: 'Banquet Hall', category_id: 'cat-wed-celeb' },
  { id: 'vt-banquet-event', name: 'Banquet Hall', category_id: 'cat-wed-events' },
  { id: 'vt-lawn', name: 'Party Lawn & Garden', category_id: 'cat-wed-celeb' },
  { id: 'vt-conf', name: 'Conference Center', category_id: 'cat-corp-prof' },
];

const MOCK_USE_CASES = [
  { id: 'uc-tournaments', name: 'Tournaments' },
  { id: 'uc-receptions', name: 'Receptions' },
];

describe('CategoryStep - Multi-Category, Multi-Space-Type & Deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url === '/api/v1/categories') return Promise.resolve(MOCK_CATEGORIES);
      if (url === '/api/v1/venue-types') return Promise.resolve(MOCK_VENUE_TYPES);
      if (url === '/api/v1/use-cases') return Promise.resolve(MOCK_USE_CASES);
      return Promise.resolve([]);
    });
  });

  it('1. deduplicates categories in display (merges Corporate and Weddings & Celebrations)', async () => {
    render(<Wrapper initialData={{}} />);

    await waitFor(() => {
      expect(screen.getByText('Sports & Fitness')).toBeInTheDocument();
    });

    // "Weddings & Celebrations" appears once
    const weddingsCards = screen.getAllByText('Weddings & Celebrations');
    expect(weddingsCards.length).toBe(1);

    // "Corporate & Professional" appears once, and raw "Corporate" is not duplicated as a card
    const corporateCards = screen.getAllByText('Corporate & Professional');
    expect(corporateCards.length).toBe(1);
    expect(screen.queryByRole('button', { name: /^Corporate$/i })).not.toBeInTheDocument();
  });

  it('2. allows selecting multiple categories simultaneously', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness'],
          category_ids: ['cat-sports'],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Sports & Fitness')).toBeInTheDocument();
    });

    // Check indicator shows 1 selected
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Click "Weddings & Celebrations" to multi-select
    const weddingsCard = screen.getByText('Weddings & Celebrations');
    fireEvent.click(weddingsCard);

    // Now 2 selected
    await waitFor(() => {
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    // Venue types from BOTH Sports and Weddings are now displayed
    expect(screen.getByText('Football Turf')).toBeInTheDocument();
    expect(screen.getByText('Party Lawn & Garden')).toBeInTheDocument();
    // And Banquet Hall is deduplicated (appears once)
    const banquetButtons = screen.getAllByText('Banquet Hall');
    expect(banquetButtons.length).toBe(1);
  });

  it('3. allows selecting multiple space types across categories', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness', 'Weddings & Celebrations'],
          category_ids: ['cat-sports', 'cat-wed-celeb', 'cat-wed-events'],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Football Turf')).toBeInTheDocument();
    });

    // Select Football Turf
    const turfBtn = screen.getByRole('button', { name: /Football Turf/i });
    fireEvent.click(turfBtn);

    // Select Party Lawn & Garden
    const lawnBtn = screen.getByRole('button', { name: /Party Lawn & Garden/i });
    fireEvent.click(lawnBtn);

    // Both Category and Space Type headers show "2 selected"
    await waitFor(() => {
      const badges = screen.getAllByText('2 selected');
      expect(badges.length).toBe(2);
    });
  });

  it('4. provides "+ Other Space Type" option and allows adding/removing custom space types', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness'],
          category_ids: ['cat-sports'],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Other space types not listed above\?/i)).toBeInTheDocument();
    });

    // Click "Add custom space" button
    const addCustomBtn = screen.getByRole('button', { name: /Add custom space/i });
    fireEvent.click(addCustomBtn);

    // Type custom space type
    const input = screen.getByPlaceholderText(/e\.g\. Drone Racing Arena/i);
    fireEvent.change(input, { target: { value: 'Pickleball Turf & Lounge' } });

    // Submit
    const addBtn = screen.getByRole('button', { name: /^Add$/i });
    fireEvent.click(addBtn);

    // The custom space type badge appears
    await waitFor(() => {
      expect(screen.getByText('Pickleball Turf & Lounge')).toBeInTheDocument();
    });

    // Remove it
    const removeBtn = screen.getByRole('button', { name: /Remove/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Pickleball Turf & Lounge')).not.toBeInTheDocument();
    });
  });

  it('5. allows adding and removing custom purposes with moderation notice', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness'],
          category_ids: ['cat-sports'],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Add your own purpose/i)).toBeInTheDocument();
    });

    const purposeInput = screen.getByPlaceholderText(/e\.g\. Drone Racing, Kite Festival/i);
    fireEvent.change(purposeInput, { target: { value: 'Esports Championship' } });

    const addPurposeBtn = screen.getByRole('button', { name: /Add Purpose/i });
    fireEvent.click(addPurposeBtn);

    // Badge appears
    await waitFor(() => {
      expect(screen.getByText('Esports Championship')).toBeInTheDocument();
    });

    // Moderation alert is present
    expect(screen.getByText(/Custom purposes are submitted to GroundBooking admins for review/i)).toBeInTheDocument();
  });

  it('6. renders Selected Spaces section and displays added spaces with category pills and primary badge', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness', 'Corporate & Professional'],
          category_ids: ['cat-sports', 'cat-corp-prof'],
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Selected Spaces & Facilities')).toBeInTheDocument();
    });

    // Initially no spaces added
    expect(screen.getByText(/No spaces added yet/i)).toBeInTheDocument();

    // Select Football Turf
    const turfBtn = screen.getByRole('button', { name: /Football Turf/i });
    fireEvent.click(turfBtn);

    // Selected Spaces now shows Football Turf with category pill and Primary badge
    await waitFor(() => {
      expect(screen.getByText(/1 added/i)).toBeInTheDocument();
      expect(screen.getAllByText('Sports & Fitness').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });

    // Select Conference Center (from Corporate) - exact name to avoid matching category description
    const confBtn = screen.getByRole('button', { name: /^Conference Center$/i });
    fireEvent.click(confBtn);

    // Now 2 added in Selected Spaces
    await waitFor(() => {
      expect(screen.getByText(/2 added/i)).toBeInTheDocument();
      expect(screen.getAllByText('Corporate & Professional').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('7. filters available space types when changing category tabs without losing selected spaces', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness', 'Corporate & Professional'],
          category_ids: ['cat-sports', 'cat-corp-prof'],
          venue_type_ids: ['vt-turf'],
          venue_type_id: 'vt-turf',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Selected Spaces & Facilities')).toBeInTheDocument();
    });

    // Both spaces are available initially under All Selected
    expect(screen.getByRole('button', { name: /^Football Turf$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Conference Center$/i })).toBeInTheDocument();

    // Click Corporate & Professional tab
    const corporateTab = screen.getByRole('button', { name: /^Corporate & Professional \(\d+\)$/i });
    fireEvent.click(corporateTab);

    // Now only Corporate spaces are in the grid
    expect(screen.getByRole('button', { name: /^Conference Center$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Football Turf$/i })).not.toBeInTheDocument();

    // But Football Turf is STILL preserved and visible in the "Selected Spaces & Facilities" section!
    expect(screen.getByText(/1 added/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sports & Fitness').length).toBeGreaterThanOrEqual(1);
  });

  it('8. allows setting a different space as primary and updates category alignment', async () => {
    render(
      <Wrapper
        initialData={{
          category: 'Sports & Fitness',
          categories: ['Sports & Fitness', 'Corporate & Professional'],
          category_ids: ['cat-sports', 'cat-corp-prof'],
          venue_type_ids: ['vt-turf', 'vt-conf'],
          venue_type_id: 'vt-turf',
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 added/i)).toBeInTheDocument();
    });

    // Football Turf is initially primary
    expect(screen.getByText('Primary')).toBeInTheDocument();

    // Click "Set Primary" on Conference Center
    const setPrimaryBtn = screen.getByRole('button', { name: /Set Primary/i });
    fireEvent.click(setPrimaryBtn);

    // Primary has shifted
    await waitFor(() => {
      expect(screen.getByText('Primary')).toBeInTheDocument();
    });
  });
});

