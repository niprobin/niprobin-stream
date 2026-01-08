import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'
import { getAlbumsToDiscover, getAlbumTracks, hideAlbum, getTracksToDiscover, getStreamUrl, hideTrack, type DiscoverAlbum, type DiscoverTrack } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { TrackList } from '@/components/TrackList'

type DiggingTab = 'tracks' | 'albums'

const CURATORS = [
  'niprobin',
  'FIP Best Of',
  'Tim Reaper',
  'Infinite Loop',
  'Joe-Armon Jones',
  'Athens of the North',
  'Somewhere Soul',
  'Jazz & Joint',
  'Skinshape',
  'Tom Misch',
  'Touching Bass',
  'Jazzafip',
  'Laurent Garnier',
]

const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export function AlbumsPage() {
  const [activeTab, setActiveTab] = useState<DiggingTab>('tracks')
  const [albums, setAlbums] = useState<DiscoverAlbum[]>([])
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false)
  const [tracks, setTracks] = useState<DiscoverTrack[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [hiddenAlbums, setHiddenAlbums] = useState<Set<string>>(new Set())
  const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set())
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [selectedCurator, setSelectedCurator] = useState<string>('all')
  const pageSize = 10

  const { setAlbumContext, play, clearAlbumContext } = useAudio()

  // Handle clicking an album to view its tracks
  const handleAlbumClick = async (album: DiscoverAlbum) => {
    setError(null)

    try {
      const tracks = await getAlbumTracks(0, album.album, album.artist)

      // Populate the player with album context (doesn't auto-play)
      setAlbumContext(tracks, {
        name: album.album,
        artist: album.artist,
        cover: album.cover_url,
      })
    } catch (err) {
      setError('Failed to load album tracks. Please try again.')
      console.error(err)
    }
  }

  // Handle hiding an album
  const handleHideAlbum = async (album: DiscoverAlbum, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent album click event
    const albumKey = `${album.album}-${album.artist}`

    // Optimistically hide the album in UI
    setHiddenAlbums((prev) => new Set(prev).add(albumKey))

    // Send to backend
    try {
      await hideAlbum({ album: album.album, artist: album.artist })
    } catch (err) {
      console.error('Failed to hide album', err)
      // Optionally: revert the UI change if the API call fails
      // setHiddenAlbums((prev) => {
      //   const newSet = new Set(prev)
      //   newSet.delete(albumKey)
      //   return newSet
      // })
    }
  }

  // Handle playing a track from the Tracks tab
  const handlePlayTrack = async (track: DiscoverTrack) => {
    // Use track+artist as unique ID since we don't have numeric track-id
    const trackKey = `${track.track}-${track.artist}`
    setLoadingTrackId(trackKey)

    try {
      // Clear album context for single track mode
      clearAlbumContext()

      // Get stream URL - pass 0 for trackId since we don't have it
      // Backend will use track+artist to find the stream
      const streamUrl = await getStreamUrl(0, track.track, track.artist)

      // Play the track
      play({
        id: trackKey,
        title: track.track,
        artist: track.artist,
        album: `Curated by ${track.curator}`,
        streamUrl: streamUrl,
        coverArt: undefined,
        spotifyId: track['spotify-id'],
      })
    } catch (err) {
      console.error('Failed to load track:', err)
      setError('Failed to load track. Please try again.')
    } finally {
      setLoadingTrackId(null)
    }
  }

  // Handle hiding a track
  const handleHideTrack = async (track: DiscoverTrack, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent track click event
    const trackKey = `${track.track}-${track.artist}`

    // Optimistically hide the track in UI
    setHiddenTracks((prev) => new Set(prev).add(trackKey))

    // Send to backend
    try {
      await hideTrack({ track: track.track, artist: track.artist, 'spotify-id': track['spotify-id'] })
    } catch (err) {
      console.error('Failed to hide track', err)
      // Optionally: revert the UI change if the API call fails
      setHiddenTracks((prev) => {
        const newSet = new Set(prev)
        newSet.delete(trackKey)
        return newSet
      })
    }
  }

  // Handle manual refresh (clear cache and reload)
  const handleRefresh = () => {
    if (activeTab === 'albums') {
      localStorage.removeItem(ALBUMS_CACHE_KEY)
    } else if (activeTab === 'tracks') {
      localStorage.removeItem(TRACKS_CACHE_KEY)
    }
    setRefreshTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  useEffect(() => {
    setPage(1)
  }, [selectedCurator])

  useEffect(() => {
    if (activeTab !== 'albums') {
      return
    }

    let isCancelled = false

    const loadAlbums = async () => {
      setIsLoadingAlbums(true)
      setError(null)

      try {
        // Check cache first
        const cached = localStorage.getItem(ALBUMS_CACHE_KEY)
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached)
            const age = Date.now() - timestamp

            // Use cache if it's still fresh
            if (age < CACHE_DURATION_MS && Array.isArray(data)) {
              if (!isCancelled) {
                setAlbums(data)
                setIsLoadingAlbums(false)
              }
              return
            }
          } catch {
            // Invalid cache, continue to fetch
          }
        }

        // Fetch fresh data
        const data = await getAlbumsToDiscover()

        // Save to cache
        try {
          localStorage.setItem(
            ALBUMS_CACHE_KEY,
            JSON.stringify({ data, timestamp: Date.now() })
          )
        } catch {
          // Cache save failed (quota exceeded?), continue anyway
        }

        if (!isCancelled) {
          setAlbums(data)
        }
      } catch (err) {
        console.error('Failed to load albums to discover', err)
        if (!isCancelled) {
          setError('Failed to load albums to discover.')
          setAlbums([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingAlbums(false)
        }
      }
    }

    loadAlbums()

    return () => {
      isCancelled = true
    }
  }, [activeTab, refreshTrigger])

  useEffect(() => {
    if (activeTab !== 'tracks') {
      return
    }

    let isCancelled = false

    const loadTracks = async () => {
      setIsLoadingTracks(true)
      setError(null)

      try {
        // Check cache first
        const cached = localStorage.getItem(TRACKS_CACHE_KEY)
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached)
            const age = Date.now() - timestamp

            // Use cache if it's still fresh
            if (age < CACHE_DURATION_MS && Array.isArray(data)) {
              if (!isCancelled) {
                setTracks(data)
                setIsLoadingTracks(false)
              }
              return
            }
          } catch {
            // Invalid cache, continue to fetch
          }
        }

        // Fetch fresh data (always fetch all tracks)
        const data = await getTracksToDiscover()

        // Save to cache
        try {
          localStorage.setItem(
            TRACKS_CACHE_KEY,
            JSON.stringify({ data, timestamp: Date.now() })
          )
        } catch {
          // Cache save failed (quota exceeded?), continue anyway
        }

        if (!isCancelled) {
          setTracks(data)
        }
      } catch (err) {
        console.error('Failed to load tracks to discover', err)
        if (!isCancelled) {
          setError('Failed to load tracks to discover.')
          setTracks([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTracks(false)
        }
      }
    }

    loadTracks()

    return () => {
      isCancelled = true
    }
  }, [activeTab, refreshTrigger])

  return (
    <div className="w-full space-y-0">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DiggingTab)}
        className="w-full p-2"
      >
        <TabsList className="flex w-full gap-6">
          <TabsTrigger
            value="tracks"
            className="relative flex-1"
          >
            Tracks
          </TabsTrigger>
          <TabsTrigger
            value="albums"
            className="relative flex-1"
          >
            Albums
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'tracks' && (
        <div>
          {error && (
            <p className="text-center text-sm text-red-400" role="status">
              {error}
            </p>
          )}

          {/* Sync Tracks Button and Curator Filter */}
          <div className="flex items-center justify-left gap-3 w-full p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Tracks
            </Button>

            <select
              value={selectedCurator}
              onChange={(e) => setSelectedCurator(e.target.value)}
              className="bg-slate-800 text-white text-xs border border-slate-700 rounded-md h-9 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-600"
            >
              <option value="all">All Curators</option>
              {CURATORS.map((curator) => (
                <option key={curator} value={curator}>
                  {curator}
                </option>
              ))}
            </select>
          </div>

          {isLoadingTracks ? (
            <div className="text-center text-slate-400 py-12">Loading tracks...</div>
          ) : tracks.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No tracks available yet. Check back soon.
            </div>
          ) : (() => {
              const filteredTracks = tracks
                .filter((track) => !hiddenTracks.has(`${track.track}-${track.artist}`))
                .filter((track) => selectedCurator === 'all' || track.curator === selectedCurator)

              return (
                <>
                  <TrackList
                    variant="album"
                    tracks={filteredTracks
                      .slice((page - 1) * pageSize, page * pageSize)
                      .map((track, index) => ({
                        track: track.track,
                        'track-id': (page - 1) * pageSize + index,
                        artist: track.artist,
                        'track-number': (page - 1) * pageSize + index + 1,
                      }))}
                    loadingTrackId={loadingTrackId}
                    onSelect={(trackItem) => {
                      // Find the original DiscoverTrack from the filtered tracks array
                      const trackIndex = trackItem['track-id']
                      const originalTrack = filteredTracks[trackIndex]
                      if (originalTrack) {
                        handlePlayTrack(originalTrack)
                      }
                    }}
                    renderIndicator={(trackItem) => {
                      const trackIndex = trackItem['track-id']
                      const originalTrack = filteredTracks[trackIndex]
                      return (
                        <div className="text-xs text-slate-400 pr-2">
                          {originalTrack?.curator}
                        </div>
                      )
                    }}
                    renderAction={(trackItem) => {
                      const trackIndex = trackItem['track-id']
                      const originalTrack = filteredTracks[trackIndex]
                      if (!originalTrack) return null
                      return (
                        <button
                          onClick={(e) => handleHideTrack(originalTrack, e)}
                          className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 hover:bg-slate-700 rounded transition-opacity"
                          aria-label="Hide track"
                        >
                          <X className="h-4 w-4 md:h-3 md:w-3 text-slate-400 hover:text-white" />
                        </button>
                      )
                    }}
                  />
                  {filteredTracks.length > pageSize && (
                    <div className="text-xs text-slate-400 flex items-center justify-center gap-3 pt-2 pb-12">
                      <Button
                        className="text-xs"
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      >
                        Prev
                      </Button>
                      <span>
                        Page {page} of {Math.ceil(filteredTracks.length / pageSize)}
                      </span>
                      <Button
                        className="text-xs"
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={page >= Math.ceil(filteredTracks.length / pageSize)}
                        onClick={() =>
                          setPage((prev) => Math.min(Math.ceil(filteredTracks.length / pageSize), prev + 1))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )
            })()}
        </div>
      )}

      {activeTab === 'albums' && (
        <div>
          {error && (
            <p className="text-center text-sm text-red-400" role="status">
              {error}
            </p>
          )}

          {/* Sync Albums Button */}
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Albums
            </Button>
          </div>

          {isLoadingAlbums ? (
            <div className="text-center text-slate-400 py-12">Loading playlists...</div>
          ) : albums.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No albums available yet. Check back soon.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {albums
                  .filter((album) => !hiddenAlbums.has(`${album.album}-${album.artist}`))
                  .slice((page - 1) * pageSize, page * pageSize)
                  .map((album, index) => (
                    <div
                      key={`${album.album}-${(page - 1) * pageSize + index}`}
                      onClick={() => handleAlbumClick(album)}
                      className="group cursor-pointer"
                    >
                  <div className="border border-slate-700 aspect-square rounded-xl overflow-hidden bg-slate-900 relative">
                    <img
                      src={album.cover_url}
                      alt={`${album.album} by ${album.artist}`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <button
                      onClick={(e) => handleHideAlbum(album, e)}
                      className="absolute top-2 right-2 w-8 h-8 md:w-6 md:h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      aria-label="Hide album"
                    >
                      <X className="h-5 w-5 md:h-4 md:w-4 text-white" />
                    </button>
                  </div>
                  <div className="px-1 mt-2">
                    <p className="text-white font-semibold text-sm line-clamp-2">
                      {album.album}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">
                      {album.artist}
                    </p>
                  </div>
                </div>
                  ))}
              </div>
              {albums.length > pageSize && (
                <div className="text-xs text-slate-400 flex items-center justify-center gap-3 pt-4 pb-12">
                  <Button
                    className="text-xs"
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Prev
                  </Button>
                  <span>
                    Page {page} of {Math.ceil(albums.length / pageSize)}
                  </span>
                  <Button
                    className="text-xs"
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={page >= Math.ceil(albums.length / pageSize)}
                    onClick={() =>
                      setPage((prev) => Math.min(Math.ceil(albums.length / pageSize), prev + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
