import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { searchTracks, searchAlbums, saveAlbum, getAlbumTracks } from '@/services/api'
import type { SearchResult, AlbumResult } from '@/types/api'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useAuth } from '@/contexts/AuthContext'
import { useAudio } from '@/contexts/AudioContext'
import { Search as SearchIcon, BookmarkPlus, Loader2 } from 'lucide-react'
import { ROUTES } from '@/utils/routes'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function CarouselSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-white font-semibold text-lg">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

function CarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-32 space-y-2">
          <div className="w-32 h-32 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-28" />
          <div className="h-3 bg-slate-800 rounded animate-pulse w-20" />
        </div>
      ))}
    </div>
  )
}

function SearchTrackCard({
  result,
  onPlay,
  isLoading,
}: {
  result: SearchResult
  onPlay: () => void
  isLoading: boolean
}) {
  return (
    <button
      onClick={onPlay}
      disabled={isLoading}
      className="flex-shrink-0 w-32 snap-start text-left space-y-2 group disabled:opacity-50"
    >
      {(result.cover_url || result.cover) ? (
        <img
          src={result.cover_url || result.cover}
          alt={result.track}
          className="w-32 h-32 rounded-lg object-cover group-hover:opacity-90 transition-opacity"
        />
      ) : (
        <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
          <span className="text-4xl">🎵</span>
        </div>
      )}
      <div>
        <p className="text-sm text-white truncate w-32">{result.track}</p>
        <p className="text-xs text-slate-400 truncate w-32">{result.artist}</p>
      </div>
    </button>
  )
}

function SearchAlbumCard({
  album,
  onSave,
  isSaving,
}: {
  album: AlbumResult
  onSave: () => void
  isSaving: boolean
}) {
  const { showNotification } = useNotification()

  const handleClick = async () => {
    const albumId = album['album-id']
    if (albumId) {
      navigateTo(ROUTES.album(albumId))
      return
    }
    try {
      const tracks = await getAlbumTracks(album.deezer_id, album.album, album.artist)
      const id = tracks[0]?.['album-id']
      if (id) navigateTo(ROUTES.album(id))
    } catch {
      showNotification('Failed to load album.', 'error')
    }
  }

  return (
    <div className="flex-shrink-0 w-32 snap-start space-y-2">
      <button onClick={handleClick} className="w-full text-left group">
        {album.cover ? (
          <img
            src={album.cover}
            alt={album.album}
            className="w-32 h-32 rounded-lg object-cover group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
            <span className="text-4xl">💿</span>
          </div>
        )}
        <div className="mt-2">
          <p className="text-sm text-white truncate w-32">{album.album}</p>
          <p className="text-xs text-slate-400 truncate w-32">{album.artist}</p>
        </div>
      </button>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full h-7 text-xs flex items-center justify-center gap-1 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-md transition-colors disabled:opacity-50"
      >
        {isSaving ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <BookmarkPlus className="h-3 w-3" />
        )}
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

export function Search({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [trackResults, setTrackResults] = useState<SearchResult[]>([])
  const [albumResults, setAlbumResults] = useState<AlbumResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null)

  const { isLoading, increment, decrement } = useLoading()
  const { showNotification } = useNotification()
  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext } = useAudio()
  const { token } = useAuth()

  const performSearch = async (q: string) => {
    if (!q.trim()) return
    increment()
    setHasSearched(true)
    try {
      const [tracks, albums] = await Promise.all([searchTracks(q), searchAlbums(q)])
      setTrackResults(tracks)
      setAlbumResults(albums)
    } catch (err) {
      showNotification('Search failed. Please try again.', 'error')
      console.error(err)
    } finally {
      decrement()
    }
  }

  useEffect(() => {
    if (initialQuery) performSearch(initialQuery)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveAlbum = async (album: AlbumResult) => {
    setSavingAlbumId(album.deezer_id)
    try {
      const response = await saveAlbum(
        { album: album.album, artist: album.artist, deezer_id: album.deezer_id },
        token,
      )
      showNotification(response.message, response.status)
    } catch {
      showNotification('Failed to save album', 'error')
    } finally {
      setSavingAlbumId(null)
    }
  }

  return (
    <div className="w-full py-8 space-y-6">
      {/* Search Form */}
      <form
        onSubmit={(e) => { e.preventDefault(); performSearch(query) }}
        className="flex gap-2"
      >
        <input
          type="text"
          placeholder="Search tracks and albums..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 px-4 focus:outline-none focus:ring-2 focus:ring-slate-600"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-white text-black h-10 px-5 rounded-lg hover:bg-white/90"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="h-4 w-4" />
          )}
        </Button>
      </form>

      {/* Track Results */}
      {(isLoading || trackResults.length > 0) && (
        <CarouselSection title="Tracks">
          {isLoading ? (
            <CarouselSkeleton />
          ) : (
            trackResults.map((result, i) => (
              <SearchTrackCard
                key={`${result['track-id']}-${i}`}
                result={result}
                isLoading={loadingTrackId === result.deezer_id}
                onPlay={() => {
                  const queue = trackResults.map((r, idx) => ({
                    track: r.track,
                    deezer_id: r.deezer_id,
                    artist: r.artist,
                    'track-number': idx + 1,
                  }))
                  setAutoPlayContext(queue, i, 'Search Results', () => queue)
                  playTrack(result.track, result.artist, {
                    clearAlbum: false,
                    albumName: result.album,
                    coverArt: result.cover_url || result.cover,
                    deezer_id: result.deezer_id,
                  })
                }}
              />
            ))
          )}
        </CarouselSection>
      )}

      {/* Album Results */}
      {(isLoading || albumResults.length > 0) && (
        <CarouselSection title="Albums">
          {isLoading ? (
            <CarouselSkeleton />
          ) : (
            albumResults.map((album, i) => (
              <SearchAlbumCard
                key={`${album.deezer_id}-${i}`}
                album={album}
                isSaving={savingAlbumId === album.deezer_id}
                onSave={() => handleSaveAlbum(album)}
              />
            ))
          )}
        </CarouselSection>
      )}

      {/* No Results */}
      {!isLoading && hasSearched && trackResults.length === 0 && albumResults.length === 0 && (
        <p className="text-slate-400 text-center py-8">No results found for "{query}".</p>
      )}
    </div>
  )
}
