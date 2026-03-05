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