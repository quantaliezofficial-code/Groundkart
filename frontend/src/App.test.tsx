import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AuthProvider } from './lib/auth';
import { venuesApi } from './lib/api/venues';
import { ApiError } from './lib/api/client';
import type { VenueListResponse, ApiHomepageResponse } from './lib/api/types';

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

const emptyVenueList: VenueListResponse = { data: [], total: 0, limit: 20, offset: 0 };
const emptyHomepage: ApiHomepageResponse = { featured: [], trending: [], popular: [], recommended: [], new: [] };

vi.mock('./lib/api/venues', () => ({
  venuesApi: {
    get: vi.fn(),
    search: vi.fn().mockImplementation(() => Promise.resolve({ data: [], total: 0, limit: 20, offset: 0 })),
    getHomepage: vi.fn().mockImplementation(() => Promise.resolve({ featured: [], trending: [], popular: [], recommended: [], new: [] })),
    listInventoryUnits: vi.fn().mockResolvedValue([]),
    getReviews: vi.fn().mockResolvedValue([]),
    createReview: vi.fn(),
    deleteVenue: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return actual;
});

function renderApp(initialEntries: string[] = ['/']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        retryDelay: 0,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}><App /></MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('App smoke test', () => {
  it('renders the home view with the GroundKart brand', async () => {
    renderApp();
    // findAllByText, not findByText: the brand name correctly appears in
    // both the header logo and the footer, so an exact-single-match query
    // is the wrong assertion — the test only cares that it renders at all.
    const matches = await screen.findAllByAltText('GroundKart');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows a "Log in" control when no one is logged in', async () => {
    renderApp();
    expect(await screen.findByRole('button', { name: /log in/i })).toBeInTheDocument();
  });
});

describe('Issue 7: Venue detail and checkout fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(venuesApi.search).mockResolvedValue(emptyVenueList);
    vi.mocked(venuesApi.getHomepage).mockResolvedValue(emptyHomepage);
  });

  it('1. venuesApi.get rejects with 404 at /venues/does-not-exist: renders 404 page and no other venue name appears', async () => {
    vi.mocked(venuesApi.get).mockRejectedValue(new ApiError(404, 'Not found'));
    renderApp(['/venues/does-not-exist']);
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.queryByText('The Grand Turf Arena')).not.toBeInTheDocument();
  });

  it('2. venuesApi.get is pending: a skeleton is shown, not another venue', async () => {
    vi.mocked(venuesApi.get).mockReturnValue(new Promise(() => {}));
    const { container } = renderApp(['/venues/pending-venue']);
    await waitFor(() => {
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
    expect(screen.queryByText('The Grand Turf Arena')).not.toBeInTheDocument();
  });

  it('3. venuesApi.get rejects with 500: an error message and a Retry button appear', async () => {
    vi.mocked(venuesApi.get).mockRejectedValue(new ApiError(500, 'Server error'));
    renderApp(['/venues/failing-venue']);
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText(/failed to load venue/i)).toBeInTheDocument();
    expect(screen.queryByText('The Grand Turf Arena')).not.toBeInTheDocument();
  });

  it('4. venue list is empty and home page loads: no sample venue name from data.ts appears', async () => {
    renderApp(['/']);
    await waitFor(() => {
      expect(screen.queryByText('The Grand Turf Arena')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Metro Sports Arena')).not.toBeInTheDocument();
  });

  it('5. /checkout with no selected slot redirects to /search or the previous venue page', async () => {
    renderApp(['/checkout']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear all active filters/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: /review & confirm/i })).not.toBeInTheDocument();
  });
});

