import { useState, useMemo, useCallback } from 'react'

// Simple debounce function
function debounce<T extends (...args: any[]) => void>(func: T, delay: number): T {
  let timeoutId: number
  return ((...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => func(...args), delay)
  }) as T
}

interface UseDiscoverySearchProps<T> {
  data: T[]
  filterFunction: (items: T[], query: string) => T[]
  setCurrentPage: (page: number) => void
}

interface UseDiscoverySearchReturn<T> {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredData: T[]
  isSearchActive: boolean
  resultsCount: number
  clearSearch: () => void
}

export function useDiscoverySearch<T>({
  data,
  filterFunction,
  setCurrentPage,
}: UseDiscoverySearchProps<T>): UseDiscoverySearchReturn<T> {
  const [searchQuery, setSearchQueryInternal] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounced search query update (300ms delay)
  const debouncedSetQuery = useMemo(
    () =>
      debounce((query: string) => {
        setDebouncedQuery(query)
        // Reset to page 1 when search query changes
        setCurrentPage(1)
      }, 300),
    [setCurrentPage]
  )

  // Update search query with debouncing
  const setSearchQuery = useCallback(
    (query: string) => {
      setSearchQueryInternal(query)
      debouncedSetQuery(query)
    },
    [debouncedSetQuery]
  )

  // Clear search and reset pagination
  const clearSearch = useCallback(() => {
    setSearchQueryInternal('')
    setDebouncedQuery('')
    setCurrentPage(1)
  }, [setCurrentPage])

  // Apply search filtering to data
  const filteredData = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return data
    }
    return filterFunction(data, debouncedQuery)
  }, [data, debouncedQuery, filterFunction])

  // Determine if search is active
  const isSearchActive = debouncedQuery.trim().length > 0

  // Get results count
  const resultsCount = filteredData.length

  return {
    searchQuery,
    setSearchQuery,
    filteredData,
    isSearchActive,
    resultsCount,
    clearSearch,
  }
}

// Predefined filter function for albums
export const albumFilterFunction = (albums: any[], query: string) => {
  const searchTerm = query.toLowerCase().trim()
  if (!searchTerm) return albums

  return albums.filter(
    (album) =>
      album.album.toLowerCase().includes(searchTerm) ||
      album.artist.toLowerCase().includes(searchTerm)
  )
}