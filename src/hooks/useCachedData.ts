import { useEffect, useState } from 'react'
import { useLoading } from '@/contexts/LoadingContext'
import { useNotification } from '@/contexts/NotificationContext'

export type UseCachedDataOptions = {
  cacheDuration?: number
  refreshTrigger?: number
  enabled?: boolean
  errorMessage?: string
}

const DEFAULT_CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Generic hook for loading and caching data with localStorage
 * Handles loading states, error notifications, and cache invalidation
 */
export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: UseCachedDataOptions = {}
) {
  const {
    cacheDuration = DEFAULT_CACHE_DURATION_MS,
    refreshTrigger,
    enabled = true,
    errorMessage = 'Failed to load data',
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { increment, decrement } = useLoading()
  const { showNotification } = useNotification()

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isCancelled = false

    const loadData = async () => {
      increment()
      setIsLoading(true)

      try {
        // Check cache first
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          try {
            const { data: cachedData, timestamp } = JSON.parse(cached)
            const age = Date.now() - timestamp

            // Use cache if it's still fresh
            if (age < cacheDuration) {
              if (!isCancelled) {
                setData(cachedData)
              }
              decrement()
              setIsLoading(false)
              return
            }
          } catch {
            // Invalid cache, continue to fetch
          }
        }

        // Fetch fresh data
        const freshData = await fetchFn()

        // Save to cache
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ data: freshData, timestamp: Date.now() })
          )
        } catch {
          // Cache save failed (quota exceeded?), continue anyway
        }

        if (!isCancelled) {
          setData(freshData)
        }
      } catch (err) {
        console.error(errorMessage, err)
        if (!isCancelled) {
          showNotification(errorMessage, 'error')
          setData(null)
        }
      } finally {
        decrement()
        setIsLoading(false)
      }
    }

    loadData()

    return () => {
      isCancelled = true
    }
  }, [enabled, refreshTrigger, cacheKey, cacheDuration, errorMessage])

  const refresh = () => {
    // Clear cache and force refresh by removing cached item
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      // Ignore errors
    }
  }

  return { data, isLoading, refresh }
}
