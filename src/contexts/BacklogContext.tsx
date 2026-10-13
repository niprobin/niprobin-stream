import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCachedData } from '@/hooks/useCachedData'
import { getTrackBacklog, getAlbumBacklog } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'
import { clearHides, createHides, hideKey, HIDE_UNDO_WINDOW_MS, type HideKind, type Hides, type HideTarget } from '@/digging/hides'
import type { BacklogTrack, BacklogAlbum } from '@/types/api'

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'

// What the Album page knows about an album, which any backlog album also has
type AlbumToHide = Pick<BacklogAlbum, 'album' | 'artist' | 'deezer_id'>

const trackTarget = (t: { track: string; artist: string; deezer_id: string }): HideTarget =>
  ({ deezerId: String(t.deezer_id), title: t.track, artist: t.artist })
const albumTarget = (a: AlbumToHide): HideTarget =>
  ({ deezerId: String(a.deezer_id), title: a.album, artist: a.artist })

const NOTHING_HIDDEN: ReadonlySet<string> = new Set()

type BacklogContextValue = {
  // The backlogs without the items Hidden in this browser
  trackBacklog: BacklogTrack[]
  albumBacklog: BacklogAlbum[]
  isLoadingTracks: boolean
  isLoadingAlbums: boolean
  refreshTracks: () => void
  refreshAlbums: () => void
  markShortlisted: (deezerId: string) => void
  // Hide with a 5s Undo, see digging/hides.ts
  hideTrack: (track: BacklogTrack) => void
  hideAlbum: (album: AlbumToHide) => void
}

const BacklogContext = createContext<BacklogContextValue>({
  trackBacklog: [],
  albumBacklog: [],
  isLoadingTracks: false,
  isLoadingAlbums: false,
  refreshTracks: () => {},
  refreshAlbums: () => {},
  markShortlisted: () => {},
  hideTrack: () => {},
  hideAlbum: () => {},
})

export function BacklogProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const [trackRefreshTrigger, setTrackRefreshTrigger] = useState(0)
  const [albumRefreshTrigger, setAlbumRefreshTrigger] = useState(0)

  const { data: rawTracks, isLoading: isLoadingTracks, refresh: clearTracksCache } =
    useCachedData<BacklogTrack[]>(
      TRACKS_CACHE_KEY,
      () => getTrackBacklog(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: trackRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: "Couldn't load the Track Backlog",
      }
    )

  const { data: rawAlbums, isLoading: isLoadingAlbums, refresh: clearAlbumsCache, mutate: mutateAlbums } =
    useCachedData<BacklogAlbum[]>(
      ALBUMS_CACHE_KEY,
      () => getAlbumBacklog(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: albumRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: "Couldn't load the Album Backlog",
      }
    )

  const refreshTracks = () => {
    clearTracksCache()
    setTrackRefreshTrigger(n => n + 1)
  }

  const refreshAlbums = () => {
    clearAlbumsCache()
    setAlbumRefreshTrigger(n => n + 1)
  }

  // Reflect a successful shortlist locally so "Listen to" updates without a refetch
  const markShortlisted = (deezerId: string) => {
    mutateAlbums(albums => albums?.map(a =>
      String(a.deezer_id) === deezerId ? { ...a, saved: true } : a
    ) ?? albums)
  }

  // The Hides of the signed-in session
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])
  const [hides, setHides] = useState<Record<HideKind, Hides> | null>(null)
  const [hidden, setHidden] = useState<Record<HideKind, ReadonlySet<string>>>({ track: NOTHING_HIDDEN, album: NOTHING_HIDDEN })
  const [sentTrackHides, setSentTrackHides] = useState<ReadonlySet<string>>(NOTHING_HIDDEN)
  const wasAuthenticated = useRef(isAuthenticated)

  useEffect(() => {
    // Logout forgets the Hides so the next listener never inherits them
    if (wasAuthenticated.current && !isAuthenticated) clearHides()
    wasAuthenticated.current = isAuthenticated
    if (!isAuthenticated) return

    const getToken = () => tokenRef.current
    const session = { track: createHides({ kind: 'track', getToken }), album: createHides({ kind: 'album', getToken }) }
    const readHidden = () => {
      setHidden({ track: session.track.hidden(), album: session.album.hidden() })
      setSentTrackHides(session.track.sent())
    }
    const unsubscribe = Object.values(session).flatMap(h => [
      h.subscribe(readHidden),
      h.onError(message => showNotification(message, 'error')),
    ])
    readHidden()
    setHides(session)
    return () => {
      unsubscribe.forEach(u => u())
      Object.values(session).forEach(h => h.dispose())
      setHides(null)
      setHidden({ track: NOTHING_HIDDEN, album: NOTHING_HIDDEN })
      setSentTrackHides(NOTHING_HIDDEN)
    }
  }, [isAuthenticated, showNotification])

  // The server has caught up with sent Hides on items its backlog no longer lists
  useEffect(() => {
    if (hides && rawTracks) hides.track.catchUp(rawTracks.map(trackTarget))
  }, [hides, rawTracks])
  useEffect(() => {
    if (hides && rawAlbums) hides.album.catchUp(rawAlbums.map(albumTarget))
  }, [hides, rawAlbums])

  const hide = useCallback((kind: HideKind, target: HideTarget) => {
    if (!hides) return
    const { undo } = hides[kind].hide(target)
    showNotification(kind === 'track' ? 'Track hidden' : 'Album hidden', 'info', {
      action: { label: 'Undo', onClick: undo },
      durationMs: HIDE_UNDO_WINDOW_MS,
    })
  }, [hides, showNotification])

  const trackBacklog = useMemo(
    () => (rawTracks ?? []).filter(t => !hidden.track.has(hideKey(trackTarget(t)))),
    [rawTracks, hidden.track],
  )
  const albumBacklog = useMemo(
    () => (rawAlbums ?? []).filter(a => !hidden.album.has(hideKey(albumTarget(a)))),
    [rawAlbums, hidden.album],
  )

  return (
    <BacklogContext.Provider value={{
      trackBacklog,
      albumBacklog,
      isLoadingTracks,
      isLoadingAlbums,
      refreshTracks,
      refreshAlbums,
      markShortlisted,
      hideTrack: track => hide('track', trackTarget(track)),
      hideAlbum: album => hide('album', albumTarget(album)),
    }}>
      <HiddenTracksLeaveQueue sent={sentTrackHides} />
      {children}
    </BacklogContext.Provider>
  )
}

// Tracks leave the queue once their Hide is sent (an undone one stays), without
// interrupting the playing one. Its own component so playback updates re-render
// it alone, not every useBacklog consumer.
function HiddenTracksLeaveQueue({ sent }: { sent: ReadonlySet<string> }) {
  const { removeFromQueue } = useAudio()
  useEffect(() => {
    if (sent.size > 0) removeFromQueue(t => sent.has(hideKey(trackTarget(t))))
  }, [sent, removeFromQueue])
  return null
}

export const useBacklog = () => useContext(BacklogContext)
