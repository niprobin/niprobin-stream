import { describe, expect, it } from 'vitest'
import { installFakeN8n } from '../../test/fakeN8n'
import { follow, isFollowed, unfollow } from './follows'

const artist = { name: 'Daft Punk', deezer_id: '27' }

describe('Follow', () => {
  it('knows whether the server lists an artist as Followed', async () => {
    const n8n = installFakeN8n()
    n8n.on('followed-artists', { json: [{ deezer_id: 27, artist: 'Daft Punk' }] })

    await expect(isFollowed('27', 'tok')).resolves.toBe(true)
    await expect(isFollowed('1', 'tok')).resolves.toBe(false)
    expect(n8n.requests[0].headers).toMatchObject({ 'X-Auth-Token': 'tok' })
  })

  it('sends the artist and its deezer_id to follow-artist', async () => {
    const n8n = installFakeN8n()
    n8n.on('follow-artist', { json: { status: 'success' } })

    await expect(follow(artist, 'tok')).resolves.toEqual({ ok: true })
    expect(n8n.requests[0]).toMatchObject({ path: 'follow-artist', body: { artist: 'Daft Punk', deezer_id: '27' } })
  })

  it('counts a Follow n8n wrote but did not answer for as done', async () => {
    const n8n = installFakeN8n()
    n8n.on('follow-artist', { status: 524, text: '<html>A timeout occurred</html>' })
    n8n.on('followed-artists', { json: [{ deezer_id: '27', artist: 'Daft Punk' }] })

    await expect(follow(artist, 'tok')).resolves.toEqual({ ok: true })
  })

  it("shows a refusal's own message", async () => {
    const n8n = installFakeN8n()
    n8n.on('follow-artist', { json: { status: 'error', message: "The DB didn't save this artist" } })

    await expect(follow(artist, 'tok')).resolves.toEqual({ ok: false, error: "The DB didn't save this artist" })
  })

  it('stops following, and checks the list when there is no answer', async () => {
    const n8n = installFakeN8n()
    n8n.on('unfollow-artist', { networkError: true })
    n8n.on('followed-artists', { json: [{ deezer_id: 27, artist: 'Daft Punk' }] })

    await expect(unfollow(artist, 'tok')).resolves.toEqual({
      ok: false,
      error: "Couldn't stop following this artist: no answer from the server",
    })
    n8n.on('followed-artists', { json: [] })
    await expect(unfollow(artist, 'tok')).resolves.toEqual({ ok: true })
  })
})
