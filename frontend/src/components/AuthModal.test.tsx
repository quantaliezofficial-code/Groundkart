import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AuthModal from './AuthModal';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api/client';

// Mock the useAuth hook
vi.mock('../lib/auth', () => ({
  useAuth: vi.fn(),
}));

describe('AuthModal component', () => {
  const mockLogin = vi.fn();
  const mockSignup = vi.fn();
  const mockOnClose = vi.fn();
  const mockOnSwitchMode = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      login: mockLogin,
      signup: mockSignup,
    });
  });

  it('renders login form correctly', () => {
    render(
      <AuthModal 
        mode="login" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com or phone')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log in/i })).toBeInTheDocument();
  });

  it('renders signup form correctly', () => {
    render(
      <AuthModal 
        mode="signup" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Your phone number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min. 8 characters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create account/i })).toBeInTheDocument();
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce({ user: { role: 'client' } });
    
    render(
      <AuthModal 
        mode="login" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    const emailInput = screen.getByPlaceholderText('you@example.com or phone');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const form = emailInput.closest('form')!;
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError(401, 'Invalid credentials'));
    
    render(
      <AuthModal 
        mode="login" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    const emailInput = screen.getByPlaceholderText('you@example.com or phone');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const form = emailInput.closest('form')!;
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    
    fireEvent.submit(form);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('switches to signup mode when link is clicked', () => {
    render(
      <AuthModal 
        mode="login" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    const signupLink = screen.getByText('Create one free');
    fireEvent.click(signupLink);
    
    expect(mockOnSwitchMode).toHaveBeenCalledWith('signup');
  });

  it('opens forgot password form when Forgot password? link is clicked', () => {
    render(
      <AuthModal 
        mode="login" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    const forgotLink = screen.getByRole('button', { name: /Forgot password\?/i });
    fireEvent.click(forgotLink);
    
    expect(screen.getByRole('heading', { name: /Reset password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone or email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request password reset/i })).toBeInTheDocument();
  });
});
