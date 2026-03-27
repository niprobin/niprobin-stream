import { useState, useEffect, useRef } from 'react'
import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { getAlbumById, rateAlbum, hideAlbum, saveAlbum, type AlbumTrack } from '@/services/api'
import { StarRating } from '@/components/ui/StarRating'
import { TrackList } from '@/components/TrackList'
import { useHideItem } from '@/hooks/useHideItem'
import { Share2, X, Loader2 } from 'lucide-react'
import { TrackIdSource } from '@/utils/trackUtils'
import { useMetaTags } from '@/hooks/useMetaTags'
import { generateAlbumMetaTags } from '@/utils/metaTagHelpers'

type AlbumPageProps = {
  albumId: number
}

export function AlbumPage({ albumId }: AlbumPageProps) {
  const [tracks, setTracks] = useState<AlbumTrack[]>([])
  const [albumName, setAlbumName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [albumDataId, setAlbumDataId] = useState<string | number | undefined>(undefined)
  const [albumRating, setAlbumRating] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { currentTrack, isPlaying, setAlbumContext, setAutoPlayContext } = useAudio()
  const { isAuthenticated, token } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setMetaTags, resetToDefault } = useMetaTags()

  // Hide functionality
  const { hideItem: hideAlbumItem } = useHideItem(
    (album: { album: string; artist: string }) => hideAlbum({ album: album.album, artist: album.artist }, token),
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
    // Reset scroll position when entering album page
    window.scrollTo(0, 0)

    const loadAlbum = async () => {
      contextRef.current.increment()
      setError(null)

      try {
        const data = await getAlbumById(albumId)
        setTracks(data.tracks)
        setAlbumName(data.album)
        setArtistName(data.artist)
        setCoverUrl(data.cover)
        setAlbumDataId(data.id)

        // Update meta tags for the album
        const albumMetaTags = generateAlbumMetaTags({
          title: data.album,
          artist: data.artist,
          coverArt: data.cover,
          albumId: albumId,
          trackCount: data.tracks.length
        })
        setMetaTags(albumMetaTags)

        // Album data loaded, context will be set when user plays the album
      } catch (err) {
        console.error('Failed to load album:', err)
        setError('Failed to load album. Please try again.')
        resetToDefault()  // Reset to default meta tags on error
        contextRef.current.showNotification('Failed to load album', 'error')
      } finally {
        contextRef.current.decrement()
      }
    }

    loadAlbum()
  }, [albumId])

  // Cleanup meta tags when component unmounts
  useEffect(() => {
    return () => {
      resetToDefault()
    }
  }, [resetToDefault])

  // Handle playing a track from the list
  const handlePlayTrack = (track: AlbumTrack) => {
    playTrack(track['track-id'], track.track, track.artist, {
      clearAlbum: false,
      albumName: albumName,
      coverArt: coverUrl,
      source: TrackIdSource.Album,
    })
  }

  // Handle "Play Album" button - plays first track
  const handlePlayAlbum = () => {
    if (tracks.length === 0) return

    // Set album context for player integration when user actually plays
    setAlbumContext(
      tracks.map((t) => ({
        track: t.track,
        'track-id': 0,
        artist: t.artist,
        'track-number': t['track-number'],
      })),
      { name: albumName, artist: artistName, cover: coverUrl, id: albumDataId?.toString() },
      { expand: false, loadFirst: false }
    )

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
      }, token)
      showNotification(response.message, response.status)
    } catch (err) {
      console.error('Failed to rate album:', err)
      showNotification('Failed to rate album', 'error')
    }
  }

  // Handle add album (save for later)
  const handleAddAlbum = async () => {
    setIsSaving(true)

    try {
      const response = await saveAlbum({
        album: albumName,
        artist: artistName,
        'album-id': albumId
      }, token)
      showNotification(response.message, response.status)
    } catch (err) {
      showNotification('Failed to save album', 'error')
      console.error('Failed to save album:', err)
    } finally {
      setIsSaving(false)
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
        artist: artistName
      })

      showNotification('Album hidden successfully', 'success')

    } catch (err) {
      console.error('Failed to hide album:', err)
      showNotification('Failed to hide album', 'error')
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-slate-400">{error}</p>
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
    <div className="w-full pb-32">
      {/* Album Header */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 lg:gap-10 mb-4 px-6 lg:px-10 pt-28 lg:pt-10 pb-4">
        {/* Left: Album Cover + Metadata */}
        <div className="flex flex-col gap-0">
          <div className="w-full lg:w-64 h-64 rounded-sm overflow-hidden bg-slate-800 flex-shrink-0 mx-auto lg:mx-0 border border-slate-700">
            {coverUrl && (
              <img
                src={coverUrl}
                alt={`${albumName} cover`}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="mt-4 flex flex-col gap-1 text-center lg:text-left">
            <h1 className="font-bebas text-4xl lg:text-5xl xl:text-6xl leading-none text-white mb-2">
              {albumName}
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-light">{artistName}</p>
          </div>
        </div>

        {/* Center: Spacer (empty on desktop) */}
        <div className="hidden lg:block"></div>

        {/* Right: Action buttons stack */}
        <div className="ap-actions-mobile lg:flex lg:flex-col gap-3 min-w-[170px] lg:min-w-[180px]">
          {/* Play Button - Primary CTA */}
          <button
            onClick={handlePlayAlbum}
            className="ap-action-btn ap-action-btn-primary"
          >
            <span>Play</span>
          </button>

          {/* Secondary Actions Container */}
          <div className="ap-actions-secondary lg:contents">
            {/* Rate Button - Stars Only */}
            {isAuthenticated && (
              <button
                className="ap-action-btn"
                onClick={(e) => e.stopPropagation()}
              >
                <StarRating
                  inline
                  variant="compact"
                  rating={albumRating}
                  onRatingChange={handleRateAlbum}
                  disabled={false}
                />
              </button>
            )}

            {/* Add Button */}
            {isAuthenticated && (
              <button
                onClick={handleAddAlbum}
                disabled={isSaving}
                className="ap-action-btn"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" strokeWidth={1.5} />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Add +</span>
                )}
              </button>
            )}

            {/* Share Button */}
            <button
              onClick={handleShareAlbum}
              className="ap-action-btn"
            >
              <span>Share</span>
              <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>

            {/* Hide Button */}
            {isAuthenticated && (
              <button
                onClick={handleHideAlbum}
                className="ap-action-btn"
              >
                <span>Hide</span>
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <TrackList
        variant="album"
        tracks={tracks.map(track => ({
          track: track.track,
          'track-id': 0,
          artist: track.artist,
          'track-number': track['track-number'],
        }))}
        loadingTrackId={loadingTrackId}
        onSelect={(trackItem, trackIndex) => {
          const originalTrack = tracks.find(t => t.track === trackItem.track && t.artist === trackItem.artist)
          if (originalTrack) {
            // Update the current track index for proper auto-play sequencing
            const albumTracksForContext = tracks.map((t) => ({
              track: t.track,
              'track-id': 0,
              artist: t.artist,
              'track-number': t['track-number'],
            }))
            setAutoPlayContext(albumTracksForContext, trackIndex, albumName)

            handlePlayTrack(originalTrack)
          }
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
