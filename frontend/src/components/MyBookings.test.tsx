import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import MyBookings from './MyBookings';
import { AppBooking, Venue } from '../types';

const mockVenues: Venue[] = [
  {
    id: 'venue-1',
    name: 'Test Venue 1',
    category: 'Turfs',
    venueType: 'Football',
    district: 'Test District',
    city: 'Test City',
    image: 'test-image.jpg',
    rating: 4.5,
    reviewCount: 10,
    basePrice: 100,
    unitType: 'hour',
    currency: '₹',
    description: 'Test description',
    capacityGroup: '1-5',
    amenities: ['Free Parking', 'Locker Rooms'],
  }
];

const mockBookings: AppBooking[] = [
  {
    id: '11111111-booking',
    venueId: 'venue-1',
    venueName: 'Test Venue 1',
    venueCategory: 'Turfs',
    date: '2030-10-10',
    slot: '10:00 AM - 11:00 AM',
    hoursCount: 1,
    clientName: 'Test User',
    clientEmail: 'test@example.com',
    createdAt: '2030-10-09T10:00:00Z',
    cancellationReason: null,
    totalPrice: 100,
    status: 'confirmed'
  },
  {
    id: '22222222-booking',
    venueId: 'venue-1',
    venueName: 'Test Venue 1',
    venueCategory: 'Turfs',
    date: '2023-10-11',
    slot: '11:00 AM - 12:00 PM',
    hoursCount: 1,
    clientName: 'Test User',
    clientEmail: 'test@example.com',
    createdAt: '2023-10-10T10:00:00Z',
    cancellationReason: null,
    totalPrice: 100,
    status: 'completed'
  },
  {
    id: '33333333-booking',
    venueId: 'venue-1',
    venueName: 'Test Venue 1',
    venueCategory: 'Turfs',
    date: '2023-10-12',
    slot: '12:00 PM - 01:00 PM',
    hoursCount: 1,
    clientName: 'Test User',
    clientEmail: 'test@example.com',
    createdAt: '2023-10-11T10:00:00Z',
    cancellationReason: 'Changed mind',
    totalPrice: 100,
    status: 'cancelled'
  }
];

describe('MyBookings component', () => {
  it('renders tabs correctly', () => {
    const onCancel = vi.fn();
    const onBookAgain = vi.fn();
    
    render(
      <MyBookings 
        bookings={mockBookings} 
        venues={mockVenues} 
        onCancelBooking={onCancel} 
        onBookAgain={onBookAgain} 
      />
    );
    
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('filters upcoming bookings by default', () => {
    const onCancel = vi.fn();
    const onBookAgain = vi.fn();
    
    render(
      <MyBookings 
        bookings={mockBookings} 
        venues={mockVenues} 
        onCancelBooking={onCancel} 
        onBookAgain={onBookAgain} 
      />
    );
    
    // Only booking-1 (confirmed) should be in the upcoming list
    expect(screen.getByText('Ref: #11111111')).toBeInTheDocument();
    expect(screen.queryByText('Ref: #22222222')).not.toBeInTheDocument();
    expect(screen.queryByText('Ref: #33333333')).not.toBeInTheDocument();
  });

  it('filters past bookings when Past tab is clicked', async () => {
    const onCancel = vi.fn();
    const onBookAgain = vi.fn();
    
    render(
      <MyBookings 
        bookings={mockBookings} 
        venues={mockVenues} 
        onCancelBooking={onCancel} 
        onBookAgain={onBookAgain} 
      />
    );
    
    fireEvent.click(screen.getByText('Past'));
    
    await waitFor(() => {
      expect(screen.queryByText('Ref: #11111111')).not.toBeInTheDocument();
      expect(screen.getByText('Ref: #22222222')).toBeInTheDocument();
      expect(screen.queryByText('Ref: #33333333')).not.toBeInTheDocument();
    });
  });

  it('filters cancelled bookings when Cancelled tab is clicked', async () => {
    const onCancel = vi.fn();
    const onBookAgain = vi.fn();
    
    render(
      <MyBookings 
        bookings={mockBookings} 
        venues={mockVenues} 
        onCancelBooking={onCancel} 
        onBookAgain={onBookAgain} 
      />
    );
    
    fireEvent.click(screen.getByText('Cancelled'));
    
    await waitFor(() => {
      expect(screen.queryByText('Ref: #11111111')).not.toBeInTheDocument();
      expect(screen.queryByText('Ref: #22222222')).not.toBeInTheDocument();
      expect(screen.getByText('Ref: #33333333')).toBeInTheDocument();
    });
  });
});
