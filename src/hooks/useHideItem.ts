import { useState, useCallback } from 'react'

/**
 * Generic hook for hiding items with optimistic UI updates
 * @param apiFn - The API function to call for persisting the hide action
 * @param keyExtractor - Function to extract a unique key from the item
 */
export function useHideItem<T>(
  apiFn: (item: T) => Promise<void>,
  keyExtractor: (item: T) => string
) {
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  const hideItem = useCallback(
    async (item: T, event?: React.MouseEvent) => {
      event?.stopPropagation()
      const key = keyExtractor(item)

      // Optimistically update UI
      setHiddenItems((prev) => new Set(prev).add(key))

      try {
        await apiFn(item)
      } catch (err) {
        console.error('Failed to hide item', err)
        // Revert on error
        setHiddenItems((prev) => {
          const newSet = new Set(prev)
          newSet.delete(key)
          return newSet
        })
      }
    },
    [apiFn, keyExtractor]
  )

  const isHidden = useCallback(
    (item: T) => hiddenItems.has(keyExtractor(item)),
    [hiddenItems, keyExtractor]
  )

  return { hiddenItems, hideItem, isHidden }
}
