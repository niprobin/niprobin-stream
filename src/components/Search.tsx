import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchTracks, searchAlbums } from '@/services/api'
import type { SearchResult, AlbumResult } from '@/services/api'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useAlbumLoader } from '@/hooks/useAlbumLoader'
import { Search as SearchIcon } from 'lucide-react'
import { TrackList } from '@/components/TrackList'

export function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const { isLoading, increment, decrement } = useLoading()
  const [searchType, setSearchType] = useState<'tracks' | 'albums'>('tracks')
  const [albumResults, setAlbumResults] = useState<AlbumResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const { showNotification } = useNotification()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { loadAlbum } = useAlbumLoader()

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    increment()
    setHasSearched(true)

    try {
      if (searchType === 'tracks') {
        const searchResults = await searchTracks(query)
        setResults(searchResults)
        setAlbumResults([]) // Clear album results
      } else {
        const searchResults = await searchAlbums(query)
        setAlbumResults(searchResults)
        setResults([]) // Clear track results
      }
    } catch (err) {
      showNotification('Search failed. Please try again.', 'error')
      console.error(err)
    } finally {
      decrement()
    }
  }

  // Handle clicking a track to play it
  const handlePlayTrack = async (result: SearchResult) => {
    playTrack(
      Number(result['track-id']),
      result.track,
      result.artist,
      {
        clearAlbum: true,
        albumName: result.album,
        coverArt: result.cover,
      }
    )
  }

  // Handle clicking an album to view its tracks
  const handleAlbumClick = async (album: AlbumResult) => {
    loadAlbum(
      album['album-id'],
      album.album,
      album.artist,
      album.cover,
      { expand: false, loadFirst: true }
    )
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col gap-2 mb-6 sm:flex-row sm:items-center"
      >
        <Input
          type="text"
          placeholder={searchType === 'tracks' ? 'Find a track' : 'Find an album'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full bg-gray-700 border-transparent flex-1 text-white text-sm min-h-11"
        />
        <div className="flex items-center gap-2">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'tracks' | 'albums')}
            className="rounded-full bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 h-11 px-4"
            aria-label="Search scope"
          >
            <option value="tracks">Track</option>
            <option value="albums">Album</option>
          </select>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    size={null as any}
                    className="flex-1 rounded-full bg-white text-slate-900 hover:bg-slate-200 whitespace-nowrap h-11 px-6"
                  >
                    {isLoading ? 'Searching...' : 'Search'}
                    <SearchIcon className="h-4 w-4" />
                  </Button>
        </div>
      </form>

      {/* Search Results - Track Results */}
      {searchType === 'tracks' && (
        <TrackList
          variant="search"
          tracks={results.map((result) => ({
            id: result['track-id'],
            title: result.track,
            artist: result.artist,
            album: result.album,
            cover: result.cover,
          }))}
          loadingTrackId={loadingTrackId}
          onSelect={(track) =>
            handlePlayTrack({
              track: track.title,
              artist: track.artist,
              album: track.album ?? '',
              'track-id': track.id,
              cover: track.cover ?? '',
            })
          }
        />
      )}

      {/* Search Results - Album Results */}
      {searchType === 'albums' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {albumResults.map((album, index) => (
            <div
              key={`${album['album-id']}-${index}`}
              onClick={() => handleAlbumClick(album)}
              className="group cursor-pointer"
            >
              {/* Album Cover */}
              <div className="border border-slate-600 aspect-square rounded-lg overflow-hidden bg-gray-800 mb-2 relative">
                <img
                  src={album.cover}
                  alt={`${album.album} by ${album.artist}`}
                  className="w-full h-full object-cover transition-transform"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity" />
              </div>

              {/* Album Info */}
              <div className="px-1">
                <div className="text-white font-semibold text-sm line-clamp-2 mb-1">
                  {album.album}
                </div>
                <div className="text-slate-400 text-xs line-clamp-1">
                  {album.artist}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results Message */}
      {!isLoading && hasSearched && results.length === 0 && albumResults.length === 0 && (
        <div className="text-slate-400 text-center py-8">
          No results found. Try a different search.
        </div>
      )}
    </div>
  )
}
