import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AuthModal, { validateEmail, validatePhoneNumber } from './AuthModal';
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

  it('validates email format requiring gmail or custom domain during signup', async () => {
    render(
      <AuthModal 
        mode="signup" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );

    const nameInput = screen.getByPlaceholderText('Your full name');
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const phoneInput = screen.getByPlaceholderText('Your phone number');
    const passwordInput = screen.getByPlaceholderText('Min. 8 characters');
    const form = nameInput.closest('form')!;

    // 1. Invalid email missing @ and domain
    fireEvent.change(nameInput, { target: { value: 'Ashley Leon' } });
    fireEvent.change(emailInput, { target: { value: 'ashleyleon92' } });
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
      expect(mockSignup).not.toHaveBeenCalled();
    });

    // 2. Invalid email missing domain extension
    fireEvent.change(emailInput, { target: { value: 'ashleyleon92@gmail' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Please enter a valid email address|valid domain extension/i)).toBeInTheDocument();
      expect(mockSignup).not.toHaveBeenCalled();
    });
  });

  it('validates phone number length to match real phone length (10 digits)', async () => {
    render(
      <AuthModal 
        mode="signup" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );

    const nameInput = screen.getByPlaceholderText('Your full name');
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const phoneInput = screen.getByPlaceholderText('Your phone number');
    const passwordInput = screen.getByPlaceholderText('Min. 8 characters');
    const form = nameInput.closest('form')!;

    fireEvent.change(nameInput, { target: { value: 'Ashley Leon' } });
    fireEvent.change(emailInput, { target: { value: 'ashleyleon92@gmail.com' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });

    // Too short (5 digits)
    fireEvent.change(phoneInput, { target: { value: '12345' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Phone number is too short \(5 digits\)\. A real phone number must be 10 digits\./i)).toBeInTheDocument();
      expect(mockSignup).not.toHaveBeenCalled();
    });

    // Invalid non-phone characters
    fireEvent.change(phoneInput, { target: { value: 'phone12345' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Phone number should only contain numbers/i)).toBeInTheDocument();
      expect(mockSignup).not.toHaveBeenCalled();
    });
  });

  it('successfully submits signup with valid gmail and 10-digit phone', async () => {
    mockSignup.mockResolvedValueOnce({ user: { role: 'client' } });

    render(
      <AuthModal 
        mode="signup" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );

    const nameInput = screen.getByPlaceholderText('Your full name');
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const phoneInput = screen.getByPlaceholderText('Your phone number');
    const passwordInput = screen.getByPlaceholderText('Min. 8 characters');
    const form = nameInput.closest('form')!;

    fireEvent.change(nameInput, { target: { value: 'Ashley Leon' } });
    fireEvent.change(emailInput, { target: { value: 'ashleyleon92@gmail.com' } });
    fireEvent.change(phoneInput, { target: { value: '+91 98765 43210' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('Ashley Leon', 'ashleyleon92@gmail.com', 'ValidPass123!', '9876543210');
      expect(mockOnSuccess).toHaveBeenCalledWith('client');
    });
  });

  it('successfully submits signup with valid custom domain email and 10-digit phone', async () => {
    mockSignup.mockResolvedValueOnce({ user: { role: 'owner' } });

    render(
      <AuthModal 
        mode="signup" 
        onClose={mockOnClose} 
        onSwitchMode={mockOnSwitchMode} 
        onSuccess={mockOnSuccess} 
      />
    );

    const listVenueBtn = screen.getByRole('button', { name: 'List a Venue' });
    fireEvent.click(listVenueBtn);

    const nameInput = screen.getByPlaceholderText('Your full name');
    const emailInput = screen.getByPlaceholderText('you@example.com');
    const phoneInput = screen.getByPlaceholderText('Your phone number');
    const passwordInput = screen.getByPlaceholderText('Min. 8 characters');
    const form = nameInput.closest('form')!;

    fireEvent.change(nameInput, { target: { value: 'Ashley Owner' } });
    fireEvent.change(emailInput, { target: { value: 'ashley@myground.org' } });
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });
    fireEvent.change(passwordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockSignup).toHaveBeenCalledWith('Ashley Owner', 'ashley@myground.org', 'ValidPass123!', '9876543210');
      expect(mockOnSuccess).toHaveBeenCalledWith('owner');
    });
  });
});

describe('Validation Helpers', () => {
  describe('validateEmail', () => {
    it('accepts valid Gmail and custom domain emails', () => {
      expect(validateEmail('ashleyleon92@gmail.com').isValid).toBe(true);
      expect(validateEmail('user@mycompany.co.in').isValid).toBe(true);
      expect(validateEmail('admin@custom-domain.org').isValid).toBe(true);
      expect(validateEmail('hello@startup.io').isValid).toBe(true);
    });

    it('rejects invalid email formats', () => {
      expect(validateEmail('').isValid).toBe(false);
      expect(validateEmail('ashley').isValid).toBe(false);
      expect(validateEmail('ashley@').isValid).toBe(false);
      expect(validateEmail('ashley@gmail').isValid).toBe(false);
      expect(validateEmail('ashley@.com').isValid).toBe(false);
      expect(validateEmail('ashley leon@gmail.com').isValid).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('accepts valid 10-digit phone numbers and formats', () => {
      expect(validatePhoneNumber('9876543210').isValid).toBe(true);
      expect(validatePhoneNumber('9876543210').cleaned).toBe('9876543210');

      expect(validatePhoneNumber('+91 98765 43210').isValid).toBe(true);
      expect(validatePhoneNumber('+91 98765 43210').cleaned).toBe('9876543210');

      expect(validatePhoneNumber('09876543210').isValid).toBe(true);
      expect(validatePhoneNumber('09876543210').cleaned).toBe('9876543210');

      expect(validatePhoneNumber('919876543210').isValid).toBe(true);
      expect(validatePhoneNumber('919876543210').cleaned).toBe('9876543210');
    });

    it('rejects phone numbers with invalid length', () => {
      const shortRes = validatePhoneNumber('12345');
      expect(shortRes.isValid).toBe(false);
      expect(shortRes.message).toContain('too short');

      const nineDigit = validatePhoneNumber('987654321');
      expect(nineDigit.isValid).toBe(false);
      expect(nineDigit.message).toContain('too short');

      const tooLong = validatePhoneNumber('123456789012345678');
      expect(tooLong.isValid).toBe(false);
      expect(tooLong.message).toContain('too long');
    });

    it('rejects non-numeric characters', () => {
      const letters = validatePhoneNumber('98765abcde');
      expect(letters.isValid).toBe(false);
      expect(letters.message).toContain('only contain numbers');
    });
  });
});
