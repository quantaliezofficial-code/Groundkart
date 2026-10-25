import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import HomepageTab from './HomepageTab';
import * as useAdminModule from '../../hooks/useAdmin';

vi.mock('../../hooks/useAdmin');

const mockVenues = [
  {
    id: 'venue-1',
    name: 'Slot Venue Alpha',
    city: 'Lucknow',
    status: 'active',
    media: [{ url: 'https://example.com/alpha.jpg', is_cover: true }],
  },
  {
    id: 'venue-2',
    name: 'Slot Venue Beta',
    city: 'Kanpur',
    status: 'active',
    media: [],
  },
  {
    id: 'venue-3',
    name: 'Slot Venue Gamma',
    city: 'Varanasi',
    status: 'active',
    media: [],
  },
  {
    id: 'venue-4',
    name: 'Slot Venue Delta',
    city: 'Lucknow',
    status: 'active',
    media: [],
  },
  {
    id: 'venue-5',
    name: 'Slot Venue Epsilon',
    city: 'Agra',
    status: 'active',
    media: [],
  },
];

const mockPlacements = [
  {
    id: 'placement-1',
    venue_id: 'venue-placed',
    section: 'featured',
    priority: 0,
    badge: 'Featured Choice',
    custom_title: 'Gomti Greens Multi-Purpose Lawn',
    custom_description: 'gomti-greens-multi-purpose-lawn',
    venue: {
      id: 'venue-placed',
      name: 'Gomti Greens',
      slug: 'gomti-greens-multi-purpose-lawn',
      cover_image_url: 'https://example.com/gomti.jpg',
    },
  },
];

describe('HomepageTab Component', () => {
  const mockCreateMutate = vi.fn();
  const mockDeleteMutate = vi.fn();
  const mockReorderMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useAdminModule, 'useAdminVenues').mockReturnValue({
      data: mockVenues,
      isLoading: false,
    } as any);

    vi.spyOn(useAdminModule, 'useHomepagePlacements').mockReturnValue({
      data: mockPlacements,
      isLoading: false,
    } as any);

    vi.spyOn(useAdminModule, 'useCreateHomepagePlacement').mockReturnValue({
      mutate: mockCreateMutate,
      isPending: false,
    } as any);

    vi.spyOn(useAdminModule, 'useDeleteHomepagePlacement').mockReturnValue({
      mutate: mockDeleteMutate,
      isPending: false,
    } as any);

    vi.spyOn(useAdminModule, 'useReorderHomepageSection').mockReturnValue({
      mutate: mockReorderMutate,
      isPending: false,
    } as any);
  });

  it('renders select venue container with scroll support and Lenis prevention', () => {
    render(<HomepageTab />);

    expect(screen.getByText('1. Select Venue')).toBeInTheDocument();
    expect(screen.getByText('5 available')).toBeInTheDocument();

    const scrollContainer = screen.getByLabelText('Available venues list');
    expect(scrollContainer).toBeInTheDocument();

    // Verify scrolling attributes and classes
    expect(scrollContainer).toHaveAttribute('data-lenis-prevent');
    expect(scrollContainer.className).toContain('overflow-y-auto');
    expect(scrollContainer.className).toContain('custom-scrollbar');
    expect(scrollContainer.className).toContain('overscroll-contain');
    expect(scrollContainer.className).not.toContain('no-scrollbar');

    // All available venues are listed
    expect(screen.getByText('Slot Venue Alpha')).toBeInTheDocument();
    expect(screen.getByText('Slot Venue Beta')).toBeInTheDocument();
    expect(screen.getByText('Slot Venue Gamma')).toBeInTheDocument();
    expect(screen.getByText('Slot Venue Delta')).toBeInTheDocument();
    expect(screen.getByText('Slot Venue Epsilon')).toBeInTheDocument();
  });

  it('allows selecting a venue from the scrollable list and filtering via search', () => {
    render(<HomepageTab />);

    const searchInput = screen.getByPlaceholderText('Search available venues...');
    fireEvent.change(searchInput, { target: { value: 'Beta' } });

    expect(screen.getByText('Slot Venue Beta')).toBeInTheDocument();
    expect(screen.queryByText('Slot Venue Alpha')).not.toBeInTheDocument();

    // Select Beta
    fireEvent.click(screen.getByText('Slot Venue Beta'));
    expect(screen.getByRole('button', { name: /Add to Section/i })).not.toBeDisabled();
  });
});
