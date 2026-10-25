import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocationStep from './LocationStep';

describe('LocationStep - State / Province Dropdown & Accessibility', () => {
  it('renders state drop down menu with placeholder and groups', () => {
    const update = vi.fn();
    render(<LocationStep data={{}} update={update} />);

    const select = screen.getByRole('combobox', { name: /state \/ province/i });
    expect(select).toBeInTheDocument();

    // Check placeholder
    expect(screen.getByText('Select State / Province')).toBeInTheDocument();

    // Check optgroups
    const stateGroup = screen.getByRole('group', { name: 'States' });
    expect(stateGroup).toBeInTheDocument();

    const utGroup = screen.getByRole('group', { name: 'Union Territories' });
    expect(utGroup).toBeInTheDocument();

    // Check presence of key states and UTs
    expect(screen.getByRole('option', { name: 'Uttar Pradesh' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Maharashtra' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Delhi' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other (Specify manually)' })).toBeInTheDocument();
  });

  it('calls update when selecting a state from the dropdown', () => {
    const update = vi.fn();
    render(<LocationStep data={{ state: '' }} update={update} />);

    const select = screen.getByRole('combobox', { name: /state \/ province/i });
    fireEvent.change(select, { target: { value: 'Uttar Pradesh' } });

    expect(update).toHaveBeenCalledWith({ state: 'Uttar Pradesh' });
  });

  it('selects state when clicking a popular state pill', () => {
    const update = vi.fn();
    render(<LocationStep data={{ state: '' }} update={update} />);

    const upPill = screen.getByRole('button', { name: 'Uttar Pradesh' });
    fireEvent.click(upPill);

    expect(update).toHaveBeenCalledWith({ state: 'Uttar Pradesh' });
  });

  it('auto-fills state when clicking a popular city and state is empty', () => {
    const update = vi.fn();
    render(<LocationStep data={{ city: '', state: '' }} update={update} />);

    const lucknowBtn = screen.getByRole('button', { name: 'Lucknow' });
    fireEvent.click(lucknowBtn);

    expect(update).toHaveBeenCalledWith({ city: 'Lucknow', state: 'Uttar Pradesh' });
  });

  it('does not overwrite existing state when clicking a popular city if already set', () => {
    const update = vi.fn();
    render(<LocationStep data={{ city: '', state: 'Karnataka' }} update={update} />);

    const lucknowBtn = screen.getByRole('button', { name: 'Lucknow' });
    fireEvent.click(lucknowBtn);

    expect(update).toHaveBeenCalledWith({ city: 'Lucknow' });
  });

  it('renders custom input when "Other (Specify manually)" is chosen', () => {
    const update = vi.fn();
    render(<LocationStep data={{ state: '' }} update={update} />);

    const select = screen.getByRole('combobox', { name: /state \/ province/i });
    fireEvent.change(select, { target: { value: '__other__' } });

    const customInput = screen.getByPlaceholderText(/type state or province name/i);
    expect(customInput).toBeInTheDocument();

    fireEvent.change(customInput, { target: { value: 'Ontario' } });
    expect(update).toHaveBeenCalledWith({ state: 'Ontario' });
  });

  it('retains an existing custom or non-standard state in the dropdown', () => {
    const update = vi.fn();
    render(<LocationStep data={{ state: 'Uttar prades' }} update={update} />);

    const select = screen.getByRole('combobox', { name: /state \/ province/i }) as HTMLSelectElement;
    expect(select.value).toBe('Uttar prades');
    expect(screen.getByRole('option', { name: 'Uttar prades' })).toBeInTheDocument();
  });

  it('updates live address verification preview with state', () => {
    render(
      <LocationStep
        data={{
          address: 'Plot 10, Gomti Nagar',
          city: 'Lucknow',
          state: 'Uttar Pradesh',
          pincode: '226010',
        }}
        update={vi.fn()}
      />
    );

    expect(
      screen.getByText('Plot 10, Gomti Nagar, Lucknow, Uttar Pradesh, 226010')
    ).toBeInTheDocument();
  });
});
