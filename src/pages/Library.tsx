import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/ui/Pagination'
import { RefreshCw, Search, X } from 'lucide-react'
import { getLibraryTracks, type LibraryTrack } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { TrackList } from '@/components/TrackList'
import { useCachedData } from '@/hooks/useCachedData'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { libraryFilterFunction } from '@/hooks/useDiscoverySearch'
import { TrackIdSource } from '@/utils/trackUtils'
import { useAudio } from '@/contexts/AudioContext'
import { useUrlFilters } from '@/hooks/useUrlFilters'

const LIBRARY_CACHE_KEY = 'niprobin-library-cache'
const CACHE_DURATION_MS = 60 * 60 * 1000 // 1 hour

interface LibraryPageProps {
  currentPage: number
  onPageChange: (page: number) => void
}

export function LibraryPage({ currentPage, onPageChange }: LibraryPageProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const pageSize = 10

  // Use URL-based filters for state management
  const { folder, search, updateFilter } = useUrlFilters('library')

  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext, currentTrack, isPlaying } = useAudio()
  const { isAuthenticated, token } = useAuth()

  // Use cached data hook for library tracks
  const { data: tracks, refresh: refreshTracks } = useCachedData<LibraryTrack[]>(
    LIBRARY_CACHE_KEY,
    () => getLibraryTracks(token),
    {
      cacheDuration: CACHE_DURATION_MS,
      refreshTrigger,
      enabled: true,
      errorMessage: 'Failed to load library tracks.',
    }
  )

  // Library search and folder filtering is now handled by URL filters

  // Handle track like operations
  const handleLikeTrack = (track: any) => {
    // Called after successful like operation
    // TrackList handles the full like modal flow internally
    console.log('Track liked successfully:', track.track, track.artist)
  }

  // Handle manual refresh (clear cache and reload)
  const handleRefresh = () => {
    refreshTracks()
    setRefreshTrigger((prev) => prev + 1)
  }

  // Page reset and filter management is now handled automatically by useUrlFilters hook

  return (
    <div className="w-full space-y-0">
      {/* Search Bar, Folder Filter, and Sync Button */}
      <div className="px-2 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          {/* Search Input - 80% width */}
          <div className="relative flex-1 min-w-0" style={{ flexBasis: '80%' }}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tracks, artists, or folders..."
              value={search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => updateFilter('search', '')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Sync Library Button - 20% width */}
          <div className="flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1.5 h-10 px-4"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Library
            </Button>
          </div>
        </div>

        {/* Folder Tags */}
        {tracks && tracks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('folder', 'all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                folder === 'all'
                  ? 'bg-white text-black'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              All Folders
            </button>
            {Array.from(
              new Set(tracks.map(track => track.folder).filter(Boolean))
            ).sort().map((trackFolder) => (
              <button
                key={trackFolder}
                onClick={() => updateFilter('folder', trackFolder)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition ${
                  folder === trackFolder
                    ? 'bg-white text-black'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
              >
                {trackFolder}
              </button>
            ))}
          </div>
        )}

        {/* Search results count */}
        {search && (
          <div className="text-xs text-slate-400 mt-2 px-1">
            Searching for "{search}"
          </div>
        )}
      </div>

      {!tracks || tracks.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          No tracks in your library yet. Upload some music to get started.
        </div>
      ) : (() => {
          // Apply search filtering first, then folder filtering
          const searchFiltered = libraryFilterFunction(tracks, search)
          const filteredTracks = searchFiltered
            .filter((track) => folder === 'all' || track.folder === folder)

          // Show no results message if search is active but no results
          if (search && filteredTracks.length === 0) {
            return (
              <div className="text-center text-slate-400 py-12">
                No tracks found matching "{search}". Try a different search term.
              </div>
            )
          }

          return (
            <>
              <TrackList
                variant="album"
                tracks={filteredTracks
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((track, index) => ({
                    track: track.track,
                    'track-id': 0,
                    artist: track.artist,
                    'track-number': (currentPage - 1) * pageSize + index + 1,
                  }))}
                loadingTrackId={loadingTrackId}
                enableLikeButtons={false}
                onLikeTrack={handleLikeTrack}
                currentTrackId={currentTrack?.id}
                isPlaying={isPlaying}
                isAuthenticated={isAuthenticated}
                onSelect={(trackItem) => {
                  // Find original track using track name and artist matching
                  const originalTrack = filteredTracks.find(track =>
                    track.track === trackItem.track && track.artist === trackItem.artist
                  )
                  if (originalTrack) {
                    // Create queue from all filtered tracks for seamless library playback
                    const allFilteredTracksQueue = filteredTracks.map((track, index) => ({
                      track: track.track,
                      'track-id': 0,
                      artist: track.artist,
                      'track-number': index + 1,
                    }))

                    // Find the index of the selected track in the full filtered list
                    const globalTrackIndex = filteredTracks.findIndex(track =>
                      track.track === trackItem.track && track.artist === trackItem.artist
                    )

                    // Create dynamic queue provider that always returns current filtered tracks
                    const queueProvider = () => {
                      const currentSearchFiltered = libraryFilterFunction(tracks || [], search)
                      const currentFilteredTracks = currentSearchFiltered
                        .filter((track) => folder === 'all' || track.folder === folder)

                      return currentFilteredTracks.map((track, index) => ({
                        track: track.track,
                        'track-id': 0,
                        artist: track.artist,
                        'track-number': index + 1,
                      }))
                    }

                    setAutoPlayContext(
                      allFilteredTracksQueue,
                      globalTrackIndex,
                      `Library`,
                      queueProvider
                    )

                    playTrack(
                      0, // Library tracks use consistent fallback (handled by normalization)
                      originalTrack.track,
                      originalTrack.artist,
                      {
                        clearAlbum: false,  // Keep auto-play context
                        source: TrackIdSource.Discovery
                      }
                    )
                  }
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
  )
}