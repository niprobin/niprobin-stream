interface HiddenItemEntry {
  key: string
  hiddenAt: number
  expiresAt: number
}

interface HiddenItemsStorage {
  items: HiddenItemEntry[]
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000 // 43,200,000ms

/**
 * Add an item to localStorage with 12-hour expiration
 */
export function addHiddenItem(cacheKey: string, itemKey: string): void {
  try {
    const now = Date.now()
    const expiresAt = now + TWELVE_HOURS_MS

    const existingData = getStorageData(cacheKey)

    // Remove existing entry if it exists
    const filteredItems = existingData.items.filter(item => item.key !== itemKey)

    // Add new entry
    const newEntry: HiddenItemEntry = {
      key: itemKey,
      hiddenAt: now,
      expiresAt
    }

    const updatedData: HiddenItemsStorage = {
      items: [...filteredItems, newEntry]
    }

    localStorage.setItem(cacheKey, JSON.stringify(updatedData))
  } catch (error) {
    console.warn(`Failed to save hidden item to localStorage:`, error)
    // Graceful fallback - operation continues without localStorage
  }
}

/**
 * Get all valid (non-expired) hidden items for a cache key
 * Automatically cleans up expired items
 */
export function getHiddenItems(cacheKey: string): Set<string> {
  try {
    const data = getStorageData(cacheKey)
    const now = Date.now()

    // Filter out expired items
    const validItems = data.items.filter(item => item.expiresAt > now)

    // Update storage if we removed any expired items
    if (validItems.length !== data.items.length) {
      const updatedData: HiddenItemsStorage = { items: validItems }
      localStorage.setItem(cacheKey, JSON.stringify(updatedData))
    }

    return new Set(validItems.map(item => item.key))
  } catch (error) {
    console.warn(`Failed to read hidden items from localStorage:`, error)
    return new Set() // Graceful fallback - return empty set
  }
}

/**
 * Manually clean up expired items for a cache key
 */
export function cleanupExpiredItems(cacheKey: string): void {
  try {
    const data = getStorageData(cacheKey)
    const now = Date.now()

    const validItems = data.items.filter(item => item.expiresAt > now)

    if (validItems.length !== data.items.length) {
      const updatedData: HiddenItemsStorage = { items: validItems }
      localStorage.setItem(cacheKey, JSON.stringify(updatedData))
    }
  } catch (error) {
    console.warn(`Failed to cleanup expired items:`, error)
    // Graceful fallback - operation continues without localStorage
  }
}

/**
 * Clear all hidden items for a cache key
 */
export function clearAllHiddenItems(cacheKey: string): void {
  try {
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.warn(`Failed to clear hidden items:`, error)
    // Graceful fallback - operation continues without localStorage
  }
}

/**
 * Get storage data with fallback for missing/invalid data
 */
function getStorageData(cacheKey: string): HiddenItemsStorage {
  try {
    const stored = localStorage.getItem(cacheKey)
    if (!stored) {
      return { items: [] }
    }

    const parsed = JSON.parse(stored)

    // Validate structure
    if (typeof parsed === 'object' && Array.isArray(parsed.items)) {
      return parsed
    }

    // Invalid structure, return empty
    return { items: [] }
  } catch (error) {
    console.warn(`Failed to parse localStorage data for ${cacheKey}:`, error)
    return { items: [] }
  }
}