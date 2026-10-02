import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import VenueCard from './VenueCard';
import { Venue } from '../types';

const mockVenue: Venue = {
  id: 'venue-1',
  name: 'Test Venue',
  city: 'Test City',
  district: 'Test District',
  image: 'test-image.jpg',
  basePrice: 150,
  unitType: 'hour',
  currency: '₹',
  rating: 4.8,
  reviewCount: 42,
  category: 'Turfs',
  venueType: 'Football',
  description: 'A test venue',
  capacityGroup: '1-5',
  amenities: ['Free Parking'],
  isFastFill: false,
  isFullyBookedToday: false
};

describe('VenueCard component', () => {
  it('renders venue details correctly', () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn();
    
    render(
      <VenueCard 
        venue={mockVenue} 
        onClick={onClick} 
        onToggleFavorite={onToggleFavorite} 
        isFavorite={false} 
      />
    );
    
    expect(screen.getByText('Test Venue')).toBeInTheDocument();
    expect(screen.getByText(/Test District/i)).toBeInTheDocument();
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn();
    
    render(
      <VenueCard 
        venue={mockVenue} 
        onClick={onClick} 
        onToggleFavorite={onToggleFavorite} 
        isFavorite={false} 
      />
    );
    
    fireEvent.click(screen.getByText('Test Venue'));
    expect(onClick).toHaveBeenCalledWith('venue-1');
  });

  it('calls onToggleFavorite when favorite button is clicked', () => {
    const onClick = vi.fn();
    const onToggleFavorite = vi.fn((id, e) => {
      e.stopPropagation();
    });
    
    render(
      <VenueCard 
        venue={mockVenue} 
        onClick={onClick} 
        onToggleFavorite={onToggleFavorite} 
        isFavorite={false} 
      />
    );
    
    // The favorite button is a div wrapping the Heart icon. We need to find it.
    // Assuming the favorite button can be found by its role or just click the first button
    const favButton = screen.getByRole('button');
    fireEvent.click(favButton);
    
    expect(onToggleFavorite).toHaveBeenCalledWith('venue-1', expect.anything());
    // Ensure onClick was not called
    expect(onClick).not.toHaveBeenCalled();
  });
});
