import { MESSAGES } from '@/api/actionMessages'
import { settleAction, type ActionOutcome } from '@/api/webhook'
import { getAlbumBacklog, getTrackBacklog, hideAlbum, hideTrack, trackKey } from '@/services/api'
import { STORAGE_KEYS } from '@/utils/storageKeys'

// Hide, on the native client's rules: the item goes at once, the Hide is sent
// once the undo window has passed, a refused Hide brings the item back, and a
// sent one keeps the item hidden until the server's backlog stops listing it.
// A Hide n8n didn't answer for counts as sent when the backlog no longer
// lists the item.

// How long a Hide can be undone before it's sent to the server
export const HIDE_UNDO_WINDOW_MS = 5000

export type HideKind = 'track' | 'album'

// A track or an album, whatever page it was hidden from
export type HideTarget = { deezerId: string; title: string; artist: string }

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

// Items Hidden in this browser, kept out of the lists until the server's
// backlog stops listing them
const ACTED_ON_KEYS: Record<HideKind, string> = {
  track: STORAGE_KEYS.HIDDEN_TRACKS,
  album: STORAGE_KEYS.HIDDEN_ALBUMS,
}

const SENDERS: Record<HideKind, (target: HideTarget, token: string | null) => Promise<ActionOutcome>> = {
  track: (target, token) => hideTrack({ track: target.title, artist: target.artist, deezer_id: target.deezerId }, token),
  album: (target, token) => hideAlbum({ album: target.title, artist: target.artist, deezer_id: target.deezerId }, token),
}

// The keys of every item the server's backlog lists now
const LISTED: Record<HideKind, (token: string | null) => Promise<Set<string>>> = {
  track: async token =>
    new Set((await getTrackBacklog(token)).map(t => hideKey({ deezerId: String(t.deezer_id), title: t.track, artist: t.artist }))),
  album: async token =>
    new Set((await getAlbumBacklog(token)).map(a => hideKey({ deezerId: String(a.deezer_id), title: a.album, artist: a.artist }))),
}

const FAILED: Record<HideKind, string> = { track: MESSAGES.hideTrackFailed, album: MESSAGES.hideAlbumFailed }

// Albums are told apart like tracks are
export const hideKey: (target: HideTarget) => string = trackKey

export type Hides = {
  // Hides the item now and sends the Hide once the undo window has passed
  hide(target: HideTarget): { undo: () => void }
  // The keys of every item to keep out of the lists. The same Set until
  // something changes, so it can back useSyncExternalStore.
  hidden(): ReadonlySet<string>
  // The keys of the Hides sent to the server, past their undo window
  sent(): ReadonlySet<string>
  // The server's latest backlog: sent Hides on items it no longer lists are done
  catchUp(listed: HideTarget[]): void
  // Logout: cancels the Hides still waiting for their undo window, as if
  // undone, and stops saving anything for this session
  dispose(): void
  subscribe(listener: () => void): () => void
  // Hides the server refused
  onError(listener: (message: string) => void): () => void
}

type Options = {
  kind: HideKind
  getToken: () => string | null
  store?: Store
}

export function createHides({ kind, getToken, store = localStorage }: Options): Hides {
  const storageKey = ACTED_ON_KEYS[kind]
  const actedOn = readActedOn()
  const pendingHides = new Map<string, { target: HideTarget; timer: ReturnType<typeof setTimeout> }>()
  // What the backlog listed last (catchUp), so a Hide is only checked
  // against the backlog for an item it listed
  let listedKeys: ReadonlySet<string> = new Set()
  let hidden: ReadonlySet<string> = new Set(actedOn)
  let sent: ReadonlySet<string> = hidden
  let disposed = false

  const listeners = new Set<() => void>()
  const errorListeners = new Set<(message: string) => void>()

  function publish() {
    sent = new Set(actedOn)
    hidden = new Set([...actedOn, ...pendingHides.keys()])
    listeners.forEach(listener => listener())
  }

  function readActedOn() {
    try {
      const saved = JSON.parse(store.getItem(storageKey) ?? '[]')
      return new Set<string>(Array.isArray(saved) ? saved.map(String) : [])
    } catch {
      // An unreadable list only risks showing an item the server still lists
      return new Set<string>()
    }
  }

  function saveActedOn() {
    // Logout already cleared the list: a late answer must not bring it back
    if (disposed) return
    try {
      store.setItem(storageKey, JSON.stringify([...actedOn]))
    } catch {
      // Same: the item can only reappear until the server catches up
    }
  }

  // Takes a Hide out of its undo window, returning it if it was waiting
  function takePendingHide(key: string) {
    const pending = pendingHides.get(key)
    if (!pending) return null
    clearTimeout(pending.timer)
    pendingHides.delete(key)
    return pending
  }

  async function sendHide(key: string) {
    const pending = takePendingHide(key)
    if (!pending) return
    actedOn.add(key)
    saveActedOn()
    publish()

    const wasListed = listedKeys.has(key)
    const token = getToken()
    const result = await settleAction(
      await SENDERS[kind](pending.target, token),
      FAILED[kind],
      async () => wasListed && !(await LISTED[kind](token)).has(key),
    )
    if (result.ok || disposed) return
    actedOn.delete(key)
    saveActedOn()
    publish()
    errorListeners.forEach(listener => listener(result.error))
  }

  return {
    hide(target) {
      const key = hideKey(target)
      if (!pendingHides.has(key) && !actedOn.has(key)) {
        const timer = setTimeout(() => void sendHide(key), HIDE_UNDO_WINDOW_MS)
        pendingHides.set(key, { target, timer })
        publish()
      }
      return {
        undo() {
          if (takePendingHide(key)) publish()
        },
      }
    },
    hidden: () => hidden,
    sent: () => sent,
    catchUp(listed) {
      listedKeys = new Set(listed.map(hideKey))
      const caughtUp = [...actedOn].filter(key => !listedKeys.has(key))
      if (caughtUp.length === 0) return
      caughtUp.forEach(key => actedOn.delete(key))
      saveActedOn()
      publish()
    },
    dispose() {
      disposed = true
      ;[...pendingHides.keys()].forEach(takePendingHide)
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

// Logout forgets the Hides so the next listener never inherits them
export function clearHides(store: Store = localStorage): void {
  Object.values(ACTED_ON_KEYS).forEach(key => store.removeItem(key))
}
