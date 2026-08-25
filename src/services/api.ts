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
  DiscoverAlbum,
  DiscoverTrack,
  HideAlbumPayload,
  HideTrackPayload,
  SaveAlbumPayload,
  ArtistSearchResult,
  ArtistPageData,
} from '@/types/api'

// Re-export all public types so existing imports from '@/services/api' keep working
export type {
  SearchResult,
  AlbumResult,
  AlbumTrack,
  AlbumResponse,
  StreamResponse,
  LikeTrackResponse,
  DiscoverAlbum,
  DiscoverTrack,
  ArtistSearchResult,
  ArtistPageData,
}

const BASE = 'https://n8n.niprobin.com/webhook'

// Auth headers helper
export function authHeaders(token: string | null): HeadersInit {
  return token
    ? { 'Content-Type': 'application/json', 'X-Auth-Token': token }
    : { 'Content-Type': 'application/json' }
}

// POST { query } with no auth, expecting either a bare array or { results: [...] }.
// Shared by the plain-text search endpoints (tracks/albums/artists).
async function postSearch<T>(path: string, query: string, errorMessage: string): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(errorMessage)
  }

  const data = await response.json()
  return data.results || data
}

// Authenticated POST that throws on failure and returns the raw JSON body.
// Shared by the simple write endpoints (hide-*) that don't need parseApiResponse's
// success/error-message normalization.
async function postForJson<T>(path: string, payload: unknown, token: string | null, errorMessage: string): Promise<T> {
  const response = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(errorMessage)
  }

  return response.json()
}

// Authenticated POST whose result is normalized via parseApiResponse.
// Shared by the user-action endpoints (like/rate/save/download-album).
async function postAction(
  path: string,
  payload: unknown,
  token: string | null,
  options: { successMessage: string; errorMessage: string }
): Promise<LikeTrackResponse> {
  const response = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, options)
}

// Authenticated GET expecting either a bare array or { results: [...] } (or empty body).
// Shared by the "to discover" list endpoints.
async function getResultsList<T>(path: string, token: string | null, errorMessage: string): Promise<T[]> {
  const response = await fetch(`${BASE}/${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  })

  if (!response.ok) {
    throw new Error(errorMessage)
  }

  const text = await response.text()
  if (!text.trim()) return []

  const data = JSON.parse(text)
  if (Array.isArray(data)) return data
  if (data?.results && Array.isArray(data.results)) return data.results
  return []
}

// Search for tracks
export async function searchTracks(query: string): Promise<SearchResult[]> {
  return postSearch<SearchResult[]>('search', query, 'Search failed')
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
    album: data['album-name'] || data.album,
    'album-id': data['album-id'] ? parseInt(String(data['album-id']), 10) : undefined,
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
  return postSearch<AlbumResult[]>('search-album', query, 'Album search failed')
}

// Parses album metadata from either the old flat format or the new structured format.
function parseAlbumMeta(albumData: any, fallbackId: string) {
  const isNewFormat = albumData.album && typeof albumData.album === 'object'
  return {
    albumTitle: isNewFormat ? (albumData.album.title || '') : (albumData.album || ''),
    albumCover: isNewFormat ? (albumData.album.covercover || albumData.album.cover || '') : (albumData.cover || ''),
    albumId: isNewFormat
      ? (Number(albumData.album.deezer_id) || parseInt(fallbackId) || 0)
      : (parseInt(albumData['album-id']) || parseInt(fallbackId) || 0),
    streamingLink: isNewFormat ? albumData.album.streaming_link : albumData.streaming_link,
    artistName: isNewFormat ? (albumData.artist?.name || '') : (albumData.artist || ''),
    artistId: isNewFormat ? (albumData.artist?.id ?? undefined) : undefined,
    legacyId: isNewFormat ? undefined : albumData.id,
  }
}

// Get album metadata only — calls the lightweight /album-info endpoint (no audio download)
export async function getAlbumById(deezer_id: string): Promise<AlbumResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/album-info', {
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
      const { albumTitle, albumCover, albumId: parsedAlbumId, streamingLink, artistName, artistId, legacyId } = parseAlbumMeta(albumData, deezer_id)

      tracks = albumData.tracks.map((track: any) => ({
        ...track,
        deezer_id: track.deezer_id,
        'track-number': typeof track['track-number'] === 'string' ? parseInt(track['track-number']) : track['track-number'],
        'album-id': parsedAlbumId,
        album: albumTitle,
        cover: albumCover,
      }))

      return { tracks, albumId: parsedAlbumId, album: albumTitle, artist: artistName, artistId, cover: albumCover, id: legacyId, streamingLink }
    }
  } else if (Array.isArray(data)) {
    tracks = data
  } else if (data.tracks && Array.isArray(data.tracks)) {
    tracks = data.tracks
    albumData = data
  } else if (data.results && Array.isArray(data.results)) {
    tracks = data.results
    albumData = data
  }

  return {
    tracks,
    albumId: albumData['album-id'] ? parseInt(albumData['album-id']) : (albumData.album_id || albumData.albumId || parseInt(deezer_id) || 0),
    album: albumData.album || (tracks.length > 0 ? tracks[0].album || '' : ''),
    artist: albumData.artist || (tracks.length > 0 ? tracks[0].artist : ''),
    cover: albumData.cover || (tracks.length > 0 ? tracks[0].cover || '' : ''),
    id: albumData.id,
    streamingLink: albumData.streaming_link,
  }
}

export async function likeTrack(payload: LikeTrackPayload, token: string | null): Promise<LikeTrackResponse> {
  return postAction('like-track', payload, token, {
    successMessage: 'Action completed',
    errorMessage: 'Failed to like track',
  })
}

export async function rateAlbum(payload: RateAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  return postAction('rate-album', payload, token, {
    successMessage: 'Rating saved',
    errorMessage: 'Failed to rate album',
  })
}

export async function saveAlbum(payload: SaveAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  return postAction('save-album', payload, token, {
    successMessage: 'Album saved for later',
    errorMessage: 'Failed to save album',
  })
}

// Trigger album download via n8n webhook
export async function downloadAlbum(
  deezer_id: string,
  token: string | null
): Promise<LikeTrackResponse> {
  return postAction('download-album', { deezer_id }, token, {
    successMessage: 'Album download initiated',
    errorMessage: 'Failed to trigger album download',
  })
}

export async function getAlbumsToDiscover(token: string | null): Promise<DiscoverAlbum[]> {
  return getResultsList<DiscoverAlbum>('albums-to-discover', token, 'Failed to load albums to discover')
}

export async function getTracksToDiscover(token: string | null): Promise<DiscoverTrack[]> {
  return getResultsList<DiscoverTrack>('tracks-to-discover', token, 'Failed to load tracks to discover')
}

export async function hideAlbum(payload: HideAlbumPayload, token: string | null): Promise<LikeTrackResponse> {
  return postForJson('hide-album', payload, token, 'Failed to hide album')
}

export async function hideTrack(payload: HideTrackPayload, token: string | null): Promise<LikeTrackResponse> {
  return postForJson('hide-track', payload, token, 'Failed to hide track')
}

export async function searchArtists(query: string): Promise<ArtistSearchResult[]> {
  return postSearch<ArtistSearchResult[]>('search-artist', query, 'Artist search failed')
}

export async function getArtistPage(deezer_id: string | number): Promise<ArtistPageData> {
  const response = await fetch('https://n8n.niprobin.com/webhook/artist-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deezer_id }),
  })

  if (!response.ok) {
    throw new Error('Failed to load artist page')
  }

  const data = await response.json()
  return Array.isArray(data) ? data[0] : data
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
