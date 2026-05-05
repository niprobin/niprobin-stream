/**
 * URL Builder Utilities
 * Functions for building shareable track URLs and managing URL-based state
 */

/**
 * Filter parameters interface for URL state management
 */
export interface FilterParams {
  page?: number
  curator?: string
  search?: string
  folder?: string
  type?: 'tracks' | 'albums'
}

/**
 * Build a track URL that can be shared
 * @param deezer_id - The Deezer track ID
 * @returns The path to the track (e.g., "/track/123456789")
 */
export function buildTrackUrl(deezer_id: string): string {
  return `/track/${deezer_id}`
}

/**
 * Extract deezer_id from a track path
 * @param path - The URL path (e.g., "/track/123456789")
 * @returns The deezer_id or null if not a valid track URL
 */
export function extractDeezerIdFromPath(path: string): string | null {
  const match = path.match(/^\/track\/(\d+)$/)
  return match ? match[1] : null
}

/**
 * Build an album URL from album ID
 * @param albumId - The album ID from the backend
 * @returns The path to the album (e.g., "/album/12345")
 */
export function buildAlbumUrl(albumId: number): string {
  return `/album/${albumId}`
}

/**
 * Extract album ID from a path
 * @param path - The URL path (e.g., "/album/12345")
 * @returns The album ID or null if not a valid album URL
 */
export function extractAlbumIdFromPath(path: string): number | null {
  const match = path.match(/^\/album\/(\d+)$/)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Build a digging URL with optional page parameter
 * @param tab - The digging tab ('tracks' or 'albums')
 * @param page - Optional page number (defaults to 1, omitted from URL if 1)
 * @returns The path to the digging page (e.g., "/digging/albums" or "/digging/albums?page=3")
 */
export function buildDiggingUrl(tab: 'tracks' | 'albums', page?: number): string {
  const basePath = `/digging/${tab}`
  if (!page || page <= 1) {
    return basePath
  }
  return `${basePath}?page=${page}`
}

/**
 * Build a library URL with optional page parameter
 * @param page - Optional page number (defaults to 1, omitted from URL if 1)
 * @returns The path to the library page (e.g., "/library" or "/library?page=3")
 */
export function buildLibraryUrl(page?: number): string {
  const basePath = '/library'
  if (!page || page <= 1) {
    return basePath
  }
  return `${basePath}?page=${page}`
}

/**
 * Parse page number from URL query parameters
 * @param url - The full URL or search params string (e.g., "?page=3" or "https://example.com/path?page=3")
 * @returns The page number or 1 if not found or invalid
 */
export function parsePageFromUrl(url?: string): number {
  if (!url) return 1

  try {
    // Handle both full URLs and search param strings
    const searchParams = url.includes('?')
      ? new URLSearchParams(url.split('?')[1])
      : new URLSearchParams(url)

    const pageParam = searchParams.get('page')
    if (!pageParam) return 1

    const pageNumber = parseInt(pageParam, 10)
    return isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber
  } catch {
    return 1
  }
}

/**
 * Get the current page context for stream endpoint calls
 * @returns The context string based on current URL path
 */
export function getStreamContext(): string {
  if (typeof window === 'undefined') return 'search'

  const path = window.location.pathname

  if (path === '/library') return 'library'
  if (path === '/digging' || path.startsWith('/digging/')) return 'digging'
  if (path.startsWith('/album/')) return 'album'

  return 'search'
}

/**
 * Share a track by copying its URL to clipboard
 * @param deezer_id - The Deezer track ID
 * @param showNotification - Function to show notification messages
 */
export function shareTrack(deezer_id: string, showNotification: (message: string, type: 'success' | 'error') => void): void {
  if (!deezer_id || deezer_id === '0') {
    showNotification('Cannot share this track - Deezer ID not available', 'error')
    return
  }

  const trackUrl = `${window.location.origin}/track/${deezer_id}`

  try {
    navigator.clipboard.writeText(trackUrl)
    showNotification('Track link copied to clipboard', 'success')
  } catch (err) {
    console.error('Failed to copy track URL to clipboard:', err)
    showNotification('Failed to copy link', 'error')
  }
}

/**
 * Build a canonical track URL with full domain for meta tags
 * @param deezer_id - The Deezer track ID
 * @returns Full canonical URL (e.g., "https://stream.niprobin.com/track/123456789")
 */
export function buildCanonicalTrackUrl(deezer_id: string): string {
  return `${window.location.origin}/track/${deezer_id}`
}

/**
 * Build a canonical album URL with full domain for meta tags
 * @param albumId - The album ID from the backend
 * @returns Full canonical URL (e.g., "https://stream.niprobin.com/album/123")
 */
export function buildCanonicalAlbumUrl(albumId: number): string {
  return `${window.location.origin}/album/${albumId}`
}

/**
 * Encode filter parameters as URL query string
 * @param params - Filter parameters to encode
 * @returns URL search string (e.g., "?curator=deadmau5&page=2")
 */
function encodeFilterParams(params: FilterParams): string {
  const urlParams = new URLSearchParams()

  // Only include non-default values to keep URLs clean
  if (params.page && params.page > 1) {
    urlParams.set('page', params.page.toString())
  }
  if (params.curator && params.curator !== 'all') {
    urlParams.set('curator', params.curator)
  }
  if (params.search && params.search.trim()) {
    urlParams.set('search', params.search.trim())
  }
  if (params.folder && params.folder !== 'all') {
    urlParams.set('folder', params.folder)
  }
  if (params.type && params.type !== 'tracks') {
    urlParams.set('type', params.type)
  }

  const searchString = urlParams.toString()
  return searchString ? `?${searchString}` : ''
}

/**
 * Parse filter parameters from URL search string
 * @param search - URL search string (e.g., "?curator=deadmau5&page=2")
 * @returns Parsed filter parameters with defaults
 */
export function parseFiltersFromUrl(search: string): FilterParams {
  const params = new URLSearchParams(search)

  return {
    page: Math.max(1, parseInt(params.get('page') || '1', 10) || 1),
    curator: params.get('curator') || 'all',
    search: params.get('search') || '',
    folder: params.get('folder') || 'all',
    type: (params.get('type') as 'tracks' | 'albums') || 'tracks'
  }
}

/**
 * Build a digging URL with filter parameters
 * @param tab - The digging tab ('tracks' or 'albums')
 * @param params - Filter parameters to include
 * @returns The path to the digging page with filters
 */
export function buildDiggingUrlWithFilters(
  tab: 'tracks' | 'albums',
  params: FilterParams = {}
): string {
  const basePath = `/digging/${tab}`
  const searchString = encodeFilterParams(params)
  return basePath + searchString
}

/**
 * Build a library URL with filter parameters
 * @param params - Filter parameters to include
 * @returns The path to the library page with filters
 */
export function buildLibraryUrlWithFilters(params: FilterParams = {}): string {
  const basePath = '/library'
  const searchString = encodeFilterParams(params)
  return basePath + searchString
}

/**
 * Build a search URL with filter parameters
 * @param params - Filter parameters to include
 * @returns The path to the search page with filters
 */
export function buildSearchUrlWithFilters(params: FilterParams = {}): string {
  const basePath = '/'
  const searchString = encodeFilterParams(params)
  return basePath + searchString
}

/**
 * Update the current URL with new filter parameters
 * @param newParams - Partial filter parameters to update
 * @param pageType - The current page type to determine URL structure
 * @param replaceHistory - Whether to replace current history entry (default true)
 */
export function updateUrlFilters(
  newParams: Partial<FilterParams>,
  pageType: 'digging' | 'library' | 'search',
  replaceHistory: boolean = true
): void {
  // Get current filters from URL
  const currentFilters = parseFiltersFromUrl(window.location.search)

  // Merge with new parameters
  const updatedFilters = { ...currentFilters, ...newParams }

  // Reset page to 1 when non-page filters change
  if (Object.keys(newParams).some(key => key !== 'page')) {
    updatedFilters.page = 1
  }

  // Build new URL based on page type
  let newUrl: string
  if (pageType === 'library') {
    newUrl = buildLibraryUrlWithFilters(updatedFilters)
  } else if (pageType === 'search') {
    newUrl = buildSearchUrlWithFilters(updatedFilters)
  } else {
    // For digging page, determine tab from current URL
    const currentTab = window.location.pathname.includes('/albums') ? 'albums' : 'tracks'
    newUrl = buildDiggingUrlWithFilters(currentTab, updatedFilters)
  }

  // Update browser history
  if (replaceHistory) {
    window.history.replaceState({}, '', newUrl)
  } else {
    window.history.pushState({}, '', newUrl)
  }
}
