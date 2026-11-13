import { useEffect, useState } from 'react'
import { getArtistPage } from '@/services/api'
import type { ArtistPageData, ArtistAlbum } from '@/types/api'
import { useAudio, autoPlayInfo } from '@/contexts/AudioContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useNotification } from '@/contexts/NotificationContext'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { RatingBadge } from '@/components/ui/RatingBadge'
import { useBacklog } from '@/contexts/BacklogContext'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { NowPlayingIndicator } from '@/components/ui/NowPlayingIndicator'
import { isCurrentTrack } from '@/utils/trackUtils'
import { ROUTES, navigateTo } from '@/utils/routes'
import { Loader2, UserCheck, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { follow, isFollowed, unfollow } from '@/digging/follows'
import { MESSAGES } from '@/api/actionMessages'

export function ArtistPage({ artistId }: { artistId: string }) {
  const [data, setData] = useState<ArtistPageData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { playList, loadingTrackId, currentTrack, isPlaying } = useAudio()
  const { increment, decrement } = useLoading()
  const { showNotification } = useNotification()
  const { albumStatus } = useBacklog()
  const { isAuthenticated, token } = useAuth()
  // null while the server's list hasn't said (or can't: signed out, failed)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [isSendingFollow, setIsSendingFollow] = useState(false)

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

  // Whether the artist is Followed, from the server's list
  useEffect(() => {
    setFollowing(null)
    if (!isAuthenticated) return
    let cancelled = false
    isFollowed(String(artistId), token)
      .then(result => { if (!cancelled) setFollowing(result) })
      .catch(() => { /* the button stays hidden */ })
    return () => { cancelled = true }
  }, [artistId, isAuthenticated, token])

  const handleFollowClick = async () => {
    if (!data || following === null || isSendingFollow) return
    const artist = { name: data.info.name, deezer_id: String(data.info.deezer_id || artistId) }
    const wasFollowing = following
    // Shown at once, put back if it didn't go through
    setFollowing(!wasFollowing)
    setIsSendingFollow(true)
    const result = wasFollowing ? await unfollow(artist, token) : await follow(artist, token)
    setIsSendingFollow(false)
    if (result.ok) {
      showNotification(wasFollowing ? MESSAGES.unfollowed(artist.name) : MESSAGES.followed(artist.name), 'success')
    } else {
      setFollowing(wasFollowing)
      showNotification(result.error, 'error')
    }
  }

  const handleTrackClick = (index: number) => {
    if (!data) return
    const queue = data.tracks.map((t, i) => ({
      track: t.title,
      deezer_id: t.deezer_id,
      isrc: t.isrc,
      artist: t.artist,
      'track-number': i + 1,
      cover: t.cover,
    }))
    playList(queue, index, autoPlayInfo(data.info.name))
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
          {following !== null && (
            <button
              type="button"
              onClick={handleFollowClick}
              disabled={isSendingFollow}
              aria-pressed={following}
              aria-label={following ? `Following ${data.info.name}, stop following` : `Follow ${data.info.name}`}
              className={`mt-1 self-center lg:self-start inline-flex items-center gap-2 h-9 px-4 rounded-full border text-sm font-medium transition-colors disabled:opacity-60 ${
                following
                  ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
                  : 'border-border text-text-1 hover:bg-bg-2'
              }`}
            >
              {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Top Tracks */}
      <section className="mt-2 px-6 lg:px-10">
        <h2 className="font-serif-display italic text-2xl text-text-1 mb-4">Top Tracks</h2>
        <ol className="space-y-1">
          {data.tracks.slice(0, 10).map((track, i) => {
            const isCurrent = isCurrentTrack(currentTrack, { deezer_id: String(track.deezer_id), title: track.title, artist: track.artist })
            return (
            <li
              key={track.deezer_id}
              onClick={() => handleTrackClick(i)}
              className={`flex items-center gap-4 px-2 py-2 rounded-lg cursor-pointer group transition-colors ${
                isCurrent ? 'bg-accent/10' : 'hover:bg-bg-2'
              }`}
            >
              <span className="text-text-3 w-5 text-sm text-right shrink-0 flex justify-end">
                {isCurrent ? <NowPlayingIndicator isPlaying={isPlaying} /> : i + 1}
              </span>
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
                <p className={`text-sm truncate ${isCurrent ? 'font-medium text-accent' : 'text-text-1'}`}>{track.title}</p>
                <p className="text-text-2 text-xs truncate">{track.artist}</p>
              </div>
              {loadingTrackId === track.deezer_id && (
                <Loader2 className="h-4 w-4 animate-spin text-text-2 shrink-0" />
              )}
            </li>
            )
          })}
        </ol>
      </section>

      {/* Albums */}
      {data.albums.length > 0 && (
        <section className="mt-10 px-6 lg:px-10">
          <h2 className="font-serif-display italic text-2xl text-text-1 mb-4">Albums</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.albums.map((album) => {
              const { rating } = albumStatus(String(album.deezer_id))
              return (
                <AlbumCard
                  key={album.deezer_id}
                  album={{
                    album: album.title,
                    artist: album.year,
                    cover: album.cover,
                  }}
                  onClick={() => handleAlbumClick(album)}
                  leftActionButton={rating !== null ? <RatingBadge rating={rating} /> : undefined}
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
