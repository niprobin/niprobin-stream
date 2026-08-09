import { STORAGE_KEYS } from './storageKeys'

export interface SearchHistoryEntry {
  query: string
  searchedAt: number
}

interface SearchHistoryStorage {
  items: SearchHistoryEntry[]
}

const MAX_HISTORY_ITEMS = 5

export function getSearchHistory(): SearchHistoryEntry[] {
  return getStorageData().items
}

export function addSearchQuery(query: string): SearchHistoryEntry[] {
  const trimmed = query.trim()
  if (!trimmed) return getSearchHistory()

  try {
    const existingItems = getStorageData().items
    const filteredItems = existingItems.filter(
      item => item.query.toLowerCase() !== trimmed.toLowerCase()
    )

    const newEntry: SearchHistoryEntry = { query: trimmed, searchedAt: Date.now() }
    const updatedItems = [newEntry, ...filteredItems].slice(0, MAX_HISTORY_ITEMS)

    setStorageData({ items: updatedItems })
    return updatedItems
  } catch (error) {
    console.warn('Failed to save search query to localStorage:', error)
    return getSearchHistory()
  }
}

export function removeSearchQuery(query: string): SearchHistoryEntry[] {
  try {
    const existingItems = getStorageData().items
    const updatedItems = existingItems.filter(item => item.query !== query)
    setStorageData({ items: updatedItems })
    return updatedItems
  } catch (error) {
    console.warn('Failed to remove search query from localStorage:', error)
    return getSearchHistory()
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY)
  } catch (error) {
    console.warn('Failed to clear search history:', error)
  }
}

function getStorageData(): SearchHistoryStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY)
    if (!stored) return { items: [] }

    const parsed = JSON.parse(stored)
    if (typeof parsed === 'object' && Array.isArray(parsed.items)) {
      return parsed
    }
    return { items: [] }
  } catch (error) {
    console.warn('Failed to parse search history from localStorage:', error)
    return { items: [] }
  }
}

function setStorageData(data: SearchHistoryStorage): void {
  localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(data))
}
