import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { searchTracks, searchAlbums, getStreamUrl, getAlbumTracks } from '@/services/api'
import type { SearchResult, AlbumResult } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { Search as SearchIcon } from 'lucide-react'

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
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Tabs for Track/Album Selection */}
      <Tabs value={searchType} onValueChange={(value) => setSearchType(value as 'tracks' | 'albums')} className="w-full mb-4">
        <TabsList className="w-full max-w-xs mx-auto">
          <TabsTrigger value="tracks" className="flex-1">Tracks</TabsTrigger>
          <TabsTrigger value="albums" className="flex-1">Albums</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input
          type="text"
          placeholder={searchType === 'tracks' ? 'Find your favourite track' : 'Find your favourite album'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full bg-gray-700 border-transparent flex-1 text-white"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="rounded-full bg-white text-slate-900 hover:bg-slate-200"
        >
          {isLoading ? 'Searching...' : 'Search'}
          <SearchIcon className="h-4 w-4" />
        </Button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Search Results - Track Results */}
      {searchType === 'tracks' && (
        <div className="space-y-2">
          {results.map((result, index) => (
            <div
              key={`${result['track-id']}-${index}`}
              onClick={() => handlePlayTrack(result)}
              className="flex gap-3 p-3 rounded-lg bg-gray-900 bg-opacity-90 cursor-pointer relative hover:bg-opacity-100 transition-all"
            >
              {/* Album Cover */}
              <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
                <img
                  src={result.cover}
                  alt={`${result.album} cover`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Track Info */}
              <div className="flex-1 min-w-0">
                <div className="text-white font-semibold truncate">{result.track}</div>
                <div className="text-slate-400 text-sm truncate">{result.artist}</div>
                <div className="text-slate-500 text-xs truncate">{result.album}</div>
              </div>

              {loadingTrackId === result['track-id'] && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                  Loading...
                </div>
              )}
            </div>
          ))}
        </div>
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
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-800 mb-2 relative">
                <img
                  src={album.cover}
                  alt={`${album.album} by ${album.artist}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
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