# Global Search + Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global header search bar with categorized dropdown results, replace the home page with Digging carousels, and fix the mobile tracklist layout.

**Architecture:** A new `DiscoveryContext` pre-fetches Digging data at app load using the existing `useCachedData` hook (6h cache). This feeds three features simultaneously: the header search dropdown, the new carousel home page, and the existing Digging page. The mobile fix is a targeted responsive change to `TrackList.tsx`. Build order: DiscoveryContext first (unblocks everything), mobile fix second (independent), then Digging refactor, then Home carousel, then SearchBar.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, existing `useCachedData` hook, `ROUTES` utility (`src/utils/routes.ts`), n8n webhook API via `src/services/api.ts`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/contexts/DiscoveryContext.tsx` | **Create** | Pre-fetch + cache Digging tracks & albums at app level |
| `src/main.tsx` | **Modify** | Add `DiscoveryProvider` to provider stack |
| `src/components/TrackList.tsx` | **Modify** | Responsive grid, hide date on mobile, fix heart button |
| `src/pages/Digging.tsx` | **Modify** | Read from `DiscoveryContext` instead of fetching locally |
| `src/pages/Home.tsx` | **Create** | Carousel home page (Tracks + Albums horizontal scroll) |
| `src/components/SearchBar.tsx` | **Create** | Header search input + categorized dropdown panel |
| `src/App.tsx` | **Modify** | Add `SearchBar` to header, wire `/` to `Home`, add `/search` route |

---

### Task 1: DiscoveryContext

**Files:**
- Create: `src/contexts/DiscoveryContext.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create DiscoveryContext**

Create `src/contexts/DiscoveryContext.tsx`:

```tsx
import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { useCachedData } from '@/hooks/useCachedData'
import { getTracksToDiscover, getAlbumsToDiscover } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'

type DiscoveryContextValue = {
  discoverTracks: DiscoverTrack[]
  discoverAlbums: DiscoverAlbum[]
  isLoadingTracks: boolean
  isLoadingAlbums: boolean
  refreshTracks: () => void
  refreshAlbums: () => void
}

const DiscoveryContext = createContext<DiscoveryContextValue>({
  discoverTracks: [],
  discoverAlbums: [],
  isLoadingTracks: false,
  isLoadingAlbums: false,
  refreshTracks: () => {},
  refreshAlbums: () => {},
})

export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const [trackRefreshTrigger, setTrackRefreshTrigger] = useState(0)
  const [albumRefreshTrigger, setAlbumRefreshTrigger] = useState(0)

  const { data: rawTracks, isLoading: isLoadingTracks, refresh: clearTracksCache } =
    useCachedData<DiscoverTrack[]>(
      TRACKS_CACHE_KEY,
      () => getTracksToDiscover(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: trackRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: 'Failed to load discovery tracks.',
      }
    )

  const { data: rawAlbums, isLoading: isLoadingAlbums, refresh: clearAlbumsCache } =
    useCachedData<DiscoverAlbum[]>(
      ALBUMS_CACHE_KEY,
      () => getAlbumsToDiscover(token),
      {
        cacheDuration: CACHE_DURATION_MS,
        refreshTrigger: albumRefreshTrigger,
        enabled: isAuthenticated,
        errorMessage: 'Failed to load discovery albums.',
      }
    )

  const refreshTracks = () => {
    clearTracksCache()
    setTrackRefreshTrigger(n => n + 1)
  }

  const refreshAlbums = () => {
    clearAlbumsCache()
    setAlbumRefreshTrigger(n => n + 1)
  }

  return (
    <DiscoveryContext.Provider value={{
      discoverTracks: rawTracks ?? [],
      discoverAlbums: rawAlbums ?? [],
      isLoadingTracks,
      isLoadingAlbums,
      refreshTracks,
      refreshAlbums,
    }}>
      {children}
    </DiscoveryContext.Provider>
  )
}

export const useDiscovery = () => useContext(DiscoveryContext)
```

- [ ] **Step 2: Add DiscoveryProvider to main.tsx**

Open `src/main.tsx`. Add the import and wrap the provider stack. `DiscoveryProvider` must sit inside `AuthProvider` (it calls `useAuth`) and outside `App`:

```tsx
import { DiscoveryProvider } from './contexts/DiscoveryContext'

// Update the render call to:
root.render(
  <AuthProvider>
    <AudioProvider>
      <DiscoveryProvider>
        <LoadingProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </LoadingProvider>
      </DiscoveryProvider>
    </AudioProvider>
  </AuthProvider>
)
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Log in. Open DevTools → Network tab. Confirm calls to `/webhook/tracks-to-discover` and `/webhook/albums-to-discover` happen on app load (not only when visiting Digging). No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/DiscoveryContext.tsx src/main.tsx
git commit -m "feat: DiscoveryContext pre-fetches Digging data at app load"
```

---

### Task 2: Mobile TrackList fix

**Files:**
- Modify: `src/components/TrackList.tsx`

- [ ] **Step 1: Responsive grid**

In `src/components/TrackList.tsx`, find line 76:
```tsx
const gridCols = 'grid-cols-[44px_1fr_120px_72px]'
```
Replace with:
```tsx
const gridCols = 'grid-cols-[36px_1fr_44px] md:grid-cols-[44px_1fr_120px_72px]'
```

- [ ] **Step 2: Hide date column header on mobile**

Find (~line 85):
```tsx
<span className="text-xs uppercase tracking-wider text-white/20 text-center px-2">Date</span>
```
Replace with:
```tsx
<span className="hidden md:block text-xs uppercase tracking-wider text-white/20 text-center px-2">Date</span>
```

- [ ] **Step 3: Hide date cell — album variant (~line 131)**

```tsx
{/* Date Column */}
<div className="text-xs text-white/40 text-center px-2">
  {item.date || ''}
</div>
```
Replace with:
```tsx
{/* Date Column */}
<div className="hidden md:block text-xs text-white/40 text-center px-2">
  {item.date || ''}
</div>
```

- [ ] **Step 4: Hide date cell — search variant (~line 192)**

```tsx
{/* Date Column */}
<div className="text-xs text-white/40 text-center px-2">
  {obj.date || ''}
</div>
```
Replace with:
```tsx
{/* Date Column */}
<div className="hidden md:block text-xs text-white/40 text-center px-2">
  {obj.date || ''}
</div>
```

- [ ] **Step 5: Fix heart button always-visible on mobile (~line 140)**

Find:
```tsx
className={`transition-all opacity-0 group-hover:opacity-100 ${
  liked ? 'text-red-400 opacity-100' : 'text-white/25'
} hover:text-red-400`}
```
Replace with:
```tsx
className={`transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 ${
  liked ? 'text-red-400' : 'text-white/25'
} hover:text-red-400`}
```

- [ ] **Step 6: Verify**

Open DevTools → toggle device toolbar → 375px width. Go to `/digging/tracks`. Confirm: track titles no longer truncated, date column absent, heart always visible. Switch to desktop (> 768px): all 4 columns present, heart only on hover.

- [ ] **Step 7: Commit**

```bash
git add src/components/TrackList.tsx
git commit -m "fix: responsive mobile tracklist — hide date column, always-visible heart button"
```

---

### Task 3: Digging.tsx — read from DiscoveryContext

**Files:**
- Modify: `src/pages/Digging.tsx`

- [ ] **Step 1: Add useDiscovery, remove local fetches**

In `src/pages/Digging.tsx`:

Add import:
```tsx
import { useDiscovery } from '@/contexts/DiscoveryContext'
```

Remove these imports (no longer needed locally):
```tsx
import { useCachedData } from '@/hooks/useCachedData'
// Remove getAlbumsToDiscover, getTracksToDiscover from the api import line
// (keep getAlbumTracks, hideTrack, hideAlbum, and the types)
```

Remove these constants at the top of the file:
```tsx
const ALBUMS_CACHE_KEY = 'niprobin-albums-cache'
const TRACKS_CACHE_KEY = 'niprobin-tracks-cache'
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000
```

- [ ] **Step 2: Replace local state with context data**

Inside the `AlbumsPage` component, remove:
```tsx
const [refreshTrigger, setRefreshTrigger] = useState(0)

const { data: albums, refresh: refreshAlbums } = useCachedData<DiscoverAlbum[]>(...)
const { data: tracks, refresh: refreshTracks } = useCachedData<DiscoverTrack[]>(...)
```

Add instead:
```tsx
const {
  discoverTracks: tracks,
  discoverAlbums: albums,
  isLoadingTracks,
  isLoadingAlbums,
  refreshTracks,
  refreshAlbums,
} = useDiscovery()
```

- [ ] **Step 3: Update handleRefresh**

The existing `handleRefresh` (~line 106) calls `refreshAlbums()`, `refreshTracks()`, and `setRefreshTrigger(prev => prev + 1)`. Replace the entire function with:

```tsx
const handleRefresh = () => {
  if (activeTab === 'tracks') {
    refreshTracks()
  } else {
    refreshAlbums()
  }
}
```

- [ ] **Step 4: Fix null checks**

`tracks` and `albums` are now `DiscoverTrack[]` and `DiscoverAlbum[]` (never null — context defaults to `[]`). Search for any `tracks ?? []` or `albums ?? []` null-coalescing patterns in Digging.tsx and remove the `?? []` since it's no longer needed. Also remove `isLoading` references from the old `useCachedData` destructuring — use `isLoadingTracks` and `isLoadingAlbums` from context where loading spinners are shown.

- [ ] **Step 5: Verify**

Navigate to `/digging/tracks` and `/digging/albums`. Both tabs load data. Sync button works (clears cache and re-fetches). Pagination, curator filter, hide buttons all still function.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Digging.tsx
git commit -m "refactor: Digging page reads from DiscoveryContext instead of fetching locally"
```

---

### Task 4: Home page with carousels

**Files:**
- Create: `src/pages/Home.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add scrollbar-hide utility to index.css**

At the bottom of `src/index.css`, add:
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: Create Home.tsx**

Create `src/pages/Home.tsx`:

```tsx
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
import { getAlbumTracks } from '@/services/api'
import { ROUTES } from '@/utils/routes'
import type { DiscoverTrack, DiscoverAlbum } from '@/types/api'

function navigateTo(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function CarouselSection({
  title,
  seeAllHref,
  children,
}: {
  title: string
  seeAllHref: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10">
        <h2 className="text-white font-semibold text-lg">{title}</h2>
        <button
          onClick={() => navigateTo(seeAllHref)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          See all →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-10 pb-3 snap-x snap-mandatory scrollbar-hide">
        {children}
      </div>
    </section>
  )
}

function TrackCard({
  track,
  onPlay,
  isLoading,
}: {
  track: DiscoverTrack
  onPlay: () => void
  isLoading: boolean
}) {
  return (
    <button
      onClick={onPlay}
      disabled={isLoading}
      className="flex-shrink-0 w-32 snap-start text-left space-y-2 group disabled:opacity-50"
    >
      <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
        <span className="text-4xl">🎵</span>
      </div>
      <div>
        <p className="text-sm text-white truncate w-32">{track.track}</p>
        <p className="text-xs text-slate-400 truncate w-32">{track.artist}</p>
      </div>
    </button>
  )
}

function AlbumCard({ album }: { album: DiscoverAlbum }) {
  const handleClick = async () => {
    try {
      const tracks = await getAlbumTracks(album.deezer_id, album.album, album.artist)
      const albumId = tracks[0]?.['album-id']
      if (albumId) {
        navigateTo(ROUTES.album(albumId))
      }
    } catch (err) {
      console.error('Failed to load album:', err)
    }
  }

  return (
    <button onClick={handleClick} className="flex-shrink-0 w-32 snap-start text-left space-y-2">
      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt={album.album}
          className="w-32 h-32 rounded-lg object-cover"
        />
      ) : (
        <div className="w-32 h-32 bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-4xl">💿</span>
        </div>
      )}
      <div>
        <p className="text-sm text-white truncate w-32">{album.album}</p>
        <p className="text-xs text-slate-400 truncate w-32">{album.artist}</p>
      </div>
    </button>
  )
}

export function HomePage() {
  const { discoverTracks, discoverAlbums } = useDiscovery()
  const { playTrack, loadingTrackId } = useTrackPlayer()

  return (
    <div className="py-8 space-y-10">
      <CarouselSection title="Digging Tracks" seeAllHref={ROUTES.diggingTracks}>
        {discoverTracks.slice(0, 20).map(track => (
          <TrackCard
            key={track.deezer_id}
            track={track}
            isLoading={loadingTrackId === track.deezer_id}
            onPlay={() =>
              playTrack(track.track, track.artist, {
                clearAlbum: false,
                deezer_id: track.deezer_id,
                curator: track.curator,
              })
            }
          />
        ))}
      </CarouselSection>

      <CarouselSection title="Digging Albums" seeAllHref={ROUTES.diggingAlbums}>
        {discoverAlbums.slice(0, 20).map(album => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </CarouselSection>
    </div>
  )
}
```

- [ ] **Step 3: Wire `/` to HomePage in App.tsx**

Open `src/App.tsx`. Add import at the top:
```tsx
import { HomePage } from './pages/Home'
```

Find the block that renders the Search component for the home route (look for `currentPage === 'home'` or `pathname === '/'`). Replace the Search render with:
```tsx
<HomePage />
```

Keep `Search` imported for the `/search` route added in Task 5.

- [ ] **Step 4: Verify**

Run `npm run dev`. Navigate to `/`. Confirm:
- "Digging Tracks" carousel shows track cards, scrolls horizontally
- "Digging Albums" carousel shows album covers, scrolls horizontally
- Tapping a track card starts playback
- Tapping an album card navigates to the album detail page
- "See all →" links navigate to `/digging/tracks` and `/digging/albums`
- On 375px viewport: carousels swipe smoothly, no horizontal page overflow

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx src/App.tsx src/index.css
git commit -m "feat: carousel home page with Digging Tracks and Digging Albums"
```

---

### Task 5: SearchBar with dropdown results

**Files:**
- Create: `src/components/SearchBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Search.tsx`

- [ ] **Step 1: Create SearchBar.tsx**

Create `src/components/SearchBar.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useDiscovery } from '@/contexts/DiscoveryContext'
import { useTrackPlayer } from '@/hooks/useTrackPlayer'
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

function TrackRow({
  track,
  artist,
  onClick,
}: {
  track: string
  artist: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 text-left transition-colors"
    >
      <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 text-sm">
        🎵
      </div>
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{track}</p>
        <p className="text-xs text-slate-400 truncate">{artist}</p>
      </div>
    </button>
  )
}

function AlbumRow({
  album,
  artist,
  cover,
  onClick,
}: {
  album: string
  artist: string
  cover?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-800 text-left transition-colors"
    >
      {cover ? (
        <img src={cover} alt={album} className="w-8 h-8 rounded object-cover flex-shrink-0" />
      ) : (
        <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center flex-shrink-0 text-sm">
          💿
        </div>
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
  const containerRef = useRef<HTMLDivElement>(null)

  const { discoverTracks, discoverAlbums } = useDiscovery()
  const { playTrack } = useTrackPlayer()

  const filteredDiggingTracks: DiscoverTrack[] = hasSearched && query
    ? discoverTracks
        .filter(
          t =>
            t.track.toLowerCase().includes(query.toLowerCase()) ||
            t.artist.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : []

  const filteredDiggingAlbums: DiscoverAlbum[] = hasSearched && query
    ? discoverAlbums
        .filter(
          a =>
            a.album.toLowerCase().includes(query.toLowerCase()) ||
            a.artist.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setIsLoading(true)
    setIsOpen(true)
    setHasSearched(true)
    try {
      const [tracks, albums] = await Promise.all([
        searchTracks(query),
        searchAlbums(query),
      ])
      setExternalTracks(tracks.slice(0, 4))
      setExternalAlbums(albums.slice(0, 4))
    } catch {
      setExternalTracks([])
      setExternalAlbums([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!val) {
      setHasSearched(false)
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
      if (albumId) navigateTo(ROUTES.album(albumId))
    } catch (err) {
      console.error('Failed to load album:', err)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
            onFocus={() => hasSearched && setIsOpen(true)}
            placeholder="Search…"
            className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none flex-1 min-w-0"
          />
        </div>
      </form>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : hasResults ? (
            <div className="py-1">
              {/* External Tracks */}
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

              {/* External Albums */}
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

              {/* Digging Tracks */}
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

              {/* Digging Albums */}
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
```

- [ ] **Step 2: Add SearchBar to App.tsx header**

Open `src/App.tsx`. Add import:
```tsx
import { SearchBar } from './components/SearchBar'
```

Find the sticky header/navbar JSX. Read the current structure around the logo and nav tabs. Add `<SearchBar />` between the logo and nav tabs on desktop. On mobile, add it as a full-width row between the logo row and the tab row. 

The goal layout:
- **Desktop:** `Logo | <SearchBar className="flex-1 max-w-sm" /> | nav tabs | auth`
- **Mobile:** Row 1: `Logo | auth`, Row 2: `<SearchBar className="w-full" />`, Row 3: `tabs`

- [ ] **Step 3: Add /search route and update Search.tsx**

In `src/App.tsx`, find the route-matching block. Add a case for `/search`:
```tsx
{currentPage === 'search' && <Search initialQuery={searchParams?.get('q') ?? ''} />}
```

Also update the navigate function cases inside App.tsx to handle `'search'` — check the `navigate` function (~line 239) and add a case that routes to `/search`.

Open `src/components/Search.tsx`. The existing handler is `handleSearch(e: React.FormEvent)` which reads from `query` state. Refactor to extract the logic into a `performSearch` function, then wire up `initialQuery`:

```tsx
import { useState, useEffect } from 'react'

// Change the component signature:
export function Search({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery) // seed with initialQuery
  // ...rest of existing state unchanged...

  // Extract search logic out of handleSearch into its own function:
  const performSearch = async (q: string) => {
    if (!q.trim()) return
    setHasSearched(true)
    // Move the body of handleSearch here, replacing references to `query` with `q`
    // e.g.: const data = await searchTracks(q)  /  const data = await searchAlbums(q)
  }

  // Update handleSearch to call performSearch:
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    await performSearch(query)
  }

  // Auto-submit when arriving from the dropdown "See all" link:
  useEffect(() => {
    if (initialQuery) performSearch(initialQuery)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ...rest of component unchanged...
}
```

Read `src/components/Search.tsx` lines 30-60 to copy the exact body of `handleSearch` into `performSearch`, replacing `query` references with the `q` parameter.

- [ ] **Step 4: Verify end-to-end**

Run `npm run dev`. Test all flows:
1. Header shows search bar on desktop and mobile
2. Type "disclosure" + Enter → spinner → External + Digging sections appear in correct order
3. Click a track → audio plays, dropdown closes
4. Click an album → navigates to album page
5. Click "See all →" in External Tracks → navigates to `/search?q=disclosure` → full Search page shows results

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.tsx src/components/Search.tsx src/App.tsx
git commit -m "feat: global header search bar with categorized dropdown and See all"
```
