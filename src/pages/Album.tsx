import { useState, useEffect, useRef } from 'react'
import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { getAlbumById, rateAlbum, hideAlbum, hideDiscoveryAlbum, type AlbumTrack } from '@/services/api'
import { Button } from '@/components/ui/button'
import { TrackList } from '@/components/TrackList'
import { useHideItem } from '@/hooks/useHideItem'
import { Play, Star, ArrowLeft, Share2, X } from 'lucide-react'

type AlbumPageProps = {
  albumId: number
  onBack: () => void
}

export function AlbumPage({ albumId, onBack }: AlbumPageProps) {
  const [tracks, setTracks] = useState<AlbumTrack[]>([])
  const [albumName, setAlbumName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [albumRating, setAlbumRating] = useState(0)
  const [albumId_md5, setAlbumId_md5] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  const { currentTrack, isPlaying, setAlbumContext } = useAudio()
  const { isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()
  const { playTrack, loadingTrackId } = useTrackPlayer()

  // Hide functionality
  const { hideItem: hideAlbumItem } = useHideItem(
    (album: { album: string; artist: string; id?: string }) => {
      if (album.id) {
        return hideDiscoveryAlbum({ id: album.id, album: album.album, artist: album.artist })
      } else {
        return hideAlbum({ album: album.album, artist: album.artist })
      }
    },
    (album) => `${album.album}-${album.artist}`,
    { persistentCacheKey: 'niprobin-hidden-albums' }
  )

  // Like functionality handler
  const handleLikeTrack = (track: AlbumTrackItem) => {
    // The TrackList component handles the full like flow including localStorage and API calls
    // This handler is called after successful like operations for any additional logic
    console.log('Track liked:', track)
  }

  // Load album data on mount or when albumId changes
  const contextRef = useRef({ increment, decrement, showNotification, setAlbumContext })

  useEffect(() => {
    contextRef.current = { increment, decrement, showNotification, setAlbumContext }
  }, [increment, decrement, showNotification, setAlbumContext])

  useEffect(() => {
    const loadAlbum = async () => {
      contextRef.current.increment()
      setError(null)

      try {
        const data = await getAlbumById(albumId)
        setTracks(data.tracks)
        setAlbumName(data.album)
        setArtistName(data.artist)
        setCoverUrl(data.cover)
        setAlbumId_md5(data.id) // Capture MD5 ID if present

        // Set album context for player integration
        contextRef.current.setAlbumContext(
          data.tracks.map((t) => ({
            track: t.track,
            'track-id': t['track-id'],
            artist: t.artist,
            'track-number': t['track-number'],
          })),
          { name: data.album, artist: data.artist, cover: data.cover, id: data.id },
          { expand: false, loadFirst: false }
        )
      } catch (err) {
        console.error('Failed to load album:', err)
        setError('Failed to load album. Please try again.')
        contextRef.current.showNotification('Failed to load album', 'error')
      } finally {
        contextRef.current.decrement()
      }
    }

    loadAlbum()
  }, [albumId])

  // Handle playing a track from the list
  const handlePlayTrack = (track: AlbumTrack) => {
    playTrack(track['track-id'], track.track, track.artist, {
      clearAlbum: false,
      albumName: albumName,
      coverArt: coverUrl,
    })
  }

  // Handle "Play Album" button - plays first track
  const handlePlayAlbum = () => {
    if (tracks.length === 0) return
    handlePlayTrack(tracks[0])
  }

  // Handle rating
  const handleRateAlbum = async (value: number) => {
    setAlbumRating(value)

    try {
      const response = await rateAlbum({
        album: albumName,
        artist: artistName,
        rating: value,
      })
      showNotification(response.message, response.status)
    } catch (err) {
      console.error('Failed to rate album:', err)
      showNotification('Failed to rate album', 'error')
    }
  }

  // Handle share
  const handleShareAlbum = () => {
    const albumUrl = `stream.niprobin.com/album/${albumId}`
    navigator.clipboard.writeText(albumUrl)
    showNotification('Album link copied to clipboard', 'success')
  }

  // Handle hide album
  const handleHideAlbum = async () => {
    try {
      await hideAlbumItem({
        album: albumName,
        artist: artistName,
        id: albumId.toString()
      })

      showNotification('Album hidden successfully', 'success')

      setTimeout(() => {
        onBack()
      }, 1000)

    } catch (err) {
      console.error('Failed to hide album:', err)
      showNotification('Failed to hide album', 'error')
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-400 mb-4">{error}</p>
        <Button onClick={onBack} variant="ghost">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  if (!albumName && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">Loading album...</p>
      </div>
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 pb-32">
      {/* Back Button */}
      <Button
        onClick={onBack}
        variant="ghost"
        className="mb-4 text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Album Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Album Cover */}
        <div className="w-48 h-48 md:w-64 md:h-64 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 mx-auto md:mx-0 border border-slate-700">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={`${albumName} cover`}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Album Info */}
        <div className="flex flex-col justify-end text-center md:text-left">
          <p className="text-sm text-slate-400 uppercase tracking-wide mb-1">
            Album
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {albumName}
          </h1>
          <p className="text-lg text-slate-300 mb-4">{artistName}</p>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center gap-4 justify-start">
            {/* Play Button - standalone */}
            <Button
              onClick={handlePlayAlbum}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6"
            >
              <Play className="h-5 w-5 mr-2" fill="currentColor" />
              Play
            </Button>

            {/* Secondary Actions - grouped */}
            <div className="flex gap-2 px-2 py-1 rounded-lg bg-slate-800/30">
              <Button
                onClick={handleShareAlbum}
                variant="outline"
                className="rounded-full border-slate-600 text-white hover:bg-slate-800"
              >
                <Share2 className="h-5 w-5 mr-2" />
                Share
              </Button>

              {isAuthenticated && (
                <Button
                  onClick={handleHideAlbum}
                  variant="outline"
                  className="rounded-full border-slate-600 text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5 mr-2" />
                  Hide
                </Button>
              )}
            </div>

            {/* Rating - separate group */}
            {isAuthenticated && (
              <div
                className="flex gap-1 px-2 py-1 rounded-lg bg-slate-800/30"
                role="radiogroup"
                aria-label="Album rating"
              >
                {[1, 2, 3, 4, 5].map((value) => {
                  const isActive = albumRating >= value
                  return (
                    <Button
                      key={value}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${isActive ? 'text-yellow-300' : 'text-slate-500'} hover:text-yellow-300`}
                      aria-pressed={isActive}
                      aria-label={`${value} star${value === 1 ? '' : 's'}`}
                      onClick={() => handleRateAlbum(value)}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={isActive ? 'currentColor' : 'none'}
                      />
                    </Button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden flex flex-col gap-3 items-center">
            {/* Row 1: Play Button */}
            <Button
              onClick={handlePlayAlbum}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6"
            >
              <Play className="h-5 w-5 mr-2" fill="currentColor" />
              Play
            </Button>

            {/* Row 2: Secondary actions grouped */}
            <div className="flex gap-3">
              <div className="flex gap-2 px-2 py-1 rounded-lg bg-slate-800/30">
                <Button
                  onClick={handleShareAlbum}
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-slate-800"
                  aria-label="Share album"
                >
                  <Share2 className="h-5 w-5" />
                </Button>

                {isAuthenticated && (
                  <Button
                    onClick={handleHideAlbum}
                    size="icon"
                    variant="ghost"
                    className="text-white hover:bg-slate-800"
                    aria-label="Hide album"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>

              {/* Rating stars - separate group */}
              {isAuthenticated && (
                <div
                  className="flex gap-1 px-2 py-1 rounded-lg bg-slate-800/30"
                  role="radiogroup"
                  aria-label="Album rating"
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const isActive = albumRating >= value
                    return (
                      <Button
                        key={value}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isActive ? 'text-yellow-300' : 'text-slate-500'} hover:text-yellow-300`}
                        aria-pressed={isActive}
                        aria-label={`${value} star${value === 1 ? '' : 's'}`}
                        onClick={() => handleRateAlbum(value)}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={isActive ? 'currentColor' : 'none'}
                        />
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <TrackList
        variant="album"
        tracks={tracks.map(track => ({
          track: track.track,
          'track-id': track['track-id'],
          artist: track.artist,
          'track-number': track['track-number'],
        }))}
        loadingTrackId={loadingTrackId}
        onSelect={(trackItem) => {
          const originalTrack = tracks.find(t => t['track-id'] === trackItem['track-id'])
          if (originalTrack) handlePlayTrack(originalTrack)
        }}
        enableLikeButtons={isAuthenticated}
        onLikeTrack={handleLikeTrack}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
