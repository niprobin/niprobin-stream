import { useEffect, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getAlbumsToDiscover, getAlbumTracks, type DiscoverAlbum } from '@/services/api'
import { useAudio } from '@/contexts/AudioContext'

type DiggingTab = 'tracks' | 'albums'

export function AlbumsPage() {
  const [activeTab, setActiveTab] = useState<DiggingTab>('tracks')
  const [albums, setAlbums] = useState<DiscoverAlbum[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { setAlbumContext } = useAudio()

  // Handle clicking an album to view its tracks
  const handleAlbumClick = async (album: DiscoverAlbum) => {
    setError(null)
    setIsLoading(true)

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
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'albums') {
      return
    }

    let isCancelled = false

    const loadAlbums = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getAlbumsToDiscover()
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
          setIsLoading(false)
        }
      }
    }

    loadAlbums()

    return () => {
      isCancelled = true
    }
  }, [activeTab])

  return (
    <div className="w-full space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as DiggingTab)}
        className="w-full p-4"
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
        <div className="text-center text-slate-500 py-12 text-sm">
          Track digging is coming soon. Switch to Albums to see fresh finds.
        </div>
      )}

      {activeTab === 'albums' && (
        <div className="space-y-2">
          {error && (
            <p className="text-center text-sm text-red-400" role="status">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="text-center text-slate-400 py-12">Loading playlists...</div>
          ) : albums.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No albums available yet. Check back soon.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {albums
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
                <div className="text-xs text-slate-400 flex items-center justify-center gap-3 pt-4">
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
