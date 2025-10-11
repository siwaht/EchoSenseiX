import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

interface OptimizedQueryOptions<T> extends Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  retry?: boolean | number;
  retryDelay?: number;
  backgroundRefetch?: boolean;
  prefetchThreshold?: number; // Prefetch when data is this close to stale
}

/**
 * Enhanced useQuery hook with optimized caching strategies
 */
export function useOptimizedQuery<T>({
  queryKey,
  queryFn,
  staleTime = 5 * 60 * 1000, // 5 minutes default
  gcTime = 10 * 60 * 1000, // 10 minutes default
  retry = 3,
  retryDelay = 1000,
  backgroundRefetch = true,
  prefetchThreshold = 30 * 1000, // 30 seconds before stale
  ...options
}: OptimizedQueryOptions<T>) {
  const queryClient = useQueryClient();

  // Memoize query key to prevent unnecessary re-renders
  const memoizedQueryKey = useMemo(() => queryKey, [JSON.stringify(queryKey)]);

  // Enhanced retry logic
  const retryFn = useCallback((failureCount: number, error: any) => {
    if (typeof retry === 'boolean') {
      return retry;
    }
    
    // Custom retry logic based on error type
    if (error?.status === 404) {
      return false; // Don't retry on 404
    }
    
    if (error?.status >= 500) {
      return failureCount < retry; // Retry server errors
    }
    
    if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
      return failureCount < retry; // Retry network errors
    }
    
    return false;
  }, [retry]);

  // Background refetch logic
  const refetchInterval = useCallback((query?: any) => {
    if (!backgroundRefetch) return false;
    
    // Check if query object exists and has the expected structure
    if (!query || !query.state) return false;
    
    // Don't refetch if data is fresh
    if (query.state.dataUpdatedAt && Date.now() - query.state.dataUpdatedAt < staleTime) {
      return false;
    }
    
    // Refetch every 2 minutes for critical data
    return 2 * 60 * 1000;
  }, [backgroundRefetch, staleTime]);

  // Prefetch logic
  const prefetchData = useCallback(async () => {
    const query = queryClient.getQueryState(memoizedQueryKey);
    
    if (!query?.data) return;
    
    const timeSinceUpdate = Date.now() - (query.dataUpdatedAt || 0);
    const timeUntilStale = staleTime - timeSinceUpdate;
    
    if (timeUntilStale <= prefetchThreshold) {
      // Prefetch in background
      queryClient.prefetchQuery({
        queryKey: memoizedQueryKey,
        queryFn,
        staleTime,
        gcTime
      });
    }
  }, [queryClient, memoizedQueryKey, queryFn, staleTime, gcTime, prefetchThreshold]);

  // Main query
  const query = useQuery({
    queryKey: memoizedQueryKey,
    queryFn,
    staleTime,
    gcTime,
    retry: retryFn,
    retryDelay,
    refetchInterval,
    refetchOnWindowFocus: false, // Prevent excessive refetches
    refetchOnMount: 'always', // Always refetch on mount for fresh data
    refetchOnReconnect: true, // Refetch when network reconnects
    ...options
  });

  // Optimized refetch function
  const optimizedRefetch = useCallback(async () => {
    // Cancel any ongoing requests for this query
    await queryClient.cancelQueries({ queryKey: memoizedQueryKey });
    
    // Invalidate and refetch
    return queryClient.invalidateQueries({ 
      queryKey: memoizedQueryKey,
      refetchType: 'active' // Only refetch active queries
    });
  }, [queryClient, memoizedQueryKey]);

  // Batch invalidation helper
  const batchInvalidate = useCallback((patterns: string[][]) => {
    patterns.forEach(pattern => {
      queryClient.invalidateQueries({ queryKey: pattern });
    });
  }, [queryClient]);

  return {
    ...query,
    optimizedRefetch,
    prefetchData,
    batchInvalidate,
    isStale: query.dataUpdatedAt ? Date.now() - query.dataUpdatedAt > staleTime : false,
    timeUntilStale: query.dataUpdatedAt ? Math.max(0, staleTime - (Date.now() - query.dataUpdatedAt)) : 0
  };
}

/**
 * Hook for managing cache warming strategies
 */
export function useCacheWarming() {
  const queryClient = useQueryClient();

  const warmCache = useCallback(async (queries: Array<{ queryKey: string[]; queryFn: () => Promise<any> }>) => {
    const promises = queries.map(({ queryKey, queryFn }) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000
      })
    );

    await Promise.allSettled(promises);
  }, [queryClient]);

  const clearExpiredCache = useCallback(() => {
    // Clear queries that haven't been used recently
    const now = Date.now();
    const cutoff = 30 * 60 * 1000; // 30 minutes

    queryClient.getQueryCache().getAll().forEach(query => {
      const lastAccessed = query.state.dataUpdatedAt || 0;
      if (now - lastAccessed > cutoff && !query.getObserversCount()) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });
  }, [queryClient]);

  const getCacheStats = useCallback(() => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => {
        const timeSinceUpdate = Date.now() - (q.state.dataUpdatedAt || 0);
        return timeSinceUpdate > (q.options.staleTime as number || 0);
      }).length,
      cacheSize: queries.reduce((size, q) => {
        try {
          return size + JSON.stringify(q.state.data).length;
        } catch {
          return size;
        }
      }, 0)
    };
  }, [queryClient]);

  return {
    warmCache,
    clearExpiredCache,
    getCacheStats
  };
}

/**
 * Hook for optimistic updates with rollback
 */
export function useOptimisticUpdate<T>(
  queryKey: string[],
  updateFn: (oldData: T, newData: Partial<T>) => T,
  rollbackFn: (oldData: T) => T
) {
  const queryClient = useQueryClient();

  const optimisticUpdate = useCallback(async (
    newData: Partial<T>,
    mutationFn: () => Promise<T>
  ) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey });

    // Snapshot previous value
    const previousData = queryClient.getQueryData<T>(queryKey);

    // Optimistically update
    if (previousData) {
      queryClient.setQueryData<T>(queryKey, updateFn(previousData, newData));
    }

    try {
      // Perform mutation
      const result = await mutationFn();
      
      // Update with server response
      queryClient.setQueryData<T>(queryKey, result);
      
      return result;
    } catch (error) {
      // Rollback on error
      if (previousData) {
        queryClient.setQueryData<T>(queryKey, rollbackFn(previousData));
      }
      throw error;
    }
  }, [queryClient, queryKey, updateFn, rollbackFn]);

  return { optimisticUpdate };
}
