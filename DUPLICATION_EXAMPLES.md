# Code Duplication Examples - Side by Side

This document shows the exact duplicated code patterns found in the codebase.

---

## 1. API Response Parsing (api.ts)

### Location 1: `likeTrack()` function (lines 194-267)

```typescript
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

    const successField = (data as Record<string, unknown>).success
    if (typeof successField === 'boolean') {
      return successField ? 'success' : 'error'
    }

    const errorField = (data as Record<string, unknown>).error
    if (typeof errorField === 'boolean') {
      return errorField ? 'error' : 'success'
    }
  }

  return response.ok ? 'success' : 'error'
}

const extractMessage = (): string | null => {
  const tryFields = (fields: string[]): string | null => {
    if (!data || typeof data !== 'object' || data === null) return null
    for (const field of fields) {
      const value = (data as Record<string, unknown>)[field]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }
    return null
  }

  const prioritized = tryFields(['message', 'msg', 'detail', 'error', 'statusText'])
  if (prioritized) return prioritized

  if (typeof data === 'string' && data.trim().length > 0) {
    return data.trim()
  }

  if (data && typeof data === 'object') {
    const fallbackValue = Object.values(data).find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    )
    if (typeof fallbackValue === 'string') {
      return fallbackValue.trim()
    }
  }

  if (rawBody && rawBody.trim().length > 0) {
    return rawBody.trim()
  }

  return null
}

const status = normalizeStatus()
const message =
  extractMessage() || (status === 'success' ? 'Action completed' : 'Failed to like track')

return { status, message }
```

### Location 2: `rateAlbum()` function (lines 279-310)

```typescript
const rawBody = await response.text()
let data: unknown = null

if (rawBody) {
  try {
    data = JSON.parse(rawBody)
  } catch {
    data = null
  }
}

const statusField =
  typeof (data as any)?.status === 'string' ? (data as any).status.toLowerCase() : null
const status: 'success' | 'error' =
  statusField === 'success'
    ? 'success'
    : statusField === 'error'
      ? 'error'
      : response.ok
        ? 'success'
        : 'error'

const message =
  typeof (data as any)?.message === 'string' && (data as any).message.trim().length > 0
    ? (data as any).message.trim()
    : rawBody.trim().length > 0
      ? rawBody.trim()
      : status === 'success'
        ? 'Rating saved'
        : 'Failed to rate album'

return { status, message }
```

**Analysis:**
- Both functions parse response text → JSON
- Both normalize status fields with fallbacks
- Both extract messages with multiple fallback strategies
- `likeTrack` has more comprehensive logic, but `rateAlbum` attempts the same goals
- Total duplication: ~60% of the code in both functions

---

## 2. Cache Management (Albums.tsx)

### Location 1: Albums loading effect (lines 169-233)

```typescript
useEffect(() => {
  if (activeTab !== 'albums') {
    return
  }

  let isCancelled = false

  const loadAlbums = async () => {
    increment()

    try {
      // Check cache first
      const cached = localStorage.getItem(ALBUMS_CACHE_KEY)
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp

          // Use cache if it's still fresh
          if (age < CACHE_DURATION_MS && Array.isArray(data)) {
            if (!isCancelled) {
              setAlbums(data)
            }
            decrement()
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }

      // Fetch fresh data
      const data = await getAlbumsToDiscover()

      // Save to cache
      try {
        localStorage.setItem(
          ALBUMS_CACHE_KEY,
          JSON.stringify({ data, timestamp: Date.now() })
        )
      } catch {
        // Cache save failed (quota exceeded?), continue anyway
      }

      if (!isCancelled) {
        setAlbums(data)
      }
    } catch (err) {
      console.error('Failed to load albums to discover', err)
      if (!isCancelled) {
        showNotification('Failed to load albums to discover.', 'error')
        setAlbums([])
      }
    } finally {
      decrement()
    }
  }

  loadAlbums()

  return () => {
    isCancelled = true
  }
}, [activeTab, refreshTrigger])
```

### Location 2: Tracks loading effect (lines 235-300)

```typescript
useEffect(() => {
  if (activeTab !== 'tracks') {
    return
  }

  let isCancelled = false

  const loadTracks = async () => {
    increment()

    try {
      // Check cache first
      const cached = localStorage.getItem(TRACKS_CACHE_KEY)
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached)
          const age = Date.now() - timestamp

          // Use cache if it's still fresh
          if (age < CACHE_DURATION_MS && Array.isArray(data)) {
            if (!isCancelled) {
              setTracks(data)
            }
            decrement()
            return
          }
        } catch {
          // Invalid cache, continue to fetch
        }
      }

      // Fetch fresh data (always fetch all tracks)
      const data = await getTracksToDiscover()

      // Save to cache
      try {
        localStorage.setItem(
          TRACKS_CACHE_KEY,
          JSON.stringify({ data, timestamp: Date.now() })
        )
      } catch {
        // Cache save failed (quota exceeded?), continue anyway
      }

      if (!isCancelled) {
        setTracks(data)
      }
    } catch (err) {
      console.error('Failed to load tracks to discover', err)
      if (!isCancelled) {
        showNotification('Failed to load tracks to discover.', 'error')
        setTracks([])
      }
    } finally {
      decrement()
    }
  }

  loadTracks()

  return () => {
    isCancelled = true
  }
}, [activeTab, refreshTrigger])
```

**Analysis:**
- 100% identical logic except for:
  - Cache key name (`ALBUMS_CACHE_KEY` vs `TRACKS_CACHE_KEY`)
  - API call (`getAlbumsToDiscover()` vs `getTracksToDiscover()`)
  - State setter (`setAlbums` vs `setTracks`)
  - Error message text
  - Guard condition (`activeTab !== 'albums'` vs `activeTab !== 'tracks'`)
- Total duplication: ~60 lines × 2 = 120 lines

---

## 3. Album Click Handler

### Location 1: Search.tsx (lines 79-101)

```typescript
// Handle clicking an album to view its tracks
const handleAlbumClick = async (album: AlbumResult) => {
  increment()

  try {
    const tracks = await getAlbumTracks(album['album-id'], album.album, album.artist)

    // Populate the player with album context (doesn't auto-play)
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
    showNotification('Failed to load album tracks. Please try again.', 'error')
    console.error(err)
  } finally {
    decrement()
  }
}
```

### Location 2: Albums.tsx (lines 50-72)

```typescript
// Handle clicking an album to view its tracks
const handleAlbumClick = async (album: DiscoverAlbum) => {

  increment()
  try {
    const tracks = await getAlbumTracks(0, album.album, album.artist)

    // Populate the player with album context (doesn't auto-play)
    setAlbumContext(
      tracks,
      {
        name: album.album,
        artist: album.artist,
        cover: album.cover_url,
      },
      { expand: false, loadFirst: true },
    )
  } catch (err) {
    showNotification('Failed to load album tracks. Please try again.', 'error')
    console.error(err)
  } finally {
    decrement()
  }
}
```

**Analysis:**
- 95% identical code
- Only differences:
  - Type of `album` parameter (`AlbumResult` vs `DiscoverAlbum`)
  - Album ID (`album['album-id']` vs `0`)
  - Cover property (`album.cover` vs `album.cover_url`)
- Total duplication: ~22 lines × 2 = 44 lines

---

## 4. Track Playing Logic

### Location 1: Search.tsx (lines 52-76)

```typescript
// Handle clicking a track to play it
const handlePlayTrack = async (result: SearchResult) => {
  setLoadingTrackId(result['track-id'])

  try {
    // Clear album context when playing a single track
    clearAlbumContext()

    // Get the stream URL from n8n
    const streamUrl = await getStreamUrl(Number(result['track-id']), result.track, result.artist)

    // Play the track with metadata
    play({
      id: result['track-id'],
      title: result.track,
      artist: result.artist,
      album: result.album,
      streamUrl: streamUrl,
    })
  } catch (err) {
    showNotification('Failed to load track. Please try again.', 'error')
    console.error(err)
  } finally {
    setLoadingTrackId(null)
  }
}
```

### Location 2: Albums.tsx (lines 97-126)

```typescript
// Handle playing a track from the Tracks tab
const handlePlayTrack = async (track: DiscoverTrack) => {
  // Use track+artist as unique ID since we don't have numeric track-id
  const trackKey = `${track.track}-${track.artist}`
  setLoadingTrackId(trackKey)

  try {
    // Clear album context for single track mode
    clearAlbumContext()

    // Get stream URL - pass 0 for trackId since we don't have it
    // Backend will use track+artist to find the stream
    const streamUrl = await getStreamUrl(0, track.track, track.artist)

    // Play the track
    play({
      id: trackKey,
      title: track.track,
      artist: track.artist,
      album: `Curated by ${track.curator}`,
      streamUrl: streamUrl,
      coverArt: undefined,
      spotifyId: track['spotify-id'],
    })
  } catch (err) {
    console.error('Failed to load track:', err)
    showNotification('Failed to load track. Please try again.', 'error')
  } finally {
    setLoadingTrackId(null)
  }
}
```

### Location 3: Player.tsx (lines 166-186)

```typescript
// Handle clicking a track from the album tracklist
const handlePlayAlbumTrack = async (track: AlbumTrackItem) => {
  if (!albumInfo) return

  setLoadingTrackId(track['track-id'].toString())

  try {
    const streamUrl = await getStreamUrl(track['track-id'], track.track, track.artist)
    play({
      id: track['track-id'].toString(),
      title: track.track,
      artist: track.artist,
      album: albumInfo.name,
      streamUrl: streamUrl,
      coverArt: albumInfo.cover,
    })
  } catch (err) {
    console.error('Failed to load track:', err)
  } finally {
    setLoadingTrackId(null)
  }
}
```

**Analysis:**
- All three follow the same pattern:
  1. Set loading state with track ID
  2. Call `getStreamUrl()` with track metadata
  3. Call `play()` with track object
  4. Handle errors
  5. Clear loading state
- Differences are only in:
  - Track ID format (string vs number vs composite key)
  - Whether to clear album context
  - Error message details
  - Additional metadata (coverArt, spotifyId, etc.)
- Total duplication: ~25 lines × 3 = 75 lines

---

## 5. Hide Actions (Albums.tsx)

### Location 1: handleHideAlbum (lines 75-94)

```typescript
// Handle hiding an album
const handleHideAlbum = async (album: DiscoverAlbum, e: React.MouseEvent) => {
  e.stopPropagation() // Prevent album click event
  const albumKey = `${album.album}-${album.artist}`

  // Optimistically hide the album in UI
  setHiddenAlbums((prev) => new Set(prev).add(albumKey))

  // Send to backend
  try {
    await hideAlbum({ album: album.album, artist: album.artist })
  } catch (err) {
    console.error('Failed to hide album', err)
    // Optionally: revert the UI change if the API call fails
    // setHiddenAlbums((prev) => {
    //   const newSet = new Set(prev)
    //   newSet.delete(albumKey)
    //   return newSet
    // })
  }
}
```

### Location 2: handleHideTrack (lines 129-148)

```typescript
// Handle hiding a track
const handleHideTrack = async (track: DiscoverTrack, e: React.MouseEvent) => {
  e.stopPropagation() // Prevent track click event
  const trackKey = `${track.track}-${track.artist}`

  // Optimistically hide the track in UI
  setHiddenTracks((prev) => new Set(prev).add(trackKey))

  // Send to backend
  try {
    await hideTrack({ track: track.track, artist: track.artist, 'spotify-id': track['spotify-id'] })
  } catch (err) {
    console.error('Failed to hide track', err)
    // Optionally: revert the UI change if the API call fails
    setHiddenTracks((prev) => {
      const newSet = new Set(prev)
      newSet.delete(trackKey)
      return newSet
    })
  }
}
```

**Analysis:**
- 90% identical pattern:
  1. Stop event propagation
  2. Create unique key from item
  3. Optimistically update UI (add to Set)
  4. Call API to persist
  5. Handle errors (with optional revert)
- Only differences:
  - Item type (`DiscoverAlbum` vs `DiscoverTrack`)
  - State name (`hiddenAlbums` vs `hiddenTracks`)
  - API call parameters
  - One reverts on error, one doesn't (inconsistent!)
- Total duplication: ~18 lines × 2 = 36 lines

---

## 6. Error Handling Pattern (Multiple Files)

### Pattern repeated ~50+ times across all files:

```typescript
try {
  const result = await someApiCall()
  // do something with result
} catch (err) {
  console.error('Some message', err)
  showNotification('Some error message', 'error')
}
```

### Examples:

**Search.tsx lines 33-48:**
```typescript
try {
  if (searchType === 'tracks') {
    const searchResults = await searchTracks(query)
    setResults(searchResults)
    setAlbumResults([])
  } else {
    const searchResults = await searchAlbums(query)
    setAlbumResults(searchResults)
    setResults([])
  }
} catch (err) {
  showNotification('Search failed. Please try again.', 'error')
  console.error(err)
}
```

**Albums.tsx lines 53-69:**
```typescript
try {
  const tracks = await getAlbumTracks(0, album.album, album.artist)
  setAlbumContext(
    tracks,
    { name: album.album, artist: album.artist, cover: album.cover_url },
    { expand: false, loadFirst: true },
  )
} catch (err) {
  showNotification('Failed to load album tracks. Please try again.', 'error')
  console.error(err)
}
```

**Player.tsx lines 219-240:**
```typescript
try {
  const result = await likeTrack({
    track: likeModalTrack.title,
    artist: likeModalTrack.artist,
    playlist: selectedPlaylist,
    'spotify-id': likeModalTrack.spotifyId || '',
  })
  if (result.status === 'success') {
    setLikedTrackIds((prev) =>
      prev.includes(likeModalTrack.id) ? prev : [...prev, likeModalTrack.id]
    )
    showNotification(result.message, 'success')
    closeLikeModal()
  } else {
    showNotification(result.message, 'error')
  }
} catch (err) {
  console.error('Failed to like track:', err)
  showNotification('Could not save like', 'error')
}
```

**Analysis:**
- Every API call follows this pattern
- Always has `try/catch` with `console.error` + `showNotification`
- Error messages are inconsistent
- No centralized error handling
- Adds ~6-8 lines to every async operation

---

## Summary Table

| Pattern | Files | Instances | Total Lines | Reduction Potential |
|---------|-------|-----------|-------------|---------------------|
| API Response Parsing | api.ts | 2 | ~80 lines | ~60 lines (75%) |
| Cache Management | Albums.tsx | 2 | ~120 lines | ~110 lines (92%) |
| Album Click Handler | Search.tsx, Albums.tsx | 2 | ~44 lines | ~40 lines (91%) |
| Track Playing | Search.tsx, Albums.tsx, Player.tsx | 3 | ~75 lines | ~60 lines (80%) |
| Hide Actions | Albums.tsx | 2 | ~36 lines | ~30 lines (83%) |
| Error Handling | All files | 50+ | ~300 lines | ~200 lines (67%) |
| **TOTAL** | **6 files** | **60+** | **~655 lines** | **~500 lines (76%)** |

---

## Conclusion

The refactoring will eliminate **~500 lines of duplicate code** while adding **~300 lines of reusable utilities**, resulting in a **net reduction of ~200 lines** and **massively improved maintainability**.

Each new utility/hook will be used 2-3+ times across the codebase, ensuring consistency and reducing future bugs.
