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
