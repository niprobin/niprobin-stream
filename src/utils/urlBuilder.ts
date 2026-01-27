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
