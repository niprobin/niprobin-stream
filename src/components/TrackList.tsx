import type { AlbumTrackItem } from '@/contexts/AudioContext'
import { Loader2 } from 'lucide-react'

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

  const containerClasses = isAlbumVariant
    ? 'divide-y divide-slate-800 border border-slate-800 bg-slate-900/40'
    : 'divide-y divide-slate-800 rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-lg'

  return (
    <div className={containerClasses}>
      {data.map((track, index) => {
        const key = isAlbumVariant
          ? `${(track as AlbumTrackItem)['track-id']}-${index}`
          : `${(track as BaseTrack).id}-${index}`

        if (isAlbumVariant) {
          const item = track as AlbumTrackItem
          const trackId = `${item.track}-${item.artist}`
          const loading = props.loadingTrackId === trackId

          return (
            <div
              key={key}
              className="flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer transition-colors group"
            >
              <div className="text-xs font-medium w-6 text-center text-slate-500 group-hover:text-white">
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
                  {props.renderIndicator?.(item)}
                  {props.renderAction?.(item)}
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
  )
}
