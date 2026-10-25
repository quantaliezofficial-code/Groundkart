import React, { useState, useMemo } from 'react';
import {
  Database,
  BarChart3,
  Table as TableIcon,
  Terminal,
  Activity,
  Download,
  Search,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  HardDrive,
  Users,
  Calendar,
  Wallet,
  FileSpreadsheet,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';
import {
  useDatabaseStats,
  useTableData,
  useExecuteSafeQuery,
  useDatabaseAnalytics,
} from '../../hooks/useAdminDb';
import { adminApi } from '../../lib/api/admin';
import type { ApiTableCatalogItem } from '../../lib/api/types';

type StudioSubTab = 'analytics' | 'explorer' | 'query' | 'health';

function formatBytes(bytesStr: string): string {
  return bytesStr || '0 B';
}

function formatMoney(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function downloadCsvBlob(filename: string, csvString: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  if (typeof window.URL?.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }
}

function jsonToCsv(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvRows: string[] = [];
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));
  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  return '\ufeff' + csvRows.join('\r\n');
}

export default function DatabaseStudioTab() {
  const [activeTab, setActiveTab] = useState<StudioSubTab>('analytics');
  const [analyticsDays, setAnalyticsDays] = useState<number>(30);

  // Health / Stats query
  const { data: dbStats, isLoading: statsLoading, refetch: refetchStats } = useDatabaseStats();

  // Table Explorer state
  const [selectedTable, setSelectedTable] = useState<string>('users');
  const [explorerPage, setExplorerPage] = useState<number>(0);
  const [explorerPageSize, setExplorerPageSize] = useState<number>(25);
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [explorerOrderBy, setExplorerOrderBy] = useState<string | undefined>(undefined);
  const [explorerOrderDir, setExplorerOrderDir] = useState<'asc' | 'desc'>('asc');
  const [cellModalValue, setCellModalValue] = useState<{ key: string; val: any } | null>(null);

  // Table data query
  const {
    data: tableData,
    isLoading: tableLoading,
    refetch: refetchTable,
  } = useTableData(selectedTable, {
    limit: explorerPageSize,
    offset: explorerPage * explorerPageSize,
    order_by: explorerOrderBy,
    order_dir: explorerOrderDir,
    search: explorerSearch,
  });

  // Safe Query state
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT id, name, city, category, status, avg_rating FROM venues ORDER BY created_at DESC LIMIT 20;'
  );
  const queryMutation = useExecuteSafeQuery();
  const [copiedQuery, setCopiedQuery] = useState(false);

  // Analytics query
  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
  } = useDatabaseAnalytics(analyticsDays);

  // Table catalog search
  const [catalogFilter, setCatalogFilter] = useState('');
  const filteredTables = useMemo(() => {
    if (!dbStats?.tables) return [];
    if (!catalogFilter.trim()) return dbStats.tables;
    const q = catalogFilter.toLowerCase();
    return dbStats.tables.filter((t) => t.table_name.toLowerCase().includes(q));
  }, [dbStats?.tables, catalogFilter]);

  const handleRunQuery = () => {
    if (!sqlQuery.trim()) return;
    queryMutation.mutate(sqlQuery);
  };

  const handleExportCurrentTable = async (excelMode: boolean = false) => {
    try {
      const csvData = await adminApi.exportTableCsv(selectedTable, 5000);
      downloadCsvBlob(
        `groundkart_${selectedTable}_${new Date().toISOString().split('T')[0]}.csv`,
        csvData
      );
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleExportQueryResults = () => {
    if (!queryMutation.data?.rows || queryMutation.data.rows.length === 0) return;
    const csvStr = jsonToCsv(queryMutation.data.rows);
    downloadCsvBlob(`groundkart_query_${new Date().toISOString().split('T')[0]}.csv`, csvStr);
  };

  const handleExportAnalyticsCsv = () => {
    if (!analytics?.bookings_trend) return;
    const csvStr = jsonToCsv(analytics.bookings_trend);
    downloadCsvBlob(`groundkart_analytics_${analyticsDays}d.csv`, csvStr);
  };

  const totalPages = tableData ? Math.ceil(tableData.total_rows / explorerPageSize) : 1;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-3xl border border-ink/5 bg-surface-container p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pitch text-chalk">
                <Database size={20} />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-pitch">
                  Database Studio & Analytics
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs font-sans text-on-surface-variant">
                  <span className="flex items-center gap-1 font-medium text-emerald-600">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                  <span>·</span>
                  <span>{dbStats?.postgres_version || 'PostgreSQL'}</span>
                  <span>·</span>
                  <span className="font-mono bg-ink/5 px-1.5 py-0.5 rounded">
                    {dbStats?.database_name || 'groundbooking'}
                  </span>
                  <span>·</span>
                  <span>Disk: {dbStats?.database_size || '15 MB'}</span>
                  {dbStats?.alembic_version && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-on-surface-variant">
                        Rev: {dbStats.alembic_version}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                refetchStats();
                refetchTable();
                refetchAnalytics();
              }}
              className="flex items-center gap-1.5 rounded-full bg-surface-container-high px-4 py-2 font-sans text-xs font-medium text-ink hover:bg-surface-container-highest transition"
            >
              <RefreshCw size={14} className={statsLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 border-t border-ink/5 pt-4">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition ${
              activeTab === 'analytics'
                ? 'bg-pitch text-chalk shadow-sm'
                : 'bg-surface-container-high text-ink hover:bg-surface-container-highest'
            }`}
          >
            <BarChart3 size={16} />
            Analytics & Graphs
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition ${
              activeTab === 'explorer'
                ? 'bg-pitch text-chalk shadow-sm'
                : 'bg-surface-container-high text-ink hover:bg-surface-container-highest'
            }`}
          >
            <TableIcon size={16} />
            Table Explorer
          </button>

          <button
            onClick={() => setActiveTab('query')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition ${
              activeTab === 'query'
                ? 'bg-pitch text-chalk shadow-sm'
                : 'bg-surface-container-high text-ink hover:bg-surface-container-highest'
            }`}
          >
            <Terminal size={16} />
            SQL Query Runner
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-sans text-sm font-medium transition ${
              activeTab === 'health'
                ? 'bg-pitch text-chalk shadow-sm'
                : 'bg-surface-container-high text-ink hover:bg-surface-container-highest'
            }`}
          >
            <HardDrive size={16} />
            DB Health & Tables ({dbStats?.total_tables || 45})
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUBTAB 1: ANALYTICS & VISUAL GRAPHS                                 */}
      {/* =================================================================== */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Time Window:
              </span>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setAnalyticsDays(d)}
                  className={`rounded-lg px-3 py-1 font-sans text-xs font-medium transition ${
                    analyticsDays === d
                      ? 'bg-pitch text-chalk'
                      : 'bg-surface-container text-ink hover:bg-surface-container-high'
                  }`}
                >
                  Last {d} Days
                </button>
              ))}
            </div>

            <button
              onClick={handleExportAnalyticsCsv}
              disabled={!analytics?.bookings_trend?.length}
              className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-chalk px-3.5 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container shadow-sm transition disabled:opacity-50"
            >
              <Download size={14} />
              Export Trend (CSV)
            </button>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Total GMV ({analyticsDays}d)
                </span>
                <Wallet size={18} className="text-emerald-600" />
              </div>
              <p className="font-display text-3xl font-bold text-pitch">
                {analyticsLoading ? '...' : formatMoney(analytics?.total_gmv ?? 0)}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Gross transaction volume
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Total Bookings
                </span>
                <Calendar size={18} className="text-marigold" />
              </div>
              <p className="font-display text-3xl font-bold text-pitch">
                {analyticsLoading ? '...' : (analytics?.total_bookings ?? 0)}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Across all active spaces
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Avg Booking Value
                </span>
                <BarChart3 size={18} className="text-clay" />
              </div>
              <p className="font-display text-3xl font-bold text-pitch">
                {analyticsLoading ? '...' : formatMoney(analytics?.average_booking_value ?? 0)}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Per reservation average
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Active Venues
                </span>
                <Layers size={18} className="text-pitch" />
              </div>
              <p className="font-display text-3xl font-bold text-pitch">
                {analyticsLoading ? '...' : (analytics?.active_venues_count ?? 0)}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Ready for instant bookings
              </p>
            </div>
          </div>

          {/* Daily Bookings & GMV Revenue Trend Chart */}
          <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="font-display text-lg font-bold text-pitch">
                  Daily Bookings & Revenue Trend
                </h3>
                <p className="font-sans text-xs text-on-surface-variant">
                  Visual volume and Gross Merchandise Value over the last {analyticsDays} days
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-sans text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />
                  <span>Bookings Count</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-sm bg-marigold" />
                  <span>GMV (₹)</span>
                </div>
              </div>
            </div>

            {/* SVG Interactive Chart */}
            {analytics?.bookings_trend && analytics.bookings_trend.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[650px] h-64 relative">
                  {(() => {
                    const trend = analytics.bookings_trend;
                    const maxCount = Math.max(...trend.map((t) => t.bookings_count), 5);
                    const maxGmv = Math.max(...trend.map((t) => t.gmv), 1000);
                    const chartHeight = 200;
                    const chartWidth = 650;
                    const paddingBottom = 30;
                    const barWidth = Math.max(6, Math.floor(chartWidth / (trend.length * 2.2)));

                    return (
                      <svg
                        viewBox={`0 0 ${chartWidth} ${chartHeight + paddingBottom}`}
                        className="w-full h-full"
                      >
                        {/* Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                          const y = chartHeight - ratio * chartHeight;
                          return (
                            <g key={idx}>
                              <line
                                x1={0}
                                y1={y}
                                x2={chartWidth}
                                y2={y}
                                stroke="currentColor"
                                strokeDasharray="3 3"
                                className="text-ink/10"
                              />
                              <text
                                x={4}
                                y={y - 4}
                                fontSize={9}
                                fill="currentColor"
                                className="text-on-surface-variant font-mono"
                              >
                                {Math.round(maxCount * ratio)} bkgs
                              </text>
                            </g>
                          );
                        })}

                        {/* Bars for bookings count */}
                        {trend.map((item, i) => {
                          const x = (i / trend.length) * (chartWidth - 40) + 30;
                          const countHeight = (item.bookings_count / maxCount) * chartHeight;
                          const y = chartHeight - countHeight;
                          const isHighlighted = item.bookings_count > 0;

                          return (
                            <g key={i} className="group cursor-pointer">
                              <title>{`${item.day}: ${item.bookings_count} bookings, ${formatMoney(item.gmv)}`}</title>
                              <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(countHeight, 2)}
                                rx={2}
                                className={
                                  isHighlighted
                                    ? 'fill-emerald-600 hover:fill-emerald-500 transition-colors'
                                    : 'fill-ink/10'
                                }
                              />
                              {/* Date label every few bars */}
                              {(trend.length <= 14 || i % Math.ceil(trend.length / 8) === 0) && (
                                <text
                                  x={x + barWidth / 2}
                                  y={chartHeight + 16}
                                  textAnchor="middle"
                                  fontSize={9}
                                  fill="currentColor"
                                  className="text-on-surface-variant font-mono"
                                >
                                  {item.day.slice(5)}
                                </text>
                              )}
                            </g>
                          );
                        })}

                        {/* Line chart for GMV trend */}
                        {(() => {
                          const points = trend
                            .map((item, i) => {
                              const x = (i / trend.length) * (chartWidth - 40) + 30 + barWidth / 2;
                              const y = chartHeight - (item.gmv / maxGmv) * chartHeight;
                              return `${x},${y}`;
                            })
                            .join(' ');

                          return (
                            <polyline
                              fill="none"
                              stroke="#eab308"
                              strokeWidth={2}
                              points={points}
                              className="opacity-80"
                            />
                          );
                        })()}
                      </svg>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center font-sans text-sm text-on-surface-variant">
                No booking trend activity in this time range.
              </div>
            )}
          </div>

          {/* Grid: Donut Status Distribution & User Roles */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Booking Status Breakdown */}
            <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm">
              <h3 className="font-display text-lg font-bold text-pitch mb-4">
                Booking Status Distribution
              </h3>
              <div className="space-y-3">
                {analytics?.booking_status_distribution?.map((st) => (
                  <div key={st.status} className="space-y-1">
                    <div className="flex justify-between font-sans text-xs">
                      <span className="font-medium text-ink capitalize">
                        {st.status.replace('_', ' ')}
                      </span>
                      <span className="text-on-surface-variant">
                        {st.count} ({st.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          st.status === 'confirmed' || st.status === 'completed'
                            ? 'bg-emerald-500'
                            : st.status === 'pending'
                            ? 'bg-marigold'
                            : 'bg-clay'
                        }`}
                        style={{ width: `${st.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Roles & Venue Status Breakdown */}
            <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm">
              <h3 className="font-display text-lg font-bold text-pitch mb-4">
                Platform Composition
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    User Accounts by Role
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {analytics?.user_roles_distribution?.map((r) => (
                      <div
                        key={r.role}
                        className="rounded-xl border border-ink/5 bg-surface-container/50 p-3 text-center"
                      >
                        <p className="font-display text-xl font-bold text-pitch">{r.count}</p>
                        <p className="font-sans text-xs text-on-surface-variant capitalize">
                          {r.role}s
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
                    Venue Listings Status
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {analytics?.venue_status_distribution?.map((v) => (
                      <div
                        key={v.status}
                        className="rounded-xl border border-ink/5 bg-surface-container/50 p-3 text-center"
                      >
                        <p className="font-display text-xl font-bold text-pitch">{v.count}</p>
                        <p className="font-sans text-xs text-on-surface-variant capitalize">
                          {v.status.replace('_', ' ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Venues by Performance */}
          <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm overflow-hidden">
            <h3 className="font-display text-lg font-bold text-pitch mb-1">Top Venues by Performance</h3>
            <p className="font-sans text-xs text-on-surface-variant mb-4">
              Leading venues generating the highest booking volume and gross revenue
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-sm">
                <thead>
                  <tr className="border-b border-surface-container text-xs text-on-surface-variant uppercase tracking-wider">
                    <th className="py-2.5 px-3">Venue Name</th>
                    <th className="py-2.5 px-3">Bookings</th>
                    <th className="py-2.5 px-3 text-right">GMV Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container">
                  {analytics?.top_venues?.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-container/50 transition">
                      <td className="py-3 px-3 font-medium text-pitch">{v.name}</td>
                      <td className="py-3 px-3 text-ink">{v.bookings_count} bookings</td>
                      <td className="py-3 px-3 text-right font-medium text-pitch">
                        {formatMoney(v.gmv)}
                      </td>
                    </tr>
                  ))}
                  {(!analytics?.top_venues || analytics.top_venues.length === 0) && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-on-surface-variant">
                        No venue booking data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUBTAB 2: TABLE EXPLORER                                            */}
      {/* =================================================================== */}
      {activeTab === 'explorer' && (
        <div className="space-y-4">
          {/* Table Selector & Search Controls Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-ink/5 bg-chalk p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  Select Table:
                </span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value);
                    setExplorerPage(0);
                    setExplorerOrderBy(undefined);
                  }}
                  className="rounded-xl border border-ink/10 bg-surface-container px-3 py-1.5 font-sans text-sm font-semibold text-pitch focus:outline-none focus:ring-2 focus:ring-pitch"
                >
                  {dbStats?.tables?.map((t) => (
                    <option key={t.table_name} value={t.table_name}>
                      {t.table_name} ({t.row_count} rows · {t.total_size})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  type="text"
                  placeholder="Filter rows..."
                  value={explorerSearch}
                  onChange={(e) => {
                    setExplorerSearch(e.target.value);
                    setExplorerPage(0);
                  }}
                  className="w-48 sm:w-64 rounded-xl border border-ink/10 bg-surface-container py-1.5 pl-8 pr-3 font-sans text-xs text-ink placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportCurrentTable(false)}
                className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-surface-container-high px-3 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container-highest transition"
                title="Download CSV"
              >
                <Download size={14} />
                Export CSV
              </button>

              <button
                onClick={() => handleExportCurrentTable(true)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 py-1.5 font-sans text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition"
                title="Download Excel compatible CSV with BOM"
              >
                <FileSpreadsheet size={14} />
                Excel (.csv)
              </button>
            </div>
          </div>

          {/* Table Data Grid */}
          <div className="rounded-3xl border border-ink/5 bg-chalk shadow-sm overflow-hidden">
            <div className="border-b border-surface-container px-6 py-4 flex justify-between items-center bg-mist/30">
              <div className="flex items-center gap-3">
                <h3 className="font-mono text-sm font-bold text-pitch">{selectedTable}</h3>
                <span className="font-sans text-xs text-on-surface-variant">
                  Total {tableData?.total_rows ?? 0} record(s)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-sans text-on-surface-variant">
                <span>Rows per page:</span>
                <select
                  value={explorerPageSize}
                  onChange={(e) => {
                    setExplorerPageSize(Number(e.target.value));
                    setExplorerPage(0);
                  }}
                  className="rounded-lg border border-ink/10 bg-chalk px-2 py-1 font-mono text-xs text-pitch"
                >
                  <option value={12}>12</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {tableLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                <RefreshCw size={24} className="animate-spin text-pitch" />
                <span className="font-sans text-sm">Loading records from {selectedTable}...</span>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="sticky top-0 bg-surface-container text-ink font-semibold uppercase tracking-wider z-10 border-b border-ink/5">
                    <tr>
                      {tableData?.columns?.map((col) => {
                        const isSorted = explorerOrderBy === col.name;
                        return (
                          <th
                            key={col.name}
                            onClick={() => {
                              if (explorerOrderBy === col.name) {
                                setExplorerOrderDir(explorerOrderDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setExplorerOrderBy(col.name);
                                setExplorerOrderDir('asc');
                              }
                            }}
                            className="py-3 px-4 cursor-pointer hover:bg-surface-container-high transition select-none whitespace-nowrap"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{col.name}</span>
                              {col.is_primary_key && (
                                <span className="rounded bg-amber-500/10 px-1 text-[9px] font-bold text-amber-700">
                                  PK
                                </span>
                              )}
                              {isSorted ? (
                                explorerOrderDir === 'asc' ? (
                                  <ArrowUp size={12} className="text-pitch" />
                                ) : (
                                  <ArrowDown size={12} className="text-pitch" />
                                )
                              ) : (
                                <ArrowUpDown size={12} className="opacity-30" />
                              )}
                            </div>
                            <div className="text-[10px] lowercase font-normal opacity-50 font-mono">
                              {col.data_type}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-mono text-[11px]">
                    {tableData?.rows?.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-surface-container/40 transition">
                        {tableData.columns.map((col) => {
                          const val = row[col.name];
                          const isObj = val !== null && typeof val === 'object';
                          const displayStr =
                            val === null || val === undefined
                              ? 'NULL'
                              : isObj
                              ? JSON.stringify(val)
                              : String(val);

                          return (
                            <td
                              key={col.name}
                              onClick={() => {
                                if (displayStr.length > 25 || isObj) {
                                  setCellModalValue({ key: col.name, val });
                                }
                              }}
                              className={`py-2.5 px-4 max-w-[240px] truncate ${
                                val === null ? 'text-on-surface-variant/40 italic' : 'text-ink'
                              } ${
                                displayStr.length > 25 || isObj
                                  ? 'cursor-pointer hover:text-pitch hover:underline'
                                  : ''
                              }`}
                              title={displayStr}
                            >
                              {displayStr}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {(!tableData?.rows || tableData.rows.length === 0) && (
                      <tr>
                        <td
                          colSpan={tableData?.columns?.length || 1}
                          className="py-12 text-center text-on-surface-variant font-sans"
                        >
                          No rows found in this table matching the query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div className="border-t border-surface-container px-6 py-3 flex items-center justify-between text-xs font-sans text-on-surface-variant">
              <div>
                Showing {tableData?.rows?.length ? explorerPage * explorerPageSize + 1 : 0} to{' '}
                {Math.min((explorerPage + 1) * explorerPageSize, tableData?.total_rows ?? 0)} of{' '}
                {tableData?.total_rows ?? 0}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={explorerPage <= 0}
                  onClick={() => setExplorerPage((p) => Math.max(p - 1, 0))}
                  className="rounded-lg p-1.5 hover:bg-surface-container disabled:opacity-40 transition"
                  aria-label="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="font-mono px-2">
                  Page {explorerPage + 1} of {Math.max(totalPages, 1)}
                </span>
                <button
                  disabled={explorerPage >= totalPages - 1}
                  onClick={() => setExplorerPage((p) => p + 1)}
                  className="rounded-lg p-1.5 hover:bg-surface-container disabled:opacity-40 transition"
                  aria-label="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SUBTAB 3: SAFE SQL QUERY RUNNER                                     */}
      {/* =================================================================== */}
      {activeTab === 'query' && (
        <div className="space-y-4">
          {/* Query Console Editor */}
          <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-pitch" />
                <h3 className="font-display text-lg font-bold text-pitch">Read-Only SQL Console</h3>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-sans text-[11px] font-semibold text-emerald-700">
                  🔒 Read-Only Protected
                </span>
              </div>
              <span className="font-sans text-xs text-on-surface-variant">
                Auto-capped at 500 rows maximum
              </span>
            </div>

            {/* Quick Sample Query Chips */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="font-sans text-xs text-on-surface-variant font-medium mr-1">
                Presets:
              </span>
              {[
                {
                  label: 'Recent 20 Venues',
                  sql: 'SELECT id, name, city, category, status, avg_rating FROM venues ORDER BY created_at DESC LIMIT 20;',
                },
                {
                  label: 'Bookings by Status',
                  sql: 'SELECT status, count(*) AS count, coalesce(sum(amount), 0) AS total_amount FROM bookings GROUP BY status ORDER BY count DESC;',
                },
                {
                  label: 'Users by Role',
                  sql: 'SELECT role, is_verified, count(*) FROM users WHERE deleted_at IS NULL GROUP BY role, is_verified;',
                },
                {
                  label: 'Top 5 Venues by Revenue',
                  sql: 'SELECT v.name, count(b.id) AS bookings, sum(b.amount) AS total_gmv FROM venues v JOIN bookings b ON b.venue_id = v.id GROUP BY v.id, v.name ORDER BY total_gmv DESC LIMIT 5;',
                },
                {
                  label: 'Platform System Config',
                  sql: 'SELECT * FROM system_configurations;',
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setSqlQuery(chip.sql)}
                  className="rounded-lg bg-surface-container px-2.5 py-1 font-sans text-xs text-ink hover:bg-surface-container-high transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                }}
                rows={5}
                placeholder="Enter read-only SQL query (SELECT or WITH)..."
                className="w-full rounded-2xl border border-ink/10 bg-surface-container/60 p-4 font-mono text-xs text-ink leading-relaxed focus:outline-none focus:ring-2 focus:ring-pitch custom-scrollbar"
              />
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunQuery}
                  disabled={queryMutation.isPending || !sqlQuery.trim()}
                  className="flex items-center gap-2 rounded-xl bg-pitch px-5 py-2 font-sans text-xs font-semibold text-chalk hover:bg-pitch/90 shadow-sm transition disabled:opacity-50"
                >
                  {queryMutation.isPending ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} className="fill-current" />
                  )}
                  Run Query (Ctrl+Enter)
                </button>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sqlQuery);
                    setCopiedQuery(true);
                    setTimeout(() => setCopiedQuery(false), 2000);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-surface-container px-3 py-2 font-sans text-xs font-medium text-ink hover:bg-surface-container-high transition"
                >
                  {copiedQuery ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  Copy SQL
                </button>
              </div>

              {queryMutation.data && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-on-surface-variant">
                    {queryMutation.data.row_count} row(s) returned in{' '}
                    <strong className="text-pitch">{queryMutation.data.duration_ms}ms</strong>
                  </span>
                  <button
                    onClick={handleExportQueryResults}
                    className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-chalk px-3.5 py-1.5 font-sans text-xs font-medium text-ink hover:bg-surface-container shadow-sm transition"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>
              )}
            </div>

            {/* Error Display */}
            {queryMutation.isError && (
              <div className="mt-4 rounded-xl bg-clay/10 p-4 font-mono text-xs text-clay flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{queryMutation.error?.message || 'SQL execution failed.'}</span>
              </div>
            )}
          </div>

          {/* Results Table */}
          {queryMutation.data && (
            <div className="rounded-3xl border border-ink/5 bg-chalk shadow-sm overflow-hidden">
              <div className="border-b border-surface-container px-6 py-3.5 bg-mist/30 flex justify-between items-center">
                <h4 className="font-sans text-xs font-bold text-pitch uppercase tracking-wider">
                  Query Results Grid
                </h4>
                {queryMutation.data.truncated && (
                  <span className="rounded bg-marigold/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                    Capped at 500 rows
                  </span>
                )}
              </div>

              <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="sticky top-0 bg-surface-container text-ink font-semibold uppercase tracking-wider z-10 border-b border-ink/5">
                    <tr>
                      {queryMutation.data.columns.map((col) => (
                        <th key={col} className="py-2.5 px-4 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-mono text-[11px]">
                    {queryMutation.data.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-surface-container/40 transition">
                        {queryMutation.data.columns.map((col) => {
                          const val = row[col];
                          const isObj = val !== null && typeof val === 'object';
                          const displayStr =
                            val === null || val === undefined
                              ? 'NULL'
                              : isObj
                              ? JSON.stringify(val)
                              : String(val);

                          return (
                            <td
                              key={col}
                              onClick={() => {
                                if (displayStr.length > 25 || isObj) {
                                  setCellModalValue({ key: col, val });
                                }
                              }}
                              className={`py-2 px-4 max-w-[240px] truncate ${
                                val === null ? 'text-on-surface-variant/40 italic' : 'text-ink'
                              } ${
                                displayStr.length > 25 || isObj
                                  ? 'cursor-pointer hover:text-pitch hover:underline'
                                  : ''
                              }`}
                              title={displayStr}
                            >
                              {displayStr}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUBTAB 4: DATABASE HEALTH & TABLES                                  */}
      {/* =================================================================== */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Health Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Active Connections
              </span>
              <p className="font-display text-3xl font-bold text-pitch mt-2">
                {dbStats?.active_connections ?? 1}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Postgres server connection pool
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Buffer Cache Hit Ratio
              </span>
              <p className="font-display text-3xl font-bold text-emerald-600 mt-2">
                {dbStats?.cache_hit_ratio ?? 99.8}%
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                RAM block cache efficiency
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Public Tables
              </span>
              <p className="font-display text-3xl font-bold text-pitch mt-2">
                {dbStats?.total_tables ?? 45}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Indexed relational schemas
              </p>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-chalk p-5 shadow-sm">
              <span className="font-sans text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Total Live Rows
              </span>
              <p className="font-display text-3xl font-bold text-pitch mt-2">
                {(dbStats?.total_rows ?? 0).toLocaleString()}
              </p>
              <p className="font-sans text-xs text-on-surface-variant mt-1">
                Across all platform tables
              </p>
            </div>
          </div>

          {/* Table Catalog */}
          <div className="rounded-3xl border border-ink/5 bg-chalk p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-pitch">Public Table Catalog</h3>
                <p className="font-sans text-xs text-on-surface-variant">
                  Live disk space, index allocation, and record counts across tables
                </p>
              </div>

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
                />
                <input
                  type="text"
                  placeholder="Filter table name..."
                  value={catalogFilter}
                  onChange={(e) => setCatalogFilter(e.target.value)}
                  className="w-56 rounded-xl border border-ink/10 bg-surface-container py-1.5 pl-8 pr-3 font-sans text-xs text-ink placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-pitch"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="border-b border-surface-container text-xs text-on-surface-variant uppercase tracking-wider">
                    <th className="py-2.5 px-3">Table Name</th>
                    <th className="py-2.5 px-3">Columns</th>
                    <th className="py-2.5 px-3">Row Count</th>
                    <th className="py-2.5 px-3">Table Size</th>
                    <th className="py-2.5 px-3">Index Size</th>
                    <th className="py-2.5 px-3">Total Size</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-mono text-[11px]">
                  {filteredTables.map((t) => (
                    <tr key={t.table_name} className="hover:bg-surface-container/50 transition">
                      <td className="py-2.5 px-3 font-bold text-pitch">{t.table_name}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">{t.columns_count}</td>
                      <td className="py-2.5 px-3 font-bold text-ink">
                        {t.row_count.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-on-surface-variant">{t.table_size}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">{t.index_size}</td>
                      <td className="py-2.5 px-3 font-medium text-pitch">{t.total_size}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedTable(t.table_name);
                            setExplorerPage(0);
                            setExplorerOrderBy(undefined);
                            setActiveTab('explorer');
                          }}
                          className="rounded-lg bg-surface-container px-2.5 py-1 font-sans text-xs font-semibold text-pitch hover:bg-pitch hover:text-chalk transition"
                        >
                          Explore
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredTables.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-on-surface-variant font-sans">
                        No tables matching '{catalogFilter}'.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cell Value Inspector Modal */}
      {cellModalValue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl border border-ink/10 bg-chalk p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <h4 className="font-mono text-sm font-bold text-pitch">
                Cell Inspector: {cellModalValue.key}
              </h4>
              <button
                onClick={() => setCellModalValue(null)}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl bg-surface-container/60 p-4 font-mono text-xs text-ink leading-relaxed custom-scrollbar">
              <pre className="whitespace-pre-wrap break-all">
                {typeof cellModalValue.val === 'object'
                  ? JSON.stringify(cellModalValue.val, null, 2)
                  : String(cellModalValue.val)}
              </pre>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  const textVal =
                    typeof cellModalValue.val === 'object'
                      ? JSON.stringify(cellModalValue.val, null, 2)
                      : String(cellModalValue.val);
                  navigator.clipboard.writeText(textVal);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-surface-container px-3.5 py-1.5 font-sans text-xs font-semibold text-ink hover:bg-surface-container-high transition"
              >
                <Copy size={13} />
                Copy Value
              </button>
              <button
                onClick={() => setCellModalValue(null)}
                className="rounded-xl bg-pitch px-4 py-1.5 font-sans text-xs font-semibold text-chalk hover:bg-pitch/90 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
