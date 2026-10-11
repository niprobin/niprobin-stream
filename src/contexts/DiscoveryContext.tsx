import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useCachedData } from '@/hooks/useCachedData'
import { getTracksToDiscover, getAlbumsToDiscover } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'

type DiscoveryContextValue = {
  discoverTracks: DiscoverTrack[]
  discoverAlbums: DiscoverAlbum[]
  isLoadingTracks: boolean
  isLoadingAlbums: boolean
  refreshTracks: () => void
  refreshAlbums: () => void
  markAlbumSaved: (deezerId: string) => void
}

const DiscoveryContext = createContext<DiscoveryContextValue>({
  discoverTracks: [],
  discoverAlbums: [],
  isLoadingTracks: false,
  isLoadingAlbums: false,
  refreshTracks: () => {},
  refreshAlbums: () => {},
  markAlbumSaved: () => {},
})

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
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

  return (
    <DiscoveryContext.Provider value={{
      discoverTracks: rawTracks ?? [],
      discoverAlbums: rawAlbums ?? [],
      isLoadingTracks,
      isLoadingAlbums,
      refreshTracks,
      refreshAlbums,
      markAlbumSaved,
    }}>
      {children}
    </DiscoveryContext.Provider>
  )
}

export const useDiscovery = () => useContext(DiscoveryContext)
