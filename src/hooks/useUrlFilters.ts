/**
 * URL Filters Hook
 * Manages bidirectional synchronization between URL parameters and component state
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { updateUrlFilters } from '@/utils/urlBuilder'
import type { FilterParams } from '@/utils/urlBuilder'
import { parseFiltersFromUrl } from '@/utils/urlParser'

export type PageType = 'digging' | 'library' | 'search'

interface UseUrlFiltersOptions {
  /** Whether to update URL immediately on filter changes (default: true) */
  updateUrl?: boolean
  /** Debounce delay for search input in milliseconds (default: 300) */
  searchDebounceMs?: number
}

/**
 * Hook for managing URL-based filter state
 * @param pageType - The current page type to determine URL structure
 * @param options - Configuration options
 * @returns Filter state and management functions
 */
export function useUrlFilters(
  pageType: PageType,
  options: UseUrlFiltersOptions = {}
) {
  const { updateUrl = true, searchDebounceMs = 300 } = options

  const [filters, setFilters] = useState<FilterParams>({})
  const searchTimeoutRef = useRef<number | undefined>(undefined)
  const initialLoadRef = useRef(false)

  // Initialize filters from URL on mount
  useEffect(() => {
    const currentFilters = parseFiltersFromUrl(window.location.search)
    setFilters(currentFilters)
    initialLoadRef.current = true
  }, [])

  // Listen for browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const currentFilters = parseFiltersFromUrl(window.location.search)
      setFilters(currentFilters)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Update a single filter parameter
  const updateFilter = useCallback(
    (key: keyof FilterParams, value: any) => {
      // Don't update during initial load
      if (!initialLoadRef.current) return

      const newFilters = { ...filters, [key]: value }

      // Reset page to 1 when non-page filters change
      if (key !== 'page') {
        newFilters.page = 1
      }

      setFilters(newFilters)

      if (updateUrl) {
        // Special handling for search input - debounce URL updates
        if (key === 'search') {
          if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current)
          }

          searchTimeoutRef.current = window.setTimeout(() => {
            updateUrlFilters({ [key]: value }, pageType, true)
          }, searchDebounceMs)
        } else {
          // Immediate URL update for other filters
          updateUrlFilters({ [key]: value }, pageType, true)
        }
      }
    },
    [filters, pageType, updateUrl, searchDebounceMs]
  )

  // Update multiple filter parameters at once
  const updateFilters = useCallback(
    (newParams: Partial<FilterParams>) => {
      if (!initialLoadRef.current) return

      const updatedFilters = { ...filters, ...newParams }

      // Reset page to 1 when non-page filters change
      if (Object.keys(newParams).some(key => key !== 'page')) {
        updatedFilters.page = 1
      }

      setFilters(updatedFilters)

      if (updateUrl) {
        updateUrlFilters(newParams, pageType, true)
      }
    },
    [filters, pageType, updateUrl]
  )

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    if (!initialLoadRef.current) return

    const defaultFilters: FilterParams = {
      page: 1,
      curator: 'all',
      search: '',
      folder: 'all',
      type: 'tracks'
    }

    setFilters(defaultFilters)

    if (updateUrl) {
      updateUrlFilters(defaultFilters, pageType, true)
    }
  }, [pageType, updateUrl])

  // Check if a filter is actively applied (not default value)
  const isFilterActive = useCallback(
    (key: keyof FilterParams): boolean => {
      switch (key) {
        case 'curator':
          return filters.curator !== 'all'
        case 'folder':
          return filters.folder !== 'all'
        case 'search':
          return Boolean(filters.search?.trim())
        case 'type':
          return filters.type !== 'tracks'
        case 'page':
          return (filters.page || 1) > 1
        default:
          return false
      }
    },
    [filters]
  )

  // Check if any filters are active
  const hasActiveFilters = useCallback((): boolean => {
    return ['curator', 'folder', 'search', 'type'].some(key =>
      isFilterActive(key as keyof FilterParams)
    )
  }, [isFilterActive])

  // Get clean filter values (removing defaults for API calls)
  const getActiveFilters = useCallback((): Partial<FilterParams> => {
    const activeFilters: Partial<FilterParams> = {}

    if (filters.page && filters.page > 1) {
      activeFilters.page = filters.page
    }
    if (filters.curator && filters.curator !== 'all') {
      activeFilters.curator = filters.curator
    }
    if (filters.search?.trim()) {
      activeFilters.search = filters.search.trim()
    }
    if (filters.folder && filters.folder !== 'all') {
      activeFilters.folder = filters.folder
    }
    if (filters.type && filters.type !== 'tracks') {
      activeFilters.type = filters.type
    }

    return activeFilters
  }, [filters])

  // Cleanup search debounce on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    isFilterActive,
    hasActiveFilters,
    getActiveFilters,
    // Expose individual filter values for convenience
    page: filters.page || 1,
    curator: filters.curator || 'all',
    search: filters.search || '',
    folder: filters.folder || 'all',
    type: filters.type || 'tracks'
  }
}