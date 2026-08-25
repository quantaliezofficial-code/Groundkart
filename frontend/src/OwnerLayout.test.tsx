import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { authApi } from './lib/api/auth';
import { AuthProvider } from './lib/auth';

/**
 * The core behavior this whole feature depends on: OwnerLayout gates
 * itself on the REAL authenticated user's role (App.tsx's activeRole-sync
 * effect + OwnerLayout.tsx's own top-level role check) — not on
 * PerspectiveSwitcher (dev-only, gated behind import.meta.env.DEV) and not
 * on any prop from App.tsx (there are none left — OwnerLayout fetches its
 * own data via hooks/useOwner.ts).
 */

vi.mock('./lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api/client')>();
  return { ...actual, restoreSession: vi.fn().mockResolvedValue(true) };
});

vi.mock('./lib/api/auth', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./lib/api/owner', () => ({
  ownerApi: {
    listMyVenues: vi.fn().mockResolvedValue([]),
    listMyBookings: vi.fn().mockResolvedValue([]),
    listMyPayouts: vi.fn().mockResolvedValue([]),
    getMyVerification: vi.fn().mockResolvedValue(null),
    createVenue: vi.fn(),
    updateVenue: vi.fn(),
    uploadVenueImage: vi.fn(),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    addInventoryUnits: vi.fn(),
    flagBooking: vi.fn(),
    submitVerification: vi.fn(),
  },
}));

vi.mock('./lib/api/notifications', () => ({
  notificationsApi: {
    list: vi.fn().mockResolvedValue([]),
    getUnreadCount: vi.fn().mockResolvedValue({ unread_count: 0 }),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

function mockLoggedInAs(role: 'customer' | 'owner' | 'admin') {
  vi.mocked(authApi.me).mockResolvedValue({
    id: 'u1', name: 'Test User', email: 't@example.com', role, is_verified: role !== 'customer',
  });
}

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

afterEach(() => {
  vi.mocked(authApi.me).mockReset();
});

describe('Owner dashboard role gating', () => {
  it('a real owner lands in the full Owner Dashboard automatically on session restore', async () => {
    mockLoggedInAs('owner');
    renderApp();
    expect(await screen.findByText('Owner Dashboard')).toBeInTheDocument();
    // Confirms this is the real dashboard, not the onboarding gate.
    expect(screen.queryByText('List your venue on GroundBooking')).not.toBeInTheDocument();
  });

  it('a logged-in customer (not yet an owner) sees the onboarding gate, not the dashboard, when they click into the owner view', async () => {
    mockLoggedInAs('customer');
    renderApp();
    const cta = await screen.findByRole('button', { name: /list a venue/i });
    fireEvent.click(cta);
    expect(await screen.findByText('List your venue on GroundBooking')).toBeInTheDocument();
    expect(screen.queryByText('Owner Dashboard')).not.toBeInTheDocument();
  });

  it('the Header CTA reads "Dashboard" (not "List a Venue") once already a real owner', async () => {
    mockLoggedInAs('owner');
    renderApp();
    await screen.findByText('Owner Dashboard');
    expect(screen.queryByRole('button', { name: /^list a venue$/i })).not.toBeInTheDocument();
  });

  it('PerspectiveSwitcher (dev-only role override) is not rendered outside dev mode', async () => {
    const originalDev = import.meta.env.DEV;
    import.meta.env.DEV = false;
    mockLoggedInAs('customer');
    renderApp();
    await screen.findAllByText('GroundBooking');
    expect(screen.queryByText(/perspective/i)).not.toBeInTheDocument();
    import.meta.env.DEV = originalDev;
  });
});
