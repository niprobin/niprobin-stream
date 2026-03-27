/**
 * URL Builder Utilities
 * Functions for building shareable track URLs
 */

/**
 * Build a track URL that can be shared
 * @param hash - The track hash from the backend
 * @returns The path to the track (e.g., "/play/abc123def456")
 */
export function buildTrackUrl(hash: string): string {
  return `/play/${hash}`
}

/**
 * Extract track hash from a path
 * @param path - The URL path (e.g., "/play/abc123def456")
 * @returns The track hash or null if not a valid track URL
 */
export function extractTrackHashFromPath(path: string): string | null {
  const match = path.match(/^\/play\/([A-Za-z0-9+/=_-]+)$/)
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
 * @param hash - The track hash from the backend
 * @param showNotification - Function to show notification messages
 */
export function shareTrack(hash: string, showNotification: (message: string, type: 'success' | 'error') => void): void {
  if (!hash) {
    showNotification('Cannot share this track', 'error')
    return
  }

  const trackUrl = `${window.location.origin}/play/${hash}`

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
 * @param hash - The track hash from the backend
 * @returns Full canonical URL (e.g., "https://stream.niprobin.com/play/abc123")
 */
export function buildCanonicalTrackUrl(hash: string): string {
  return `${window.location.origin}/play/${hash}`
}

/**
 * Build a canonical album URL with full domain for meta tags
 * @param albumId - The album ID from the backend
 * @returns Full canonical URL (e.g., "https://stream.niprobin.com/album/123")
 */
export function buildCanonicalAlbumUrl(albumId: number): string {
  return `${window.location.origin}/album/${albumId}`
}
