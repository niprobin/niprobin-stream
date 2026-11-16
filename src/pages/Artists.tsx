import { useEffect, useMemo, useState } from 'react'
import { Search, UserMinus } from 'lucide-react'
import { useFollowedArtists } from '@/contexts/FollowedArtistsContext'
import { matchesArtist, sortArtists, type ArtistSort, type FollowedArtist } from '@/digging/followedArtists'
import { ROUTES, navigateTo } from '@/utils/routes'
import { cn } from '@/lib/utils'

const SORT_KEY = 'niprobin-artists-sort'

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

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-xs text-text-3">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-border p-0.5">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'h-7 px-3 rounded-full text-xs font-medium transition-colors',
              value === option.value ? 'bg-bg-2 text-text-1' : 'text-text-2 hover:text-text-1',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// "12 Picks · 3 Rated albums · Followed 13 Nov 2026"
function Activity({ artist }: { artist: FollowedArtist }) {
  const followed = formatDate(artist.followedAt)
  return (
    <p className="text-xs text-text-2 truncate">
      <span className={artist.picks ? '' : 'text-text-3'}>{plural(artist.picks, 'Pick')}</span>
      <span className="text-text-3"> · </span>
      <span className={artist.ratedAlbums ? '' : 'text-text-3'}>{plural(artist.ratedAlbums, 'Rated album')}</span>
      {followed && <span className="text-text-3 font-mono"> · Followed {followed}</span>}
    </p>
  )
}

// The Followed artists, sorted A→Z, by follow date or by Picks/Rated albums: open one, or stop following it (5s Undo)
export function ArtistsPage() {
  const { artists, isLoading, loadFailed, reload, unfollow } = useFollowedArtists()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<ArtistSort>(() =>
    readChoice(SORT_KEY, ['name', 'followed', 'picks', 'albums'], 'name'),
  )

  // Follows made from an Artist page since the last load show up here
  useEffect(() => {
    reload()
  }, [reload])

  const shown = useMemo(
    () => sortArtists((artists ?? []).filter(artist => matchesArtist(artist.name, query)), sort),
    [artists, query, sort],
  )

  return (
    <div className="w-full pb-32 pt-6 lg:pt-10">
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
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <Segmented
              label="Sort"
              value={sort}
              options={[
                { value: 'name', label: 'A→Z' },
                { value: 'followed', label: 'Recently followed' },
                { value: 'picks', label: 'Most Picks' },
                { value: 'albums', label: 'Most Rated albums' },
              ]}
              onChange={value => {
                setSort(value)
                saveChoice(SORT_KEY, value)
              }}
            />
          </div>

          <div className="relative mb-4 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Filter artists"
              aria-label="Filter artists"
              className="w-full h-10 pl-9 pr-3 rounded-md-crate bg-bg-1 border border-border text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:border-accent"
            />
          </div>

          {shown.length === 0 ? (
            <p className="py-10 text-center text-text-2">No artist matches "{query.trim()}"</p>
          ) : (
            <ul className="space-y-1">
              {shown.map(artist => (
                <li
                  key={artist.deezer_id}
                  className="flex items-center gap-2 rounded-lg hover:bg-bg-2 transition-colors"
                >
                  <a
                    href={ROUTES.artist(artist.deezer_id)}
                    onClick={event => {
                      // A plain click stays in the app; Ctrl/middle click opens a tab
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                      event.preventDefault()
                      navigateTo(ROUTES.artist(artist.deezer_id))
                    }}
                    className="flex-1 min-w-0 px-3 py-2.5"
                  >
                    <p className="text-sm text-text-1 truncate">{artist.name}</p>
                    <Activity artist={artist} />
                  </a>
                  <button
                    type="button"
                    onClick={() => unfollow(artist)}
                    aria-label={`Stop following ${artist.name}`}
                    title="Unfollow"
                    className="shrink-0 mr-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-xs font-medium text-text-2 hover:text-text-1 hover:bg-bg-1 transition-colors"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Unfollow
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
