import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ForgotPassword from './ForgotPassword';
import { api } from '../lib/api/client';

vi.mock('../lib/api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

function renderForgotPassword(props = {}) {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ForgotPassword {...props} />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ForgotPassword component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with Phone or email label and submit button', () => {
    renderForgotPassword();

    expect(screen.getByRole('heading', { name: /Forgot password\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone or email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request password reset/i })).toBeInTheDocument();
    // No dev token or token entry steps should exist
    expect(screen.queryByText(/Reset token/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dev mode/i)).not.toBeInTheDocument();
  });

  it('submits phone login_id and displays the neutral support message', async () => {
    const neutralMsg = 'If an account exists, our support team will contact you to complete the reset.';
    (api.post as any).mockResolvedValueOnce({
      message: neutralMsg,
    });

    renderForgotPassword();

    const input = screen.getByLabelText(/Phone or email/i);
    fireEvent.change(input, { target: { value: '9876543210' } });

    const submitBtn = screen.getByRole('button', { name: /Request password reset/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/forgot-password', {
        login_id: '9876543210',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Request Received')).toBeInTheDocument();
      expect(screen.getByText(neutralMsg)).toBeInTheDocument();
      // Must not claim an email or SMS was sent
      expect(screen.queryByText(/instructions have been sent/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/we've sent a link/i)).not.toBeInTheDocument();
    });
  });

  it('submits email login_id and displays the neutral message', async () => {
    const neutralMsg = 'If an account exists, our support team will contact you to complete the reset.';
    (api.post as any).mockResolvedValueOnce({
      message: neutralMsg,
    });

    renderForgotPassword();

    const input = screen.getByLabelText(/Phone or email/i);
    fireEvent.change(input, { target: { value: 'user@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Request password reset/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/auth/forgot-password', {
        login_id: 'user@example.com',
      });
    });

    await waitFor(() => {
      expect(screen.getByText(neutralMsg)).toBeInTheDocument();
    });
  });

  it('supports modal mode and callbacks to return to login', async () => {
    const mockBack = vi.fn();
    (api.post as any).mockResolvedValueOnce({
      message: 'If an account exists, our support team will contact you to complete the reset.',
    });

    renderForgotPassword({ inModal: true, onBackToLogin: mockBack });

    const input = screen.getByLabelText(/Phone or email/i);
    fireEvent.change(input, { target: { value: '9876543210' } });
    fireEvent.click(screen.getByRole('button', { name: /Request password reset/i }));

    await waitFor(() => {
      expect(screen.getByText('Request Received')).toBeInTheDocument();
    });

    const returnBtn = screen.getByRole('button', { name: /Return to login/i });
    fireEvent.click(returnBtn);

    expect(mockBack).toHaveBeenCalled();
  });

  it('displays error message when request fails', async () => {
    (api.post as any).mockRejectedValueOnce(new Error('Rate limit exceeded. Please try again later.'));

    renderForgotPassword();

    const input = screen.getByLabelText(/Phone or email/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Request password reset/i }));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded. Please try again later.')).toBeInTheDocument();
    });
  });
});
