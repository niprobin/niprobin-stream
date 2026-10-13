import { installFakeN8n } from '../../test/fakeN8n'
import { lookupStream, STREAM_LOOKUP_TIMEOUT_MS } from './api'

describe('lookupStream', () => {
  const track = { deezerId: '12345', title: 'Windowlicker', artist: 'Aphex Twin' }

  it('sends the track, its context and the token, and returns the stream URL and details', async () => {
    const n8n = installFakeN8n()
    n8n.on('stream', {
      json: {
        stream_url: 'https://files.example.com/a.flac',
        track_id: 12345,
        hash_url: 'h4sh',
        track: 'Windowlicker',
        artist: 'Aphex Twin',
        'album-name': 'Windowlicker EP',
        'album-id': '678',
        cover: 'https://covers.example.com/w.jpg',
      },
    })

    await expect(lookupStream('tok', track, 'digging')).resolves.toEqual({
      ok: true,
      streamUrl: 'https://files.example.com/a.flac',
      details: {
        trackId: '12345',
        hashUrl: 'h4sh',
        title: 'Windowlicker',
        artist: 'Aphex Twin',
        album: 'Windowlicker EP',
        albumId: 678,
        cover: 'https://covers.example.com/w.jpg',
      },
    })
    expect(n8n.requests[0]).toMatchObject({
      path: 'stream',
      method: 'POST',
      headers: { 'X-Auth-Token': 'tok' },
      body: { deezer_id: '12345', track: 'Windowlicker', artist: 'Aphex Twin', context: 'digging' },
    })
  })

  it('looks a track up without a session', async () => {
    const n8n = installFakeN8n()
    n8n.on('stream', { json: { stream_url: 'https://files.example.com/a.flac' } })

    await expect(lookupStream(null, track, 'search')).resolves.toMatchObject({ ok: true })
    expect(n8n.requests[0].headers).not.toHaveProperty('X-Auth-Token')
  })

  it('sends deezer_id 0 for a track without one', async () => {
    const n8n = installFakeN8n()
    n8n.on('stream', { json: { stream_url: 'https://files.example.com/a.flac' } })

    await lookupStream('tok', { ...track, deezerId: '' }, 'search')

    expect(n8n.requests[0].body).toMatchObject({ deezer_id: '0' })
  })

  it('reports a reply without a stream URL', async () => {
    const n8n = installFakeN8n()
    n8n.on('stream', { json: {} })

    await expect(lookupStream('tok', track, 'digging')).resolves.toEqual({
      ok: false,
      error: "Couldn't find this track",
    })
  })

  it('reports server and network failures instead of throwing', async () => {
    const n8n = installFakeN8n()
    n8n.on('stream', { status: 500, text: 'boom' })
    await expect(lookupStream('tok', track, 'digging')).resolves.toEqual({ ok: false, error: "Couldn't find this track" })

    n8n.on('stream', { networkError: true })
    await expect(lookupStream('tok', track, 'digging')).resolves.toEqual({ ok: false, error: "Couldn't find this track" })
  })
})

describe('lookupStream timing out', () => {
  afterEach(() => vi.useRealTimers())

  it('gives up on a lookup n8n never answers', async () => {
    vi.useFakeTimers()
    const n8n = installFakeN8n()
    n8n.on('stream', () => new Promise(() => {}))

    const lookup = lookupStream('tok', { deezerId: '1', title: 'Stuck', artist: 'A' }, 'album')
    await vi.advanceTimersByTimeAsync(STREAM_LOOKUP_TIMEOUT_MS)

    await expect(lookup).resolves.toEqual({ ok: false, error: "Couldn't find this track" })
  })
})
