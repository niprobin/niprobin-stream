import { useEffect, useState, type FormEvent } from 'react'
import { MESSAGES } from '@/api/actionMessages'
import { pick } from '@/digging/actions'
import { useNotification } from '@/contexts/NotificationContext'
import { useBacklog } from '@/contexts/BacklogContext'

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
  const { pickedPlaylist, recordPick } = useBacklog()

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

  // Whether the track is Picked, on any device
  const isTrackPicked = (title?: string, artist?: string, deezer_id?: string) => {
    if (!title || !artist) return false
    return pickedPlaylist({ title, artist, deezer_id }) !== null
  }

  // The Radio Playlist the open track is already Picked for: the drawer checks it
  // and can't choose it again; another one moves the track
  const pickedFor = pickModalTrack
    ? pickedPlaylist({ title: pickModalTrack.title, artist: pickModalTrack.artist, deezer_id: pickModalTrack.deezer_id })
    : null

  // Open modal with track information
  const openPickModal = (id: string, title: string, artist: string, spotifyId?: string, deezer_id?: string) => {
    const current = pickedPlaylist({ title, artist, deezer_id })
    setPickModalTrack({ id, title, artist, spotifyId, deezer_id })
    setSelectedPlaylist(RADIO_PLAYLISTS.find(playlist => playlist !== current) ?? RADIO_PLAYLISTS[0])
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
    if (!pickModalTrack || !selectedPlaylist || selectedPlaylist === pickedFor) return
    const wasPicked = pickedFor !== null

    setIsSubmittingPick(true)
    try {
      const result = await pick(pickModalTrack, selectedPlaylist, token)

      if (result.ok) {
        const newTrack = {
          title: pickModalTrack.title,
          artist: pickModalTrack.artist,
          playlist: selectedPlaylist
        }
        recordPick({ ...newTrack, deezer_id: pickModalTrack.deezer_id }, selectedPlaylist)

        showNotification(wasPicked ? MESSAGES.moved(selectedPlaylist) : MESSAGES.picked(selectedPlaylist), 'success')

        return { success: true, track: newTrack }
      }
      showNotification(result.error, 'error')
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
    pickedFor,

    // Functions
    isTrackPicked,
    openPickModal,
    closePickModal,
    handleSubmitPick,
    setSelectedPlaylist,
  }
}