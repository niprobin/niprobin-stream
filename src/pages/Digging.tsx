import { useEffect, useRef, useState } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AlbumCard } from '@/components/ui/AlbumCard'
import { CoverArtPlaceholder } from '@/components/ui/CoverArtPlaceholder'
import { EyebrowLabel } from '@/components/ui/EyebrowLabel'
import { X, ChevronDown, Heart, Loader2, ListPlus } from 'lucide-react'
import type { DiscoverAlbum, DiscoverTrack } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useShortlistAlbum } from '@/hooks/useShortlistAlbum'
import { useAudio, autoPlayInfo } from '@/contexts/AudioContext'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { useLikeModal } from '@/hooks/useLikeModal'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ROUTES, navigateTo } from '@/utils/routes'
import { isAlbumSaved, type AlbumsView } from '@/utils/albumUtils'
import type { AlbumTrackItem } from '@/contexts/AudioContext'
import type { FormEvent } from 'react'
import { LikeModal } from '@/components/LikeModal'

type DiggingTab = 'tracks' | 'albums'

interface AlbumsPageProps {
  activeTab: DiggingTab
  albumsView: AlbumsView
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

export function AlbumsPage({ activeTab, albumsView, currentPage, onPageChange }: AlbumsPageProps) {
  const [prevActiveTab, setPrevActiveTab] = useState<DiggingTab>(activeTab)
  const [curatorPickerOpen, setCuratorPickerOpen] = useState(false)

  const { curator, updateFilter, updateFilters } = useUrlFilters('digging')

  // Album grid columns match the `grid-cols-3 sm:grid-cols-4` classes below
  // (desktop column count is measured, see below) — page size is a multiple
  // of the current column count so the last row of a page is never partially
  // filled.
  const isTablet = useMediaQuery('(min-width: 640px)')
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  // Desktop: the album grid must show 2 full rows above the docked player
  // with no scroll. Covers are capped by the available height, and we add as
  // many columns as fit so the grid always fills the full width.
  const albumAreaRef = useRef<HTMLDivElement>(null)
  const [desktopAlbumColumns, setDesktopAlbumColumns] = useState(5)
  useEffect(() => {
    const el = albumAreaRef.current
    if (!isDesktop || activeTab !== 'albums' || !el) return
    const GAP = 16 // gap-4
    const GRID_TOP = 13 // pt-[13px]
    const TEXT_HEIGHT = 72 // title (2 lines) + artist under each cover
    const MAX_COVER = 320 // [&>*]:max-w-[320px]
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const maxCover = Math.min(MAX_COVER, (height - GRID_TOP - GAP - 2 * TEXT_HEIGHT) / 2)
      const cols = Math.ceil((width + GAP) / (Math.max(maxCover, 80) + GAP))
      setDesktopAlbumColumns(Math.max(5, cols))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isDesktop, activeTab])

  const albumColumns = isDesktop ? desktopAlbumColumns : isTablet ? 4 : 3
  const albumRows = isDesktop ? 2 : 3
  const albumPageSize = albumColumns * albumRows
  const trackPageSize = 10

  const { playList, loadingTrackId, currentTrack } = useAudio()
  const { token } = useAuth()

  const {
    discoverTracks: tracks,
    discoverAlbums: albums,
    hideTrack,
    hideAlbum,
  } = useDiscovery()

  const { shortlist: handleShortlistAlbum, isShortlisting: isAlbumShortlisting } = useShortlistAlbum()

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

  // Album page size depends on the grid's column count, which changes at
  // breakpoints — jump back to page 1 when the breakpoint actually changes
  // (not on initial mount) so the current page can't land past the new
  // last page, without clobbering the preserved page on remount.
  const [prevIsDesktop, setPrevIsDesktop] = useState(isDesktop)
  const [prevIsTablet, setPrevIsTablet] = useState(isTablet)
  useEffect(() => {
    if (isDesktop !== prevIsDesktop || isTablet !== prevIsTablet) {
      onPageChange(1)
      setPrevIsDesktop(isDesktop)
      setPrevIsTablet(isTablet)
    }
  }, [isDesktop, isTablet, prevIsDesktop, prevIsTablet, onPageChange])

  const buildQueueAndPlay = (filteredTracks: DiscoverTrack[], selectedTrack: DiscoverTrack) => {
    const allQueue = filteredTracks.map((t, index) => ({
      track: t.track,
      deezer_id: t.deezer_id,
      artist: t.artist,
      'track-number': index + 1,
      date: t.date,
      curator: t.curator,
      cover: t.cover_url,
    }))

    const globalIndex = filteredTracks.findIndex(
      t => t.track === selectedTrack.track && t.artist === selectedTrack.artist
    )

    playList(allQueue, globalIndex, autoPlayInfo('Discovery Tracks'))
  }

  // Curators list
  const availableCurators = Array.from(
    new Set(tracks.map(t => t.curator).filter(Boolean))
  ).sort()

  // Hoisted so both the sticky desktop header (pagination totals) and the
  // tab body below can share the same filtered lists.
  const filteredTracks = tracks.filter(t => curator === 'all' || t.curator === curator)
  // "Listen to" shows shortlisted albums; "Backlog" shows the rest
  const viewAlbums = albums.filter(a => isAlbumSaved(a) === (albumsView === 'listen'))
  const filteredAlbums = viewAlbums

  const queueCount = filteredTracks.length

  // Desktop column count follows the window size, so the page size can
  // shrink — keep the current page within range when it does.
  const albumLastPage = Math.max(1, Math.ceil(filteredAlbums.length / albumPageSize))
  useEffect(() => {
    if (activeTab === 'albums' && filteredAlbums.length > 0 && currentPage > albumLastPage) {
      onPageChange(albumLastPage)
    }
  }, [activeTab, filteredAlbums.length, currentPage, albumLastPage, onPageChange])

  const curatorFilterControl = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setCuratorPickerOpen(prev => !prev)}
        className="h-10 flex items-center gap-[6px] bg-bg-1 border border-border rounded-sm-crate px-[13px] text-[13px] font-medium text-text-2 hover:bg-bg-2 transition-colors"
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
  )

  return (
    <div className={`w-full space-y-0 ${activeTab === 'albums' ? 'lg:h-full lg:flex lg:flex-col' : ''}`}>

      {/* Desktop header row: title + tab-specific filter + pagination,
          sticky so pagination is always reachable without scrolling. */}
      <div className="hidden lg:flex lg:items-center lg:gap-4 lg:sticky lg:top-0 lg:z-10 lg:bg-bg-0 lg:py-4">
        <h1 className="font-serif-display italic text-2xl text-text-1 flex-shrink-0">
          {activeTab === 'tracks' ? 'Tracks' : albumsView === 'listen' ? 'Listen to' : 'Backlog'}
        </h1>

        <div className="flex-1 min-w-0">
          {activeTab === 'albums' ? (
            <div className="flex items-center justify-end">
              <EyebrowLabel className="text-[11px] flex-shrink-0">
                {filteredAlbums.length} {filteredAlbums.length === 1 ? 'album' : 'albums'}
              </EyebrowLabel>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              {curatorFilterControl}
              <EyebrowLabel className="text-[11px] flex-shrink-0">
                {queueCount} to listen
              </EyebrowLabel>
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          {activeTab === 'tracks' && filteredTracks.length > trackPageSize && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTracks.length}
              pageSize={trackPageSize}
              onPageChange={onPageChange}
              variant="simple"
            />
          )}
          {activeTab === 'albums' && filteredAlbums.length > albumPageSize && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredAlbums.length}
              pageSize={albumPageSize}
              onPageChange={onPageChange}
              variant="simple"
            />
          )}
        </div>
      </div>

      {activeTab === 'tracks' && (
        <div>
          {/* ── Curator chip + queue count (mobile/tablet only — desktop
                uses the sticky header above) ── */}
          <div className="flex items-center justify-between px-[18px] pt-3 pb-[6px] lg:hidden">
            {curatorFilterControl}
            <EyebrowLabel className="text-[11px]">
              {queueCount} to listen
            </EyebrowLabel>
          </div>

          {tracks.length === 0 ? (
            <div className="text-center text-text-2 py-12">
              No tracks available yet. Check back soon.
            </div>
          ) : (() => {
            const pagedTracks = filteredTracks.slice(
              (currentPage - 1) * trackPageSize,
              currentPage * trackPageSize
            )

            const mappedPagedTracks: AlbumTrackItem[] = pagedTracks.map((t, i) => ({
              track: t.track,
              deezer_id: t.deezer_id,
              artist: t.artist,
              'track-number': (currentPage - 1) * trackPageSize + i + 1,
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
                          e.stopPropagation()
                          if (originalTrack) hideTrack(originalTrack)
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

                {filteredTracks.length > trackPageSize && (
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredTracks.length}
                    pageSize={trackPageSize}
                    onPageChange={onPageChange}
                    className="pt-2 pb-12 lg:hidden"
                  />
                )}
              </>
            )
          })()}
        </div>
      )}

      {activeTab === 'albums' && (
        // Desktop: fills the space left between the sticky header and the
        // docked player, and is a size container so the grid can fit 2 rows.
        <div ref={albumAreaRef} className="lg:flex-1 lg:min-h-0 lg:pb-4">
          {filteredAlbums.length === 0 ? (
            <div className="text-center text-text-2 py-12">
              {albumsView === 'listen'
                ? 'No shortlisted albums yet. Use Shortlist on an album page to add one.'
                : 'No albums available yet. Check back soon.'}
            </div>
          ) : (
            <>
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-4 pt-[13px] [&>*]:max-w-[320px] [&>*]:mx-auto"
                style={isDesktop ? { gridTemplateColumns: `repeat(${albumColumns}, minmax(0, 1fr))` } : undefined}
              >
                {filteredAlbums
                  .slice((currentPage - 1) * albumPageSize, currentPage * albumPageSize)
                  .map((album, index) => (
                    <AlbumCard
                      key={`${album.album}-${(currentPage - 1) * albumPageSize + index}`}
                      album={album}
                      onClick={() => handleAlbumClick(album)}
                      leftActionButton={albumsView === 'backlog' && (() => {
                        // Shortlisted albums leave the Backlog, so no "saved" state here
                        const isShortlisting = isAlbumShortlisting(album)
                        return (
                          <button
                            onClick={(e) => handleShortlistAlbum(album, e)}
                            disabled={isShortlisting}
                            className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            aria-label="Shortlist album"
                            title="Shortlist"
                          >
                            {isShortlisting ? (
                              <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 text-white animate-spin" />
                            ) : (
                              <ListPlus className="h-4 w-4 md:h-3.5 md:w-3.5 text-white" />
                            )}
                          </button>
                        )
                      })()}
                      actionButton={
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            hideAlbum(album)
                          }}
                          className="w-8 h-8 md:w-6 md:h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 rounded-full md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                          aria-label="Hide album"
                        >
                          <X className="h-5 w-5 md:h-4 md:w-4 text-white" />
                        </button>
                      }
                    />
                  ))}
              </div>
              {filteredAlbums.length > albumPageSize && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredAlbums.length}
                  pageSize={albumPageSize}
                  onPageChange={onPageChange}
                  className="pt-4 pb-12 lg:hidden"
                />
              )}
            </>
          )}
        </div>
      )}

      <LikeModal
        isOpen={isLikeModalOpen}
        track={likeModalTrack}
        playlists={PLAYLISTS}
        selectedPlaylist={selectedPlaylist}
        isSubmitting={isSubmittingLike}
        onSelectPlaylist={setSelectedPlaylist}
        onSubmit={handleSubmitLike}
        onClose={closeLikeModal}
      />
    </div>
  )
}
