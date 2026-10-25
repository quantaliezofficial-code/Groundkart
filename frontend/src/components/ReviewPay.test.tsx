import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReviewPay from './ReviewPay';
import { Venue } from '../types';

const mockVenue: Venue = {
  id: 'venue-1',
  slug: 'test-venue',
  name: 'Test Venue',
  city: 'Lucknow',
  district: 'Lucknow',
  image: 'https://example.com/test.jpg',
  gallery: ['https://example.com/test.jpg'],
  basePrice: 1500,
  unitType: 'hour',
  currency: '₹',
  rating: 4.8,
  reviewCount: 10,
  amenities: [],
  capacity: 20,
  capacityGroup: '11-20',
  category: 'Sports',
  venueType: 'Turf',
  description: 'Test description',
  latitude: 26.8467,
  longitude: 80.9462,
};

describe('ReviewPay Adversarial Double-Click and Idempotency Tests', () => {
  it('rapid double click triggers onSubmitBooking only once and attaches idempotencyKey', async () => {
    let resolveBooking: (val: any) => void = () => {};
    const bookingPromise = new Promise((resolve) => {
      resolveBooking = resolve;
    });
    const onSubmitBookingMock = vi.fn().mockImplementation(() => bookingPromise);

    render(
      <ReviewPay
        venue={mockVenue}
        selectedSlot="10:00 - 11:00"
        selectedSlotId="slot-uuid-123"
        selectedDate="2027-08-15"
        currentUser={null}
        onNavigateHome={vi.fn()}
        onSubmitBooking={onSubmitBookingMock}
      />
    );

    // Fill guest fields
    fireEvent.change(screen.getByPlaceholderText(/full name/i), {
      target: { value: 'Aarav Patel' },
    });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { value: 'aarav@example.com' },
    });

    const submitBtn = screen.getByRole('button', { name: /request booking/i });
    expect(submitBtn).toBeEnabled();

    // Rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Assert that onSubmitBooking was called EXACTLY ONCE
    expect(onSubmitBookingMock).toHaveBeenCalledTimes(1);

    // Assert that the call included a non-empty idempotencyKey
    const bookingDetailsArg = onSubmitBookingMock.mock.calls[0][3];
    expect(bookingDetailsArg).toBeDefined();
    expect(bookingDetailsArg.idempotencyKey).toBeDefined();
    expect(typeof bookingDetailsArg.idempotencyKey).toBe('string');
    expect(bookingDetailsArg.idempotencyKey.length).toBeGreaterThan(10);

    // Button should be in loading state
    expect(screen.getByText(/requesting…/i)).toBeInTheDocument();

    // Resolve the promise
    resolveBooking({
      booking_id: 'booking-uuid-456',
      amount: '1500.00',
      expires_in: 900,
      manage_token: 'manage-token-abc',
    });
  });
});
