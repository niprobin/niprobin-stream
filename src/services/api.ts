import { parseApiResponse } from '@/utils/apiHelpers'

// Type for search results
export type SearchResult = {
  track: string
  artist: string
  album: string
  'track-id': string
  cover: string
}

// Type for album search results
export type AlbumResult = {
  album: string
  artist: string
  'album-id': number
  cover: string
}

// Type for album track listing
export type AlbumTrack = {
  track: string
  'track-id': number
  artist: string
  'track-number': number
}

// Type for stream response
export type StreamResponse = {
  streamUrl: string
  trackId: string
  hashUrl: string
  track: string
  artist: string
  album?: string
  cover?: string
}

type LikeTrackPayload = {
  track: string
  artist: string
  playlist: string
  'spotify-id': string
}

export type LikeTrackResponse = {
  status: 'success' | 'error'
  message: string
}

type RateAlbumPayload = {
  album: string
  artist: string
  rating: number
}

export type LibraryAlbum = {
  album: string
  artist: string
  'album-id': number
  cover: string
}

export type DiscoverAlbum = {
  album: string
  artist: string
  cover_url: string
}

export type DiscoverTrack = {
  track: string
  artist: string
  curator: string
  'spotify-id': string
}

// Search for tracks
export async function searchTracks(query: string): Promise<SearchResult[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error('Search failed')
  }

  const data = await response.json()
  return data.results || data
}

// Get stream URL for a track
export async function getStreamUrl(
  trackId: number,
  track: string,
  artist: string
): Promise<StreamResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trackId, track, artist }),
  })

  if (!response.ok) {
    throw new Error('Failed to get stream URL')
  }

  const data = await response.json()
  return {
    streamUrl: data.stream_url,
    trackId: String(data.track_id || trackId),
    hashUrl: data.hash_url,
    track: data.track,
    artist: data.artist,
    album: data.album,
    cover: data.cover,
  }
}

// Download a track (returns blob directly)
export async function downloadTrack(
  trackId: string,
  trackName: string,
  artistName: string
): Promise<Blob> {
  const response = await fetch('https://n8n.niprobin.com/webhook/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      trackId,
      track: trackName,
      artist: artistName
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to download track')
  }

  return response.blob()
}

// Search for albums
export async function searchAlbums(query: string): Promise<AlbumResult[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/search-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error('Album search failed')
  }

  const data = await response.json()
  return data.results || data
}

// Get tracks for a specific album
export async function getAlbumTracks(
  albumId: number,
  album: string,
  artist: string
): Promise<AlbumTrack[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ albumId, album, artist }),
  })

  if (!response.ok) {
    throw new Error('Failed to get album tracks')
  }

  const data = await response.json()

  // Ensure we always return an array
  if (Array.isArray(data)) {
    return data
  }

  if (data.results && Array.isArray(data.results)) {
    return data.results
  }

  // If data is not an array, wrap it or return empty array
  return []
}

export async function likeTrack(payload: LikeTrackPayload): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/like-track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Action completed',
    errorMessage: 'Failed to like track',
  })
}

export async function rateAlbum(payload: RateAlbumPayload): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/rate-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Rating saved',
    errorMessage: 'Failed to rate album',
  })
}

export async function getAlbumsToDiscover(): Promise<DiscoverAlbum[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/albums-to-discover', {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error('Failed to load albums to discover')
  }

  const data = await response.json()
  if (Array.isArray(data)) {
    return data
  }

  if (data?.results && Array.isArray(data.results)) {
    return data.results
  }

  return []
}

export async function getTracksToDiscover(): Promise<DiscoverTrack[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/tracks-to-discover', {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error('Failed to load tracks to discover')
  }

  const data = await response.json()
  if (Array.isArray(data)) {
    return data
  }

  if (data?.results && Array.isArray(data.results)) {
    return data.results
  }

  return []
}

export async function getLibraryAlbums(): Promise<LibraryAlbum[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/albums-to-discover', {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error('Failed to load albums')
  }

  const data = await response.json()
  if (Array.isArray(data)) {
    return data
  }

  if (data?.results && Array.isArray(data.results)) {
    return data.results
  }

  return []
}

type HideAlbumPayload = {
  album: string
  artist: string
}

export async function hideAlbum(payload: HideAlbumPayload): Promise<void> {
  const response = await fetch('https://n8n.niprobin.com/webhook/hide-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to hide album')
  }
}

type HideTrackPayload = {
  track: string
  artist: string
  'spotify-id': string
}

export async function hideTrack(payload: HideTrackPayload): Promise<void> {
  const response = await fetch('https://n8n.niprobin.com/webhook/hide-track', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to hide track')
  }
}

// Get track info and stream URL from hash
export async function getTrackByHash(hash: string): Promise<StreamResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ hash }),
  })

  if (!response.ok) {
    throw new Error('Failed to get track by hash')
  }

  const data = await response.json()
  return {
    streamUrl: data.stream_url,
    trackId: String(data.track_id),
    hashUrl: data.hash_url || hash,
    track: data.track,
    artist: data.artist,
    album: data.album,
    cover: data.cover,
  }
}
