import { describe, expect, it } from 'vitest'
import { installFakeN8n } from '../../test/fakeN8n'
import { addToJellyfin, pick, rate, shortlist } from './actions'

const track = { title: 'Windowlicker', artist: 'Aphex Twin', deezer_id: '12345' }
const album = { album: 'Discovery', artist: 'Daft Punk', deezer_id: '302127' }

describe('Pick', () => {
  it('sends the track and its Radio Playlist to like-track', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { json: { status: 'success' } })

    await expect(pick(track, 'Beats', 'tok')).resolves.toEqual({ ok: true })
    expect(n8n.requests[0]).toMatchObject({
      path: 'like-track',
      headers: { 'X-Auth-Token': 'tok' },
      body: { track: 'Windowlicker', artist: 'Aphex Twin', playlist: 'Beats', 'spotify-id': '', deezer_id: '12345' },
    })
  })

  it('counts a Pick n8n wrote but did not answer for as done', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { status: 524, text: '<html>A timeout occurred</html>' })
    n8n.on('picked-tracks', { json: [{ deezer_id: 12345, playlist: 'Beats' }] })

    await expect(pick(track, 'Beats', 'tok')).resolves.toEqual({ ok: true })
  })

  it('says there was no answer when picked-tracks does not have it', async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { networkError: true })
    n8n.on('picked-tracks', { json: [] })

    await expect(pick(track, 'Beats', 'tok')).resolves.toEqual({
      ok: false,
      error: "Couldn't Pick this track: no answer from the server",
    })
  })

  it("shows a refusal's own message, and never other server text", async () => {
    const n8n = installFakeN8n()
    n8n.on('like-track', { json: { status: 'error', message: 'Unknown playlist' } })
    await expect(pick(track, 'Beats', 'tok')).resolves.toEqual({ ok: false, error: 'Unknown playlist' })

    n8n.on('like-track', { status: 403, text: 'Forbidden' })
    await expect(pick(track, 'Beats', 'tok')).resolves.toEqual({ ok: false, error: "Couldn't Pick this track" })
  })
})

describe('the album actions', () => {
  it('count an unanswered Rate as done when rated-albums has the rating', async () => {
    const n8n = installFakeN8n()
    n8n.on('rate-album', { status: 500, json: { message: 'Error in workflow' } })
    n8n.on('rated-albums', { json: [{ deezer_id: '302127', rating: 4 }] })

    await expect(rate(album, 4, 'tok')).resolves.toEqual({ ok: true })
    await expect(rate(album, 5, 'tok')).resolves.toEqual({
      ok: false,
      error: "Couldn't Rate this album: no answer from the server",
    })
  })

  it('count an unanswered Shortlist as done when the backlog has it shortlisted', async () => {
    const n8n = installFakeN8n()
    n8n.on('shortlist', { networkError: true })
    n8n.on('albums-to-discover', { json: [{ album: 'Discovery', artist: 'Daft Punk', deezer_id: 302127, saved: 'true' }] })

    await expect(shortlist('302127', 'tok')).resolves.toEqual({ ok: true })
  })

  it('never count Add to Jellyfin as done for an album the backlog never listed', async () => {
    const n8n = installFakeN8n()
    n8n.on('download-album', { networkError: true })
    n8n.on('albums-to-discover', { json: [] })

    await expect(addToJellyfin('302127', false, 'tok')).resolves.toMatchObject({ ok: false })
    await expect(addToJellyfin('302127', true, 'tok')).resolves.toEqual({ ok: true })
  })
})
