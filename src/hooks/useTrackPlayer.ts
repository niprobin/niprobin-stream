import { useState } from 'react'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'

export type TrackPlayerOptions = {
  clearAlbum?: boolean
  albumName?: string
  coverArt?: string
  deezer_id?: string
  curator?: string
}

/**
 * Hook for playing tracks from any source (search, albums, player tracklist)
 * Handles loading state, error notifications, and consistent playback behavior.
 *
 * Delegates the actual fetch-and-play work to AudioContext's loadAndPlayTrack —
 * the same cache-aware pipeline used by Next/Previous/auto-advance — so a
 * manual click benefits from whatever the app already prefetched instead of
 * re-fetching from scratch, and there's a single place that owns "how do we
 * start a track" instead of two pipelines that can drift apart.
 */
export function useTrackPlayer() {
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const {
    loadAndPlayTrack,
    clearAlbumContext,
    loadingState,
    setLoadingState,
    beginManualLoad,
    endManualLoad,
  } = useAudio()
  const { showNotification } = useNotification()

  const playTrack = async (
    trackName: string,
    artistName: string,
    options: TrackPlayerOptions = {}
  ) => {
    const {
      clearAlbum = false,
      albumName,
      coverArt,
      deezer_id,
      curator,
    } = options

    // Use deezer_id or fallback for loading state
    const loadingKey = deezer_id || '0'
    setLoadingTrackId(loadingKey)

    // Set loading state for API fetch
    setLoadingState({ status: 'fetching-stream', trackId: loadingKey })

    // manualLoadInFlightRef guard — see AudioContext for why 'ended' must not
    // auto-advance while a manual click's own fetch is in flight.
    beginManualLoad()

    try {
      // Clear album context if requested (for standalone tracks)
      if (clearAlbum) {
        clearAlbumContext()
      }

      const result = await loadAndPlayTrack({
        item: { track: trackName, artist: artistName, deezer_id, curator },
        albumInfoForFallback: { name: albumName ?? '', artist: '', cover: coverArt ?? '' },
        useCache: true,
      })

      if (result === 'error') {
        showNotification('Failed to load track. Please try again.', 'error')
        setLoadingState({ status: 'idle' })
      }
      // 'stale' means a newer click/navigation superseded this one — that
      // request owns loadingTrackId cleanup now, so leave it alone here.
      if (result !== 'stale') {
        setLoadingTrackId(null)
      }
    } finally {
      endManualLoad()
    }
  }

  return {
    playTrack,
    loadingTrackId,  // Existing string | null for backward compatibility
    loadingState,    // New: full loading state from AudioContext
    isLoading: loadingState.status !== 'idle',  // New: convenient boolean
  }
}
