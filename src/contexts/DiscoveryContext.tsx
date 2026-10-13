import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useCachedData } from '@/hooks/useCachedData'
import { getTracksToDiscover, getAlbumsToDiscover } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'
import { clearHides, createHides, hideKey, HIDE_UNDO_WINDOW_MS, type HideKind, type Hides, type HideTarget } from '@/digging/hides'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'

// What the Album page knows about an album, which any backlog album also has
type AlbumToHide = Pick<DiscoverAlbum, 'album' | 'artist' | 'deezer_id'>

const trackTarget = (t: { track: string; artist: string; deezer_id: string }): HideTarget =>
  ({ deezerId: String(t.deezer_id), title: t.track, artist: t.artist })
const albumTarget = (a: AlbumToHide): HideTarget =>
  ({ deezerId: String(a.deezer_id), title: a.album, artist: a.artist })

const NOTHING_HIDDEN: ReadonlySet<string> = new Set()

type DiscoveryContextValue = {
  // The backlogs without the items Hidden in this browser
  discoverTracks: DiscoverTrack[]
  discoverAlbums: DiscoverAlbum[]
  isLoadingTracks: boolean
  isLoadingAlbums: boolean
  refreshTracks: () => void
  refreshAlbums: () => void
  markAlbumSaved: (deezerId: string) => void
  // Hide with a 5s Undo, see digging/hides.ts
  hideTrack: (track: DiscoverTrack) => void
  hideAlbum: (album: AlbumToHide) => void
}

const DiscoveryContext = createContext<DiscoveryContextValue>({
  discoverTracks: [],
  discoverAlbums: [],
  isLoadingTracks: false,
  isLoadingAlbums: false,
  refreshTracks: () => {},
  refreshAlbums: () => {},
  markAlbumSaved: () => {},
  hideTrack: () => {},
  hideAlbum: () => {},
})

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const [trackRefreshTrigger, setTrackRefreshTrigger] = useState(0)
  const [albumRefreshTrigger, setAlbumRefreshTrigger] = useState(0)

  const { data: rawTracks, isLoading: isLoadingTracks, refresh: clearTracksCache } =
    useCachedData<DiscoverTrack[]>(
      TRACKS_CACHE_KEY,
      () => getTracksToDiscover(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: trackRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: 'Failed to load discovery tracks.',
      }
    )

  const { data: rawAlbums, isLoading: isLoadingAlbums, refresh: clearAlbumsCache, mutate: mutateAlbums } =
    useCachedData<DiscoverAlbum[]>(
      ALBUMS_CACHE_KEY,
      () => getAlbumsToDiscover(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: albumRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: 'Failed to load discovery albums.',
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
  const markAlbumSaved = (deezerId: string) => {
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

  const discoverTracks = useMemo(
    () => (rawTracks ?? []).filter(t => !hidden.track.has(hideKey(trackTarget(t)))),
    [rawTracks, hidden.track],
  )
  const discoverAlbums = useMemo(
    () => (rawAlbums ?? []).filter(a => !hidden.album.has(hideKey(albumTarget(a)))),
    [rawAlbums, hidden.album],
  )

  return (
    <DiscoveryContext.Provider value={{
      discoverTracks,
      discoverAlbums,
      isLoadingTracks,
      isLoadingAlbums,
      refreshTracks,
      refreshAlbums,
      markAlbumSaved,
      hideTrack: track => hide('track', trackTarget(track)),
      hideAlbum: album => hide('album', albumTarget(album)),
    }}>
      <HiddenTracksLeaveQueue sent={sentTrackHides} />
      {children}
    </DiscoveryContext.Provider>
  )
}

// Tracks leave the queue once their Hide is sent (an undone one stays), without
// interrupting the playing one. Its own component so playback updates re-render
// it alone, not every useDiscovery consumer.
function HiddenTracksLeaveQueue({ sent }: { sent: ReadonlySet<string> }) {
  const { removeFromQueue } = useAudio()
  useEffect(() => {
    if (sent.size > 0) removeFromQueue(t => sent.has(hideKey(trackTarget(t))))
  }, [sent, removeFromQueue])
  return null
}

export const useDiscovery = () => useContext(DiscoveryContext)
