import { getFollowedArtists } from '@/services/api'
import { unfollow as sendUnfollow, type ArtistRef } from './follows'

// The Followed artists for the Artists page and the Sidebar count. Unfollow
// from the list works like Hide: the artist leaves at once, the Unfollow is
// sent once the undo window has passed, and a refused one brings it back.

// How long an Unfollow from the list can be undone before it's sent
export const UNFOLLOW_UNDO_WINDOW_MS = 5000

export type FollowedArtistsState = {
  // A→Z, without the artists being unfollowed; null until the first load
  artists: ArtistRef[] | null
  isLoading: boolean
  // The last load failed
  loadFailed: boolean
}

export type FollowedArtists = {
  // The same object until something changes, so it can back useSyncExternalStore
  getState(): FollowedArtistsState
  load(): Promise<void>
  // Takes the artist out now and sends the Unfollow once the undo window has passed
  unfollow(artist: ArtistRef): { undo: () => void }
  // Logout: cancels the Unfollows still waiting, as if undone
  dispose(): void
  subscribe(listener: () => void): () => void
  // Loads and Unfollows that failed
  onError(listener: (message: string) => void): () => void
}

const byName = (a: ArtistRef, b: ArtistRef) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

export function createFollowedArtists({ getToken }: { getToken: () => string | null }): FollowedArtists {
  let artists: ArtistRef[] | null = null
  let isLoading = false
  let loadFailed = false
  let disposed = false
  // Waiting for their undo window, by deezer_id
  const pending = new Map<string, ReturnType<typeof setTimeout>>()
  // Sent, waiting for n8n's answer
  const sending = new Set<string>()
  let state: FollowedArtistsState = { artists: null, isLoading, loadFailed }

  const listeners = new Set<() => void>()
  const errorListeners = new Set<(message: string) => void>()

  function publish() {
    const leaving = (artist: ArtistRef) => pending.has(artist.deezer_id) || sending.has(artist.deezer_id)
    state = { artists: artists && artists.filter(artist => !leaving(artist)), isLoading, loadFailed }
    listeners.forEach(listener => listener())
  }

  function fail(message: string) {
    errorListeners.forEach(listener => listener(message))
  }

  async function send(artist: ArtistRef) {
    pending.delete(artist.deezer_id)
    sending.add(artist.deezer_id)
    publish()
    const result = await sendUnfollow(artist, getToken())
    if (disposed) return
    sending.delete(artist.deezer_id)
    if (result.ok) artists = (artists ?? []).filter(a => a.deezer_id !== artist.deezer_id)
    else fail(result.error)
    publish()
  }

  return {
    getState: () => state,
    async load() {
      if (isLoading || disposed) return
      isLoading = true
      publish()
      try {
        const rows = await getFollowedArtists(getToken())
        if (disposed) return
        artists = rows
          .map(row => ({ deezer_id: row.deezer_id == null ? '' : String(row.deezer_id), name: String(row.artist ?? '') }))
          .filter(artist => artist.deezer_id)
          .sort(byName)
        loadFailed = false
      } catch (error) {
        if (disposed) return
        loadFailed = true
        fail(error instanceof Error ? error.message : "Couldn't load the Followed artists")
      }
      isLoading = false
      publish()
    },
    unfollow(artist) {
      const key = artist.deezer_id
      if (!pending.has(key) && !sending.has(key)) {
        pending.set(key, setTimeout(() => void send(artist), UNFOLLOW_UNDO_WINDOW_MS))
        publish()
      }
      return {
        undo() {
          const timer = pending.get(key)
          if (timer === undefined) return
          clearTimeout(timer)
          pending.delete(key)
          publish()
        },
      }
    },
    dispose() {
      disposed = true
      pending.forEach(timer => clearTimeout(timer))
      pending.clear()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    onError(listener) {
      errorListeners.add(listener)
      return () => {
        errorListeners.delete(listener)
      }
    },
  }
}

// The filter on the Artists page: case and accents don't count
export function matchesArtist(name: string, query: string): boolean {
  const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
  return fold(name).includes(fold(query))
}
