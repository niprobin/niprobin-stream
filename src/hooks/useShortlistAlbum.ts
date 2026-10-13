import { useState } from 'react'
import { shortlistAlbum, type BacklogAlbum } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useBacklog } from '@/contexts/BacklogContext'
import { isShortlisted } from '@/utils/albumUtils'

/**
 * Shortlist an Album Backlog album from a card (Backlog grid, Home carousel).
 * On success the album is marked shortlisted locally, which moves it from the
 * Backlog to "Listen to" without refetching.
 */
export function useShortlistAlbum() {
  const { token } = useAuth()
  const { showNotification } = useNotification()
  const { markShortlisted } = useBacklog()
  const [shortlistingIds, setShortlistingIds] = useState<Set<string>>(new Set())

  const shortlist = async (album: BacklogAlbum, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const id = String(album.deezer_id)
    if (shortlistingIds.has(id) || isShortlisted(album)) return

    setShortlistingIds(prev => new Set(prev).add(id))
    try {
      const response = await shortlistAlbum({ album_id: id, saved: true }, token)
      showNotification(response.message, response.status)
      if (response.status === 'success') markShortlisted(id)
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

  const isShortlisting = (album: BacklogAlbum) => shortlistingIds.has(String(album.deezer_id))

  return { shortlist, isShortlisting }
}
