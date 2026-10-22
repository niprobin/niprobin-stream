import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { Loader2, Heart, Play } from 'lucide-react'
import { usePickModal } from '@/hooks/usePickModal'
import { useAuth } from '@/contexts/AuthContext'
import { PickModal } from '@/components/PickModal'
import { NowPlayingIndicator } from '@/components/ui/NowPlayingIndicator'
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
  renderAction?: (track: AlbumTrackItem) => React.ReactNode
  loadingTrackId?: string | null
  enablePickButtons?: boolean
  onPickTrack?: (track: AlbumTrackItem) => void
  // The playing track's deezer_id, and whether it's playing or paused
  currentTrackId?: string | null
  isPlaying?: boolean
  isAuthenticated?: boolean
  compactSpacing?: boolean
  showColumnHeaders?: boolean
}

type SearchListProps = {
  variant: 'search'
  tracks: (BaseTrack & { cover: string; album: string })[]
  loadingTrackId?: string | null
  onSelect: (track: BaseTrack & { cover: string; album: string }, trackIndex: number) => void
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
    isPickModalOpen,
    pickModalTrack,
    selectedPlaylist,
    isSubmittingPick,
    RADIO_PLAYLISTS,
    isTrackPicked,
    openPickModal,
    closePickModal,
    handleSubmitPick: handleModalSubmit,
    setSelectedPlaylist,
  } = usePickModal(token)

  // Wrapper to handle parent callback after a successful Pick
  const handleSubmitPick = async (event: FormEvent) => {
    const result = await handleModalSubmit(event)

    // Call the parent's Pick handler if provided and the Pick succeeded
    if (result?.success && isAlbumVariant && props.onPickTrack && pickModalTrack) {
      const track = data.find(t => (t as AlbumTrackItem).deezer_id === pickModalTrack.id)
      if (track) props.onPickTrack(track as AlbumTrackItem)
    }
  }

  // Compact mode (queue drawer) stays on the 3-column mobile grid to fit the narrow panel
  const gridCols = compactSpacing
    ? 'grid-cols-[28px_1fr_44px]'
    : 'grid-cols-[28px_1fr_44px] md:grid-cols-[32px_1fr_120px_72px]'
  const horizontalPadding = compactSpacing ? 'px-4' : 'px-6 lg:px-10'

  return (
    <>
    {showColumnHeaders && (
      <div className={`grid ${gridCols} ${horizontalPadding} py-3 border-b border-border`}>
        <span className="text-xs uppercase tracking-wider text-text-3">#</span>
        <span className="text-xs uppercase tracking-wider text-text-3">Title</span>
        <span className="hidden md:block text-xs uppercase tracking-wider text-text-3 text-center px-2">Date</span>
        <span className="hidden md:block"></span>
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
          const picked = isTrackPicked(item.track, item.artist)

          return (
            <div
              key={key}
              className={`grid ${gridCols} items-center ${horizontalPadding} h-14 border-b border-border cursor-pointer transition-colors group ${
                isCurrentTrack ? 'bg-accent/10' : 'hover:bg-bg-2/50'
              }`}
              onClick={() => props.onSelect(item, index)}
            >
              {/* Track Number / Play Button Column; the playing track shows the indicator instead */}
              {isCurrentTrack ? (
                <div className="flex items-center">
                  <NowPlayingIndicator isPlaying={!!props.isPlaying} />
                </div>
              ) : (
                <div className="relative">
                  <span className="text-xs font-normal text-center transition-colors group-hover:hidden text-text-3">
                    {item['track-number']}
                  </span>
                  <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-text-2" />
                    ) : (
                      <Play className="h-3.5 w-3.5 text-text-2 fill-current" />
                    )}
                  </div>
                </div>
              )}

              {/* Title / Artist Column */}
              <div className="flex flex-col gap-1 min-w-0">
                <div className={`text-sm truncate ${isCurrentTrack ? 'font-medium text-accent' : 'font-normal text-text-1'}`}>{item.track}</div>
                <div className="text-xs text-text-2 font-light truncate">{item.artist}</div>
              </div>

              {/* Date Column */}
              <div className={`${compactSpacing ? 'hidden' : 'hidden md:block'} text-xs text-text-3 text-center px-2`}>
                {item.date || ''}
              </div>

              {/* Action Buttons Column */}
              <div className="flex items-center justify-end gap-2">
                {props.renderAction?.(item)}
                {props.enablePickButtons && props.isAuthenticated && (
                  <button
                    type="button"
                    className={`transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 ${
                      picked ? 'text-accent' : 'text-text-3'
                    } hover:text-accent`}
                    onClick={(event) => {
                      event.stopPropagation()
                      openPickModal(trackId, item.track, item.artist, undefined, 'deezer_id' in item ? item.deezer_id : undefined)
                    }}
                    aria-pressed={picked}
                  >
                    <Heart className="h-4 w-4" fill={picked ? 'currentColor' : 'none'} />
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
            className={`grid ${gridCols} items-center ${horizontalPadding} h-14 border-b border-border hover:bg-bg-2/50 cursor-pointer transition-colors group`}
            onClick={() => props.onSelect(obj, index)}
          >
            {/* Track Number / Play Button Column */}
            <div className="relative">
              <span className="text-sm font-normal text-center transition-colors group-hover:hidden text-text-3">
                {trackNumber}
              </span>
              <div className="absolute inset-0 hidden group-hover:flex items-center justify-center">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-text-2" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-text-2 fill-current" />
                )}
              </div>
            </div>

            {/* Title / Artist / Album Column */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="text-sm font-normal text-text-1 truncate">{obj.title}</div>
              <div className="text-xs text-text-2 font-light truncate">
                {obj.artist} • {obj.album}
              </div>
            </div>

            {/* Date Column */}
            <div className="hidden md:block text-xs text-text-3 text-center px-2">
              {obj.date || ''}
            </div>

            {/* Action Column (empty for search - no actions needed) */}
            <div></div>
          </div>
        )
      })}
    </div>

    <PickModal
      isOpen={isPickModalOpen}
      track={pickModalTrack}
      playlists={RADIO_PLAYLISTS}
      selectedPlaylist={selectedPlaylist}
      isSubmitting={isSubmittingPick}
      onSelectPlaylist={setSelectedPlaylist}
      onSubmit={handleSubmitPick}
      onClose={closePickModal}
    />
  </>
  )
}
