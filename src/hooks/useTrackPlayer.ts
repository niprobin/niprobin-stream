import { useState } from 'react'
import { getStreamUrl } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'

export type TrackPlayerOptions = {
  clearAlbum?: boolean
  albumName?: string
  coverArt?: string
  spotifyId?: string
}

/**
 * Hook for playing tracks from any source (search, albums, player tracklist)
 * Handles loading state, error notifications, and consistent playback behavior
 */
export function useTrackPlayer() {
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const { play, clearAlbumContext } = useAudio()
  const { showNotification } = useNotification()

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
    } = options

    // Use track ID as loading key, or fallback to track-artist combo
    const loadingKey = String(trackId)
    setLoadingTrackId(loadingKey)

    try {
      // Clear album context if requested (for standalone tracks)
      if (clearAlbum) {
        clearAlbumContext()
      }

      // Fetch stream URL and track metadata from backend
      const streamResponse = await getStreamUrl(
        typeof trackId === 'string' ? Number(trackId) || 0 : trackId,
        trackName,
        artistName
      )

      // Play the track with all metadata
      play({
        id: streamResponse.trackId,
        title: streamResponse.track,
        artist: streamResponse.artist,
        album: albumName || streamResponse.album,
        streamUrl: streamResponse.streamUrl,
        coverArt: coverArt || streamResponse.cover,
        spotifyId,
      })
    } catch (err) {
      console.error('Failed to load track:', err)
      showNotification('Failed to load track. Please try again.', 'error')
    } finally {
      setLoadingTrackId(null)
    }
  }

  return {
    playTrack,
    loadingTrackId,
  }
}
