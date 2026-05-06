import { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useNotification } from '@/contexts/NotificationContext'
import { getAlbumTracks, searchTracks, searchAlbums } from '@/services/api'
import { ROUTES } from '@/utils/routes'
import type { SearchResult, AlbumResult, DiscoverTrack, DiscoverAlbum } from '@/types/api'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-slate-500 font-medium">
      {label}
    </p>
  )
}

function TrackRow({ track, artist, onClick }: { track: string; artist: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 text-left transition-colors"
    >
      <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 text-sm">🎵</div>
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{track}</p>
        <p className="text-xs text-slate-400 truncate">{artist}</p>
      </div>
    </button>
  )
}

function AlbumRow({ album, artist, cover, onClick }: { album: string; artist: string; cover?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 text-left transition-colors"
    >
      {cover ? (
        <img src={cover} alt={album} className="w-8 h-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 text-sm">💿</div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{album}</p>
        <p className="text-xs text-slate-400 truncate">{artist}</p>
      </div>
    </button>
  )
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [externalTracks, setExternalTracks] = useState<SearchResult[]>([])
  const [externalAlbums, setExternalAlbums] = useState<AlbumResult[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchedQuery, setSearchedQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const { discoverTracks, discoverAlbums } = useDiscovery()
  const { playTrack } = useTrackPlayer()
  const { showNotification } = useNotification()

  const filteredDiggingTracks: DiscoverTrack[] = hasSearched && query
    ? discoverTracks
        .filter(t =>
          t.track.toLowerCase().includes(query.toLowerCase()) ||
          t.artist.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : []

  const filteredDiggingAlbums: DiscoverAlbum[] = hasSearched && query
    ? discoverAlbums
        .filter(a =>
          a.album.toLowerCase().includes(query.toLowerCase()) ||
          a.artist.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const id = ++requestIdRef.current
    setIsLoading(true)
    setIsOpen(true)
    setHasSearched(true)
    setSearchedQuery(query)
    try {
      const [tracks, albums] = await Promise.all([
        searchTracks(query),
        searchAlbums(query),
      ])
      if (id !== requestIdRef.current) return
      setExternalTracks(tracks.slice(0, 4))
      setExternalAlbums(albums.slice(0, 4))
    } catch {
      if (id !== requestIdRef.current) return
      setExternalTracks([])
      setExternalAlbums([])
    } finally {
      if (id === requestIdRef.current) setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!val) {
      setHasSearched(false)
      setSearchedQuery('')
      setIsOpen(false)
      setExternalTracks([])
      setExternalAlbums([])
    }
  }

  const handleAlbumClick = async (deezer_id: string, album: string, artist: string) => {
    setIsOpen(false)
    try {
      const tracks = await getAlbumTracks(deezer_id, album, artist)
      const albumId = tracks[0]?.['album-id']
      if (albumId) {
        navigateTo(ROUTES.album(albumId))
      } else {
        showNotification('Could not load album. Please try again.', 'error')
      }
    } catch {
      showNotification('Failed to load album. Please try again.', 'error')
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const hasResults =
    externalTracks.length > 0 ||
    externalAlbums.length > 0 ||
    filteredDiggingTracks.length > 0 ||
    filteredDiggingAlbums.length > 0

  return (
    <div ref={containerRef} className="relative flex-1 max-w-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 focus-within:border-slate-500 rounded-lg px-3 py-1.5 transition-colors">
          <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onFocus={() => hasSearched && query === searchedQuery && setIsOpen(true)}
            placeholder="Search…"
            className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none flex-1 min-w-0"
          />
        </div>
      </form>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-y-auto max-h-[70vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : hasResults ? (
            <div className="py-1">
              {externalTracks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between pr-3">
                    <SectionLabel label="External Tracks" />
                    <button
                      onClick={() => {
                        navigateTo(`/search?q=${encodeURIComponent(query)}`)
                        setIsOpen(false)
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      See all →
                    </button>
                  </div>
                  {externalTracks.map((r, i) => (
                    <TrackRow
                      key={i}
                      track={r.track}
                      artist={r.artist}
                      onClick={() => {
                        playTrack(r.track, r.artist, { clearAlbum: false, deezer_id: r.deezer_id })
                        setIsOpen(false)
                      }}
                    />
                  ))}
                </div>
              )}

              {externalAlbums.length > 0 && (
                <div>
                  <SectionLabel label="External Albums" />
                  {externalAlbums.map((r, i) => (
                    <AlbumRow
                      key={i}
                      album={r.album}
                      artist={r.artist}
                      cover={r.cover}
                      onClick={() => handleAlbumClick(r.deezer_id, r.album, r.artist)}
                    />
                  ))}
                </div>
              )}

              {filteredDiggingTracks.length > 0 && (
                <div>
                  <SectionLabel label="Digging Tracks" />
                  {filteredDiggingTracks.map((t, i) => (
                    <TrackRow
                      key={i}
                      track={t.track}
                      artist={t.artist}
                      onClick={() => {
                        playTrack(t.track, t.artist, {
                          clearAlbum: false,
                          deezer_id: t.deezer_id,
                          curator: t.curator,
                        })
                        setIsOpen(false)
                      }}
                    />
                  ))}
                </div>
              )}

              {filteredDiggingAlbums.length > 0 && (
                <div>
                  <SectionLabel label="Digging Albums" />
                  {filteredDiggingAlbums.map((a, i) => (
                    <AlbumRow
                      key={i}
                      album={a.album}
                      artist={a.artist}
                      cover={a.cover_url}
                      onClick={() => handleAlbumClick(a.deezer_id, a.album, a.artist)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">No results found</p>
          )}
        </div>
      )}
    </div>
  )
}
