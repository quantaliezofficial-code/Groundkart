import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ResetPassword from './ResetPassword';
import { api } from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

function renderResetPassword(initialEntry = '/reset-password?token=valid-test-token-123') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ResetPassword />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ResetPassword component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the reset form when a valid token is in query params', () => {
    renderResetPassword('/reset-password?token=valid-test-token-123');

    expect(screen.getByText('Create a New Password')).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Password/i })).toBeDisabled();
  });

  it('shows invalid/expired state when no token is present', () => {
    renderResetPassword('/reset-password');

    expect(screen.getByText('Link Invalid or Expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to Login/i })).toBeInTheDocument();
  });

  it('validates minimum 8 characters and displays warning', () => {
    renderResetPassword('/reset-password?token=valid-test-token-123');

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    fireEvent.change(newPasswordInput, { target: { value: 'short' } });

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Password/i })).toBeDisabled();
  });

  it('validates password match and shows mismatch warning', () => {
    renderResetPassword('/reset-password?token=valid-test-token-123');

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(newPasswordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmInput, { target: { value: 'different123' } });

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Password/i })).toBeDisabled();
  });

  it('submits token and new password, then displays success state', async () => {
    (api.post as any).mockResolvedValueOnce({ message: 'Password reset successfully.' });

    renderResetPassword('/reset-password?token=valid-test-token-123');

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(newPasswordInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SuperSecret123!' } });

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    expect(submitBtn).toBeEnabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/reset-password', {
        token: 'valid-test-token-123',
        new_password: 'SuperSecret123!',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Password Updated')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Return to Login/i })).toBeInTheDocument();
    });
  });

  it('shows invalid/expired message when backend rejects token', async () => {
    (api.post as any).mockRejectedValueOnce({
      message: 'Invalid or expired reset token',
    });

    renderResetPassword('/reset-password?token=stale-token');

    const newPasswordInput = screen.getByLabelText(/^new password$/i);
    const confirmInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(newPasswordInput, { target: { value: 'SuperSecret123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SuperSecret123!' } });

    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    await waitFor(() => {
      expect(screen.getByText('Link Invalid or Expired')).toBeInTheDocument();
    });
  });
});
