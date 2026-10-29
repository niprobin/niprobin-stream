import { useState } from 'react'
import type { BacklogAlbum } from '@/services/api'
import { MESSAGES } from '@/api/actionMessages'
import { shortlist as sendShortlist } from '@/digging/actions'
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
      const result = await sendShortlist(id, token)
      showNotification(result.ok ? MESSAGES.shortlisted : result.error, result.ok ? 'success' : 'error')
      if (result.ok) markShortlisted(id)
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
