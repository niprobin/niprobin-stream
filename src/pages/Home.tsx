import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAudio } from '@/contexts/AudioContext'
import { useHideItem } from '@/hooks/useHideItem'
import { getAlbumTracks, hideTrack, hideAlbum } from '@/services/api'
import { ROUTES } from '@/utils/routes'
import { STORAGE_KEYS } from '@/utils/storageKeys'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'
import { CarouselSection } from '@/components/ui/CarouselSection'
import { X } from 'lucide-react'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function TrackCard({
  track,
  onPlay,
  onHide,
  isLoading,
}: {
  track: DiscoverTrack
  onPlay: () => void
  onHide: (e: React.MouseEvent) => void
  isLoading: boolean
}) {
  return (
    <div className="flex-shrink-0 w-40 snap-start space-y-2 group">
      <div className="relative">
        <button
          onClick={onPlay}
          disabled={isLoading}
          className="w-40 h-40 block rounded-lg overflow-hidden disabled:opacity-50"
        >
          {track.cover_url ? (
            <img
              src={track.cover_url}
              alt={track.track}
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <span className="text-4xl">🎵</span>
            </div>
          )}
        </button>
        <button
          onClick={onHide}
          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Hide track"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
      <div
        onClick={isLoading ? undefined : onPlay}
        className={`text-left w-40 cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <p className="text-sm text-white truncate">{track.track}</p>
        <p className="text-xs text-slate-400 truncate">{track.artist}</p>
      </div>
    </div>
  )
}

function AlbumCard({
  album,
  onHide,
}: {
  album: DiscoverAlbum
  onHide: (e: React.MouseEvent) => void
}) {
  const { showNotification } = useNotification()

  const handleClick = async () => {
    try {
      const tracks = await getAlbumTracks(album.deezer_id, album.album, album.artist)
      const albumId = tracks[0]?.['album-id']
      if (albumId) {
        navigateTo(ROUTES.album(albumId))
      }
    } catch (err) {
      console.error('Failed to load album:', err)
      showNotification('Failed to load album. Please try again.', 'error')
    }
  }

  return (
    <div className="flex-shrink-0 w-60 snap-start space-y-2 group">
      <div className="relative">
        <button onClick={handleClick} className="w-60 h-60 block rounded-lg overflow-hidden">
          {album.cover_url ? (
            <img
              src={album.cover_url}
              alt={album.album}
              className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-full h-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
              <span className="text-4xl">💿</span>
            </div>
          )}
        </button>
        <button
          onClick={onHide}
          className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Hide album"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
      <div onClick={handleClick} className="text-left w-60 cursor-pointer">
        <p className="text-sm text-white truncate">{album.album}</p>
        <p className="text-xs text-slate-400 truncate">{album.artist}</p>
      </div>
    </div>
  )
}

function CarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 space-y-2">
          <div className="w-40 h-40 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-36" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-28" />
        </div>
      ))}
    </div>
  )
}

export function HomePage() {
  const { discoverTracks, discoverAlbums, isLoadingTracks, isLoadingAlbums } = useDiscovery()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext } = useAudio()
  const { isAuthenticated, token } = useAuth()

  const { showNotification } = useNotification()

  const { hiddenItems: hiddenTracks, hideItem: hideTrackItem } = useHideItem(
    (track: DiscoverTrack) => hideTrack({ track: track.track, artist: track.artist, deezer_id: track.deezer_id }, token),
    (track: DiscoverTrack) => `${track.track}-${track.artist}`,
    {
      persistentCacheKey: STORAGE_KEYS.HIDDEN_TRACKS,
      onSuccess: (result) => showNotification(result.message, result.status),
    }
  )

  const { hiddenItems: hiddenAlbums, hideItem: hideAlbumItem } = useHideItem(
    (album: DiscoverAlbum) => hideAlbum({ album: album.album, artist: album.artist, deezer_id: album.deezer_id }, token),
    (album: DiscoverAlbum) => `${album.album}-${album.artist}`,
    {
      persistentCacheKey: STORAGE_KEYS.HIDDEN_ALBUMS,
      onSuccess: (result) => showNotification(result.message, result.status),
    }
  )

  if (!isAuthenticated) {
    return (
      <div className="py-16 text-center space-y-2">
        <p className="text-slate-400 text-sm">Log in to discover tracks and albums.</p>
      </div>
    )
  }

  const visibleTracks = discoverTracks
    .filter((t) => !hiddenTracks.has(`${t.track}-${t.artist}`))
    .slice(0, 20)

  const visibleAlbums = discoverAlbums
    .filter((a) => !hiddenAlbums.has(`${a.album}-${a.artist}`))
    .slice(0, 20)

  return (
    <div className="py-8 space-y-6">
      <CarouselSection title="Recently added tracks" seeAllHref={ROUTES.diggingTracks}>
        {isLoadingTracks ? <CarouselSkeleton /> : visibleTracks.map((track, index) => (
          <TrackCard
            key={track.deezer_id}
            track={track}
            isLoading={loadingTrackId === track.deezer_id}
            onHide={(e) => hideTrackItem(track, e)}
            onPlay={() => {
              const queue = visibleTracks.map((t, i) => ({
                track: t.track,
                deezer_id: t.deezer_id,
                artist: t.artist,
                'track-number': i + 1,
                date: t.date,
                curator: t.curator,
              }))
              setAutoPlayContext(queue, index, 'Recently added tracks', () => queue)
              playTrack(track.track, track.artist, {
                clearAlbum: false,
                deezer_id: track.deezer_id,
                curator: track.curator,
              })
            }}
          />
        ))}
      </CarouselSection>

      <CarouselSection title="Recently added albums" seeAllHref={ROUTES.diggingAlbums}>
        {isLoadingAlbums ? <CarouselSkeleton /> : visibleAlbums.map((album) => (
          <AlbumCard
            key={album.deezer_id}
            album={album}
            onHide={(e) => hideAlbumItem(album, e)}
          />
        ))}
      </CarouselSection>
    </div>
  )
}
