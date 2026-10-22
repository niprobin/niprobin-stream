import { useState, useEffect } from 'react'
import { searchTracks, searchAlbums, searchArtists, addAlbum } from '@/services/api'
import type { SearchResult, AlbumResult, ArtistSearchResult } from '@/types/api'
import { useNotification } from '@/contexts/NotificationContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useAuth } from '@/contexts/AuthContext'
import { useAudio, autoPlayInfo } from '@/contexts/AudioContext'
import { BookmarkPlus, Heart, Loader2 } from 'lucide-react'
import { useBacklog } from '@/contexts/BacklogContext'
import { ROUTES, navigateTo } from '@/utils/routes'
import { CarouselSection } from '@/components/ui/CarouselSection'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { NowPlayingOverlay } from '@/components/ui/NowPlayingIndicator'
import { isCurrentTrack } from '@/utils/trackUtils'
import { SectionHeader } from '@/components/ui/SectionHeader'

function CarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden pb-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40 space-y-2">
          <div className="w-40 h-40 bg-bg-2 rounded-md-crate animate-pulse" />
          <div className="h-3 bg-bg-2 rounded animate-pulse w-36" />
          <div className="h-3 bg-bg-2 rounded animate-pulse w-28" />
        </div>
      ))}
    </div>
  )
}

function TrackListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-[13px] px-[18px] py-[13px]">
          <div className="flex-shrink-0 w-[46px] h-[46px] rounded-sm-crate bg-bg-2 animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-bg-2 rounded animate-pulse w-40" />
            <div className="h-2.5 bg-bg-2 rounded animate-pulse w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchTrackRow({
  result,
  onPlay,
  isLoading,
  isCurrent,
  isPlaying,
  pickedFor,
}: {
  result: SearchResult
  onPlay: () => void
  isLoading: boolean
  isCurrent: boolean
  isPlaying: boolean
  // The Radio Playlist it's Picked for, or null
  pickedFor: string | null
}) {
  const cover = result.cover_url || result.cover
  return (
    <button
      onClick={onPlay}
      disabled={isLoading}
      className={`w-full flex items-center gap-[13px] px-[18px] py-[13px] border-b border-border text-left transition-colors active:bg-white/5 disabled:opacity-50 ${
        isCurrent ? 'bg-accent/10' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
      {cover ? (
        <div className="flex-shrink-0 w-[46px] h-[46px] rounded-sm-crate overflow-hidden">
          <img src={cover} alt={result.track} className="w-full h-full object-cover" />
        </div>
      ) : isLoading ? (
        <div className="flex-shrink-0 w-[46px] h-[46px] rounded-sm-crate bg-bg-2 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-text-3 animate-spin" />
        </div>
      ) : (
        <CoverArtPlaceholder size={46} radius={10} showLabel={false} className="flex-shrink-0" />
      )}
      {isCurrent && <NowPlayingOverlay isPlaying={isPlaying} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] font-semibold truncate leading-snug ${isCurrent ? 'text-accent' : 'text-text-1'}`}>{result.track}</p>
        <p className="text-[13px] text-text-2 truncate mt-0.5">{result.artist}</p>
      </div>
      {pickedFor && (
        <Heart className="h-4 w-4 flex-shrink-0 text-accent" fill="currentColor" aria-label={pickedFor} />
      )}
    </button>
  )
}

function SearchAlbumCard({
  album,
  onAdd,
  isAdding,
}: {
  album: AlbumResult
  onAdd: () => void
  isAdding: boolean
}) {
  const handleClick = () => {
    navigateTo(ROUTES.album(album.deezer_id))
  }

  return (
    <div className="flex-shrink-0 w-60 snap-start space-y-2">
      <button onClick={handleClick} className="w-full text-left group">
        {album.cover ? (
          <img
            src={album.cover}
            alt={album.album}
            className="w-60 h-60 rounded-md-crate object-cover group-hover:opacity-90 transition-opacity"
          />
        ) : (
          <CoverArtPlaceholder size={240} className="group-hover:opacity-90 transition-opacity" />
        )}
        <div className="mt-2">
          <p className="text-sm text-text-1 truncate w-60">{album.album}</p>
          <p className="text-xs text-text-2 truncate w-60">{album.artist}</p>
        </div>
      </button>
      <button
        onClick={onAdd}
        disabled={isAdding}
        className="w-full h-7 text-xs flex items-center justify-center gap-1 text-text-2 hover:text-text-1 border border-border hover:border-text-3 rounded-sm-crate transition-colors disabled:opacity-50"
      >
        {isAdding ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <BookmarkPlus className="h-3 w-3" />
        )}
        {isAdding ? 'Adding...' : 'Add'}
      </button>
    </div>
  )
}

function SearchArtistCard({ result }: { result: ArtistSearchResult }) {
  return (
    <button
      onClick={() => navigateTo(ROUTES.artist(result.deezer_id))}
      className="flex-shrink-0 w-36 snap-start text-left space-y-2 group"
    >
      {result.cover_url ? (
        <div className="w-36 h-36 rounded-full overflow-hidden group-hover:opacity-90 transition-opacity">
          <img
            src={result.cover_url}
            alt={result.artist}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <CoverArtPlaceholder size={144} circular showLabel={false} className="group-hover:opacity-90 transition-opacity" />
      )}
      <p className="text-sm text-text-1 truncate w-36 text-center">{result.artist}</p>
    </button>
  )
}

// Results page for the global SearchBar: the query comes from /search?q=...
// (App remounts this component, keyed by query, whenever it changes).
export function Search({ initialQuery = '' }: { initialQuery?: string }) {
  const query = initialQuery
  const [trackResults, setTrackResults] = useState<SearchResult[]>([])
  const [albumResults, setAlbumResults] = useState<AlbumResult[]>([])
  const [artistResults, setArtistResults] = useState<ArtistSearchResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [addingAlbumId, setAddingAlbumId] = useState<string | null>(null)

  const { isLoading, increment, decrement } = useLoading()
  const { showNotification } = useNotification()
  const { playList, loadingTrackId, currentTrack, isPlaying } = useAudio()
  const { pickedPlaylist } = useBacklog()
  const { token } = useAuth()

  const performSearch = async (q: string) => {
    if (!q.trim()) return
    increment()
    setHasSearched(true)
    try {
      const [tracksRes, albumsRes, artistsRes] = await Promise.allSettled([
        searchTracks(q),
        searchAlbums(q),
        searchArtists(q),
      ])
      if (tracksRes.status === 'fulfilled') setTrackResults(tracksRes.value)
      else { showNotification('Track search failed. Please try again.', 'error'); console.error(tracksRes.reason) }
      if (albumsRes.status === 'fulfilled') setAlbumResults(albumsRes.value)
      if (artistsRes.status === 'fulfilled') setArtistResults(artistsRes.value)
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

  const handleAddAlbum = async (album: AlbumResult) => {
    setAddingAlbumId(album.deezer_id)
    try {
      const response = await addAlbum(
        { album: album.album, artist: album.artist, deezer_id: album.deezer_id },
        token,
      )
      showNotification(response.message, response.status)
    } catch {
      showNotification("Couldn't Add this album", 'error')
    } finally {
      setAddingAlbumId(null)
    }
  }

  return (
    <div className="w-full py-8 lg:pt-4 space-y-6">
      {query ? (
        <h1 className="font-serif-display italic text-2xl text-text-1 truncate">
          Results for “{query}”
        </h1>
      ) : (
        <p className="text-text-2 text-center py-12">
          Use the search bar to find tracks, albums and artists.
        </p>
      )}

      {/* Artist Results */}
      {(isLoading || artistResults.length > 0) && (
        <CarouselSection title="Artists">
          {isLoading ? (
            <div className="flex gap-4 overflow-hidden pb-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-36 space-y-2">
                  <div className="w-36 h-36 bg-bg-2 rounded-full animate-pulse" />
                  <div className="h-3 bg-bg-2 rounded animate-pulse w-28 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            artistResults.map((artist, i) => (
              <SearchArtistCard key={`${artist.deezer_id}-${i}`} result={artist} />
            ))
          )}
        </CarouselSection>
      )}

      {/* Track Results */}
      {(isLoading || trackResults.length > 0) && (
        <section className="space-y-3">
          <SectionHeader title="Tracks" />
          {isLoading ? (
            <TrackListSkeleton />
          ) : (
            <div>
              {trackResults.map((result, i) => (
                <SearchTrackRow
                  key={`${result['track-id']}-${i}`}
                  result={result}
                  isLoading={loadingTrackId === result.deezer_id}
                  isCurrent={isCurrentTrack(currentTrack, { deezer_id: result.deezer_id, title: result.track, artist: result.artist })}
                  isPlaying={isPlaying}
                  pickedFor={pickedPlaylist({ deezer_id: result.deezer_id, title: result.track, artist: result.artist })}
                  onPlay={() => {
                    const queue = trackResults.map((r, idx) => ({
                      track: r.track,
                      deezer_id: r.deezer_id,
                      artist: r.artist,
                      'track-number': idx + 1,
                      cover: r.cover_url || r.cover,
                    }))
                    playList(queue, i, autoPlayInfo('Search Results'))
                  }}
                />
              ))}
            </div>
          )}
        </section>
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
                isAdding={addingAlbumId === album.deezer_id}
                onAdd={() => handleAddAlbum(album)}
              />
            ))
          )}
        </CarouselSection>
      )}

      {/* No Results */}
      {!isLoading && hasSearched && trackResults.length === 0 && albumResults.length === 0 && artistResults.length === 0 && (
        <p className="text-text-2 text-center py-8">No results found for "{query}".</p>
      )}
    </div>
  )
}
