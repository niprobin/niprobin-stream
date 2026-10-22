import { useState, useEffect, useRef } from 'react'
import { useAudio, type AlbumTrackItem } from '@/contexts/AudioContext'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useBacklog } from '@/contexts/BacklogContext'
import { getAlbumById, rateAlbum, addAlbum, shortlistAlbum, addAlbumToJellyfin, type AlbumTrack } from '@/services/api'
import { StarRating } from '@/components/ui/StarRating'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { TrackList } from '@/components/TrackList'
import { Share2, X, Loader2, Music4, Download, ListPlus } from 'lucide-react'
import { useMetaTags } from '@/hooks/useMetaTags'
import { generateAlbumMetaTags } from '@/utils/metaTagHelpers'
import { ROUTES } from '@/utils/routes'

type AlbumPageProps = {
  albumId: number
}

export function AlbumPage({ albumId }: AlbumPageProps) {
  const [tracks, setTracks] = useState<AlbumTrack[]>([])
  const [albumName, setAlbumName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [albumDataId, setAlbumDataId] = useState<string | number | undefined>(undefined)
  const [streamingLink, setStreamingLink] = useState<string | undefined>(undefined)
  const [artistId, setArtistId] = useState<string | undefined>(undefined)
  const [albumRating, setAlbumRating] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isShortlisting, setIsShortlisting] = useState(false)
  const [isAddingToJellyfin, setIsAddingToJellyfin] = useState(false)
  const [showShareTooltip, setShowShareTooltip] = useState(false)

  const { currentTrack, isPlaying, playList, loadingTrackId } = useAudio()
  const { isAuthenticated, token } = useAuth()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()
  const { markShortlisted, hideAlbum, albumBacklog } = useBacklog()
  const { setMetaTags, resetToDefault } = useMetaTags()

  const handlePickTrack = (_track: AlbumTrackItem) => {
    // no-op: TrackList handles the full Pick flow; this callback exists for future use
  }

  // Load album data on mount or when albumId changes
  const contextRef = useRef({ increment, decrement, showNotification })
  const shareTooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contextRef.current = { increment, decrement, showNotification }
  }, [increment, decrement, showNotification])

  useEffect(() => {
    // Reset scroll position when entering album page
    window.scrollTo(0, 0)

    const loadAlbum = async () => {
      contextRef.current.increment()
      setError(null)

      try {
        const data = await getAlbumById(albumId.toString())
        setTracks(data.tracks)
        setAlbumName(data.album)
        setArtistName(data.artist)
        setArtistId(data.artistId)
        setCoverUrl(data.cover)
        // New-format albums have no legacy `id`; fall back to albumId so the
        // player can tell clicks within the same album apart from an album
        // switch (and keep its prefetched tracks).
        setAlbumDataId(data.id ?? data.albumId)
        setStreamingLink(data.streamingLink)

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

  // Handle click outside to close share tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showShareTooltip &&
          shareTooltipRef.current &&
          !shareTooltipRef.current.contains(event.target as Node)) {
        setShowShareTooltip(false)
      }
    }

    if (showShareTooltip) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showShareTooltip])

  // Plays the album from `index`, fetching the next tracks ahead
  const playAlbumFrom = (index: number) => {
    if (tracks.length === 0) return
    playList(
      tracks.map((t) => ({
        track: t.track,
        deezer_id: t.deezer_id,
        artist: t.artist,
        'track-number': t['track-number'],
      })),
      index,
      { name: albumName, artist: artistName, cover: coverUrl, id: albumDataId?.toString(), streamingLink },
    )
  }

  // Handle "Play Album" button - plays first track
  const handlePlayAlbum = () => playAlbumFrom(0)

  // Handle rating
  const handleRateAlbum = async (value: number) => {
    setAlbumRating(value)

    try {
      const response = await rateAlbum({
        album: albumName,
        artist: artistName,
        rating: value,
        deezer_id: albumId.toString(),
      }, token)
      showNotification(response.message, response.status)
    } catch (err) {
      console.error('Failed to rate album:', err)
      showNotification('Failed to rate album', 'error')
    }
  }

  // Add: puts the album into the Album Backlog
  const handleAddAlbum = async () => {
    setIsAdding(true)

    try {
      const response = await addAlbum({
        album: albumName,
        artist: artistName,
        deezer_id: albumId.toString()
      }, token)
      showNotification(response.message, response.status)
    } catch (err) {
      showNotification("Couldn't Add this album", 'error')
      console.error("Couldn't Add this album:", err)
    } finally {
      setIsAdding(false)
    }
  }

  // Handle shortlist album
  const handleShortlistAlbum = async () => {
    setIsShortlisting(true)

    try {
      const response = await shortlistAlbum({
        album_id: albumId.toString(),
        saved: true,
      }, token)
      showNotification(response.message, response.status)
      // Update the Album Backlog locally so the "Listen to" view reflects the change
      if (response.status === 'success') markShortlisted(albumId.toString())
    } catch (err) {
      showNotification('Failed to shortlist album', 'error')
      console.error('Failed to shortlist album:', err)
    } finally {
      setIsShortlisting(false)
    }
  }

  // Add to Jellyfin: the server fetches the album into the Jellyfin library
  const handleAddToJellyfin = async () => {
    setIsAddingToJellyfin(true)

    try {
      const response = await addAlbumToJellyfin(albumId.toString(), token)
      showNotification(response.message, response.status)
    } catch (err) {
      showNotification("Couldn't Add this album to Jellyfin", 'error')
      console.error("Couldn't Add this album to Jellyfin:", err)
    } finally {
      setIsAddingToJellyfin(false)
    }
  }

  // Toggle share tooltip
  const toggleShareTooltip = () => {
    setShowShareTooltip(!showShareTooltip)
  }

  // Handle share album URL
  const handleShareAlbum = () => {
    const albumUrl = `stream.niprobin.com/album/${albumId}`
    navigator.clipboard.writeText(albumUrl)
    showNotification('Album link copied to clipboard', 'success')
    setShowShareTooltip(false)
  }

  // Handle share deezer link
  const handleShareDeezer = () => {
    if (!streamingLink) {
      showNotification('Streaming link not available', 'error')
      return
    }

    navigator.clipboard.writeText(streamingLink)
      .then(() => {
        showNotification('Deezer link copied to clipboard', 'success')
        setShowShareTooltip(false)
      })
      .catch(() => {
        showNotification('Failed to copy link', 'error')
      })
  }

  // Hides the backlog's own row when it lists this album, as its name may differ
  const handleHideAlbum = () => {
    const deezerId = albumId.toString()
    const listed = albumBacklog.find(a => String(a.deezer_id) === deezerId)
    hideAlbum(listed ?? { album: albumName, artist: artistName, deezer_id: deezerId })
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-text-2">{error}</p>
      </div>
    )
  }

  if (!albumName && tracks.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-2">Loading album...</p>
      </div>
    )
  }

  return (
    <div className="w-full pb-32">
      {/* Album Header */}
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-6 lg:gap-10 mb-4 px-6 lg:px-10 pt-28 lg:pt-4 pb-4">
        {/* Left: Album Cover + Metadata */}
        <div className="flex flex-col gap-0">
          <div className="w-[184px] h-[184px] lg:w-64 lg:h-64 rounded-md-crate overflow-hidden bg-bg-1 flex-shrink-0 mx-auto lg:mx-0 border border-border">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={`${albumName} cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <CoverArtPlaceholder size={184} className="!w-full !h-full" />
            )}
          </div>
          <div className="mt-4 flex flex-col gap-1 text-center lg:text-left">
            <h1 className="font-serif-display italic text-4xl lg:text-5xl xl:text-6xl leading-none text-text-1 mb-2">
              {albumName}
            </h1>
            {artistId ? (
              <button
                onClick={() => { window.history.pushState({}, '', ROUTES.artist(artistId)); window.dispatchEvent(new PopStateEvent('popstate')) }}
                className="text-xs text-text-2 uppercase tracking-widest font-light underline decoration-dotted underline-offset-4 hover:text-text-1 transition-colors text-center lg:text-left"
              >
                {artistName}
              </button>
            ) : (
              <p className="text-xs text-text-2 uppercase tracking-widest font-light">{artistName}</p>
            )}
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
                disabled={isAdding}
                className="ap-action-btn"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" strokeWidth={1.5} />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Add +</span>
                )}
              </button>
            )}

            {/* Shortlist Button */}
            {isAuthenticated && (
              <button
                onClick={handleShortlistAlbum}
                disabled={isShortlisting}
                className="ap-action-btn"
              >
                {isShortlisting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" strokeWidth={1.5} />
                    <span>Shortlisting...</span>
                  </>
                ) : (
                  <>
                    <span>Shortlist</span>
                    <ListPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </>
                )}
              </button>
            )}

            {/* Share Button */}
            <div className="relative">
              <button
                onClick={toggleShareTooltip}
                className="ap-action-btn"
              >
                <span>Share</span>
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>

              {/* Share Tooltip */}
              {showShareTooltip && (
                <div
                  ref={shareTooltipRef}
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-bg-1 border border-border rounded-md-crate shadow-lg py-1 z-50 w-48"
                >
                  <button
                    onClick={handleShareAlbum}
                    className="w-full px-3 py-2 text-left text-text-1 hover:bg-bg-2 flex items-center gap-2 text-sm"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy stream link
                  </button>
                  <button
                    onClick={handleShareDeezer}
                    className="w-full px-3 py-2 text-left text-text-1 hover:bg-bg-2 flex items-center gap-2 text-sm"
                  >
                    <Music4 className="h-4 w-4" />
                    Copy deezer link
                  </button>
                </div>
              )}
            </div>

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

            {/* Add to Jellyfin Button */}
            {isAuthenticated && (
              <button
                onClick={handleAddToJellyfin}
                disabled={isAddingToJellyfin}
                className="ap-action-btn"
              >
                {isAddingToJellyfin ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" strokeWidth={1.5} />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <span>Add to Jellyfin</span>
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </>
                )}
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
          deezer_id: track.deezer_id,
          artist: track.artist,
          'track-number': track['track-number'],
        }))}
        loadingTrackId={loadingTrackId}
        onSelect={(_trackItem, trackIndex) => playAlbumFrom(trackIndex)}
        enablePickButtons={isAuthenticated}
        onPickTrack={handlePickTrack}
        currentTrackId={currentTrack?.deezer_id}
        isPlaying={isPlaying}
        isAuthenticated={isAuthenticated}
      />
    </div>
  )
}
