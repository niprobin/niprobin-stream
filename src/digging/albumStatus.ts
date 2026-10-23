import type { BacklogAlbum } from '@/types/api'
import type { RatedAlbum } from '@/services/api'
import { isShortlisted } from '@/utils/albumUtils'

// What the DB already knows about an album
export type AlbumStatus = {
  // 1–5, or null when it isn't Rated
  rating: number | null
  // Listed by albums-to-discover: in the DB, not checked nor rated
  inBacklog: boolean
  shortlisted: boolean
}

// The Rated albums by deezer_id, without rows that aren't a 1–5 rating
export function ratingsByDeezerId(rows: RatedAlbum[]): Map<string, number> {
  return new Map(
    rows
      .map(row => [String(row.deezer_id), Number(row.rating)] as const)
      .filter(([deezerId, rating]) => deezerId && Number.isInteger(rating) && rating >= 1 && rating <= 5)
  )
}

export function albumStatus(
  deezerId: string,
  backlog: BacklogAlbum[],
  ratings: ReadonlyMap<string, number>,
): AlbumStatus {
  const listed = backlog.find(a => String(a.deezer_id) === deezerId)
  return {
    rating: ratings.get(deezerId) ?? null,
    inBacklog: Boolean(listed),
    shortlisted: listed ? isShortlisted(listed) : false,
  }
}

// Why Add is greyed, or null when it can be used. A Rated album is done with,
// so it can't go back to the backlog.
export function addBlocker(status: AlbumStatus): 'Rated' | 'In backlog' | null {
  if (status.rating !== null) return 'Rated'
  if (status.inBacklog) return 'In backlog'
  return null
}

// Why Shortlist is greyed, or null when it can be used
export function shortlistBlocker(status: AlbumStatus): 'Rated' | 'Shortlisted' | null {
  if (status.rating !== null) return 'Rated'
  if (status.shortlisted) return 'Shortlisted'
  return null
}

export const ratingBadge = (rating: number) => `★ ${rating}`
