/**
 * URL Builder Utilities
 * Functions for building shareable track URLs
 */

/**
 * Build a track URL that can be shared
 * @param trackId - The numeric track ID
 * @returns The path to the track (e.g., "/play/12345")
 */
export function buildTrackUrl(trackId: string | number): string {
  return `/play/${trackId}`
}

/**
 * Extract track ID from a path
 * @param path - The URL path (e.g., "/play/12345")
 * @returns The track ID or null if not a valid track URL
 */
export function extractTrackIdFromPath(path: string): string | null {
  const match = path.match(/^\/play\/(\d+)$/)
  return match ? match[1] : null
}
