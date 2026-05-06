import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { getAlbumTracks } from '@/services/api'
import { ROUTES } from '@/utils/routes'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function CarouselSection({
  title,
  seeAllHref,
  children,
}: {
  title: string
  seeAllHref: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        <button
          onClick={() => navigateTo(seeAllHref)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          See all →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

function TrackCard({
  track,
  onPlay,
  isLoading,
}: {
  track: DiscoverTrack
  onPlay: () => void
  isLoading: boolean
}) {
  return (
    <button
      onClick={onPlay}
      disabled={isLoading}
      className="flex-shrink-0 w-32 snap-start text-left space-y-2 group disabled:opacity-50"
    >
      <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
        <span className="text-4xl">🎵</span>
      </div>
      <div>
        <p className="text-sm text-white truncate w-32">{track.track}</p>
        <p className="text-xs text-slate-400 truncate w-32">{track.artist}</p>
      </div>
    </button>
  )
}

function AlbumCard({ album }: { album: DiscoverAlbum }) {
  const handleClick = async () => {
    try {
      const tracks = await getAlbumTracks(album.deezer_id, album.album, album.artist)
      const albumId = tracks[0]?.['album-id']
      if (albumId) {
        navigateTo(ROUTES.album(albumId))
      }
    } catch (err) {
      console.error('Failed to load album:', err)
    }
  }

  return (
    <button onClick={handleClick} className="flex-shrink-0 w-32 snap-start text-left space-y-2">
      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt={album.album}
          className="w-32 h-32 rounded-lg object-cover"
        />
      ) : (
        <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-4xl">💿</span>
        </div>
      )}
      <div>
        <p className="text-sm text-white truncate w-32">{album.album}</p>
        <p className="text-xs text-slate-400 truncate w-32">{album.artist}</p>
      </div>
    </button>
  )
}

export function HomePage() {
  const { discoverTracks, discoverAlbums } = useDiscovery()
  const { playTrack, loadingTrackId } = useTrackPlayer()

  return (
    <div className="py-8 space-y-10">
      <CarouselSection title="Digging Tracks" seeAllHref={ROUTES.diggingTracks}>
        {discoverTracks.slice(0, 20).map(track => (
          <TrackCard
            key={track.deezer_id}
            track={track}
            isLoading={loadingTrackId === track.deezer_id}
            onPlay={() =>
              playTrack(track.track, track.artist, {
                clearAlbum: false,
                deezer_id: track.deezer_id,
                curator: track.curator,
              })
            }
          />
        ))}
      </CarouselSection>

      <CarouselSection title="Digging Albums" seeAllHref={ROUTES.diggingAlbums}>
        {discoverAlbums.slice(0, 20).map(album => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </CarouselSection>
    </div>
  )
}
