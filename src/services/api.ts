import { callAction, read, readFile, readList, type ActionOutcome } from '@/api/webhook'
import type {
  SearchResult,
  AlbumResult,
  AlbumTrack,
  AlbumResponse,
  StreamResponse,
  PickTrackPayload,
  RateAlbumPayload,
  BacklogAlbum,
  BacklogTrack,
  HideAlbumPayload,
  ShortlistAlbumPayload,
  HideTrackPayload,
  AddAlbumPayload,
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
  BacklogAlbum,
  BacklogTrack,
  ArtistSearchResult,
  ArtistPageData,
}

// Every request goes through webhook.ts, shared word for word with the native
// client; docs/n8n-contract.md in the native repo says what n8n answers.
export { authHeaders, type ActionOutcome, type ActionResult } from '@/api/webhook'

// A list from n8n, or the error to throw when there's none
async function listOrThrow<T>(path: string, token: string | null, errorMessage: string, payload?: unknown): Promise<T[]> {
  const list = await readList(path, token, payload)
  if (!list) throw new Error(errorMessage)
  return list as T[]
}

// POST { query } with no auth, for the search endpoints (tracks/albums/artists)
function postSearch<T>(path: string, query: string, errorMessage: string): Promise<T> {
  return listOrThrow(path, null, errorMessage, { query }) as Promise<T>
}

// What a read answered, or the error to throw when it failed
async function readOrThrow(path: string, token: string | null, payload: unknown, errorMessage: string, timeoutMs?: number) {
  const result = await read(path, token, payload, timeoutMs)
  if (!result.ok || result.data === null) throw new Error(errorMessage)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.data as any
}

// Search for tracks
export async function searchTracks(query: string): Promise<SearchResult[]> {
  return postSearch<SearchResult[]>('search', query, 'Search failed')
}

export type StreamContext = 'digging' | 'album' | 'search' | 'artist'

export type StreamTrack = { deezerId: string; title: string; artist: string }

// Two rows can share a deezer_id (bonus or live duplicates) or both lack one,
// so the title and artist are part of a track's identity.
export function trackKey(track: StreamTrack): string {
  return `${track.deezerId}::${track.title}::${track.artist}`
}

// What /stream says about a track besides where to download it
export type StreamDetails = {
  trackId: string
  hashUrl?: string
  title: string
  artist: string
  album?: string
  albumId?: number
  cover?: string
}

export type StreamLookupResult =
  | { ok: true; streamUrl: string; details: StreamDetails }
  | { ok: false; error: string }

// Lookups run one at a time, so one that n8n never answers (a tunnel, a stuck
// workflow) must give up rather than hold every later track back
export const STREAM_LOOKUP_TIMEOUT_MS = 60_000

// Asks n8n to fetch a track onto the server and returns where to download it.
// The file there is deleted after about 10 minutes (ADR 0002). Search plays
// without a session, so the token is optional.
export async function lookupStream(
  token: string | null,
  track: StreamTrack,
  context: StreamContext,
): Promise<StreamLookupResult> {
  const failure = { ok: false as const, error: "Couldn't find this track" }
  const result = await read(
    'stream',
    token,
    { deezer_id: track.deezerId || '0', track: track.title, artist: track.artist, context },
    STREAM_LOOKUP_TIMEOUT_MS,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.ok ? (result.data as any) : null
  if (typeof data?.stream_url !== 'string' || !data.stream_url) return failure
  return {
      ok: true,
      streamUrl: data.stream_url,
      details: {
        trackId: String(data.track_id || track.deezerId),
        hashUrl: data.hash_url,
        title: data.track || track.title,
        artist: data.artist || track.artist,
        album: data['album-name'] || data.album,
        albumId: data['album-id'] ? parseInt(String(data['album-id']), 10) : undefined,
        cover: data.cover,
      },
    }
}

// Download a track (returns blob directly)
export async function downloadTrack(
  deezer_id: string,
  trackName: string,
  artistName: string
): Promise<Blob> {
  const file = await readFile('download', null, { deezer_id, track: trackName, artist: artistName })
  if (!file) throw new Error('Failed to download track')
  return file
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
  const data = await readOrThrow('album-info', null, { deezer_id }, 'Failed to get album')

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

// The actions answer with what became of them; the callers settle an
// unknown outcome against the list it changes (settleAction in webhook.ts).

export function pickTrack(payload: PickTrackPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('like-track', token, payload)
}

export function rateAlbum(payload: RateAlbumPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('rate-album', token, payload)
}

export function addAlbum(payload: AddAlbumPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('save-album', token, payload)
}

export function shortlistAlbum(payload: ShortlistAlbumPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('shortlist', token, payload)
}

// Add to Jellyfin: the server fetches the album into the Jellyfin library
export function addAlbumToJellyfin(deezer_id: string, token: string | null): Promise<ActionOutcome> {
  return callAction('download-album', token, { deezer_id })
}

export async function getAlbumBacklog(token: string | null): Promise<BacklogAlbum[]> {
  return listOrThrow<BacklogAlbum>('albums-to-discover', token, "Couldn't load the Album Backlog")
}

export async function getTrackBacklog(token: string | null): Promise<BacklogTrack[]> {
  return listOrThrow<BacklogTrack>('tracks-to-discover', token, "Couldn't load the Track Backlog")
}

// A Picked track, by deezer_id, and the playlist n8n has for it, shown as is.
// Picks from every device.
export type PickedTrack = { deezer_id: string | number; playlist: string }

export async function getPickedTracks(token: string | null): Promise<PickedTrack[]> {
  return listOrThrow<PickedTrack>('picked-tracks', token, "Couldn't load the Picked tracks")
}

// A Rated album, by deezer_id, and its 1–5 rating
export type RatedAlbum = { deezer_id: string | number; rating: number }

export async function getRatedAlbums(token: string | null): Promise<RatedAlbum[]> {
  return listOrThrow<RatedAlbum>('rated-albums', token, "Couldn't load the Rated albums")
}

export function hideAlbum(payload: HideAlbumPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('hide-album', token, payload)
}

export function hideTrack(payload: HideTrackPayload, token: string | null): Promise<ActionOutcome> {
  return callAction('hide-track', token, payload)
}

export async function searchArtists(query: string): Promise<ArtistSearchResult[]> {
  return postSearch<ArtistSearchResult[]>('search-artist', query, 'Artist search failed')
}

export async function getArtistPage(deezer_id: string | number): Promise<ArtistPageData> {
  const data = await readOrThrow('artist-page', null, { deezer_id }, 'Failed to load artist page')
  return Array.isArray(data) ? data[0] : data
}

// Get track info and stream URL from deezer_id
export async function getTrackByDeezerId(deezer_id: string, token: string | null): Promise<StreamResponse> {
  const data = await readOrThrow(
    'stream',
    token,
    { deezer_id, context: 'share' },
    'Failed to get track by Deezer ID',
    STREAM_LOOKUP_TIMEOUT_MS,
  )
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
