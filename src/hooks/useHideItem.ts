import { useState, useCallback, useEffect } from 'react'
import { addHiddenItem, getHiddenItems } from '../utils/hiddenItemsStorage'

interface UseHideItemOptions {
  persistentCacheKey?: string
  persistentCacheDuration?: number
}

/**
 * Generic hook for hiding items with optimistic UI updates
 * @param apiFn - The API function to call for persisting the hide action
 * @param keyExtractor - Function to extract a unique key from the item
 * @param options - Optional configuration for persistent storage
 */
export function useHideItem<T>(
  apiFn: (item: T) => Promise<void>,
  keyExtractor: (item: T) => string,
  options?: UseHideItemOptions
) {
  const [sessionHiddenItems, setSessionHiddenItems] = useState<Set<string>>(new Set())
  const [persistentHiddenItems, setPersistentHiddenItems] = useState<Set<string>>(new Set())

  // Load persistent hidden items on mount
  useEffect(() => {
    if (options?.persistentCacheKey) {
      const persistentItems = getHiddenItems(options.persistentCacheKey)
      setPersistentHiddenItems(persistentItems)
    }
  }, [options?.persistentCacheKey])

  // Combine session and persistent hidden items
  const hiddenItems = new Set([...sessionHiddenItems, ...persistentHiddenItems])

  const hideItem = useCallback(
    async (item: T, event?: React.MouseEvent) => {
      event?.stopPropagation()
      const key = keyExtractor(item)

      // Optimistically update session UI
      setSessionHiddenItems((prev) => new Set(prev).add(key))

      // Add to persistent storage if configured
      if (options?.persistentCacheKey) {
        addHiddenItem(options.persistentCacheKey, key)
        setPersistentHiddenItems((prev) => new Set(prev).add(key))
      }

      try {
        await apiFn(item)
      } catch (err) {
        console.error('Failed to hide item', err)
        // Revert session state on error
        setSessionHiddenItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(key)
          return newSet
        })

        // Note: We keep the persistent storage entry even on API failure
        // to maintain user's intent and avoid confusing UI behavior
      }
    },
    [apiFn, keyExtractor, options?.persistentCacheKey]
  )

  const isHidden = useCallback(
    (item: T) => hiddenItems.has(keyExtractor(item)),
    [hiddenItems, keyExtractor]
  )

  return { hiddenItems, hideItem, isHidden }
}
