import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A booking's availability status is exactly the kind of thing
      // that can change from someone else's action between renders —
      // default to fairly fresh data rather than React Query's 0-staleTime-
      // implied "always refetch on mount" being the only thing preventing
      // a stale slot picker. 30s is a light cache, not a long one.
      staleTime: 30_000,
      retry: (failureCount, error: any) => {
        if (error?.status === 429) return false;
        return failureCount < 1;
      },
    },
  },
});
