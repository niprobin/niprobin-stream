import type { PickedTrack } from '@/services/api'

// Picks match on deezer_id, then on ISRC: the same song often has several
// deezer_ids (the single, then the album) but one ISRC, so a Pick shows on
// every version of the song.

export type PickableTrack = { deezer_id?: string; isrc?: string | null; title: string; artist: string }

// A recording's ISRC, or '' when n8n has none
export function toIsrc(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function isSameRecording(pick: Pick<PickedTrack, 'deezer_id' | 'isrc'>, track: Pick<PickableTrack, 'deezer_id' | 'isrc'>): boolean {
  const isrc = toIsrc(track.isrc)
  return (!!track.deezer_id && String(pick.deezer_id) === String(track.deezer_id)) || (isrc !== '' && toIsrc(pick.isrc) === isrc)
}

export type PickIndex = { byDeezerId: Map<string, string>; byIsrc: Map<string, string> }

export function indexPicks(picks: PickedTrack[]): PickIndex {
  const listed = picks.filter(pick => pick.playlist)
  return {
    byDeezerId: new Map(listed.filter(pick => pick.deezer_id).map(pick => [String(pick.deezer_id), String(pick.playlist)])),
    byIsrc: new Map(listed.filter(pick => toIsrc(pick.isrc)).map(pick => [toIsrc(pick.isrc), String(pick.playlist)])),
  }
}

// The playlist the track is Picked for, or null
export function pickedPlaylistOf(index: PickIndex, track: PickableTrack): string | null {
  const isrc = toIsrc(track.isrc)
  return (track.deezer_id && index.byDeezerId.get(String(track.deezer_id))) || (isrc && index.byIsrc.get(isrc)) || null
}

// The picks after a Pick or a move: it replaces any other version of the recording
export function withPick(picks: PickedTrack[], track: PickableTrack, playlist: string): PickedTrack[] {
  const deezerId = track.deezer_id ?? ''
  const isrc = toIsrc(track.isrc)
  if (!deezerId && !isrc) return picks
  return [...picks.filter(other => !isSameRecording(other, track)), { deezer_id: deezerId, isrc: isrc || undefined, playlist }]
}

// Whether n8n lists the track (or another version of it) in the playlist
export function isPickedFor(picks: PickedTrack[], track: Pick<PickableTrack, 'deezer_id' | 'isrc'>, playlist: string): boolean {
  return picks.some(pick => isSameRecording(pick, track) && pick.playlist === playlist)
}
