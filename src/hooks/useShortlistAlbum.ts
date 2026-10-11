import { useState } from 'react'
import { shortlistAlbum, type DiscoverAlbum } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { isAlbumSaved } from '@/utils/albumUtils'

/**
 * Shortlist a discovery album from a card (Backlog grid, Home carousel).
 * On success the album is marked saved locally, which moves it from the
 * Backlog to "Listen to" without refetching.
 */
export function useShortlistAlbum() {
  const { token } = useAuth()
  const { showNotification } = useNotification()
  const { markAlbumSaved } = useDiscovery()
  const [shortlistingIds, setShortlistingIds] = useState<Set<string>>(new Set())

  const shortlist = async (album: DiscoverAlbum, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const id = String(album.deezer_id)
    if (shortlistingIds.has(id) || isAlbumSaved(album)) return

    setShortlistingIds(prev => new Set(prev).add(id))
    try {
      const response = await shortlistAlbum({ album_id: id, saved: true }, token)
      showNotification(response.message, response.status)
      if (response.status === 'success') markAlbumSaved(id)
    } catch (err) {
      console.error('Failed to shortlist album:', err)
      showNotification('Failed to shortlist album', 'error')
    } finally {
      setShortlistingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const isShortlisting = (album: DiscoverAlbum) => shortlistingIds.has(String(album.deezer_id))

  return { shortlist, isShortlisting }
}
