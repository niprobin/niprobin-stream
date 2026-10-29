import { MESSAGES } from '@/api/actionMessages'
import { settleAction, type ActionResult } from '@/api/webhook'
import {
  addAlbum,
  addAlbumToJellyfin,
  getAlbumBacklog,
  getPickedTracks,
  getRatedAlbums,
  pickTrack,
  rateAlbum,
  shortlistAlbum,
} from '@/services/api'
import type { BacklogAlbum } from '@/types/api'

// The digging actions, settled as in the native client: an action n8n didn't
// answer for is checked against the list it changes before the listener is
// told it failed. Hide has its own rules in hides.ts.

type TrackToPick = { title: string; artist: string; deezer_id?: string; spotifyId?: string }
type AlbumRef = { album: string; artist: string; deezer_id: string }

// The album as the server lists it now (undefined when it isn't listed).
// Throws when the backlog can't be fetched, which confirms nothing.
async function listedAlbum(token: string | null, deezerId: string): Promise<BacklogAlbum | undefined> {
  const albums = await getAlbumBacklog(token)
  return albums.find(album => String(album.deezer_id) === deezerId)
}

const isShortlisted = (album: BacklogAlbum | undefined) => String(album?.saved).toLowerCase() === 'true'

// Pick: send a track to one Radio Playlist (or move it there)
export async function pick(track: TrackToPick, playlist: string, token: string | null): Promise<ActionResult> {
  const outcome = await pickTrack(
    { track: track.title, artist: track.artist, playlist, 'spotify-id': track.spotifyId || '', deezer_id: track.deezer_id },
    token,
  )
  return settleAction(outcome, MESSAGES.pickFailed, async () => {
    const picks = await getPickedTracks(token)
    return !!track.deezer_id && picks.some(p => String(p.deezer_id) === track.deezer_id && p.playlist === playlist)
  })
}

export async function rate(album: AlbumRef, rating: number, token: string | null): Promise<ActionResult> {
  const outcome = await rateAlbum({ album: album.album, artist: album.artist, rating, deezer_id: album.deezer_id }, token)
  return settleAction(outcome, MESSAGES.rateFailed, async () => {
    const ratings = await getRatedAlbums(token)
    return ratings.some(rated => String(rated.deezer_id) === album.deezer_id && Number(rated.rating) === rating)
  })
}

export async function add(album: AlbumRef, token: string | null): Promise<ActionResult> {
  const outcome = await addAlbum({ album: album.album, artist: album.artist, deezer_id: album.deezer_id }, token)
  return settleAction(outcome, MESSAGES.addFailed, async () => !!(await listedAlbum(token, album.deezer_id)))
}

export async function shortlist(deezerId: string, token: string | null): Promise<ActionResult> {
  const outcome = await shortlistAlbum({ album_id: deezerId, saved: true }, token)
  return settleAction(outcome, MESSAGES.shortlistFailed, async () => isShortlisted(await listedAlbum(token, deezerId)))
}

// n8n takes an album Added to Jellyfin out of the backlog, which only shows
// for an album the backlog listed (`wasListed`)
export async function addToJellyfin(deezerId: string, wasListed: boolean, token: string | null): Promise<ActionResult> {
  const outcome = await addAlbumToJellyfin(deezerId, token)
  return settleAction(
    outcome,
    MESSAGES.addToJellyfinFailed,
    async () => wasListed && !(await listedAlbum(token, deezerId)),
  )
}
