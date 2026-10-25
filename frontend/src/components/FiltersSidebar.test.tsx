import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import FiltersSidebar, {
  AMENITY_FILTER_ITEMS,
  matchesAmenity,
} from './FiltersSidebar';

describe('FiltersSidebar Component', () => {
  const defaultProps = {
    minPrice: '',
    onMinPriceChange: vi.fn(),
    maxPrice: '',
    onMaxPriceChange: vi.fn(),
    selectedAmenities: [] as string[],
    onAmenityToggle: vi.fn(),
    selectedCapacity: '',
    onCapacitySet: vi.fn(),
    selectedRating: 0,
    onRatingSet: vi.fn(),
    selectedCategory: '',
    onCategorySet: vi.fn(),
    selectedEnvironment: '',
    onEnvironmentSet: vi.fn(),
    sortBy: 'recommended' as const,
    onSortByChange: vi.fn(),
    onClearAll: vi.fn(),
    resultsCount: 12,
    isMobileDrawerOpen: false,
    onCloseMobileDrawer: vi.fn(),
    amenityCounts: { freeParking: 8, floodlights: 3, wifi: 5 },
  };

  it('renders filter sidebar sections with title, price range, and amenities', () => {
    render(<FiltersSidebar {...defaultProps} />);

    expect(screen.getByRole('heading', { name: /filters/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /price range/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /amenities/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /capacity/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /minimum rating/i })).toBeInTheDocument();
  });

  it('initially displays top 6 popular amenities and allows expanding to view all', () => {
    render(<FiltersSidebar {...defaultProps} />);

    // Top amenities visible initially
    expect(screen.getByText('Free Parking')).toBeInTheDocument();
    expect(screen.getByText('Air Conditioning')).toBeInTheDocument();

    // Toggle button to show more
    const expandButton = screen.getByRole('button', { name: /\+.*more amenities/i });
    expect(expandButton).toBeInTheDocument();

    fireEvent.click(expandButton);

    // After expanding, additional amenities should be visible
    expect(screen.getByText('Swimming Pool')).toBeInTheDocument();
    expect(screen.getByText('First Aid Kit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show fewer amenities/i })).toBeInTheDocument();
  });

  it('triggers onAmenityToggle when an amenity checkbox is clicked', () => {
    const onAmenityToggle = vi.fn();
    render(<FiltersSidebar {...defaultProps} onAmenityToggle={onAmenityToggle} />);

    const parkingCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(parkingCheckbox);

    expect(onAmenityToggle).toHaveBeenCalledWith('freeParking');
  });

  it('applies quick price presets when clicked', () => {
    const onMinPriceChange = vi.fn();
    const onMaxPriceChange = vi.fn();
    render(
      <FiltersSidebar
        {...defaultProps}
        onMinPriceChange={onMinPriceChange}
        onMaxPriceChange={onMaxPriceChange}
      />
    );

    const preset1kTo25k = screen.getByRole('button', { name: '₹1,000–₹2,500' });
    fireEvent.click(preset1kTo25k);

    expect(onMinPriceChange).toHaveBeenCalledWith('1000');
    expect(onMaxPriceChange).toHaveBeenCalledWith('2500');
  });

  it('calls onCapacitySet when capacity chips are clicked', () => {
    const onCapacitySet = vi.fn();
    render(<FiltersSidebar {...defaultProps} onCapacitySet={onCapacitySet} />);

    const capButton = screen.getByRole('button', { name: '11-20 Guests' });
    fireEvent.click(capButton);

    expect(onCapacitySet).toHaveBeenCalledWith('11-20');
  });

  it('calls onRatingSet when rating button is clicked', () => {
    const onRatingSet = vi.fn();
    render(<FiltersSidebar {...defaultProps} onRatingSet={onRatingSet} />);

    const rating4 = screen.getByRole('button', { name: /4\.0\+/i });
    fireEvent.click(rating4);

    expect(onRatingSet).toHaveBeenCalledWith(4.0);
  });

  it('calls onCategorySet and onEnvironmentSet when category and setting buttons are clicked', () => {
    const onCategorySet = vi.fn();
    const onEnvironmentSet = vi.fn();
    render(
      <FiltersSidebar
        {...defaultProps}
        onCategorySet={onCategorySet}
        onEnvironmentSet={onEnvironmentSet}
      />
    );

    const banquetBtn = screen.getByRole('button', { name: 'Banquet Halls' });
    fireEvent.click(banquetBtn);
    expect(onCategorySet).toHaveBeenCalledWith('banquet_hall');

    const indoorBtn = screen.getByRole('button', { name: 'Indoor' });
    fireEvent.click(indoorBtn);
    expect(onEnvironmentSet).toHaveBeenCalledWith('indoor');
  });

  it('calls onClearAll when clear all button is clicked', () => {
    const onClearAll = vi.fn();
    render(
      <FiltersSidebar
        {...defaultProps}
        selectedAmenities={['freeParking']}
        onClearAll={onClearAll}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearBtn);

    expect(onClearAll).toHaveBeenCalled();
  });

  it('renders mobile drawer when isMobileDrawerOpen is true', () => {
    const onCloseMobileDrawer = vi.fn();
    render(
      <FiltersSidebar
        {...defaultProps}
        isMobileDrawerOpen={true}
        onCloseMobileDrawer={onCloseMobileDrawer}
      />
    );

    expect(screen.getByText('Filters & Sorting')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show 12 venues/i })).toBeInTheDocument();
  });
});

describe('matchesAmenity helper logic', () => {
  it('correctly matches various synonyms and cases', () => {
    // Free Parking
    expect(matchesAmenity(['Valet Parking', 'CCTV'], 'freeParking')).toBe(true);
    expect(matchesAmenity(['free on-site parking'], 'freeParking')).toBe(true);
    expect(matchesAmenity(['No vehicle spot'], 'freeParking')).toBe(false);

    // Floodlights
    expect(matchesAmenity(['Stadium Lighting', 'Turf Grass'], 'floodlights')).toBe(true);
    expect(matchesAmenity(['Night Floodlights'], 'floodlights')).toBe(true);

    // Air Conditioning
    expect(matchesAmenity(['Climate Control'], 'airConditioning')).toBe(true);
    expect(matchesAmenity(['AC banquet hall'], 'airConditioning')).toBe(true);
    expect(matchesAmenity(['Industrial Air Coolers'], 'airConditioning')).toBe(true);

    // Wi-Fi
    expect(matchesAmenity(['High-Speed WiFi'], 'wifi')).toBe(true);
    expect(matchesAmenity(['Broadband Internet Access'], 'wifi')).toBe(true);

    // Locker Rooms / Changing
    expect(matchesAmenity(['Changing Rooms', 'Showers'], 'lockerRooms')).toBe(true);
    expect(matchesAmenity(['Locker Rooms'], 'lockerRooms')).toBe(true);
  });

  it('returns false for empty or non-matching arrays', () => {
    expect(matchesAmenity([], 'freeParking')).toBe(false);
    expect(matchesAmenity(['Natural Grass'], 'wifi')).toBe(false);
  });
});
