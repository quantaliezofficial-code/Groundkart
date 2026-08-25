import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './lib/auth';

// restoreSession() calls the real API on mount — mocked here so these
// tests never depend on a live backend being reachable, matching
// PHASE_A_SUMMARY.md's own smoke-test scope (renders + basic navigation,
// not integration against a live server).
vi.mock('./lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api/client')>();
  return {
    ...actual,
    restoreSession: vi.fn().mockResolvedValue(false),
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return actual;
});

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('App smoke test', () => {
  it('renders the home view with the GroundBooking brand', async () => {
    renderApp();
    // findAllByText, not findByText: the brand name correctly appears in
    // both the header logo and the footer, so an exact-single-match query
    // is the wrong assertion — the test only cares that it renders at all.
    const matches = await screen.findAllByText('GroundBooking');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows a "Log in" control when no one is logged in', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
});
