import { getAlbumTracks } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'

export type AlbumLoaderOptions = {
  expand?: boolean
  loadFirst?: boolean
}

/**
 * Hook for loading album tracks from any source
 * Handles loading state, error notifications, and populating the player with album context
 */
export function useAlbumLoader() {
  const { setAlbumContext } = useAudio()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()

  const loadAlbum = async (
    albumId: number,
    albumName: string,
    artistName: string,
    coverUrl?: string,
    options: AlbumLoaderOptions = { expand: false, loadFirst: true }
  ) => {
    increment()

    try {
      // Fetch album tracks
      const tracks = await getAlbumTracks(albumId, albumName, artistName)

      // Populate the player with album context (doesn't auto-play unless configured)
      setAlbumContext(
        tracks,
        {
          name: albumName,
          artist: artistName,
          cover: coverUrl || '',
        },
        options
      )
    } catch (err) {
      console.error('Failed to load album tracks:', err)
      showNotification('Failed to load album tracks. Please try again.', 'error')
    } finally {
      decrement()
    }
  }

  return {
    loadAlbum,
  }
}
