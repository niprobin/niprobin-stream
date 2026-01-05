// Type for search results
export type SearchResult = {
  track: string
  artist: string
  album: string
  'track-id': string
}

// Type for stream response
export type StreamResponse = {
  streamUrl: string
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