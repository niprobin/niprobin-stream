import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { Loader2, Heart, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

type BaseTrack = {
  id: string
  title: string
  artist: string
  album?: string
  cover?: string
}

type AlbumListProps = {
  variant: 'album'
  tracks: AlbumTrackItem[]
  onSelect: (track: AlbumTrackItem) => void
  renderIndicator?: (track: AlbumTrackItem) => React.ReactNode
  renderAction?: (track: AlbumTrackItem) => React.ReactNode
  loadingTrackId?: string | null
  enableLikeButtons?: boolean
  onLikeTrack?: (track: AlbumTrackItem) => void
  currentTrackId?: string | null
  isPlaying?: boolean
  isAuthenticated?: boolean
}

type SearchListProps = {
  variant: 'search'
  tracks: (BaseTrack & { cover: string; album: string })[]
  loadingTrackId?: string | null
  onSelect: (track: BaseTrack & { cover: string; album: string }) => void
}

type TrackListProps = (AlbumListProps | SearchListProps)

export function TrackList(props: TrackListProps) {
  const isAlbumVariant = props.variant === 'album'
  const data = props.tracks
  const { showNotification } = useNotification()

  // Modal state for like functionality (moved from Player)
  const [isLikeModalOpen, setIsLikeModalOpen] = useState(false)
  const [likeModalTrack, setLikeModalTrack] = useState<{ id: string; title: string; artist: string } | null>(null)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>(PLAYLISTS[0])
  const [isSubmittingLike, setIsSubmittingLike] = useState(false)

  // Helper function to check if track is liked (same logic as Player)
  const isTrackLiked = (title?: string, artist?: string) => {
    if (!title || !artist) return false
    const likedTracks = JSON.parse(localStorage.getItem('likedTracks') || '[]')
    return likedTracks.some((track: any) => track.title === title && track.artist === artist)
  }

  // Modal handlers
  const openLikeModal = (trackId: string, title: string, artist: string) => {
    setLikeModalTrack({ id: trackId, title, artist })
    setSelectedPlaylist(PLAYLISTS[0])
    setIsLikeModalOpen(true)
  }

  const closeLikeModal = () => {
    setIsLikeModalOpen(false)
    setLikeModalTrack(null)
    setSelectedPlaylist(PLAYLISTS[0])
    setIsSubmittingLike(false)
  }

  const handleSubmitLike = async (event: FormEvent) => {
    event.preventDefault()
    if (!likeModalTrack || !selectedPlaylist) return

    setIsSubmittingLike(true)
    try {
      const result = await likeTrack({
        track: likeModalTrack.title,
        artist: likeModalTrack.artist,
        album: undefined,
        discogs: undefined,
        playlist: selectedPlaylist
      })

      if (result.success) {
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

        // Call the parent's like handler if provided
        if (isAlbumVariant && props.onLikeTrack) {
          const track = data.find(t => (t as AlbumTrackItem)['track-id'].toString() === likeModalTrack.id)
          if (track) props.onLikeTrack(track as AlbumTrackItem)
        }
      } else {
        showNotification(result.message || 'Failed to add track to playlist', 'error')
      }
    } catch (error) {
      showNotification('Failed to add track to playlist', 'error')
    } finally {
      closeLikeModal()
    }
  }

  const containerClasses = isAlbumVariant
    ? 'divide-y divide-slate-800 border border-slate-800 bg-slate-900/40'
    : 'divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-lg'

  return (
    <>
    <div className={containerClasses}>
      {data.map((track, index) => {
        const key = isAlbumVariant
          ? `${(track as AlbumTrackItem)['track-id']}-${index}`
          : `${(track as BaseTrack).id}-${index}`

        if (isAlbumVariant) {
          const item = track as AlbumTrackItem
          const trackId = item['track-id'].toString()
          const loading = props.loadingTrackId === trackId
          const isCurrentTrack = props.currentTrackId === trackId
          const liked = isTrackLiked(item.track, item.artist)

          return (
            <div
              key={key}
              className={`flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer transition-colors group ${
                isCurrentTrack ? 'bg-slate-800' : ''
              }`}
            >
              <div className={`text-xs font-medium w-6 text-center group-hover:text-white transition-colors ${
                isCurrentTrack ? 'text-white' : 'text-slate-500'
              }`}>
                {item['track-number']}
              </div>
              <div
                className="flex-1 min-w-0"
                onClick={() => props.onSelect(item)}
              >
                <div className="text-sm font-medium text-white truncate">{item.track}</div>
                <div className="text-slate-400 text-xs truncate">{item.artist}</div>
              </div>
              {loading ? (
                <div className="flex items-center text-slate-400 text-xs pr-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <>
                  {isCurrentTrack && !loading && (
                    <div className="text-white text-xs pr-2">
                      {props.isPlaying ? '▶' : '❚❚'}
                    </div>
                  )}
                  {props.renderIndicator?.(item)}
                  {props.renderAction?.(item)}
                  {props.enableLikeButtons && props.isAuthenticated && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 text-slate-300 hover:text-red-400 ${
                        liked ? 'text-red-400' : ''
                      }`}
                      onClick={(event) => {
                        event.stopPropagation()
                        openLikeModal(trackId, item.track, item.artist)
                      }}
                      aria-pressed={liked}
                    >
                      <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
                    </Button>
                  )}
                </>
              )}
            </div>
          )
        }

        const obj = track as BaseTrack & { cover: string; album: string }
        const loading = props.loadingTrackId === obj.id

        return (
          <div
            key={key}
            onClick={() => props.onSelect(obj)}
            className="flex gap-3 p-3 hover:bg-slate-800/70 cursor-pointer transition-colors"
          >
            <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
              <img src={obj.cover} alt={`${obj.album} cover`} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold truncate">{obj.title}</div>
              <div className="text-slate-400 text-sm truncate">{obj.artist}</div>
              <div className="text-slate-500 text-xs truncate">{obj.album}</div>
            </div>
            {loading && (
              <div className="flex items-center text-slate-400 text-xs">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
          </div>
        )
      })}
    </div>

    {/* Like Modal (moved from Player) */}
    {isLikeModalOpen && likeModalTrack && (
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
        role="dialog"
        aria-modal="true"
      >
        <form
          onSubmit={handleSubmitLike}
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-slate-400 tracking-wide">Add to playlist</p>
              <p className="text-white text-lg font-semibold truncate">{likeModalTrack.title}</p>
              <p className="text-slate-400 text-sm truncate">{likeModalTrack.artist}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white"
              onClick={closeLikeModal}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {PLAYLISTS.map((playlist) => {
              const isSelected = selectedPlaylist === playlist
              return (
                <button
                  type="button"
                  key={playlist}
                  onClick={() => setSelectedPlaylist(playlist)}
                  className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-white bg-white/10 text-white'
                      : 'border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {playlist}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              className="text-slate-300 hover:text-white"
              onClick={closeLikeModal}
              disabled={isSubmittingLike}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-white text-black hover:bg-white/90"
              disabled={isSubmittingLike || !selectedPlaylist}
            >
              {isSubmittingLike ? 'Saving...' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    )}
  </>
  )
}
