import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import FeaturesStep from './FeaturesStep';

describe('FeaturesStep Horizontal Scroll and Category Selection', () => {
  it('renders category tabs with left and right scroll buttons', () => {
    const update = vi.fn();
    render(<FeaturesStep data={{ amenity_names: ['High-Speed Wi-Fi'] }} update={update} />);

    // Scroll buttons exist
    const leftBtn = screen.getByRole('button', { name: /scroll left/i });
    const rightBtn = screen.getByRole('button', { name: /scroll right/i });
    expect(leftBtn).toBeInTheDocument();
    expect(rightBtn).toBeInTheDocument();

    // Clicking scroll buttons works without error
    fireEvent.click(rightBtn);
    fireEvent.click(leftBtn);
  });

  it('switches categories and toggles amenity selection', () => {
    const update = vi.fn();
    render(<FeaturesStep data={{ amenity_names: [] }} update={update} />);

    // Switch to Parking & Arrival category tab
    const parkingTab = screen.getByRole('button', { name: /Parking & Arrival/i });
    fireEvent.click(parkingTab);

    // Click an amenity inside that category
    const valetBtn = screen.getByRole('button', { name: /Valet Parking Available/i });
    fireEvent.click(valetBtn);

    expect(update).toHaveBeenCalledWith({
      amenity_names: ['Valet Parking Available'],
    });
  });
});
