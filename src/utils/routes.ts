export const ROUTES = {
  album: (id: number | string) => `/album/${id}`,
  digging: '/digging',
  diggingTracks: '/digging/tracks',
  diggingAlbums: '/digging/albums',
} as const
