import { useEffect, useMemo, useState } from 'react'
import { Search, UserMinus } from 'lucide-react'
import { useFollowedArtists } from '@/contexts/FollowedArtistsContext'
import { matchesArtist } from '@/digging/followedArtists'
import { ROUTES, navigateTo } from '@/utils/routes'

// The Followed artists, A→Z: open one, or stop following it (5s Undo)
export function ArtistsPage() {
  const { artists, isLoading, loadFailed, reload, unfollow } = useFollowedArtists()
  const [query, setQuery] = useState('')

  // Follows made from an Artist page since the last load show up here
  useEffect(() => {
    reload()
  }, [reload])

  const shown = useMemo(
    () => (artists ?? []).filter(artist => matchesArtist(artist.name, query)),
    [artists, query],
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
                    className="flex-1 min-w-0 px-3 py-2.5 text-sm text-text-1 truncate"
                  >
                    {artist.name}
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
