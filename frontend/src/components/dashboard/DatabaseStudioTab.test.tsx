import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DatabaseStudioTab from './DatabaseStudioTab';
import { adminApi } from '../../lib/api/admin';

vi.mock('../../lib/api/admin', () => ({
  adminApi: {
    getDatabaseStats: vi.fn(),
    getTableData: vi.fn(),
    executeSafeQuery: vi.fn(),
    getDatabaseAnalytics: vi.fn(),
    exportTableCsv: vi.fn(),
  },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', name: 'Super Admin', role: 'admin' },
  }),
}));

const mockStats = {
  db_connected: true,
  database_name: 'groundbooking',
  postgres_version: 'PostgreSQL 18.4',
  alembic_version: 'h1_resilience_backstops',
  database_size: '15 MB',
  active_connections: 3,
  cache_hit_ratio: 99.85,
  total_tables: 45,
  total_rows: 1540,
  tables: [
    {
      table_name: 'users',
      row_count: 65,
      total_size: '64 kB',
      table_size: '32 kB',
      index_size: '32 kB',
      columns_count: 14,
    },
    {
      table_name: 'venues',
      row_count: 98,
      total_size: '256 kB',
      table_size: '128 kB',
      index_size: '128 kB',
      columns_count: 27,
    },
    {
      table_name: 'bookings',
      row_count: 51,
      total_size: '128 kB',
      table_size: '64 kB',
      index_size: '64 kB',
      columns_count: 18,
    },
  ],
};

const mockTableData = {
  table_name: 'users',
  columns: [
    { name: 'id', data_type: 'uuid', is_nullable: false, is_primary_key: true },
    { name: 'name', data_type: 'text', is_nullable: false, is_primary_key: false },
    { name: 'email', data_type: 'text', is_nullable: false, is_primary_key: false },
    { name: 'role', data_type: 'user_role', is_nullable: false, is_primary_key: false },
  ],
  total_rows: 2,
  limit: 25,
  offset: 0,
  rows: [
    { id: 'u1', name: 'Admin One', email: 'admin@groundkart.com', role: 'admin' },
    { id: 'u2', name: 'Pushkar Customer', email: 'pushkar@groundkart.com', role: 'customer' },
  ],
};

const mockAnalytics = {
  days: 30,
  total_bookings: 51,
  total_gmv: 314700,
  average_booking_value: 6170.58,
  active_venues_count: 98,
  bookings_trend: [
    { day: '2026-10-20', bookings_count: 8, gmv: 245200 },
    { day: '2026-10-22', bookings_count: 32, gmv: 67500 },
    { day: '2026-10-24', bookings_count: 11, gmv: 2000 },
  ],
  booking_status_distribution: [
    { status: 'confirmed', count: 42, percentage: 82.4 },
    { status: 'cancelled', count: 9, percentage: 17.6 },
  ],
  user_roles_distribution: [
    { role: 'customer', count: 50 },
    { role: 'owner', count: 10 },
    { role: 'admin', count: 5 },
  ],
  venue_status_distribution: [
    { status: 'active', count: 98, percentage: 100 },
  ],
  top_venues: [
    { id: 'v1', name: 'Skyline Turf Arena', bookings_count: 24, gmv: 148000 },
    { id: 'v2', name: 'Royal Palace Banquet', bookings_count: 15, gmv: 120000 },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('DatabaseStudioTab Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminApi.getDatabaseStats as any).mockResolvedValue(mockStats);
    (adminApi.getTableData as any).mockResolvedValue(mockTableData);
    (adminApi.getDatabaseAnalytics as any).mockResolvedValue(mockAnalytics);
  });

  it('1. renders top status bar with database badges and navigation subtabs', async () => {
    renderWithClient(<DatabaseStudioTab />);

    expect(screen.getByText('Database Studio & Analytics')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/groundbooking/)).toBeInTheDocument();
      expect(screen.getByText(/PostgreSQL 18.4/)).toBeInTheDocument();
      expect(screen.getByText(/Disk: 15 MB/)).toBeInTheDocument();
    });

    // Check subtab buttons
    expect(screen.getByRole('button', { name: /Analytics & Graphs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Table Explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SQL Query Runner/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DB Health & Tables/i })).toBeInTheDocument();
  });

  it('2. renders analytics KPI cards and visual trend chart in Analytics view', async () => {
    renderWithClient(<DatabaseStudioTab />);

    await waitFor(() => {
      expect(screen.getByText(/Total GMV/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Bookings/i)).toBeInTheDocument();
      expect(screen.getByText('51')).toBeInTheDocument();
      expect(screen.getByText('Daily Bookings & Revenue Trend')).toBeInTheDocument();
      expect(screen.getByText('Top Venues by Performance')).toBeInTheDocument();
      expect(screen.getByText('Skyline Turf Arena')).toBeInTheDocument();
    });
  });

  it('3. allows switching to Table Explorer, selecting tables, and viewing data rows', async () => {
    renderWithClient(<DatabaseStudioTab />);

    // Click Table Explorer tab
    fireEvent.click(screen.getByRole('button', { name: /Table Explorer/i }));

    await waitFor(() => {
      expect(screen.getByText(/Select Table:/i)).toBeInTheDocument();
      expect(screen.getByText('Admin One')).toBeInTheDocument();
      expect(screen.getByText('pushkar@groundkart.com')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Excel \(\.csv\)/i })).toBeInTheDocument();
    });
  });

  it('4. allows switching to SQL Query Runner and executing a query', async () => {
    (adminApi.executeSafeQuery as any).mockResolvedValue({
      columns: ['name', 'status', 'avg_rating'],
      rows: [
        { name: 'Skyline Arena', status: 'active', avg_rating: '4.8' },
        { name: 'Gomti Turf', status: 'active', avg_rating: '4.5' },
      ],
      row_count: 2,
      duration_ms: 14.5,
      truncated: false,
    });

    renderWithClient(<DatabaseStudioTab />);

    // Click SQL Query Runner tab
    fireEvent.click(screen.getByRole('button', { name: /SQL Query Runner/i }));

    expect(screen.getByText('Read-Only SQL Console')).toBeInTheDocument();
    expect(screen.getByText(/Read-Only Protected/i)).toBeInTheDocument();

    const runBtn = screen.getByRole('button', { name: /Run Query/i });
    expect(runBtn).toBeInTheDocument();

    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(adminApi.executeSafeQuery).toHaveBeenCalled();
      expect(screen.getByText('Skyline Arena')).toBeInTheDocument();
      expect(screen.getByText('Gomti Turf')).toBeInTheDocument();
      expect(screen.getByText(/14.5ms/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    });
  });

  it('5. allows switching to DB Health & Tables to view table catalog', async () => {
    renderWithClient(<DatabaseStudioTab />);

    // Click DB Health & Tables tab
    fireEvent.click(screen.getByRole('button', { name: /DB Health & Tables/i }));

    await waitFor(() => {
      expect(screen.getByText('Buffer Cache Hit Ratio')).toBeInTheDocument();
      expect(screen.getByText('99.85%')).toBeInTheDocument();
      expect(screen.getByText('Public Table Catalog')).toBeInTheDocument();
      expect(screen.getByText('users')).toBeInTheDocument();
      expect(screen.getByText('venues')).toBeInTheDocument();
      expect(screen.getByText('bookings')).toBeInTheDocument();
    });
  });

  it('6. triggers CSV export when export button is clicked', async () => {
    (adminApi.exportTableCsv as any).mockResolvedValue('id,name,role\nu1,Admin,admin');

    renderWithClient(<DatabaseStudioTab />);

    fireEvent.click(screen.getByRole('button', { name: /Table Explorer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));

    await waitFor(() => {
      expect(adminApi.exportTableCsv).toHaveBeenCalledWith('users', 5000);
    });
  });
});
