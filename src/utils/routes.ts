export const ROUTES = {
  album: (id: number | string) => `/album/${id}`,
  artist: (id: string | number) => `/artist/${encodeURIComponent(id)}`,
  digging: '/digging',
  diggingTracks: '/digging/tracks',
  diggingAlbums: '/digging/albums',
} as const
