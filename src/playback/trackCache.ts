import { lookupStream, trackKey, type StreamContext, type StreamDetails, type StreamTrack } from '@/services/api'
import type { StoredFile, TrackFiles } from './trackFiles'

export type EnsureResult = { ok: true; uri: string } | { ok: false; error: string }

export type TrackCache = {
  // Makes sure the track's file is stored, looking it up and downloading it
  // when it isn't, and returns its playable URI
  ensure(track: StreamTrack, context: StreamContext): Promise<EnsureResult>
  // What /stream last said about the track (album, cover, share hash), or
  // undefined when it was never looked up
  details(track: StreamTrack): StreamDetails | undefined
  // The tracks cleanup must never delete (the playing track and the upcoming
  // album tracks), replacing the previous set
  protect(tracks: StreamTrack[]): void
  // Bytes stored
  size(): Promise<number>
  // Deletes every file but those of `keep`
  clear(keep: StreamTrack[]): Promise<void>
}

// The files live in memory, so the cache keeps nothing past the protected
// tracks: the playing one and the next album tracks
export const DEFAULT_MAX_BYTES = 0

export const OFFLINE_MESSAGE = "You're offline"

type TrackCacheOptions = {
  files: TrackFiles
  getToken: () => string | null
  maxBytes?: number
  now?: () => number
  isOnline?: () => boolean
}

function totalBytes(files: StoredFile[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

// A file name that is stable for the same track
function fileNameFor(track: StreamTrack): string {
  return trackKey(track)
}

// The track files fetched for playback (ADR 0002: always play a downloaded
// copy, never the stream URL, which the server deletes). Past its size limit
// it deletes the least recently played files. Copied from the native client
// (ADR 0001), with the files in memory instead of on disk.
export function createTrackCache({
  files,
  getToken,
  maxBytes = DEFAULT_MAX_BYTES,
  now = Date.now,
  isOnline = () => true,
}: TrackCacheOptions): TrackCache {
  // Asking twice for the same track while it downloads shares one download
  const inFlight = new Map<string, Promise<EnsureResult>>()
  // n8n can't take overlapping /stream lookups, so they run one at a time,
  // whether for the track the listener picked or one fetched ahead. Downloads
  // don't go through n8n and can overlap.
  let lookupQueue: Promise<unknown> = Promise.resolve()
  let protectedNames = new Set<string>()
  // Files fetched but whose play time isn't recorded yet: without one they
  // would look like the oldest files to a cleanup running meanwhile
  const landing = new Set<string>()
  // File name → when it was last played. Cleanup and clear take turns, so
  // neither undoes the other.
  const playedAt = new Map<string, number>()
  const knownDetails = new Map<string, StreamDetails>()
  let housekeeping: Promise<unknown> = Promise.resolve()

  // Runs a change to the files after the previous one
  function inTurn(change: () => Promise<void>) {
    const run = housekeeping.then(change)
    housekeeping = run.catch(() => {})
    return run
  }

  function lookupInTurn(track: StreamTrack, context: StreamContext) {
    // The token is read when the lookup's turn comes, not when it was queued
    const lookup = lookupQueue.then(() => lookupStream(getToken(), track, context))
    lookupQueue = lookup.catch(() => {})
    return lookup
  }

  async function fetchIntoCache(track: StreamTrack, context: StreamContext): Promise<EnsureResult> {
    const name = fileNameFor(track)
    const existing = await files.find(name)
    if (existing) {
      playedAt.set(name, now())
      return { ok: true, uri: existing }
    }

    if (!isOnline()) return { ok: false, error: OFFLINE_MESSAGE }
    const lookup = await lookupInTurn(track, context)
    if (!lookup.ok) return lookup
    knownDetails.set(trackKey(track), lookup.details)

    landing.add(name)
    try {
      const uri = await files.download(lookup.streamUrl, name)
      // Cleanup never fails a track that's already stored
      await inTurn(async () => {
        playedAt.set(name, now())
        landing.delete(name)
        await evict()
      }).catch(() => {})
      return { ok: true, uri }
    } catch {
      return { ok: false, error: "Couldn't fetch this track" }
    } finally {
      landing.delete(name)
    }
  }

  // Deletes the least recently played files until the cache is under its
  // limit, sparing the protected tracks and the files still landing. The
  // track just fetched is the most recently played, so it goes last.
  async function evict() {
    const stored = await files.list()
    let total = totalBytes(stored)
    const candidates = stored
      .filter(file => !protectedNames.has(file.name) && !landing.has(file.name))
      .sort((a, b) => (playedAt.get(a.name) ?? 0) - (playedAt.get(b.name) ?? 0))
    for (const file of candidates) {
      if (total <= maxBytes) break
      await files.remove(file.name)
      playedAt.delete(file.name)
      total -= file.size
    }
  }

  return {
    ensure(track, context) {
      const key = trackKey(track)
      const pending = inFlight.get(key)
      if (pending) return pending

      const request = fetchIntoCache(track, context)
        // Storage can fail too: never leave a caller hanging
        .catch((): EnsureResult => ({ ok: false, error: "Couldn't fetch this track" }))
        .finally(() => inFlight.delete(key))
      inFlight.set(key, request)
      return request
    },
    details(track) {
      return knownDetails.get(trackKey(track))
    },
    protect(tracks) {
      protectedNames = new Set(tracks.map(fileNameFor))
    },
    async size() {
      await housekeeping
      return totalBytes(await files.list())
    },
    clear(keep) {
      const kept = new Set(keep.map(fileNameFor))
      return inTurn(async () => {
        for (const file of await files.list()) {
          if (kept.has(file.name) || landing.has(file.name)) continue
          await files.remove(file.name)
          playedAt.delete(file.name)
        }
      })
    },
  }
}
