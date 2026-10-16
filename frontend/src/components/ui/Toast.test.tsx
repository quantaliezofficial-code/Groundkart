import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function TestConsumer() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.error('Something broke!')}>Trigger Error</button>
      <button onClick={() => toast.success('Action succeeded!')}>Trigger Success</button>
      <button onClick={() => toast.info('Informational message')}>Trigger Info</button>
    </div>
  );
}

describe('Toast notification system', () => {
  it('renders error toasts with role="alert"', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Trigger Error').click();
    });

    const alertEl = screen.getByRole('alert');
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent('Something broke!');
  });

  it('renders success toasts with role="status"', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Trigger Success').click();
    });

    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent('Action succeeded!');
  });

  it('allows dismissing a toast by clicking close button', () => {
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('Trigger Error').click();
    });

    expect(screen.getByText('Something broke!')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close notification/i });
    act(() => {
      closeBtn.click();
    });

    expect(screen.queryByText('Something broke!')).not.toBeInTheDocument();
  });
});
