// Raw API response shapes from n8n webhooks.
// Fields use the exact casing the API returns (kebab-case, snake_case).
// Internal app types should use camelCase — convert at the service boundary.

export type SearchResult = {
  track: string
  artist: string
  album: string
  'track-id': string
  cover: string
  deezer_id: string
}

export type AlbumResult = {
  album: string
  artist: string
  'album-id'?: number
  cover: string
  deezer_id: string
}

export type AlbumTrack = {
  track: string
  deezer_id: string
  artist: string
  'track-number': number
  'album-id'?: number
  album?: string
  cover?: string
}

export type AlbumResponse = {
  tracks: AlbumTrack[]
  albumId: number
  album: string
  artist: string
  cover: string
  id?: string
  streamingLink?: string
}

// Partially normalised: stream_url/track_id/hash_url are mapped to camelCase at
// the boundary, but 'album-id' is kept raw because the field name varies by endpoint.
export type StreamResponse = {
  streamUrl: string
  trackId: string
  hashUrl: string
  track: string
  artist: string
  album?: string
  'album-id'?: number
  cover?: string
}

export type LikeTrackResponse = {
  status: 'success' | 'error'
  message: string
}

export type LibraryAlbum = {
  album: string
  artist: string
  'album-id': number
  cover: string
}

export type DiscoverAlbum = {
  id: string
  album: string
  artist: string
  cover_url: string
  deezer_id: string
}

export type DiscoverTrack = {
  track: string
  artist: string
  curator: string
  date: string
  deezer_id: string
  cover_url?: string
  // TODO: Remove once confirmed the database field is fully gone
  'spotify-id'?: string
}

export type LibraryTrack = {
  track: string
  artist: string
  folder: string
  uploaded_at: string
  stream_url: string
}

// Payload types — shapes sent TO n8n webhooks
export type LikeTrackPayload = {
  track: string
  artist: string
  playlist: string
  'spotify-id'?: string
  deezer_id?: string
}

export type RateAlbumPayload = {
  album: string
  artist: string
  rating: number
  deezer_id?: string
}

export type RateDiscoveryAlbumPayload = {
  id: string
  album: string
  artist: string
  rating: number
}

export type SaveAlbumPayload = {
  album: string
  artist: string
  'album-id'?: number
  deezer_id?: string
}

export type HideAlbumPayload = {
  album: string
  artist: string
  deezer_id?: string
}

export type HideDiscoveryAlbumPayload = {
  id: string
  album: string
  artist: string
}

export type HideTrackPayload = {
  track: string
  artist: string
  'spotify-id'?: string
  deezer_id?: string
}
