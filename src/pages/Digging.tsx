import { useEffect, useState } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { X, ChevronDown, Music, Heart, Loader2 } from 'lucide-react'
import { hideTrack, hideAlbum, type DiscoverAlbum, type DiscoverTrack } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { TrackList } from '@/components/TrackList'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useHideItem } from '@/hooks/useHideItem'
import { albumFilterFunction } from '@/hooks/useDiscoverySearch'
import { useAudio } from '@/contexts/AudioContext'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLikeModal } from '@/hooks/useLikeModal'
import { STORAGE_KEYS } from '@/utils/storageKeys'
import { ROUTES } from '@/utils/routes'
import type { AlbumTrackItem } from '@/contexts/AudioContext'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'

type DiggingTab = 'tracks' | 'albums'

interface AlbumsPageProps {
  activeTab: DiggingTab
  currentPage: number
  onPageChange: (page: number) => void
}

// Mobile-only track row for the Digging view
function MobileTrackRow({
  track,
  isCurrentTrack,
  isLoading,
  coverArt,
  onPlay,
  onHide,
  onLike,
  isLiked,
}: {
  track: AlbumTrackItem
  isCurrentTrack: boolean
  isLoading: boolean
  coverArt?: string
  onPlay: () => void
  onHide: (e: React.MouseEvent) => void
  onLike: (e: React.MouseEvent) => void
  isLiked: boolean
}) {
  return (
    <div
      className={`flex items-center gap-[13px] px-[18px] py-[13px] border-b border-slate-800 cursor-pointer active:bg-white/5 transition-colors ${
        isCurrentTrack ? 'bg-blue-400/[0.06]' : ''
      }`}
      onClick={onPlay}
    >
      {/* Album art */}
      <div className="flex-shrink-0 w-[46px] h-[46px] rounded-[7px] overflow-hidden">
        {coverArt ? (
          <img src={coverArt} alt="" className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #534AB7 0%, #1D9E75 100%)' }}
          >
            {isLoading
              ? <Loader2 className="h-4 w-4 text-white/70 animate-spin" />
              : <Music className="h-4 w-4 text-white/50" />
            }
          </div>
        )}
      </div>

      {/* Title / Artist */}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-semibold truncate leading-snug ${
          isCurrentTrack ? 'text-blue-400' : 'text-white'
        }`}>
          {track.track}
        </div>
        <div className="text-[13px] text-slate-400 truncate mt-0.5">
          {track.artist}
        </div>
      </div>

      {/* Action buttons — circular, 38×38, touch target ≥44 */}
      <div className="flex items-center gap-[6px] flex-shrink-0">
        <button
          type="button"
          onClick={onHide}
          className="w-[44px] h-[44px] flex items-center justify-center"
          aria-label="Dismiss track"
        >
          <span className="w-[38px] h-[38px] flex items-center justify-center rounded-full border border-slate-700 text-slate-400 active:bg-slate-700 transition-colors">
            <X className="h-4 w-4" />
          </span>
        </button>
        <button
          type="button"
          onClick={onLike}
          className="w-[44px] h-[44px] flex items-center justify-center"
          aria-label={isLiked ? 'Liked' : 'Like track'}
        >
          <span className={`w-[38px] h-[38px] flex items-center justify-center rounded-full border transition-colors ${
            isLiked
              ? 'border-red-400/50 text-red-400'
              : 'border-slate-700 text-slate-400 active:bg-slate-700'
          }`}>
            <Heart className="h-4 w-4" fill={isLiked ? 'currentColor' : 'none'} />
          </span>
        </button>
      </div>
    </div>
  )
}

export function AlbumsPage({ activeTab, currentPage, onPageChange }: AlbumsPageProps) {
  const [prevActiveTab, setPrevActiveTab] = useState<DiggingTab>(activeTab)
  const [curatorPickerOpen, setCuratorPickerOpen] = useState(false)
  const isMobile = useIsMobile()

  const { curator, search, updateFilter, updateFilters } = useUrlFilters('digging')
  const pageSize = 10

  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext, currentTrack } = useAudio()
  const { isAuthenticated, token } = useAuth()
  const { showNotification } = useNotification()

  const {
    discoverTracks: tracks,
    discoverAlbums: albums,
  } = useDiscovery()

  const { hiddenItems: hiddenAlbums, hideItem: hideAlbumItem } = useHideItem(
    (album: DiscoverAlbum) => hideAlbum({ album: album.album, artist: album.artist, deezer_id: album.deezer_id }, token),
    (album: DiscoverAlbum) => `${album.album}-${album.artist}`,
    {
      persistentCacheKey: STORAGE_KEYS.HIDDEN_ALBUMS,
      onSuccess: (result) => showNotification(result.message || 'Album hidden', result.status),
    }
  )

  const { hiddenItems: hiddenTracks, hideItem: hideTrackItem } = useHideItem(
    (track: DiscoverTrack) => hideTrack({ track: track.track, artist: track.artist, deezer_id: track.deezer_id }, token),
    (track: DiscoverTrack) => `${track.track}-${track.artist}`,
    {
      persistentCacheKey: STORAGE_KEYS.HIDDEN_TRACKS,
      onSuccess: (result) => showNotification(result.message || 'Track hidden', result.status),
    }
  )

  const {
    isLikeModalOpen,
    likeModalTrack,
    selectedPlaylist,
    isSubmittingLike,
    PLAYLISTS,
    isTrackLiked,
    openLikeModal,
    closeLikeModal,
    handleSubmitLike: handleModalSubmit,
    setSelectedPlaylist,
  } = useLikeModal(token)

  const handleSubmitLike = async (event: FormEvent) => {
    await handleModalSubmit(event)
  }

  const handleAlbumClick = (album: DiscoverAlbum) => {
    window.history.pushState({}, '', ROUTES.album(album.deezer_id))
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleLikeTrack = (track: any) => {
    console.log('Track liked successfully:', track.track, track.artist)
  }

  useEffect(() => {
    if (prevActiveTab !== activeTab) {
      onPageChange(1)
      updateFilters({ search: '', curator: 'all' })
      setPrevActiveTab(activeTab)
    }
  }, [activeTab, prevActiveTab, onPageChange, updateFilters])

  const buildQueueAndPlay = (filteredTracks: DiscoverTrack[], selectedTrack: DiscoverTrack) => {
    const allQueue = filteredTracks.map((t, index) => ({
      track: t.track,
      deezer_id: t.deezer_id,
      artist: t.artist,
      'track-number': index + 1,
      date: t.date,
      curator: t.curator,
    }))

    const globalIndex = filteredTracks.findIndex(
      t => t.track === selectedTrack.track && t.artist === selectedTrack.artist
    )

    const queueProvider = () => {
      const current = tracks
        .filter(t => !hiddenTracks.has(`${t.track}-${t.artist}`))
        .filter(t => curator === 'all' || t.curator === curator)
      return current.map((t, i) => ({
        track: t.track,
        deezer_id: t.deezer_id,
        artist: t.artist,
        'track-number': i + 1,
        date: t.date,
        curator: t.curator,
      }))
    }

    setAutoPlayContext(allQueue, globalIndex, 'Discovery Tracks', queueProvider)
    playTrack(selectedTrack.track, selectedTrack.artist, {
      clearAlbum: false,
      deezer_id: selectedTrack.deezer_id,
      curator: selectedTrack.curator,
    })
  }

  // Curators list
  const availableCurators = Array.from(
    new Set(tracks.map(t => t.curator).filter(Boolean))
  ).sort()

  return (
    <div className="w-full space-y-0">

      {activeTab === 'tracks' && (
        <div>
          {isMobile ? (
            /* ── Mobile: curator chip + queue count ── */
            <div className="flex items-center justify-between px-[18px] pt-3 pb-[6px]">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCuratorPickerOpen(prev => !prev)}
                  className="flex items-center gap-[6px] bg-slate-800 border border-slate-700 rounded-[20px] px-[13px] py-[7px] text-[13px] font-medium text-slate-300 active:bg-slate-700 transition-colors"
                >
                  {curator === 'all' ? 'All Curators' : curator}
                  <ChevronDown className="h-[11px] w-[11px] text-slate-500" />
                </button>

                {/* Curator picker dropdown */}
                {curatorPickerOpen && (
                  <div className="absolute top-full left-0 mt-1 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl min-w-[160px] py-1 overflow-hidden">
                    {['all', ...availableCurators].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          updateFilter('curator', c)
                          setCuratorPickerOpen(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          curator === c
                            ? 'text-blue-400 bg-blue-400/10'
                            : 'text-slate-300 active:bg-slate-700'
                        }`}
                      >
                        {c === 'all' ? 'All Curators' : c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Queue count */}
              {(() => {
                const count = tracks
                  .filter(t => !hiddenTracks.has(`${t.track}-${t.artist}`))
                  .filter(t => curator === 'all' || t.curator === curator)
                  .length
                return (
                  <span className="font-mono text-[11px] text-slate-400 tracking-wide">
                    {count} to listen
                  </span>
                )
              })()}
            </div>
          ) : (
            /* ── Desktop: full-width select ── */
            <div className="px-2 pt-4 pb-3">
              <select
                value={curator}
                onChange={(e) => updateFilter('curator', e.target.value)}
                className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                <option value="all">All Curators</option>
                {availableCurators.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {tracks.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No tracks available yet. Check back soon.
            </div>
          ) : (() => {
            const filteredTracks = tracks
              .filter(t => !hiddenTracks.has(`${t.track}-${t.artist}`))
              .filter(t => curator === 'all' || t.curator === curator)

            const pagedTracks = filteredTracks.slice(
              (currentPage - 1) * pageSize,
              currentPage * pageSize
            )

            const mappedPagedTracks: AlbumTrackItem[] = pagedTracks.map((t, i) => ({
              track: t.track,
              deezer_id: t.deezer_id,
              artist: t.artist,
              'track-number': (currentPage - 1) * pageSize + i + 1,
              date: t.date,
              curator: t.curator,
            }))

            return (
              <>
                {isMobile ? (
                  /* ── Mobile track rows ── */
                  <div>
                    {mappedPagedTracks.map((item) => {
                      const originalTrack = filteredTracks.find(
                        t => t.track === item.track && t.artist === item.artist
                      )
                      const isCurrentTrack = !!(currentTrack &&
                        currentTrack.title === item.track &&
                        currentTrack.artist === item.artist)
                      const isLoading = loadingTrackId === item.deezer_id
                      const isLiked = isTrackLiked(item.track, item.artist)
                      const coverArt = originalTrack?.cover_url || (isCurrentTrack ? currentTrack?.coverArt : undefined)

                      return (
                        <MobileTrackRow
                          key={`${item.deezer_id}-${item['track-number']}`}
                          track={item}
                          isCurrentTrack={isCurrentTrack}
                          isLoading={isLoading}
                          coverArt={coverArt}
                          onPlay={() => {
                            if (originalTrack) buildQueueAndPlay(filteredTracks, originalTrack)
                          }}
                          onHide={(e) => {
                            if (originalTrack) hideTrackItem(originalTrack, e)
                          }}
                          onLike={(e) => {
                            e.stopPropagation()
                            openLikeModal(
                              item.deezer_id,
                              item.track,
                              item.artist,
                              undefined,
                              item.deezer_id
                            )
                          }}
                          isLiked={isLiked}
                        />
                      )
                    })}
                  </div>
                ) : (
                  /* ── Desktop TrackList ── */
                  <TrackList
                    variant="album"
                    tracks={mappedPagedTracks}
                    loadingTrackId={loadingTrackId}
                    enableLikeButtons={isAuthenticated}
                    onLikeTrack={handleLikeTrack}
                    currentTrackId={currentTrack?.id}
                    isAuthenticated={isAuthenticated}
                    onSelect={(trackItem) => {
                      const originalTrack = filteredTracks.find(
                        t => t.track === trackItem.track && t.artist === trackItem.artist
                      )
                      if (originalTrack) buildQueueAndPlay(filteredTracks, originalTrack)
                    }}
                    renderAction={(trackItem) => {
                      const originalTrack = filteredTracks.find(
                        t => t.track === trackItem.track && t.artist === trackItem.artist
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
                )}

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
          {/* Album search — desktop style, same on both */}
          <div className="px-2 pt-4 pb-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search albums..."
                value={search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full bg-slate-800 text-white text-sm border border-slate-700 rounded-lg h-10 pl-4 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
              />
              {search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {albums.length === 0 ? (
            <div className="text-center text-slate-400 py-12">
              No albums available yet. Check back soon.
            </div>
          ) : (() => {
            const filteredAlbums = albumFilterFunction(albums, search)
              .filter(a => !hiddenAlbums.has(`${a.album}-${a.artist}`))

            if (search && filteredAlbums.length === 0) {
              return (
                <div className="text-center text-slate-400 py-12">
                  No albums found matching "{search}".
                </div>
              )
            }

            return (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4 [&>*]:max-w-[320px] [&>*]:mx-auto">
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

      {/* Like Modal */}
      {isLikeModalOpen && likeModalTrack && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitLike}
            className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-slate-400 tracking-wide">Add to playlist</p>
                <p className="text-white text-lg font-semibold truncate">{likeModalTrack.title}</p>
                <p className="text-slate-400 text-sm truncate">{likeModalTrack.artist}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white"
                onClick={closeLikeModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => {
                const isSelected = selectedPlaylist === playlist
                return (
                  <button
                    type="button"
                    key={playlist}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-white bg-white/10 text-white'
                        : 'border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    {playlist}
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-300 hover:text-white"
                onClick={closeLikeModal}
                disabled={isSubmittingLike}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-white text-black hover:bg-white/90"
                disabled={isSubmittingLike || !selectedPlaylist}
              >
                {isSubmittingLike ? 'Saving...' : 'Add'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
