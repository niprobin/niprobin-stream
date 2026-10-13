import { useEffect, useState, type FormEvent } from 'react'
import { pickTrack } from '@/services/api'
import { useNotification } from '@/contexts/NotificationContext'
import { STORAGE_KEYS } from '@/utils/storageKeys'

const RADIO_PLAYLISTS = [
  'Beats',
  'Bossa Nova',
  'Disco Dancefloor',
  'DNB',
  'Downtempo Trip-hop',
  'Funk & Rock',
  'Global Grooves',
  'Hip-hop',
  'House Chill',
  'House Dancefloor',
  'Jazz Classic',
  'Jazz Funk',
  'Morning Chill',
  'Neo Soul',
  'Reggae',
  'RNB Mood',
  'Soul Oldies',
] as const

type PickModalTrack = {
  id: string
  title: string
  artist: string
  spotifyId?: string
  deezer_id?: string
}

export function usePickModal(token: string | null) {
  const { showNotification } = useNotification()

  const [isPickModalOpen, setIsPickModalOpen] = useState(false)
  const [pickModalTrack, setPickModalTrack] = useState<PickModalTrack | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>(RADIO_PLAYLISTS[0])
  const [isSubmittingPick, setIsSubmittingPick] = useState(false)

  // Lock background scroll while the modal is open
  useEffect(() => {
    if (!isPickModalOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isPickModalOpen])

  // Helper function to check if track is picked
  const isTrackPicked = (title?: string, artist?: string) => {
    if (!title || !artist) return false
    const pickedTracks = JSON.parse(localStorage.getItem(STORAGE_KEYS.PICKED_TRACKS) || '[]')
    return pickedTracks.some((track: any) => track.title === title && track.artist === artist)
  }

  // Open modal with track information
  const openPickModal = (id: string, title: string, artist: string, spotifyId?: string, deezer_id?: string) => {
    setPickModalTrack({ id, title, artist, spotifyId, deezer_id })
    setSelectedPlaylist(RADIO_PLAYLISTS[0])
    setIsPickModalOpen(true)
  }

  // Close modal and reset state
  const closePickModal = () => {
    setIsPickModalOpen(false)
    setPickModalTrack(null)
    setSelectedPlaylist(RADIO_PLAYLISTS[0])
    setIsSubmittingPick(false)
  }

  // Handle form submission
  const handleSubmitPick = async (event: FormEvent) => {
    event.preventDefault()
    if (!pickModalTrack || !selectedPlaylist) return

    setIsSubmittingPick(true)
    try {
      const result = await pickTrack({
        track: pickModalTrack.title,
        artist: pickModalTrack.artist,
        playlist: selectedPlaylist,
        'spotify-id': pickModalTrack.spotifyId || '',
        deezer_id: pickModalTrack.deezer_id
      }, token)

      if (result.status === 'success') {
        // Update localStorage
        const pickedTracks = JSON.parse(localStorage.getItem(STORAGE_KEYS.PICKED_TRACKS) || '[]')
        const newTrack = {
          title: pickModalTrack.title,
          artist: pickModalTrack.artist,
          playlist: selectedPlaylist
        }
        const updatedTracks = [...pickedTracks, newTrack]
        localStorage.setItem(STORAGE_KEYS.PICKED_TRACKS, JSON.stringify(updatedTracks))

        showNotification(`Picked "${pickModalTrack.title}" for ${selectedPlaylist}`, 'success')

        return { success: true, track: newTrack }
      } else if (result.status === 'error') {
        showNotification(result.message || "Couldn't Pick this track", 'error')
        return { success: false }
      }
    } catch (error) {
      showNotification("Couldn't Pick this track", 'error')
      return { success: false }
    } finally {
      closePickModal()
    }
  }

  return {
    // State
    isPickModalOpen,
    pickModalTrack,
    selectedPlaylist,
    isSubmittingPick,
    RADIO_PLAYLISTS,

    // Functions
    isTrackPicked,
    openPickModal,
    closePickModal,
    handleSubmitPick,
    setSelectedPlaylist,
  }
}