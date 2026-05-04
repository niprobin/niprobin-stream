import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { Loader2, Heart, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLikeModal } from '@/hooks/useLikeModal'
import { useAuth } from '@/contexts/AuthContext'
import type { FormEvent } from 'react'

type BaseTrack = {
  id: string
  title: string
  artist: string
  album?: string
  cover?: string
  date?: string
  deezer_id?: string
}

type AlbumListProps = {
  variant: 'album'
  tracks: AlbumTrackItem[]
  onSelect: (track: AlbumTrackItem, trackIndex: number) => void
  renderIndicator?: (track: AlbumTrackItem) => React.ReactNode
  renderAction?: (track: AlbumTrackItem) => React.ReactNode
  loadingTrackId?: string | null
  enableLikeButtons?: boolean
  onLikeTrack?: (track: AlbumTrackItem) => void
  currentTrackId?: string | null
  isPlaying?: boolean
  isAuthenticated?: boolean
  autoPlayContext?: {
    contextName: string  // e.g., "Discovery Tracks - Page 1", "Search Results"
  }
  compactSpacing?: boolean
  showColumnHeaders?: boolean
}

type SearchListProps = {
  variant: 'search'
  tracks: (BaseTrack & { cover: string; album: string })[]
  loadingTrackId?: string | null
  onSelect: (track: BaseTrack & { cover: string; album: string }, trackIndex: number) => void
  autoPlayContext?: {
    contextName: string  // e.g., "Discovery Tracks - Page 1", "Search Results"
  }
  compactSpacing?: boolean
  showColumnHeaders?: boolean
}

type TrackListProps = (AlbumListProps | SearchListProps)


export function TrackList(props: TrackListProps) {
  const isAlbumVariant = props.variant === 'album'
  const data = props.tracks
  const compactSpacing = props.compactSpacing || false
  const showColumnHeaders = props.showColumnHeaders !== false // Default true unless explicitly false
  const { token } = useAuth()

  const {
    isLikeModalOpen,
    likeModalTrack,
    selectedPlaylist,
    isSubmittingLike,
    PLAYLISTS,
    isTrackLiked,
    openLikeModal,
    closeLikeModal,
    handleSubmitLike: handleModalSubmit,
    setSelectedPlaylist,
  } = useLikeModal(token)

  // Wrapper to handle parent callback after successful like
  const handleSubmitLike = async (event: FormEvent) => {
    const result = await handleModalSubmit(event)

    // Call the parent's like handler if provided and like was successful
    if (result?.success && isAlbumVariant && props.onLikeTrack && likeModalTrack) {
      const track = data.find(t => (t as AlbumTrackItem).deezer_id === likeModalTrack.id)
      if (track) props.onLikeTrack(track as AlbumTrackItem)
    }
  }

  // Grid column template: improved spacing for date and action columns
  const gridCols = 'grid-cols-[44px_1fr_120px_72px]'
  const horizontalPadding = compactSpacing ? 'px-4' : 'px-6 lg:px-10'

  return (
    <>
    {showColumnHeaders && (
      <div className={`grid ${gridCols} ${horizontalPadding} py-3 border-b border-white/5`}>
        <span className="text-xs uppercase tracking-wider text-white/20">#</span>
        <span className="text-xs uppercase tracking-wider text-white/20">Title</span>
        <span className="text-xs uppercase tracking-wider text-white/20 text-center px-2">Date</span>
        <span></span>
      </div>
    )}
    <div className="overflow-hidden">
      {data.map((track, index) => {
        const key = isAlbumVariant
          ? `${(track as AlbumTrackItem).deezer_id}-${index}`
          : `${(track as BaseTrack).id}-${index}`

        if (isAlbumVariant) {
          const item = track as AlbumTrackItem
          const trackId = item.deezer_id
          const loading = props.loadingTrackId === trackId
          const isCurrentTrack = props.currentTrackId === trackId
          const liked = isTrackLiked(item.track, item.artist)

          return (
            <div
              key={key}
              className={`grid ${gridCols} items-center ${horizontalPadding} h-14 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group`}
              onClick={() => props.onSelect(item, index)}
            >
              {/* Track Number / Play Button Column */}
              <div className="relative">
                <span className={`text-sm font-normal text-center transition-colors group-hover:hidden ${
                  isCurrentTrack ? 'text-white' : 'text-white/20'
                }`}>
                  {item['track-number']}
                </span>
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-white/50 fill-current" />
                  )}
                </div>
              </div>

              {/* Title / Artist Column */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="text-sm font-normal text-white truncate">{item.track}</div>
                <div className="text-xs text-white/30 font-light truncate">{item.artist}</div>
              </div>

              {/* Date Column */}
              <div className="text-xs text-white/40 text-center px-2">
                {item.date || ''}
              </div>

              {/* Action Buttons Column */}
              <div className="flex items-center justify-end gap-2">
                {props.renderAction?.(item)}
                {props.enableLikeButtons && props.isAuthenticated && (
                  <button
                    type="button"
                    className={`transition-all opacity-0 group-hover:opacity-100 ${
                      liked ? 'text-red-400 opacity-100' : 'text-white/25'
                    } hover:text-red-400`}
                    onClick={(event) => {
                      event.stopPropagation()
                      openLikeModal(trackId, item.track, item.artist, undefined, 'deezer_id' in item ? item.deezer_id : undefined)
                    }}
                    aria-pressed={liked}
                  >
                    <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          )
        }

        // Search variant - now using grid layout with track numbers
        const obj = track as BaseTrack & { cover: string; album: string }
        const loading = props.loadingTrackId === obj.id
        const trackNumber = index + 1

        return (
          <div
            key={key}
            className={`grid ${gridCols} items-center ${horizontalPadding} h-14 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group`}
            onClick={() => props.onSelect(obj, index)}
          >
            {/* Track Number / Play Button Column */}
            <div className="relative">
              <span className="text-sm font-normal text-center transition-colors group-hover:hidden text-white/20">
                {trackNumber}
              </span>
              <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-white/50 fill-current" />
                )}
              </div>
            </div>

            {/* Title / Artist / Album Column */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="text-sm font-normal text-white truncate">{obj.title}</div>
              <div className="text-xs text-white/30 font-light truncate">
                {obj.artist} • {obj.album}
              </div>
            </div>

            {/* Date Column */}
            <div className="text-xs text-white/40 text-center px-2">
              {obj.date || ''}
            </div>

            {/* Action Column (empty for search - no actions needed) */}
            <div></div>
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
