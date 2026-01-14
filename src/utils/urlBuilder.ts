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
  const match = path.match(/^\/play\/([a-f0-9]+)$/i)
  return match ? match[1] : null
}
