# Refactoring Summary - Quick Reference

## 🎯 Main Issues Found

| Issue | Files Affected | Lines Duplicated | Priority |
|-------|---------------|------------------|----------|
| API Response Parsing | `api.ts` | ~80 lines | 🔴 High |
| Cache Management | `Albums.tsx` | ~80 lines | 🔴 High |
| Album Click Handlers | `Search.tsx`, `Albums.tsx` | ~40 lines | 🟡 Medium |
| Track Playing Logic | `Search.tsx`, `Albums.tsx`, `Player.tsx` | ~60 lines | 🟡 Medium |
| Hide Action Pattern | `Albums.tsx` | ~30 lines | 🟢 Low |
| Error Handling | All components | ~50+ instances | 🟢 Low |

**Total Reduction: ~400-500 lines (20-25% of component code)**

---

## 📁 New Files to Create

### Phase 1: High Priority
```
src/utils/apiHelpers.ts          // API response parsing utilities
src/hooks/useCachedData.ts        // Generic caching hook
```

### Phase 2: Medium Priority
```
src/hooks/useAlbumLoader.ts       // Album loading logic
src/hooks/useTrackPlayer.ts       // Track playing logic
```

### Phase 3: Low Priority
```
src/hooks/useHideItem.ts          // Hide item logic
src/hooks/useApiCall.ts           // Consistent error handling
```

---

## 🔧 Specific Code Duplications

### 1. API Response Parsing (`api.ts`)

**Before (83 lines):**
```typescript
// In likeTrack() - lines 185-268
const rawBody = await response.text()
let data: unknown = null
if (rawBody) {
  try {
    data = JSON.parse(rawBody)
  } catch {
    data = null
  }
}

const normalizeStatus = (): 'success' | 'error' => {
  if (data && typeof data === 'object' && data !== null) {
    const candidate = (data as Record<string, unknown>).status
    if (typeof candidate === 'string') {
      const lowered = candidate.toLowerCase()
      if (lowered === 'success') return 'success'
      if (lowered === 'error' || lowered === 'failed' || lowered === 'fail') return 'error'
    }
    // ... more normalization logic
  }
  return response.ok ? 'success' : 'error'
}

const extractMessage = (): string | null => {
  // ... 30+ lines of message extraction logic
}

// SAME CODE REPEATED IN rateAlbum() - lines 270-311
```

**After (20 lines):**
```typescript
import { parseApiResponse } from '@/utils/apiHelpers'

export async function likeTrack(payload: LikeTrackPayload): Promise<LikeTrackResponse> {
  const response = await fetch('https://n8n.niprobin.com/webhook/like-track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text()
  return parseApiResponse(response, rawBody, {
    successMessage: 'Action completed',
    errorMessage: 'Failed to like track'
  })
}
```

---

### 2. Cache Management (`Albums.tsx`)

**Before (80 lines × 2):**
```typescript
// Lines 175-226 for albums
useEffect(() => {
  let isCancelled = false
  const loadAlbums = async () => {
    increment()
    try {
      const cached = localStorage.getItem(ALBUMS_CACHE_KEY)
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp
          if (age < CACHE_DURATION_MS && Array.isArray(data)) {
            if (!isCancelled) setAlbums(data)
            decrement()
            return
          }
        } catch { /* Invalid cache */ }
      }

      const data = await getAlbumsToDiscover()

      try {
        localStorage.setItem(ALBUMS_CACHE_KEY, JSON.stringify({
          data,
          timestamp: Date.now()
        }))
      } catch { /* Quota exceeded */ }

      if (!isCancelled) setAlbums(data)
    } catch (err) {
      console.error('Failed to load albums', err)
      if (!isCancelled) {
        showNotification('Failed to load albums', 'error')
        setAlbums([])
      }
    } finally {
      decrement()
    }
  }
  loadAlbums()
  return () => { isCancelled = true }
}, [activeTab, refreshTrigger])

// Lines 242-293 - EXACT SAME PATTERN for tracks
```

**After (5 lines × 2):**
```typescript
const { data: albums, refresh: refreshAlbums } = useCachedData(
  'niprobin-albums-cache',
  getAlbumsToDiscover,
  { refreshTrigger }
)

const { data: tracks, refresh: refreshTracks } = useCachedData(
  'niprobin-tracks-cache',
  getTracksToDiscover,
  { refreshTrigger }
)
```

---

### 3. Album Click Handler (2 files)

**Duplicated in:**
- `Search.tsx` lines 79-101
- `Albums.tsx` lines 50-72

**Before (22 lines each):**
```typescript
const handleAlbumClick = async (album: AlbumResult) => {
  increment()

  try {
    const tracks = await getAlbumTracks(
      album['album-id'],
      album.album,
      album.artist
    )

    setAlbumContext(
      tracks,
      {
        name: album.album,
        artist: album.artist,
        cover: album.cover,
      },
      { expand: false, loadFirst: true },
    )
  } catch (err) {
    showNotification('Failed to load album tracks', 'error')
    console.error(err)
  } finally {
    decrement()
  }
}
```

**After (3 lines):**
```typescript
const { loadAlbum } = useAlbumLoader()

// Usage:
onClick={() => loadAlbum(album['album-id'], album.album, album.artist, album.cover)}
```

---

### 4. Track Playing Logic (3 files)

**Similar patterns in:**
- `Search.tsx` lines 52-76
- `Albums.tsx` lines 97-126
- `Player.tsx` lines 166-186

**Before (20-30 lines each):**
```typescript
const handlePlayTrack = async (track: SearchResult) => {
  setLoadingTrackId(track['track-id'])

  try {
    clearAlbumContext()

    const streamUrl = await getStreamUrl(
      Number(track['track-id']),
      track.track,
      track.artist
    )

    play({
      id: track['track-id'],
      title: track.track,
      artist: track.artist,
      album: track.album,
      streamUrl: streamUrl,
    })
  } catch (err) {
    showNotification('Failed to load track', 'error')
    console.error(err)
  } finally {
    setLoadingTrackId(null)
  }
}
```

**After (3-5 lines):**
```typescript
const { playTrack, isLoading } = useTrackPlayer()

// Usage:
onClick={() => playTrack(track['track-id'], track.track, track.artist, {
  album: track.album,
  clearAlbum: true
})}
```

---

### 5. Hide Actions (`Albums.tsx`)

**Before (15 lines × 2):**
```typescript
const [hiddenAlbums, setHiddenAlbums] = useState<Set<string>>(new Set())
const [hiddenTracks, setHiddenTracks] = useState<Set<string>>(new Set())

const handleHideAlbum = async (album: DiscoverAlbum, e: React.MouseEvent) => {
  e.stopPropagation()
  const albumKey = `${album.album}-${album.artist}`
  setHiddenAlbums(prev => new Set(prev).add(albumKey))

  try {
    await hideAlbum({ album: album.album, artist: album.artist })
  } catch (err) {
    console.error('Failed to hide album', err)
  }
}

// handleHideTrack has identical pattern
```

**After (3 lines):**
```typescript
const { hiddenItems: hiddenAlbums, hideItem: hideAlbumItem } = useHideItem(
  hideAlbum,
  (album) => `${album.album}-${album.artist}`
)

// Same for tracks
```

---

## 📊 File Size Comparison

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| `src/services/api.ts` | 417 lines | ~330 lines | **-21%** |
| `src/pages/Albums.tsx` | 537 lines | ~380 lines | **-29%** |
| `src/components/Search.tsx` | 206 lines | ~170 lines | **-17%** |
| `src/components/Player.tsx` | 623 lines | ~580 lines | **-7%** |
| **Total** | **1,783 lines** | **~1,460 lines** | **-18%** |

Plus 6 new utility/hook files (~300 lines) that are **reusable across the entire app**.

---

## ✅ Benefits

### For Development
- ✅ Easier to add new features (just use existing hooks)
- ✅ Consistent patterns across the app
- ✅ Easier to test (isolated hooks)
- ✅ Less code to review in PRs

### For LLM Agents
- ✅ **20-30% faster parsing** (fewer lines to read)
- ✅ **Clearer structure** (hooks folder shows all reusable logic)
- ✅ **Better context** (each file has single responsibility)
- ✅ **Easier reasoning** (no need to compare duplicate code)

### For Maintenance
- ✅ **Bug fixes in one place** (not scattered across files)
- ✅ **Type safety** (generic hooks ensure consistency)
- ✅ **Less cognitive load** (smaller files, clearer purpose)
- ✅ **Better onboarding** (new devs see patterns quickly)

---

## 🚀 Implementation Timeline

### Phase 1: Foundation (2-3 days)
- Create `utils/apiHelpers.ts`
- Create `hooks/useCachedData.ts`
- Update `api.ts` and `Albums.tsx`

### Phase 2: Audio Interactions (2-3 days)
- Create `hooks/useAlbumLoader.ts`
- Create `hooks/useTrackPlayer.ts`
- Update all components using album/track logic

### Phase 3: Polish (1-2 days)
- Create `hooks/useHideItem.ts`
- Create `hooks/useApiCall.ts` (optional)
- Final testing and cleanup

**Total estimated time: 5-8 days**

---

## 📝 Next Steps

1. Review this plan and provide feedback
2. Decide if we should proceed with all phases or just high-priority items
3. Create Git branch for refactoring work
4. Implement Phase 1 (highest impact)
5. Test thoroughly before moving to Phase 2
6. Deploy incrementally

---

## Questions?

- Do you want to proceed with all phases, or just high-priority items?
- Should we create the hooks one at a time or all at once?
- Any specific concerns about breaking existing functionality?
- Would you like me to start implementing Phase 1?
