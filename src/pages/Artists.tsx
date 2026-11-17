import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Search, UserMinus } from 'lucide-react'
import { useFollowedArtists } from '@/contexts/FollowedArtistsContext'
import { matchesArtist, sortArtists, type ArtistSort } from '@/digging/followedArtists'
import { ROUTES, navigateTo } from '@/utils/routes'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { Pagination } from '@/components/ui/Pagination'

const SORT_KEY = 'niprobin-artists-sort'
const REVERSED_KEY = 'niprobin-artists-sort-reversed'
const ROW_HEIGHT = 44 // h-11
const HEADER_HEIGHT = 41 // h-10 + border
const MOBILE_PAGE_SIZE = 25

// The choices are remembered in this browser; a blocked localStorage just forgets them
function readChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function saveChoice(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not remembered
  }
}

// 2021-12-22 → 22 Dec 2021 (the day n8n says, whatever the time zone)
function formatDate(date: string | null): string | null {
  if (!date) return null
  const ms = Date.parse(date)
  if (Number.isNaN(ms)) return null
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// One grid for the header and the rows, so the columns line up
const COLS = 'grid grid-cols-[minmax(0,1fr)_4rem_4rem] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_8rem] items-center gap-x-4'

// Each column header sorts by it; a second click reverses the order
const COLUMNS: { sort: ArtistSort; label: string; title: string; className: string }[] = [
  { sort: 'name', label: 'Artist', title: 'Sort A→Z', className: 'justify-start' },
  { sort: 'picks', label: 'Picks', title: 'Sort by most Picks', className: 'justify-end' },
  { sort: 'albums', label: 'Rated', title: 'Sort by most Rated albums', className: 'justify-end' },
  { sort: 'followed', label: 'Followed', title: 'Sort by recently followed', className: 'justify-end hidden sm:flex' },
]

function Count({ n }: { n: number }) {
  return <span className={cn('text-right tabular-nums', n ? 'text-text-1' : 'text-text-3')}>{n || '–'}</span>
}

// The Followed artists as a table sorted by a column (A→Z, Picks, Rated albums, follow date): open one, or stop following it (5s Undo)
export function ArtistsPage() {
  const { artists, isLoading, loadFailed, reload, unfollow } = useFollowedArtists()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ArtistSort>(() =>
    readChoice(SORT_KEY, ['name', 'followed', 'picks', 'albums'], 'name'),
  )
  const [reversed, setReversed] = useState(() => readChoice(REVERSED_KEY, ['0', '1'], '0') === '1')
  const [page, setPage] = useState(1)

  // Follows made from an Artist page since the last load show up here
  useEffect(() => {
    reload()
  }, [reload])

  const shown = useMemo(
    () => sortArtists((artists ?? []).filter(artist => matchesArtist(artist.name, query)), sort, reversed),
    [artists, query, sort, reversed],
  )

  // Desktop: as many rows as fit above the docked player, so the page never scrolls
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const tableRef = useRef<HTMLDivElement>(null)
  const [fitRows, setFitRows] = useState(MOBILE_PAGE_SIZE)
  const hasTable = shown.length > 0
  useEffect(() => {
    const el = tableRef.current
    if (!isDesktop || !el) return
    const observer = new ResizeObserver(([entry]) => {
      setFitRows(Math.max(5, Math.floor((entry.contentRect.height - HEADER_HEIGHT) / ROW_HEIGHT)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isDesktop, hasTable])
  const pageSize = isDesktop ? fitRows : MOBILE_PAGE_SIZE
  // Unfollows and a smaller window can leave the page past the end
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const chooseSort = (column: ArtistSort) => {
    const nextReversed = column === sort ? !reversed : false
    setSort(column)
    setReversed(nextReversed)
    setPage(1)
    saveChoice(SORT_KEY, column)
    saveChoice(REVERSED_KEY, nextReversed ? '1' : '0')
  }

  return (
    <div className="w-full pb-32 pt-6 lg:pt-10 lg:pb-4 lg:h-full lg:flex lg:flex-col">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="font-serif-display italic text-4xl text-text-1">Artists</h1>
        {artists && artists.length > 0 && (
          <span className="text-sm font-mono text-text-3">{artists.length}</span>
        )}
      </div>

      {artists === null ? (
        loadFailed && !isLoading ? (
          <div className="py-16 text-center space-y-4">
            <p className="text-text-2">Couldn't load the Followed artists</p>
            <button
              type="button"
              onClick={reload}
              className="h-9 px-4 rounded-full border border-border text-sm font-medium text-text-1 hover:bg-bg-2 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="py-16 text-center text-text-2">Loading artists...</p>
        )
      ) : artists.length === 0 ? (
        <p className="py-16 text-center text-text-2">No followed artists yet. Follow one from its Artist page.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative flex-1 min-w-[12rem] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={event => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Filter artists"
                aria-label="Filter artists"
                className="w-full h-10 pl-9 pr-3 rounded-md-crate bg-bg-1 border border-border text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
              />
            </div>
            {pageCount > 1 && (
              <Pagination variant="simple" currentPage={currentPage} totalItems={shown.length} pageSize={pageSize} onPageChange={setPage} />
            )}
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-text-2">No artist matches "{query.trim()}"</p>
          ) : (
            <div ref={tableRef} className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border">
                <div className={cn(COLS, 'flex-1 min-w-0 h-10 px-3')}>
                  {COLUMNS.map(column => (
                    <button
                      key={column.sort}
                      type="button"
                      aria-pressed={sort === column.sort}
                      title={sort === column.sort ? 'Reverse the order' : column.title}
                      onClick={() => chooseSort(column.sort)}
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium transition-colors',
                        column.className,
                        sort === column.sort ? 'text-text-1' : 'text-text-2 hover:text-text-1',
                      )}
                    >
                      {column.label}
                      {sort === column.sort &&
                        (reversed
                          ? <ArrowUp aria-hidden="true" className="h-3 w-3 text-accent" />
                          : <ArrowDown aria-hidden="true" className="h-3 w-3 text-accent" />)}
                    </button>
                  ))}
                </div>
                <span className="shrink-0 w-9 mr-2" />
              </div>
              <ul>
                {visible.map(artist => (
                  <li
                    key={artist.deezer_id}
                    className="group flex items-center gap-2 rounded-lg hover:bg-bg-2 focus-within:bg-bg-2 transition-colors"
                  >
                    <a
                      href={ROUTES.artist(artist.deezer_id)}
                      onClick={event => {
                        // A plain click stays in the app; Ctrl/middle click opens a tab
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                        event.preventDefault()
                        navigateTo(ROUTES.artist(artist.deezer_id))
                      }}
                      aria-label={`${artist.name}: ${plural(artist.picks, 'Pick')}, ${plural(artist.ratedAlbums, 'Rated album')}`}
                      className={cn(COLS, 'flex-1 min-w-0 h-11 px-3 text-sm')}
                    >
                      <span className="text-text-1 truncate">{artist.name}</span>
                      <Count n={artist.picks} />
                      <Count n={artist.ratedAlbums} />
                      <span className="hidden sm:block text-right text-text-2 tabular-nums">{formatDate(artist.followedAt) ?? '–'}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => unfollow(artist)}
                      aria-label={`Stop following ${artist.name}`}
                      title="Unfollow"
                      className="shrink-0 mr-2 inline-flex items-center justify-center h-9 w-9 rounded-full text-text-2 hover:text-text-1 hover:bg-bg-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 transition"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
