import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/Pagination'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { RefreshCw, X, Search } from 'lucide-react'
import { getAlbumsToDiscover, hideDiscoveryAlbum, getTracksToDiscover, hideTrack, getAlbumTracks, type DiscoverAlbum, type DiscoverTrack } from '@/services/api'
import { useLoading } from '@/contexts/LoadingContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useAuth } from '@/contexts/AuthContext'
import { TrackList } from '@/components/TrackList'
import { useCachedData } from '@/hooks/useCachedData'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useHideItem } from '@/hooks/useHideItem'
import { useDiscoverySearch, albumFilterFunction } from '@/hooks/useDiscoverySearch'
import { generateStableTrackId } from '@/utils/trackUtils'
import { useAudio } from '@/contexts/AudioContext'

type DiggingTab = 'tracks' | 'albums'


const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000 // 6 hours

interface AlbumsPageProps {
  activeTab: DiggingTab
  currentPage: number
  onPageChange: (page: number) => void
}

export function AlbumsPage({ activeTab, currentPage, onPageChange }: AlbumsPageProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  console.log(`AlbumsPage: activeTab=${activeTab}, currentPage=${currentPage}`)
  const [selectedCurator, setSelectedCurator] = useState<string>('all')
  const pageSize = 10

  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext } = useAudio()
  const { increment, decrement } = useLoading()
  const { showNotification } = useNotification()
  const { isAuthenticated } = useAuth()

  // Use hide item hooks for albums and tracks
  const { hiddenItems: hiddenAlbums, hideItem: hideAlbumItem } = useHideItem<DiscoverAlbum>(
    (album) => hideDiscoveryAlbum({ id: album.id, album: album.album, artist: album.artist }),
    (album) => `${album.album}-${album.artist}`,
    { persistentCacheKey: 'niprobin-hidden-albums' }
  )

  const { hiddenItems: hiddenTracks, hideItem: hideTrackItem } = useHideItem<DiscoverTrack>(
    (track) => hideTrack({ track: track.track, artist: track.artist }),
    (track) => `${track.track}-${track.artist}`,
    { persistentCacheKey: 'niprobin-hidden-tracks' }
  )

  // Use cached data hooks for albums and tracks
  const { data: albums, refresh: refreshAlbums } = useCachedData<DiscoverAlbum[]>(
    ALBUMS_CACHE_KEY,
    getAlbumsToDiscover,
    {
      cacheDuration: CACHE_DURATION_MS,
      refreshTrigger,
      enabled: activeTab === 'albums',
      errorMessage: 'Failed to load albums to discover.',
    }
  )

  const { data: tracks, refresh: refreshTracks } = useCachedData<DiscoverTrack[]>(
    TRACKS_CACHE_KEY,
    getTracksToDiscover,
    {
      cacheDuration: CACHE_DURATION_MS,
      refreshTrigger,
      enabled: activeTab === 'tracks',
      errorMessage: 'Failed to load tracks to discover.',
    }
  )

  // Search hook for albums only
  const albumsSearch = useDiscoverySearch({
    data: albums || [],
    filterFunction: albumFilterFunction,
    setCurrentPage: onPageChange,
  })

  // Handle clicking an album to navigate to album page
  const handleAlbumClick = async (album: DiscoverAlbum) => {
    increment()
    try {
      // Fetch album tracks to get the album ID
      const tracks = await getAlbumTracks(0, album.album, album.artist)
      // Get album ID from first track
      const albumId = tracks[0]?.['album-id']
      if (albumId) {
        window.history.pushState({}, '', `/album/${albumId}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      } else {
        showNotification('Could not find album', 'error')
      }
    } catch (err) {
      console.error('Failed to load album:', err)
      showNotification('Failed to load album', 'error')
    } finally {
      decrement()
    }
  }


  // Handle track like operations
  const handleLikeTrack = (track: any) => {
    // Called after successful like operation
    // TrackList handles the full like modal flow internally
    console.log('Track liked successfully:', track.track, track.artist)
  }

  // Handle manual refresh (clear cache and reload)
  const handleRefresh = () => {
    if (activeTab === 'albums') {
      refreshAlbums()
    } else if (activeTab === 'tracks') {
      refreshTracks()
    }
    setRefreshTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    onPageChange(1)
    // Clear search when switching tabs
    if (activeTab === 'albums') {
      albumsSearch.clearSearch()
    }
  }, [activeTab])

  useEffect(() => {
    onPageChange(1)
  }, [selectedCurator])

  return (
    <div className="w-full space-y-0">

      {activeTab === 'tracks' && (
        <div>
          {/* Curator Filter and Sync Button */}
          <div className="px-2 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {/* Curator Filter - 80% width */}
              <div className="flex-1 min-w-0" style={{ flexBasis: '80%' }}>
                <select
                  value={selectedCurator}
                  onChange={(e) => setSelectedCurator(e.target.value)}
                  className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  <option value="all">All Curators</option>
                  {tracks && Array.from(
                    new Set(tracks.map(track => track.curator).filter(Boolean))
                  ).sort().map((curator) => (
                    <option key={curator} value={curator}>
                      {curator}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sync Tracks Button - 20% width */}
              <div className="flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 h-10 px-4"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync Tracks
                </Button>
              </div>
            </div>
          </div>

          {!tracks || tracks.length === 0 ? (
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
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((track, index) => ({
                        track: track.track,
                        'track-id': generateStableTrackId(track.track, track.artist),
                        artist: track.artist,
                        'track-number': (currentPage - 1) * pageSize + index + 1,
                      }))}
                    loadingTrackId={loadingTrackId}
                    enableLikeButtons={isAuthenticated}
                    onLikeTrack={handleLikeTrack}
                    isAuthenticated={isAuthenticated}
                    onSelect={(trackItem, _trackIndex) => {
                      // Find original track using stable ID matching
                      const originalTrack = filteredTracks.find(track =>
                        generateStableTrackId(track.track, track.artist) === trackItem['track-id']
                      )
                      if (originalTrack) {
                        // Create queue from all filtered tracks for seamless discovery
                        const allFilteredTracksQueue = filteredTracks.map((track, index) => ({
                          track: track.track,
                          'track-id': generateStableTrackId(track.track, track.artist),
                          artist: track.artist,
                          'track-number': index + 1,
                        }))

                        // Find the index of the selected track in the full filtered list
                        const globalTrackIndex = filteredTracks.findIndex(track =>
                          generateStableTrackId(track.track, track.artist) === trackItem['track-id']
                        )

                        // Create dynamic queue provider that always returns current filtered tracks
                        const queueProvider = () => {
                          const currentFilteredTracks = tracks
                            ?.filter((track) => !hiddenTracks.has(`${track.track}-${track.artist}`))
                            .filter((track) => selectedCurator === 'all' || track.curator === selectedCurator)
                            || []

                          return currentFilteredTracks.map((track, index) => ({
                            track: track.track,
                            'track-id': generateStableTrackId(track.track, track.artist),
                            artist: track.artist,
                            'track-number': index + 1,
                          }))
                        }

                        setAutoPlayContext(
                          allFilteredTracksQueue,
                          globalTrackIndex,
                          `Discovery Tracks`,
                          queueProvider
                        )

                        playTrack(
                          0, // Global rule: use 0 for streaming tracks without real database IDs
                          originalTrack.track,
                          originalTrack.artist,
                          {
                            clearAlbum: false,  // Keep auto-play context
                            albumName: `Discovery Tracks`
                          }
                        )
                      }
                    }}
                    renderAction={(trackItem) => {
                      const originalTrack = filteredTracks.find(track =>
                        generateStableTrackId(track.track, track.artist) === trackItem['track-id']
                      )
                      if (!originalTrack) return null

                      return (
                        <button
                          onClick={(e) => hideTrackItem(originalTrack, e)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-slate-700 rounded transition-colors mr-1"
                          aria-label="Hide track"
                        >
                          <X className="h-4 w-4 text-slate-400 hover:text-white" />
                        </button>
                      )
                    }}
                  />
                  {filteredTracks.length > pageSize && (
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredTracks.length}
                      pageSize={pageSize}
                      onPageChange={onPageChange}
                      className="pt-2 pb-12"
                    />
                  )}
                </>
              )
            })()}
        </div>
      )}

      {activeTab === 'albums' && (
        <div>
          {/* Search Bar and Sync Button */}
          <div className="px-2 pt-4 pb-3">
            <div className="flex items-center gap-3">
              {/* Search Input - 80% width */}
              <div className="relative flex-1 min-w-0" style={{ flexBasis: '80%' }}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search albums..."
                  value={albumsSearch.searchQuery}
                  onChange={(e) => albumsSearch.setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                />
                {albumsSearch.isSearchActive && (
                  <button
                    onClick={albumsSearch.clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sync Albums Button - 20% width */}
              <div className="flex-shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 h-10 px-4"
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync Albums
                </Button>
              </div>
            </div>

            {/* Results count */}
            {albumsSearch.isSearchActive && (
              <div className="text-xs text-slate-400 mt-2 px-1">
                Showing {albumsSearch.resultsCount} results for "{albumsSearch.searchQuery}"
              </div>
            )}
          </div>

          {!albums || albums.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No albums available yet. Check back soon.
            </div>
          ) : albumsSearch.isSearchActive && albumsSearch.resultsCount === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No albums found matching "{albumsSearch.searchQuery}". Try a different search term.
            </div>
          ) : (() => {
              const filteredAlbums = albumsSearch.filteredData
                .filter((album) => !hiddenAlbums.has(`${album.album}-${album.artist}`))

              return (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredAlbums
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((album, index) => (
                        <AlbumCard
                          key={`${album.album}-${(currentPage - 1) * pageSize + index}`}
                          album={album}
                          onClick={() => handleAlbumClick(album)}
                          actionButton={
                            <button
                              onClick={(e) => hideAlbumItem(album, e)}
                              className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                              aria-label="Hide album"
                            >
                              <X className="h-5 w-5 md:h-4 md:w-4 text-white" />
                            </button>
                          }
                        />
                      ))}
                  </div>
                  {filteredAlbums.length > pageSize && (
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredAlbums.length}
                      pageSize={pageSize}
                      onPageChange={onPageChange}
                      className="pt-4 pb-12"
                    />
                  )}
                </>
              )
            })()}
        </div>
      )}
    </div>
  )
}
