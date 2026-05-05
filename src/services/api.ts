import { parseApiResponse } from '@/utils/apiHelpers'
import type {
  SearchResult,
  AlbumResult,
  AlbumTrack,
  AlbumResponse,
  StreamResponse,
  LikeTrackPayload,
  LikeTrackResponse,
  RateAlbumPayload,
  RateDiscoveryAlbumPayload,
  LibraryAlbum,
  DiscoverAlbum,
  DiscoverTrack,
  LibraryTrack,
  HideAlbumPayload,
  HideDiscoveryAlbumPayload,
  HideTrackPayload,
  SaveAlbumPayload,
} from '@/types/api'

// Re-export all public types so existing imports from '@/services/api' keep working
export type {
  SearchResult,
  AlbumResult,
  AlbumTrack,
  AlbumResponse,
  StreamResponse,
  LikeTrackResponse,
  LibraryAlbum,
  DiscoverAlbum,
  DiscoverTrack,
  LibraryTrack,
}

// Auth headers helper
export function authHeaders(token: string | null): HeadersInit {
  return token
    ? { 'Content-Type': 'application/json', 'X-Auth-Token': token }
    : { 'Content-Type': 'application/json' }
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
  deezer_id: string,
  track: string,
  artist: string,
  token: string | null,
  context?: string
): Promise<StreamResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ deezer_id, track, artist, context }),
  })

  if (!response.ok) {
    throw new Error('Failed to get stream URL')
  }

  const data = await response.json()
  return {
    streamUrl: data.stream_url,
    trackId: String(data.track_id || deezer_id),
    hashUrl: data.hash_url,
    track: data.track,
    artist: data.artist,
    album: data.album,
    'album-id': data['album-id'],
    cover: data.cover,
  }
}

// Download a track (returns blob directly)
export async function downloadTrack(
  deezer_id: string,
  trackName: string,
  artistName: string
): Promise<Blob> {
  const response = await fetch('https://n8n.niprobin.com/webhook/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deezer_id,
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
  deezer_id: string,
  album: string,
  artist: string
): Promise<AlbumTrack[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deezer_id, album, artist }),
  })

  if (!response.ok) {
    throw new Error('Failed to get album tracks')
  }

  const data = await response.json()

  // The endpoint now returns an array with album objects containing tracks
  if (Array.isArray(data) && data.length > 0 && data[0].tracks && Array.isArray(data[0].tracks)) {
    const albumData = data[0]
    const albumId = parseInt(albumData['album-id']) || 0

    // Add album metadata to each track
    return albumData.tracks.map((track: any) => ({
      ...track,
      deezer_id: track.deezer_id, // Ensure deezer_id is preserved
      'album-id': albumId,
      album: albumData.album,
      cover: albumData.cover
    }))
  }

  // Fallback to previous formats for backward compatibility
  if (Array.isArray(data)) {
    return data
  }

  if (data.results && Array.isArray(data.results)) {
    return data.results
  }

  // If data is not an array, return empty array
  return []
}

// Get album by ID (for album page)
export async function getAlbumById(deezer_id: string): Promise<AlbumResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream-album', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deezer_id }),
  })

  if (!response.ok) {
    throw new Error('Failed to get album')
  }

  const data = await response.json()

  // Handle new array format with album object containing tracks
  let tracks: AlbumTrack[] = []
  let albumData: any = {}

  if (Array.isArray(data) && data.length > 0) {
    albumData = data[0]
    if (albumData.tracks && Array.isArray(albumData.tracks)) {
      const parsedAlbumId = parseInt(albumData['album-id']) || parseInt(deezer_id) || 0

      // Add album metadata to each track
      tracks = albumData.tracks.map((track: any) => ({
        ...track,
        deezer_id: track.deezer_id, // Ensure deezer_id is preserved
        'album-id': parsedAlbumId,
        album: albumData.album,
        cover: albumData.cover
      }))
    }
  } else if (Array.isArray(data)) {
    // Fallback: if data is just an array of tracks
    tracks = data
  } else if (data.tracks && Array.isArray(data.tracks)) {
    // Fallback: if data object has tracks property
    tracks = data.tracks
    albumData = data
  } else if (data.results && Array.isArray(data.results)) {
    // Fallback: legacy results format
    tracks = data.results
    albumData = data
  }

  return {
    tracks,
    albumId: albumData['album-id'] ? parseInt(albumData['album-id']) : (albumData.album_id || albumData.albumId || parseInt(deezer_id) || 0),
    album: albumData.album || (tracks.length > 0 ? tracks[0].album || '' : ''),
    artist: albumData.artist || (tracks.length > 0 ? tracks[0].artist : ''),
    cover: albumData.cover || (tracks.length > 0 ? tracks[0].cover || '' : ''),
    id: albumData.id, // Include MD5 hash ID if present
    streamingLink: albumData.streaming_link, // Include streaming service link if present
  }
}

export async function likeTrack(payload: LikeTrackPayload, token: string | null): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/like-track', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Action completed',
    errorMessage: 'Failed to like track',
  })
}

export async function rateAlbum(payload: RateAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/rate-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Rating saved',
    errorMessage: 'Failed to rate album',
  })
}

export async function rateDiscoveryAlbum(payload: RateDiscoveryAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/rate-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Rating saved',
    errorMessage: 'Failed to rate album',
  })
}

export async function saveAlbum(payload: SaveAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/save-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Album saved for later',
    errorMessage: 'Failed to save album',
  })
}

export async function getAlbumsToDiscover(token: string | null): Promise<DiscoverAlbum[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/albums-to-discover', {
    method: 'GET',
    headers: authHeaders(token),
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

export async function getTracksToDiscover(token: string | null): Promise<DiscoverTrack[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/tracks-to-discover', {
    method: 'GET',
    headers: authHeaders(token),
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

export async function getLibraryTracks(token: string | null): Promise<LibraryTrack[]> {
  const response = await fetch('https://n8n.niprobin.com/webhook/library', {
    method: 'GET',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error('Failed to load library tracks')
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

export async function hideAlbum(payload: HideAlbumPayload, token: string | null): Promise<void> {
  const response = await fetch('https://n8n.niprobin.com/webhook/hide-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to hide album')
  }
}

export async function hideDiscoveryAlbum(payload: HideDiscoveryAlbumPayload, token: string | null): Promise<void> {
  const response = await fetch('https://n8n.niprobin.com/webhook/hide-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to hide discovery album')
  }
}

export async function hideTrack(payload: HideTrackPayload, token: string | null): Promise<void> {
  const response = await fetch('https://n8n.niprobin.com/webhook/hide-track', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to hide track')
  }
}

// Get track info and stream URL from deezer_id
export async function getTrackByDeezerId(deezer_id: string, token: string | null): Promise<StreamResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ deezer_id, context: 'share' }),
  })

  if (!response.ok) {
    throw new Error('Failed to get track by Deezer ID')
  }

  const data = await response.json()
  return {
    streamUrl: data.stream_url,
    trackId: String(data.track_id || deezer_id),
    hashUrl: data.hash_url,
    track: data.track,
    artist: data.artist,
    album: data.album,
    cover: data.cover,
  }
}
