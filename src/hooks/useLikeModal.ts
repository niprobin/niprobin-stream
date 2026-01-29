import { useState, type FormEvent } from 'react'
import { likeTrack } from '@/services/api'
import { useNotification } from '@/contexts/NotificationContext'

const PLAYLISTS = [
  'Afrobeat & Highlife',
  'Beats',
  'Bossa Nova',
  'Brazilian Music',
  'Disco Dancefloor',
  'DNB',
  'Downtempo Trip-hop',
  'Funk & Rock',
  'Hip-hop',
  'House Chill',
  'House Dancefloor',
  'Jazz Classic',
  'Jazz Funk',
  'Latin Music',
  'Morning Chill',
  'Neo Soul',
  'Reggae',
  'RNB Mood',
  'Soul Oldies',
] as const

type LikeModalTrack = {
  id: string
  title: string
  artist: string
  spotifyId?: string
}

export function useLikeModal() {
  const { showNotification } = useNotification()

  const [isLikeModalOpen, setIsLikeModalOpen] = useState(false)
  const [likeModalTrack, setLikeModalTrack] = useState<LikeModalTrack | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>(PLAYLISTS[0])
  const [isSubmittingLike, setIsSubmittingLike] = useState(false)

  // Helper function to check if track is liked
  const isTrackLiked = (title?: string, artist?: string) => {
    if (!title || !artist) return false
    const likedTracks = JSON.parse(localStorage.getItem('likedTracks') || '[]')
    return likedTracks.some((track: any) => track.title === title && track.artist === artist)
  }

  // Open modal with track information
  const openLikeModal = (id: string, title: string, artist: string, spotifyId?: string) => {
    setLikeModalTrack({ id, title, artist, spotifyId })
    setSelectedPlaylist(PLAYLISTS[0])
    setIsLikeModalOpen(true)
  }

  // Close modal and reset state
  const closeLikeModal = () => {
    setIsLikeModalOpen(false)
    setLikeModalTrack(null)
    setSelectedPlaylist(PLAYLISTS[0])
    setIsSubmittingLike(false)
  }

  // Handle form submission
  const handleSubmitLike = async (event: FormEvent) => {
    event.preventDefault()
    if (!likeModalTrack || !selectedPlaylist) return

    setIsSubmittingLike(true)
    try {
      const result = await likeTrack({
        track: likeModalTrack.title,
        artist: likeModalTrack.artist,
        playlist: selectedPlaylist,
        'spotify-id': likeModalTrack.spotifyId || ''
      })

      if (result.status === 'success') {
        // Update localStorage
        const likedTracks = JSON.parse(localStorage.getItem('likedTracks') || '[]')
        const newTrack = {
          title: likeModalTrack.title,
          artist: likeModalTrack.artist,
          playlist: selectedPlaylist
        }
        const updatedTracks = [...likedTracks, newTrack]
        localStorage.setItem('likedTracks', JSON.stringify(updatedTracks))

        showNotification(`Added "${likeModalTrack.title}" to ${selectedPlaylist}`, 'success')

        return { success: true, track: newTrack }
      } else if (result.status === 'error') {
        showNotification(result.message || 'Failed to add track to playlist', 'error')
        return { success: false }
      }
    } catch (error) {
      showNotification('Failed to add track to playlist', 'error')
      return { success: false }
    } finally {
      closeLikeModal()
    }
  }

  return {
    // State
    isLikeModalOpen,
    likeModalTrack,
    selectedPlaylist,
    isSubmittingLike,
    PLAYLISTS,

    // Functions
    isTrackLiked,
    openLikeModal,
    closeLikeModal,
    handleSubmitLike,
    setSelectedPlaylist,
  }
}