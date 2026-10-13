import type { BacklogAlbum } from '@/types/api'

export type AlbumsView = 'backlog' | 'listen'

// An album is in "Listen to" once it has been shortlisted (n8n sends saved = true)
export function isShortlisted(album: BacklogAlbum): boolean {
  return String(album.saved).toLowerCase() === 'true'
}
