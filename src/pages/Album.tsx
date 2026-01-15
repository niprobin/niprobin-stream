import { useState, useEffect, useRef } from 'react'
import { useAudio } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { getAlbumById, rateAlbum, type AlbumTrack } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Play, Star, ArrowLeft } from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)

  const { currentTrack, isPlaying, setAlbumContext } = useAudio()
  const { isAuthenticated } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()
  const { playTrack, loadingTrackId } = useTrackPlayer()

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

        // Set album context for player integration
        contextRef.current.setAlbumContext(
          data.tracks.map((t) => ({
            track: t.track,
            'track-id': t['track-id'],
            artist: t.artist,
            'track-number': t['track-number'],
          })),
          { name: data.album, artist: data.artist, cover: data.cover },
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

          {/* Play Button and Rating */}
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <Button
              onClick={handlePlayAlbum}
              className="bg-white text-black hover:bg-white/90 rounded-full px-6"
            >
              <Play className="h-5 w-5 mr-2" fill="currentColor" />
              Play
            </Button>

            {/* Rating (authenticated only) */}
            {isAuthenticated && (
              <div
                className="flex items-center gap-1"
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

      {/* Tracklist */}
      <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/40">
        {tracks.map((track, index) => {
          const trackId = `${track.track}-${track.artist}`
          const isCurrentTrack = currentTrack?.id === track['track-id'].toString()
          const isLoading = loadingTrackId === trackId

          return (
            <div
              key={`${track['track-id']}-${index}`}
              onClick={() => handlePlayTrack(track)}
              className={`flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer transition-colors group ${
                isCurrentTrack ? 'bg-slate-800' : ''
              }`}
            >
              {/* Track Number */}
              <div
                className={`text-sm font-medium w-8 text-center ${
                  isCurrentTrack ? 'text-white' : 'text-slate-500'
                } group-hover:text-white`}
              >
                {track['track-number']}
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium truncate ${
                    isCurrentTrack ? 'text-white' : 'text-white'
                  }`}
                >
                  {track.track}
                </div>
                <div className="text-xs text-slate-400 truncate">
                  {track.artist}
                </div>
              </div>

              {/* Status Indicator */}
              {isLoading && (
                <div className="text-slate-400 text-xs pr-2">Loading...</div>
              )}
              {isCurrentTrack && !isLoading && (
                <div className="text-white text-xs pr-2">
                  {isPlaying ? '▶' : '❚❚'}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
