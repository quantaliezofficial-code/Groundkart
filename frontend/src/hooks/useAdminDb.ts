import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '../lib/api/admin';
import type {
  ApiDatabaseStats,
  ApiTableData,
  ApiSafeQueryResponse,
  ApiDatabaseAnalytics,
} from '../lib/api/types';
import { useAuth } from '../lib/auth';

export function useDatabaseStats() {
  const { user } = useAuth();
  return useQuery<ApiDatabaseStats>({
    queryKey: ['admin-db-stats'],
    queryFn: () => adminApi.getDatabaseStats(),
    enabled: Boolean(user && user.role === 'admin'),
    staleTime: 10_000,
  });
}

export function useTableData(
  tableName: string,
  params: {
    limit?: number;
    offset?: number;
    order_by?: string;
    order_dir?: 'asc' | 'desc';
    search?: string;
  } = {}
) {
  const { user } = useAuth();
  return useQuery<ApiTableData>({
    queryKey: ['admin-db-table', tableName, params],
    queryFn: () => adminApi.getTableData(tableName, params),
    enabled: Boolean(user && user.role === 'admin' && tableName),
    staleTime: 5_000,
  });
}

export function useExecuteSafeQuery() {
  return useMutation<ApiSafeQueryResponse, Error, string>({
    mutationFn: (sql: string) => adminApi.executeSafeQuery(sql),
  });
}

export function useDatabaseAnalytics(days: number = 30) {
  const { user } = useAuth();
  return useQuery<ApiDatabaseAnalytics>({
    queryKey: ['admin-db-analytics', days],
    queryFn: () => adminApi.getDatabaseAnalytics(days),
    enabled: Boolean(user && user.role === 'admin'),
    staleTime: 30_000,
  });
}
