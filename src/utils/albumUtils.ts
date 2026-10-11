import type { DiscoverAlbum } from '@/types/api'

export type AlbumsView = 'backlog' | 'listen'

// An album is in "Listen to" once it has been shortlisted (saved = true)
export function isAlbumSaved(album: DiscoverAlbum): boolean {
  return String(album.saved).toLowerCase() === 'true'
}
