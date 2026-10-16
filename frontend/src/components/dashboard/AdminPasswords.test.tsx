import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AdminPasswords from './AdminPasswords';
import * as useAdminModule from '../../hooks/useAdmin';
import type { ApiAdminUserView } from '../../lib/api/types';

vi.mock('../../hooks/useAdmin');

const mockUsers: ApiAdminUserView[] = [
  {
    id: 'user-uuid-1111-2222',
    name: 'Ragas Owner',
    email: 'ragas7419@gmail.com',
    phone: '+91 98765 43210',
    role: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    suspended_at: null,
    suspension_reason: null,
  },
  {
    id: 'user-uuid-3333-4444',
    name: 'Customer NoPhone',
    email: 'nophone@example.com',
    phone: undefined,
    role: 'customer',
    created_at: '2026-01-02T00:00:00Z',
    suspended_at: null,
    suspension_reason: null,
  },
];

describe('AdminPasswords component', () => {
  const mockMutateAsync = vi.fn();
  const mockCancelMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(useAdminModule, 'useAdminUsersPaginated').mockReturnValue({
      data: {
        pages: [mockUsers],
        pageParams: [0],
      },
      isLoading: false,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as any);

    vi.spyOn(useAdminModule, 'useAdminResetPassword').mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);

    vi.spyOn(useAdminModule, 'useAdminCancelPasswordResetRequest').mockReturnValue({
      mutateAsync: mockCancelMutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    } as any);
  });

  it('renders contact column without duplicate emails, showing phone only when present', () => {
    render(<AdminPasswords />);

    // User 1: has email and phone
    expect(screen.getByText('ragas7419@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();

    // Verify email is NOT duplicated: queryAllByText for ragas7419@gmail.com should return exactly 1
    const emailOccurrences = screen.getAllByText('ragas7419@gmail.com');
    expect(emailOccurrences).toHaveLength(1);

    // User 2: has email but no phone
    expect(screen.getByText('nophone@example.com')).toBeInTheDocument();
    const noPhoneOccurrences = screen.getAllByText('nophone@example.com');
    expect(noPhoneOccurrences).toHaveLength(1);

    // Internal UUIDs should not be displayed in the primary user view
    expect(screen.queryByText('user-uuid-1111-2222')).not.toBeInTheDocument();
    expect(screen.queryByText('user-uuid-3333-4444')).not.toBeInTheDocument();
  });

  it('opens Reset Password modal with user details and default method "link"', () => {
    render(<AdminPasswords />);

    const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
    fireEvent.click(resetButtons[0]);

    // Modal header
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();

    // Selected user details
    expect(screen.getAllByText('Ragas Owner').length).toBeGreaterThanOrEqual(2);
    // In modal, email is shown in user info
    expect(screen.getAllByText('ragas7419@gmail.com').length).toBeGreaterThanOrEqual(2);

    // Primary action button should say "Generate Reset Link"
    expect(screen.getByRole('button', { name: 'Generate Reset Link' })).toBeInTheDocument();
  });

  it('updates primary action button label when recovery method changes', () => {
    render(<AdminPasswords />);

    const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
    fireEvent.click(resetButtons[0]);

    // Switch to Temporary Password
    const tempRadio = screen.getByLabelText(/generate temporary password/i);
    fireEvent.click(tempRadio);
    expect(screen.getByRole('button', { name: 'Generate Temporary Password' })).toBeInTheDocument();

    // Switch to Force Reset
    const forceRadio = screen.getByLabelText(/require reset at next login/i);
    fireEvent.click(forceRadio);
    expect(screen.getByRole('button', { name: 'Require Reset at Next Login' })).toBeInTheDocument();

    // Switch back to Link
    const linkRadio = screen.getByLabelText(/generate reset link/i);
    fireEvent.click(linkRadio);
    expect(screen.getByRole('button', { name: 'Generate Reset Link' })).toBeInTheDocument();
  });

  it('generates reset link and displays result state with Copy button', async () => {
    const mockResetUrl = 'http://localhost:3000/reset-password?token=secret-token-abc';
    mockMutateAsync.mockResolvedValueOnce({
      message: 'Reset link generated',
      reset_url: mockResetUrl,
    });

    // Mock navigator.clipboard
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    render(<AdminPasswords />);

    const resetButtons = screen.getAllByRole('button', { name: /Reset Password/i });
    fireEvent.click(resetButtons[0]);

    // Click Generate Reset Link
    const generateBtn = screen.getByRole('button', { name: 'Generate Reset Link' });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: 'user-uuid-1111-2222',
        data: expect.objectContaining({
          method: 'link',
          reason: 'User requested password recovery',
        }),
      });
    });

    // Result state appears
    await waitFor(() => {
      expect(screen.getByText('Password Reset Link Ready')).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockResetUrl)).toBeInTheDocument();
    });

    // Copy link
    const copyBtn = screen.getByRole('button', { name: /Copy Reset Link/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(mockResetUrl);
      expect(screen.getByText('Link Copied')).toBeInTheDocument();
    });
  });

  it('renders pending requests and clicking Generate link calls existing route and shows link', async () => {
    const mockResetUrl = 'http://localhost:3000/reset-password?token=pending-token-xyz';
    mockMutateAsync.mockResolvedValueOnce({
      message: 'Reset link generated',
      reset_url: mockResetUrl,
    });

    vi.spyOn(useAdminModule, 'useAdminPasswordResetRequests').mockReturnValue({
      data: [
        {
          id: 'req-1',
          user_id: 'user-pending-1',
          name: 'Pending Customer',
          contact: '987****210',
          created_at: '2026-03-01T10:00:00Z',
          status: 'pending',
        },
      ],
      isLoading: false,
    } as any);

    render(<AdminPasswords />);

    expect(screen.getByText('Pending Reset Requests')).toBeInTheDocument();
    expect(screen.getByText('Pending Customer')).toBeInTheDocument();
    expect(screen.getByText('987****210')).toBeInTheDocument();

    const generateBtn = screen.getByRole('button', { name: /Generate link/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        userId: 'user-pending-1',
        data: expect.objectContaining({
          method: 'link',
          source_type: 'user',
          source_id: 'req-1',
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Password Reset Link Ready')).toBeInTheDocument();
      expect(screen.getByDisplayValue(mockResetUrl)).toBeInTheDocument();
    });
  });

  it('renders cancel cross button beside Generate link and cancels request after confirmation', async () => {
    mockCancelMutateAsync.mockResolvedValueOnce({ message: 'Password reset request cancelled' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    vi.spyOn(useAdminModule, 'useAdminPasswordResetRequests').mockReturnValue({
      data: [
        {
          id: 'req-cancel-123',
          user_id: 'user-pending-1',
          name: 'Pending Customer',
          contact: '987****210',
          created_at: '2026-03-01T10:00:00Z',
          status: 'pending',
        },
      ],
      isLoading: false,
    } as any);

    render(<AdminPasswords />);

    const cancelBtn = screen.getByRole('button', { name: /cancel request/i });
    expect(cancelBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('cancel this password reset request'));
    await waitFor(() => {
      expect(mockCancelMutateAsync).toHaveBeenCalledWith({
        requestId: 'req-cancel-123',
      });
    });
  });
});

