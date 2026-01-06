import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchTracks, searchAlbums, getStreamUrl, getAlbumTracks } from '@/services/api'
import type { SearchResult, AlbumResult } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { Search as SearchIcon } from 'lucide-react'
import { TrackList } from '@/components/TrackList'

export function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<'tracks' | 'albums'>('tracks')
  const [albumResults, setAlbumResults] = useState<AlbumResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)

  const { play, setAlbumContext, clearAlbumContext } = useAudio() // Get the play function and album context functions from audio context

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsLoading(true)
    setError(null)
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
      setError('Search failed. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle clicking a track to play it
  const handlePlayTrack = async (result: SearchResult) => {
    setLoadingTrackId(result['track-id'])
    setError(null)

    try {
      // Clear album context when playing a single track
      clearAlbumContext()

      // Get the stream URL from n8n
      const streamUrl = await getStreamUrl(result['track-id'])

      // Play the track with metadata
      play({
        id: result['track-id'],
        title: result.track,
        artist: result.artist,
        album: result.album,
        streamUrl: streamUrl,
      })
    } catch (err) {
      setError('Failed to load track. Please try again.')
      console.error(err)
    } finally {
      setLoadingTrackId(null)
    }
  }

  // Handle clicking an album to view its tracks
  const handleAlbumClick = async (album: AlbumResult) => {
    setError(null)
    setIsLoading(true)

    try {
      const tracks = await getAlbumTracks(album['album-id'])

      // Populate the player with album context (doesn't auto-play)
      setAlbumContext(tracks, {
        name: album.album,
        artist: album.artist,
        cover: album.cover,
      })
    } catch (err) {
      setError('Failed to load album tracks. Please try again.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
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
          className="rounded-full bg-gray-700 border-transparent flex-1 text-white text-sm h-11"
        />
        <div className="flex items-center gap-2">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'tracks' | 'albums')}
            className="rounded-full bg-slate-900 border border-slate-700 text-white text-sm px-4 h-11 focus:outline-none focus:ring-2 focus:ring-white/20"
            aria-label="Search scope"
          >
            <option value="tracks">Tracks</option>
            <option value="albums">Albums</option>
          </select>
          <Button
            type="submit"
            disabled={isLoading}
            className="rounded-full bg-white text-slate-900 hover:bg-slate-200 whitespace-nowrap h-11 px-6"
          >
            {isLoading ? 'Searching...' : 'Search'}
            <SearchIcon className="h-4 w-4" />
          </Button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

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
