import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { Loader2, Heart, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLikeModal } from '@/hooks/useLikeModal'
import type { FormEvent } from 'react'

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
  albumRedesign?: boolean
}

type SearchListProps = {
  variant: 'search'
  tracks: (BaseTrack & { cover: string; album: string })[]
  loadingTrackId?: string | null
  onSelect: (track: BaseTrack & { cover: string; album: string }, trackIndex: number) => void
  autoPlayContext?: {
    contextName: string  // e.g., "Discovery Tracks - Page 1", "Search Results"
  }
}

type TrackListProps = (AlbumListProps | SearchListProps)

export function TrackList(props: TrackListProps) {
  const isAlbumVariant = props.variant === 'album'
  const useRedesignLayout = isAlbumVariant && props.albumRedesign
  const data = props.tracks

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
  } = useLikeModal()

  // Wrapper to handle parent callback after successful like
  const handleSubmitLike = async (event: FormEvent) => {
    const result = await handleModalSubmit(event)

    // Call the parent's like handler if provided and like was successful
    if (result?.success && isAlbumVariant && props.onLikeTrack && likeModalTrack) {
      const track = data.find(t => (t as AlbumTrackItem)['track-id'].toString() === likeModalTrack.id)
      if (track) props.onLikeTrack(track as AlbumTrackItem)
    }
  }

  const baseClasses = 'divide-y divide-slate-800 border border-slate-800 overflow-hidden'
  const containerClasses = useRedesignLayout
    ? 'overflow-hidden'
    : isAlbumVariant
    ? `${baseClasses} bg-slate-900/50 shadow-sm`
    : `${baseClasses} bg-slate-900/60 shadow-lg`

  return (
    <>
    {useRedesignLayout && (
      <div className="grid grid-cols-[44px_1fr_36px] px-6 lg:px-10 py-3 border-b border-white/5">
        <span className="text-xs uppercase tracking-wider text-white/20">#</span>
        <span className="text-xs uppercase tracking-wider text-white/20">Title</span>
        <span></span>
      </div>
    )}
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

          if (useRedesignLayout) {
            return (
              <div
                key={key}
                className="grid grid-cols-[44px_1fr_36px] items-center px-6 lg:px-10 h-14 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                onClick={() => props.onSelect(item, index)}
              >
                <span className={`text-sm font-normal text-center transition-colors group-hover:hidden ${
                  isCurrentTrack ? 'text-white' : 'text-white/20'
                }`}>
                  {item['track-number']}
                </span>
                <div className="hidden group-hover:flex items-center justify-center w-11">
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/50" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-white/50 fill-current" />
                  )}
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-sm font-normal text-white truncate">{item.track}</div>
                  <div className="text-xs text-white/30 font-light truncate">{item.artist}</div>
                </div>

                <div className="flex items-center justify-center">
                  {props.enableLikeButtons && props.isAuthenticated && (
                    <button
                      type="button"
                      className={`transition-all opacity-0 group-hover:opacity-100 ${
                        liked ? 'text-red-400 opacity-100' : 'text-white/25'
                      } hover:text-red-400`}
                      onClick={(event) => {
                        event.stopPropagation()
                        openLikeModal(trackId, item.track, item.artist)
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

          return (
            <div
              key={key}
              className={`hover:bg-black/40 flex items-center gap-2 p-2 cursor-pointer transition-colors group`}
            >
              <div className={`text-xs font-medium w-6 text-center transition-colors ${
                isCurrentTrack ? 'text-white' : 'text-slate-500'
              }`}>
                {item['track-number']}
              </div>
              <div
                className="flex-1 min-w-0"
                onClick={() => props.onSelect(item, index)}
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
            onClick={() => props.onSelect(obj, index)}
            className="flex flex-col p-3 hover:bg-black/40 cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white font-semibold truncate">{obj.title}</div>
              <div className="text-slate-400 text-xs truncate">{obj.artist}</div>
              <div className="text-slate-500 text-xs truncate">{obj.album}</div>
            </div>
            {loading && (
              <div className="flex items-center text-slate-400 text-xs mt-2">
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
