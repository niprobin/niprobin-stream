import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchTracks, getStreamUrl } from '@/services/api'
import type { SearchResult } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'
import { Search as SearchIcon } from 'lucide-react'

export function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null)

  const { play } = useAudio() // Get the play function from audio context

  // Handle search submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!query.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      const searchResults = await searchTracks(query)
      setResults(searchResults)
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

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <Input
          type="text"
          placeholder="Find your favourite track"
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
          <SearchIcon className="h-2 w-2" />
        </Button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="text-red-400 text-sm mb-4">{error}</div>
      )}

      {/* Search Results */}
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={`${result['track-id']}-${index}`}
            onClick={() => handlePlayTrack(result)}
            className="p-3 rounded-lg bg-gray-900 bg-opacity-90 cursor-pointer relative"
          >
            <div className="text-white font-semibold">{result.track}</div>
            <div className="text-slate-400 text-sm">{result.artist}</div>
            <div className="text-slate-500 text-xs">{result.album}</div>

            {/* Loading indicator for this specific track */}
            {loadingTrackId === result['track-id'] && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                Loading...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No Results Message */}
      {!isLoading && results.length === 0 && query && (
        <div className="text-slate-400 text-center py-8">
          No results found. Try a different search.
        </div>
      )}
    </div>
  )
}