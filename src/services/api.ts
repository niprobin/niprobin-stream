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
}

type LikeTrackPayload = {
  track: string
  artist: string
  playlist: string
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
export async function getStreamUrl(trackId: string): Promise<string> {
  const response = await fetch('https://n8n.niprobin.com/webhook/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trackId }),
  })

  if (!response.ok) {
    throw new Error('Failed to get stream URL')
  }

  const data = await response.json()
  return data.stream_url
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
  let data: unknown = null

  if (rawBody) {
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = null
    }
  }

  const normalizeStatus = (): 'success' | 'error' => {
    if (data && typeof data === 'object' && data !== null) {
      const candidate = (data as Record<string, unknown>).status
      if (typeof candidate === 'string') {
        const lowered = candidate.toLowerCase()
        if (lowered === 'success') return 'success'
        if (lowered === 'error' || lowered === 'failed' || lowered === 'fail') return 'error'
      }

      const successField = (data as Record<string, unknown>).success
      if (typeof successField === 'boolean') {
        return successField ? 'success' : 'error'
      }

      const errorField = (data as Record<string, unknown>).error
      if (typeof errorField === 'boolean') {
        return errorField ? 'error' : 'success'
      }
    }

    return response.ok ? 'success' : 'error'
  }

  const extractMessage = (): string | null => {
    const tryFields = (fields: string[]): string | null => {
      if (!data || typeof data !== 'object' || data === null) return null
      for (const field of fields) {
        const value = (data as Record<string, unknown>)[field]
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim()
        }
      }
      return null
    }

    const prioritized = tryFields(['message', 'msg', 'detail', 'error', 'statusText'])
    if (prioritized) return prioritized

    if (typeof data === 'string' && data.trim().length > 0) {
      return data.trim()
    }

    if (data && typeof data === 'object') {
      const fallbackValue = Object.values(data).find(
        (value) => typeof value === 'string' && value.trim().length > 0,
      )
      if (typeof fallbackValue === 'string') {
        return fallbackValue.trim()
      }
    }

    if (rawBody && rawBody.trim().length > 0) {
      return rawBody.trim()
    }

    return null
  }

  const status = normalizeStatus()
  const message =
    extractMessage() || (status === 'success' ? 'Action completed' : 'Failed to like track')

  return { status, message }
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
  let data: unknown = null

  if (rawBody) {
    try {
      data = JSON.parse(rawBody)
    } catch {
      data = null
    }
  }

  const statusField =
    typeof (data as any)?.status === 'string' ? (data as any).status.toLowerCase() : null
  const status: 'success' | 'error' =
    statusField === 'success'
      ? 'success'
      : statusField === 'error'
        ? 'error'
        : response.ok
          ? 'success'
          : 'error'

  const message =
    typeof (data as any)?.message === 'string' && (data as any).message.trim().length > 0
      ? (data as any).message.trim()
      : rawBody.trim().length > 0
        ? rawBody.trim()
        : status === 'success'
          ? 'Rating saved'
          : 'Failed to rate album'

  return { status, message }
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
