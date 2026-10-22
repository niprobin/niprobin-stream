import type { AlbumsView } from '@/utils/albumUtils'

export const ROUTES = {
  album: (id: number | string) => `/album/${id}`,
  artist: (id: string | number) => `/artist/${encodeURIComponent(id)}`,
  digging: '/digging',
  diggingTracks: '/digging/tracks',
  diggingAlbums: '/digging/albums',
  diggingAlbumsView: (view: AlbumsView) => `/digging/albums/${view === 'backlog' ? 'backlog' : 'listen-to'}`,
} as const

export function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
