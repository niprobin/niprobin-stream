import { useState } from 'react'
import { getStreamUrl } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { normalizeTrackId, TrackIdSource } from '@/utils/trackUtils'
import { getStreamContext } from '@/utils/urlBuilder'

export type TrackPlayerOptions = {
  clearAlbum?: boolean
  albumName?: string
  coverArt?: string
  spotifyId?: string
  source?: TrackIdSource
}

/**
 * Hook for playing tracks from any source (search, albums, player tracklist)
 * Handles loading state, error notifications, and consistent playback behavior
 */
export function useTrackPlayer() {
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const { play, clearAlbumContext, loadingState, setLoadingState } = useAudio()
  const { showNotification } = useNotification()
  const { token } = useAuth()

  const playTrack = async (
    trackId: number | string,
    trackName: string,
    artistName: string,
    options: TrackPlayerOptions = {}
  ) => {
    const {
      clearAlbum = false,
      albumName,
      coverArt,
      spotifyId,
      source = TrackIdSource.Album, // Default to album for backward compatibility
    } = options

    // Normalize track ID for consistent webhook calls
    const normalizedTrackId = normalizeTrackId(trackId, trackName, artistName, source)
    const loadingKey = String(normalizedTrackId)
    setLoadingTrackId(loadingKey)

    // Set loading state for API fetch
    setLoadingState({ status: 'fetching-stream', trackId: loadingKey })

    try {
      // Clear album context if requested (for standalone tracks)
      if (clearAlbum) {
        clearAlbumContext()
      }

      // Fetch stream URL and track metadata from backend
      const streamResponse = await getStreamUrl(
        normalizedTrackId,
        trackName,
        artistName,
        token,
        getStreamContext()
      )


      // Play the track with all metadata
      play({
        id: streamResponse.trackId,
        hashUrl: streamResponse.hashUrl,
        title: streamResponse.track,
        artist: streamResponse.artist,
        album: streamResponse.album || albumName,
        albumId: streamResponse['album-id'],
        streamUrl: streamResponse.streamUrl,
        coverArt: coverArt || streamResponse.cover,
        spotifyId,
      })

      // API fetch completed - loading state will be managed by AudioContext
    } catch (err) {
      console.error('Failed to load track:', err)
      showNotification('Failed to load track. Please try again.', 'error')
      setLoadingState({ status: 'idle' })
    } finally {
      setLoadingTrackId(null)
    }
  }

  return {
    playTrack,
    loadingTrackId,  // Existing string | null for backward compatibility
    loadingState,    // New: full loading state from AudioContext
    isLoading: loadingState.status !== 'idle',  // New: convenient boolean
  }
}
