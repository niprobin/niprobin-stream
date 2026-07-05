import { useEffect, useState } from 'react'
import { getArtistPage } from '@/services/api'
import type { ArtistPageData, ArtistTrack, ArtistAlbum } from '@/types/api'
import { useAudio } from '@/contexts/AudioContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useLoading } from '@/contexts/LoadingContext'
import { useNotification } from '@/contexts/NotificationContext'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { ROUTES, navigateTo } from '@/utils/routes'
import { Loader2 } from 'lucide-react'

export function ArtistPage({ artistId }: { artistId: string }) {
  const [data, setData] = useState<ArtistPageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { setAutoPlayContext } = useAudio()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { increment, decrement } = useLoading()
  const { showNotification } = useNotification()

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      increment()
      try {
        const result = await getArtistPage(artistId)
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) {
          setError('Failed to load artist.')
          showNotification('Failed to load artist.', 'error')
        }
      } finally {
        decrement()
      }
    }
    window.scrollTo(0, 0)
    load()
    return () => { cancelled = true }
  }, [artistId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrackClick = (track: ArtistTrack, index: number) => {
    if (!data) return
    const queue = data.tracks.map((t, i) => ({
      track: t.title,
      deezer_id: t.deezer_id,
      artist: t.artist,
      'track-number': i + 1,
    }))
    setAutoPlayContext(queue, index, data.info.name)
    playTrack(track.title, track.artist, {
      deezer_id: track.deezer_id,
      coverArt: track.cover,
    })
  }

  const handleAlbumClick = (album: ArtistAlbum) => {
    navigateTo(ROUTES.album(album.deezer_id.toString()))
  }

  if (error) {
    return (
      <div className="w-full py-16 text-center">
        <p className="text-text-2">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="w-full py-16 text-center">
        <p className="text-text-2">Loading artist...</p>
      </div>
    )
  }

  return (
    <div className="w-full pb-32">
      {/* Header */}
      <div className="flex flex-col gap-0 px-6 lg:px-10 pt-28 lg:pt-10 pb-4 mb-4">
        <div className="w-[168px] h-[168px] lg:w-64 lg:h-64 rounded-full overflow-hidden bg-bg-1 flex-shrink-0 mx-auto lg:mx-0 border border-border">
          {data.info.cover_url ? (
            <img
              src={data.info.cover_url}
              alt={data.info.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <CoverArtPlaceholder circular showLabel={false} className="!w-full !h-full" />
          )}
        </div>
        <div className="mt-4 flex flex-col gap-1 text-center lg:text-left">
          <h1 className="font-serif-display italic text-4xl lg:text-5xl xl:text-6xl leading-none text-text-1 mb-2">
            {data.info.name}
          </h1>
        </div>
      </div>

      {/* Top Tracks */}
      <section className="mt-2 px-6 lg:px-10">
        <h2 className="font-serif-display italic text-2xl text-text-1 mb-4">Top Tracks</h2>
        <ol className="space-y-1">
          {data.tracks.slice(0, 10).map((track, i) => (
            <li
              key={track.deezer_id}
              onClick={() => handleTrackClick(track, i)}
              className="flex items-center gap-4 px-2 py-2 rounded-lg hover:bg-bg-2 cursor-pointer group transition-colors"
            >
              <span className="text-text-3 w-5 text-sm text-right shrink-0">{i + 1}</span>
              {track.cover ? (
                <img
                  src={track.cover}
                  alt={track.title}
                  className="w-[38px] h-[38px] rounded-[10px] object-cover shrink-0"
                />
              ) : (
                <CoverArtPlaceholder size={38} radius={10} showLabel={false} className="shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-text-1 text-sm truncate">{track.title}</p>
                <p className="text-text-2 text-xs truncate">{track.artist}</p>
              </div>
              {loadingTrackId === track.deezer_id && (
                <Loader2 className="h-4 w-4 animate-spin text-text-2 shrink-0" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Albums */}
      {data.albums.length > 0 && (
        <section className="mt-10 px-6 lg:px-10">
          <h2 className="font-serif-display italic text-2xl text-text-1 mb-4">Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.albums.map((album) => (
              <AlbumCard
                key={album.deezer_id}
                album={{
                  album: album.title,
                  artist: album.year,
                  cover: album.cover,
                }}
                onClick={() => handleAlbumClick(album)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
