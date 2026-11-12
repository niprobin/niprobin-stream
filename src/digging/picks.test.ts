import { describe, expect, it } from 'vitest'
import { indexPicks, isPickedFor, pickedPlaylistOf, withPick } from './picks'

const single = { title: 'Song', artist: 'Artist', deezer_id: 'single-id', isrc: 'FRX202400001' }
const onAlbum = { title: 'Song', artist: 'Artist', deezer_id: 'album-id', isrc: 'FRX202400001' }
const picks = [{ deezer_id: 'single-id', isrc: 'FRX202400001', playlist: 'Neo Soul' }]

describe('Picked tracks across versions of a song (ISRC)', () => {
  it('shows a song Picked from the single as Picked on the album, and the other way round', () => {
    const index = indexPicks(picks)
    expect(pickedPlaylistOf(index, single)).toBe('Neo Soul')
    expect(pickedPlaylistOf(index, onAlbum)).toBe('Neo Soul')
  })

  it('reads the ISRC whatever its case or spacing', () => {
    const index = indexPicks([{ deezer_id: 'single-id', isrc: ' frx202400001 ', playlist: 'Neo Soul' }])
    expect(pickedPlaylistOf(index, onAlbum)).toBe('Neo Soul')
  })

  it('matches on deezer_id alone when a track has no ISRC', () => {
    const index = indexPicks(picks)
    expect(pickedPlaylistOf(index, { ...single, isrc: undefined })).toBe('Neo Soul')
    expect(pickedPlaylistOf(index, { ...onAlbum, isrc: null })).toBeNull()
  })

  it('never matches two tracks that both lack an ISRC', () => {
    const index = indexPicks([{ deezer_id: 'a', isrc: null, playlist: 'Neo Soul' }, { deezer_id: 'b', isrc: '', playlist: 'Jazz Funk' }])
    expect(pickedPlaylistOf(index, { title: 'Other', artist: 'Artist', deezer_id: 'c', isrc: '' })).toBeNull()
  })

  it('a different ISRC is a different recording', () => {
    expect(pickedPlaylistOf(indexPicks(picks), { ...onAlbum, isrc: 'FRX202400099' })).toBeNull()
  })

  it('moving the album version moves the song, and the single follows', () => {
    const index = indexPicks(withPick(picks, onAlbum, 'Reggae'))
    expect(pickedPlaylistOf(index, onAlbum)).toBe('Reggae')
    expect(pickedPlaylistOf(index, single)).toBe('Reggae')
  })

  it('knows when n8n lists another version of the track in the playlist', () => {
    expect(isPickedFor(picks, onAlbum, 'Neo Soul')).toBe(true)
    expect(isPickedFor(picks, onAlbum, 'Reggae')).toBe(false)
    expect(isPickedFor(picks, { deezer_id: 'album-id' }, 'Neo Soul')).toBe(false)
  })
})
