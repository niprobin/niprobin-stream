import { useEffect, useState } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { EyebrowLabel } from '@/components/ui/EyebrowLabel'
import { X, ChevronDown, Heart, Loader2 } from 'lucide-react'
import { hideTrack, hideAlbum, type DiscoverAlbum, type DiscoverTrack } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useNotification } from '@/contexts/NotificationContext'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { useHideItem } from '@/hooks/useHideItem'
import { albumFilterFunction } from '@/hooks/useDiscoverySearch'
import { useAudio } from '@/contexts/AudioContext'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { useLikeModal } from '@/hooks/useLikeModal'
import { STORAGE_KEYS } from '@/utils/storageKeys'
import { ROUTES, navigateTo } from '@/utils/routes'
import type { AlbumTrackItem } from '@/contexts/AudioContext'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'

type DiggingTab = 'tracks' | 'albums'

interface AlbumsPageProps {
  activeTab: DiggingTab
  currentPage: number
  onPageChange: (page: number) => void
}

// Track row for the Digging tracks view
function DiggingTrackRow({
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
      className={`flex items-center gap-[13px] px-[18px] py-[13px] border-b border-border cursor-pointer active:bg-white/5 transition-colors ${
        isCurrentTrack ? 'bg-accent/[0.08]' : ''
      }`}
      onClick={onPlay}
    >
      {/* Album art */}
      {coverArt ? (
        <div className="flex-shrink-0 w-[46px] h-[46px] rounded-sm-crate overflow-hidden">
          <img src={coverArt} alt="" className="w-full h-full object-cover" />
        </div>
      ) : isLoading ? (
        <div className="flex-shrink-0 w-[46px] h-[46px] rounded-sm-crate bg-bg-2 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-text-3 animate-spin" />
        </div>
      ) : (
        <CoverArtPlaceholder size={46} radius={10} showLabel={false} className="flex-shrink-0" />
      )}

      {/* Title / Artist */}
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-semibold truncate leading-snug ${
          isCurrentTrack ? 'text-accent' : 'text-text-1'
        }`}>
          {track.track}
        </div>
        <div className="text-[13px] text-text-2 truncate mt-0.5">
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
          <span className="w-[38px] h-[38px] flex items-center justify-center rounded-full border border-border text-text-2 active:bg-bg-2 transition-colors">
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
              ? 'border-accent/50 text-accent'
              : 'border-border text-text-2 active:bg-bg-2'
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

  const { curator, search, updateFilter, updateFilters } = useUrlFilters('digging')
  const pageSize = 10

  const { playTrack, loadingTrackId } = useTrackPlayer()
  const { setAutoPlayContext, currentTrack } = useAudio()
  const { token } = useAuth()
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
    navigateTo(ROUTES.album(album.deezer_id))
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
          {/* ── Curator chip + queue count ── */}
          <div className="flex items-center justify-between px-[18px] pt-3 pb-[6px]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setCuratorPickerOpen(prev => !prev)}
                className="flex items-center gap-[6px] bg-bg-1 border border-border rounded-sm-crate px-[13px] py-[7px] text-[13px] font-medium text-text-2 hover:bg-bg-2 transition-colors"
              >
                {curator === 'all' ? 'All curators' : curator}
                <ChevronDown className="h-[11px] w-[11px] text-text-3" />
              </button>

              {/* Curator picker dropdown */}
              {curatorPickerOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-bg-1 border border-border rounded-md-crate shadow-xl min-w-[160px] py-1 overflow-hidden">
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
                          ? 'text-accent bg-accent/10'
                          : 'text-text-2 hover:bg-bg-2'
                      }`}
                    >
                      {c === 'all' ? 'All curators' : c}
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
                <EyebrowLabel className="text-[11px]">
                  {count} to listen
                </EyebrowLabel>
              )
            })()}
          </div>

          {tracks.length === 0 ? (
            <div className="text-center text-text-2 py-12">
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
                      <DiggingTrackRow
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
                className="w-full bg-bg-1 text-text-1 text-sm border border-border rounded-md-crate h-10 pl-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-colors"
              />
              {search && (
                <button
                  onClick={() => updateFilter('search', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text-1"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {albums.length === 0 ? (
            <div className="text-center text-text-2 py-12">
              No albums available yet. Check back soon.
            </div>
          ) : (() => {
            const filteredAlbums = albumFilterFunction(albums, search)
              .filter(a => !hiddenAlbums.has(`${a.album}-${a.artist}`))

            if (search && filteredAlbums.length === 0) {
              return (
                <div className="text-center text-text-2 py-12">
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] px-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitLike}
            className="w-full md:max-w-sm h-[90vh] max-h-[720px] flex flex-col bg-bg-1 border border-border rounded-lg-crate p-5 space-y-4 shadow-2xl md:h-auto md:max-h-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <EyebrowLabel>Add to playlist</EyebrowLabel>
                <p className="text-text-1 text-lg font-semibold truncate mt-1">{likeModalTrack.title}</p>
                <p className="text-text-2 text-sm truncate">{likeModalTrack.artist}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-text-2 hover:text-text-1 flex-shrink-0"
                onClick={closeLikeModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-1">
              {PLAYLISTS.map((playlist) => {
                const isSelected = selectedPlaylist === playlist
                return (
                  <button
                    type="button"
                    key={playlist}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className={`text-left text-sm px-3 py-2.5 rounded-md-crate border transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent/12 text-text-1 font-medium'
                        : 'border-border text-text-2 hover:border-text-3'
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
                className="text-text-2 hover:text-text-1"
                onClick={closeLikeModal}
                disabled={isSubmittingLike}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-accent text-accent-ink hover:bg-accent/90"
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
