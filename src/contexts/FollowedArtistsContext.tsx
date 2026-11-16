import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { MESSAGES } from '@/api/actionMessages'
import type { ArtistRef } from '@/digging/follows'
import {
  createFollowedArtists,
  UNFOLLOW_UNDO_WINDOW_MS,
  type FollowedArtists,
  type FollowedArtistsState,
} from '@/digging/followedArtists'

// The Followed artists for the Artists page and the Sidebar count, with
// Unfollow and its 5s Undo (rules in digging/followedArtists.ts)

type FollowedArtistsContextValue = FollowedArtistsState & {
  reload: () => void
  unfollow: (artist: ArtistRef) => void
}

const EMPTY: FollowedArtistsState = { artists: null, isLoading: false, loadFailed: false }
const noSubscription = () => () => {}

const FollowedArtistsContext = createContext<FollowedArtistsContextValue>({
  ...EMPTY,
  reload: () => {},
  unfollow: () => {},
})

export function FollowedArtistsProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const tokenRef = useRef(token)
  useEffect(() => {
    tokenRef.current = token
  }, [token])
  const [store, setStore] = useState<FollowedArtists | null>(null)

  // One list per session: logout cancels the Unfollows still waiting
  useEffect(() => {
    if (!isAuthenticated) return
    const session = createFollowedArtists({ getToken: () => tokenRef.current })
    const stopErrors = session.onError(message => showNotification(message, 'error'))
    setStore(session)
    void session.load()
    return () => {
      stopErrors()
      session.dispose()
      setStore(null)
    }
  }, [isAuthenticated, showNotification])

  const state = useSyncExternalStore(store?.subscribe ?? noSubscription, () => store?.getState() ?? EMPTY)

  const reload = useCallback(() => {
    void store?.load()
  }, [store])

  const unfollow = useCallback(
    (artist: ArtistRef) => {
      if (!store) return
      const { undo } = store.unfollow(artist)
      showNotification(MESSAGES.unfollowed(artist.name), 'info', {
        action: { label: 'Undo', onClick: undo },
        durationMs: UNFOLLOW_UNDO_WINDOW_MS,
      })
    },
    [store, showNotification],
  )

  return (
    <FollowedArtistsContext.Provider value={{ ...state, reload, unfollow }}>
      {children}
    </FollowedArtistsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFollowedArtists() {
  return useContext(FollowedArtistsContext)
}
