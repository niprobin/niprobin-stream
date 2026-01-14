# Niprobin Stream - Refactoring Plan

## Executive Summary

After analyzing the codebase, I've identified significant code duplication across multiple files. The main issues are:

1. **Duplicated API response parsing** (~100 lines)
2. **Duplicated caching logic** (~80 lines)
3. **Duplicated album/track interaction handlers** (~150 lines)
4. **Repetitive error handling patterns** (throughout)
5. **Duplicated hide action logic** (~40 lines)

This refactoring will **reduce total lines by ~400-500** and make the codebase more maintainable.

---

## Current State Analysis

### 1. API Response Parsing Duplication (High Priority)

**Location:** `src/services/api.ts`

**Problem:** The `likeTrack()` (lines 185-268) and `rateAlbum()` (lines 270-311) functions contain nearly identical response parsing logic:
- Parse response body as text
- Try to parse JSON
- Normalize status field (success/error)
- Extract message from various possible fields
- Return structured response

**Impact:** ~80 duplicated lines

**Solution:** Extract into a shared `parseApiResponse()` utility function

---

### 2. Cache Management Duplication (High Priority)

**Location:** `src/pages/Albums.tsx`

**Problem:** The `loadAlbums()` effect (lines 175-226) and `loadTracks()` effect (lines 242-293) have identical cache logic:
- Check localStorage for cached data
- Validate cache timestamp
- Return cached data if fresh
- Fetch from API if stale
- Save to localStorage
- Handle errors with notifications

**Impact:** ~80 duplicated lines

**Solution:** Create a generic `useCachedData<T>()` custom hook

---

### 3. Album Click Handler Duplication (Medium Priority)

**Location:**
- `src/components/Search.tsx` (lines 79-101)
- `src/pages/Albums.tsx` (lines 50-72)

**Problem:** Both components have identical `handleAlbumClick()` logic:
- Call `increment()` for loading state
- Fetch album tracks via API
- Populate player with album context
- Handle errors with notifications
- Call `decrement()` in finally

**Impact:** ~40 duplicated lines

**Solution:** Create a shared `useAlbumLoader()` custom hook

---

### 4. Track Playing Logic Duplication (Medium Priority)

**Location:**
- `src/components/Search.tsx` (lines 52-76)
- `src/pages/Albums.tsx` (lines 97-126)
- `src/components/Player.tsx` (lines 166-186)

**Problem:** Similar patterns for loading and playing tracks:
- Set loading state
- Clear/maintain album context
- Fetch stream URL
- Call `play()` with track metadata
- Handle errors
- Clear loading state

**Impact:** ~60 duplicated lines

**Solution:** Create a `useTrackPlayer()` custom hook

---

### 5. Hide Action Logic Duplication (Low Priority)

**Location:** `src/pages/Albums.tsx`
- `handleHideAlbum()` (lines 75-94)
- `handleHideTrack()` (lines 129-148)

**Problem:** Identical pattern for hiding items:
- Stop event propagation
- Create unique key
- Optimistically update UI (add to Set)
- Call API
- Handle errors (optionally revert)

**Impact:** ~30 duplicated lines

**Solution:** Create a generic `useHideItem()` custom hook

---

### 6. Repetitive Error Handling Pattern (Low Priority)

**Location:** Throughout all components

**Problem:** Every API call has the same pattern:
```typescript
try {
  const result = await apiCall()
  // do something
} catch (err) {
  console.error('message', err)
  showNotification('message', 'error')
}
```

**Impact:** ~50+ instances across files

**Solution:** Create a `useApiCall()` hook with automatic error handling

---

## Detailed Refactoring Plan

### Phase 1: API Layer Utilities (Priority: High)

#### File: `src/utils/apiHelpers.ts` (NEW)

**Create helper functions:**

```typescript
// Normalize API response into standard format
export function parseApiResponse(response: Response, rawBody: string): {
  status: 'success' | 'error'
  message: string
}

// Generic fetch wrapper with consistent error handling
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T>
```

**Changes to `src/services/api.ts`:**
- Refactor `likeTrack()` to use `parseApiResponse()` (reduce from 83 lines to ~20)
- Refactor `rateAlbum()` to use `parseApiResponse()` (reduce from 41 lines to ~15)
- Consider using `fetchWithErrorHandling()` for all API calls

**Estimated reduction:** ~90 lines

---

### Phase 2: Data Loading Hooks (Priority: High)

#### File: `src/hooks/useCachedData.ts` (NEW)

**Create custom hook:**

```typescript
export function useCachedData<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options?: {
    cacheDuration?: number
    refreshTrigger?: number
    onError?: (error: Error) => void
  }
): {
  data: T | null
  isLoading: boolean
  refresh: () => void
}
```

**Changes to `src/pages/Albums.tsx`:**
- Replace albums loading effect (lines 169-233) with `useCachedData()`
- Replace tracks loading effect (lines 235-300) with `useCachedData()`
- Remove local cache management code

**Estimated reduction:** ~120 lines from Albums.tsx

---

### Phase 3: Audio Interaction Hooks (Priority: Medium)

#### File: `src/hooks/useAlbumLoader.ts` (NEW)

**Create custom hook:**

```typescript
export function useAlbumLoader() {
  const { setAlbumContext } = useAudio()
  const { showNotification } = useNotification()
  const { increment, decrement } = useLoading()

  const loadAlbum = async (
    albumId: number,
    albumName: string,
    artist: string,
    coverUrl: string,
    options?: { expand?: boolean; loadFirst?: boolean }
  ) => {
    // Consolidated album loading logic
  }

  return { loadAlbum }
}
```

**Changes:**
- Replace `handleAlbumClick()` in `src/components/Search.tsx` (lines 79-101)
- Replace `handleAlbumClick()` in `src/pages/Albums.tsx` (lines 50-72)

**Estimated reduction:** ~40 lines

---

#### File: `src/hooks/useTrackPlayer.ts` (NEW)

**Create custom hook:**

```typescript
export function useTrackPlayer() {
  const { play, clearAlbumContext } = useAudio()
  const { showNotification } = useNotification()

  const playTrack = async (
    trackId: string | number,
    trackName: string,
    artist: string,
    options?: {
      album?: string
      coverArt?: string
      spotifyId?: string
      clearAlbum?: boolean
    }
  ) => {
    // Consolidated track playing logic
  }

  return { playTrack, isLoading }
}
```

**Changes:**
- Simplify `handlePlayTrack()` in `src/components/Search.tsx`
- Simplify `handlePlayTrack()` in `src/pages/Albums.tsx`
- Simplify `handlePlayAlbumTrack()` in `src/components/Player.tsx`

**Estimated reduction:** ~50 lines

---

### Phase 4: UI Action Hooks (Priority: Low)

#### File: `src/hooks/useHideItem.ts` (NEW)

**Create custom hook:**

```typescript
export function useHideItem<T>(
  apiFn: (item: T) => Promise<void>,
  keyExtractor: (item: T) => string
) {
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set())

  const hideItem = async (item: T, event?: React.MouseEvent) => {
    event?.stopPropagation()
    const key = keyExtractor(item)

    // Optimistically update UI
    setHiddenItems(prev => new Set(prev).add(key))

    try {
      await apiFn(item)
    } catch (err) {
      console.error('Failed to hide item', err)
      // Revert on error
      setHiddenItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(key)
        return newSet
      })
    }
  }

  return { hiddenItems, hideItem }
}
```

**Changes:**
- Replace `handleHideAlbum()` and `hiddenAlbums` state in `src/pages/Albums.tsx`
- Replace `handleHideTrack()` and `hiddenTracks` state in `src/pages/Albums.tsx`

**Estimated reduction:** ~35 lines

---

#### File: `src/hooks/useApiCall.ts` (NEW)

**Create custom hook for consistent error handling:**

```typescript
export function useApiCall<T, Args extends any[]>(
  apiFn: (...args: Args) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
    successMessage?: string
    errorMessage?: string
  }
) {
  const { showNotification } = useNotification()
  const [isLoading, setIsLoading] = useState(false)

  const execute = async (...args: Args): Promise<T | null> => {
    setIsLoading(true)
    try {
      const result = await apiFn(...args)
      options?.onSuccess?.(result)
      if (options?.successMessage) {
        showNotification(options.successMessage, 'success')
      }
      return result
    } catch (error) {
      console.error(error)
      options?.onError?.(error as Error)
      if (options?.errorMessage) {
        showNotification(options.errorMessage, 'error')
      }
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { execute, isLoading }
}
```

**Changes:** Can be adopted gradually across components

---

## Implementation Order

### Week 1: Foundation (High-Impact, Low-Risk)

1. **Create `src/utils/apiHelpers.ts`**
   - Extract response parsing logic
   - Update `likeTrack()` and `rateAlbum()`
   - Test thoroughly

2. **Create `src/hooks/useCachedData.ts`**
   - Extract cache logic
   - Update `Albums.tsx` to use it
   - Verify caching still works

### Week 2: Audio Interactions (Medium-Impact, Medium-Risk)

3. **Create `src/hooks/useAlbumLoader.ts`**
   - Consolidate album loading logic
   - Update `Search.tsx` and `Albums.tsx`
   - Test album loading flows

4. **Create `src/hooks/useTrackPlayer.ts`**
   - Consolidate track playing logic
   - Update all three components
   - Test playback flows

### Week 3: Polish (Low-Impact, Low-Risk)

5. **Create `src/hooks/useHideItem.ts`**
   - Consolidate hide logic
   - Update `Albums.tsx`
   - Test hide functionality

6. **Create `src/hooks/useApiCall.ts`** (Optional)
   - Gradually adopt in existing code
   - No breaking changes required

---

## Expected Benefits

### Quantitative

- **~400-500 lines of code removed** (20-25% reduction in component code)
- **6 new reusable utilities/hooks** (improved code organization)
- **Reduced file sizes:**
  - `api.ts`: 417 → ~330 lines (21% reduction)
  - `Albums.tsx`: 537 → ~380 lines (29% reduction)
  - `Search.tsx`: 206 → ~170 lines (17% reduction)
  - `Player.tsx`: 623 → ~580 lines (7% reduction)

### Qualitative

- **Better testability:** Isolated hooks are easier to test
- **Improved maintainability:** Changes in one place, not scattered
- **Clearer component logic:** Components focus on UI, not data fetching
- **Reduced cognitive load:** Less code to read per file
- **Type safety:** Generics in hooks ensure type consistency
- **Easier onboarding:** New developers can understand patterns faster
- **Bug reduction:** Shared logic means fewer places for bugs to hide

---

## Risk Mitigation

### Testing Strategy

1. **Create test suite for new utilities** before refactoring
2. **Test incrementally** - refactor one hook at a time
3. **Keep old code** in comments during transition
4. **Verify behavior** matches exactly (caching, loading states, etc.)
5. **Test error paths** thoroughly

### Rollback Plan

- Use Git branches for each phase
- Can revert individual hooks if issues arise
- No breaking API changes to external systems

---

## Alternative Approaches Considered

### 1. State Management Library (Redux/Zustand)
**Pros:** Centralized state, devtools
**Cons:** Heavy-handed for this app size, steep learning curve
**Decision:** Not needed - React Context is sufficient

### 2. React Query / SWR
**Pros:** Advanced caching, automatic refetching
**Cons:** Additional dependency, over-engineered for simple needs
**Decision:** Current caching is simple and works - custom hook is lighter

### 3. Service Layer Pattern
**Pros:** Clear separation of concerns
**Cons:** More abstraction, more files
**Decision:** Hooks + utilities provide enough separation

---

## File Structure After Refactoring

```
src/
├── components/
│   ├── Player.tsx (reduced)
│   ├── Search.tsx (reduced)
│   └── TrackList.tsx
├── contexts/
│   ├── AudioContext.tsx
│   ├── AuthContext.tsx
│   ├── LoadingContext.tsx
│   └── NotificationContext.tsx
├── hooks/ (NEW)
│   ├── useAlbumLoader.ts
│   ├── useApiCall.ts
│   ├── useCachedData.ts
│   ├── useHideItem.ts
│   └── useTrackPlayer.ts
├── pages/
│   └── Albums.tsx (reduced)
├── services/
│   └── api.ts (reduced)
├── utils/ (NEW)
│   └── apiHelpers.ts
└── main.tsx
```

---

## Success Metrics

After refactoring is complete, we should see:

1. ✅ No change in user-facing functionality
2. ✅ All existing features work identically
3. ✅ ~400+ fewer lines of code
4. ✅ 6 new reusable hooks/utilities
5. ✅ Each component file <400 lines
6. ✅ No duplicated logic >10 lines
7. ✅ LLM agents can parse the codebase 20-30% faster

---

## Conclusion

This refactoring will significantly improve code maintainability without changing any user-facing functionality. The modular approach allows for incremental implementation with low risk. Each phase can be completed, tested, and deployed independently.

The new hooks and utilities will establish clear patterns that future features can follow, making the codebase more predictable and easier to extend.
