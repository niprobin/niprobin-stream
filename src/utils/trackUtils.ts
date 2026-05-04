/**
 * Track ID source tracking for debugging and proper handling
 */
export const TrackIdSource = {
  Album: 'album',
  Search: 'search',
  Discovery: 'discovery'
} as const

export type TrackIdSource = typeof TrackIdSource[keyof typeof TrackIdSource]

/**
 * Normalize track IDs across all track sources for consistent webhook calls
 * @param trackId - Raw track ID from API response (string, number, null, or undefined)
 * @param trackName - Track name for logging/debugging
 * @param artistName - Artist name for logging/debugging
 * @param source - Source of the track for proper handling
 * @returns Normalized track ID (0 for discovery/invalid IDs, actual number for valid IDs)
 */
export function normalizeTrackId(
  trackId: string | number | null | undefined,
  trackName: string,
  artistName: string,
  source: TrackIdSource
): number {
  // For discovery tracks, ALWAYS use 0 (check source first!)
  if (source === TrackIdSource.Discovery) {
    return 0;
  }

  // For other sources, use valid track-id if available
  if (trackId !== null && trackId !== undefined && trackId !== '') {
    const numId = Number(trackId);
    if (!isNaN(numId) && numId > 0) {
      return numId;
    }
  }

  // For search/album tracks with invalid IDs, log warning and use fallback
  if (trackId !== null && trackId !== undefined && trackId !== '') {
    console.warn(`Invalid track-id "${trackId}" for ${trackName} by ${artistName} from ${source}, using fallback`);
  }

  return 0;
}

/**
 * Generate a stable track ID based on track content for persistent likes
 * This creates a deterministic hash from track + artist combination
 */
export function generateStableTrackId(track: string, artist: string): number {
  const str = `${track}-${artist}`
  return Math.abs(
    str.split('').reduce((hash, char) => {
      hash = ((hash << 5) - hash) + char.charCodeAt(0)
      return hash & hash
    }, 0)
  )
}

/**
 * Extract metadata from a track for use in external API calls
 * Returns available metadata including deezer_id, curator, etc.
 */
export function extractTrackMetadata(track: { deezer_id?: string; curator?: string; [key: string]: any }) {
  return {
    deezer_id: track.deezer_id,
    curator: track.curator,
    // Add other metadata fields here as needed
  }
}

/**
 * Format track data with metadata for API calls
 * Useful for sending complete track information to endpoints
 */
export function formatTrackForAPI(track: {
  track?: string;
  title?: string;
  artist: string;
  deezer_id?: string;
  curator?: string;
  date?: string;
}) {
  return {
    track: track.track || track.title,
    artist: track.artist,
    deezer_id: track.deezer_id,
    curator: track.curator,
    date: track.date,
  }
}