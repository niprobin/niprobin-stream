# Design Spec: Global Search + Mobile UI Improvements

**Date:** 2026-05-06  
**Status:** Approved

---

## Context

Two improvements to address usability gaps:

1. **Search is buried** — currently a standalone page at `/`, requiring navigation away from content to search. Users can't search while browsing Digging or Library.
2. **Mobile tracklist is broken** — a fixed 4-column grid (`[44px_1fr_120px_72px]`) leaves only ~107px for track titles on a 375px phone. The heart button is also hover-only, making it invisible on touch devices.

Both changes share a prerequisite: pre-fetching Digging data at app load (currently only fetched when visiting the Digging page).

---

## Step 1: Global Search

### Header Bar

An always-visible compact search input sits in the header between the logo and nav tabs. On mobile it renders as a full-width row below the logo/nav row.

### Dropdown Results Panel

Focus opens the dropdown. Results only appear after pressing Enter. Three sections, in priority order:

| Section | Trigger | Data source | Max shown |
|---|---|---|---|
| External | press Enter | `/search` + `/search-album` API | 4 each |
| Digging Tracks | press Enter | local cache (client filter) | 4 |
| Digging Albums | press Enter | local cache (client filter) | 4 |

**Loading behaviour:** on Enter, show a spinner in the dropdown while the External API call runs. Once it resolves, render all three sections together in a single paint — External first, then Digging Tracks, then Digging Albums.

- "See all" link in External section navigates to a full results page (reuses existing `Search.tsx` display logic).
- Dropdown closes on Escape or click-away.

### Data Pre-fetch Strategy

Move the `getTracksToDiscover` and `getAlbumsToDiscover` fetches from `Digging.tsx` up to app level, stored in a new slim `DiscoveryContext`. `AudioContext` is already large — keep concerns separate. Use the existing `useCachedData` hook (6h localStorage cache). Fetch only when authenticated.

This single change serves three features: home carousel, search dropdown, and the existing Digging page — with zero extra API calls.

### Files to create/modify

- `src/components/SearchBar.tsx` — new header search input + dropdown
- `src/contexts/DiscoveryContext.tsx` — new context for pre-fetched Digging data (or extend AudioContext)
- `src/App.tsx` — add `SearchBar` to header, add `DiscoveryProvider`, remove old Home route search
- `src/pages/Home.tsx` — new file (carousel home page, see Step 2)
- `src/components/Search.tsx` — repurpose as full results view (remove page-level fetch, accept results as props)

---

## Step 2: New Home Page

**Route:** `/` → `src/pages/Home.tsx`

Two horizontal-scroll carousels using the pre-fetched Digging data:

1. **Digging Tracks** — slim cards (album art + title + artist). Tap to play via `useTrackPlayer`.
2. **Digging Albums** — square cover cards. Tap to navigate to `/album/:id`.

Each section has a header with label + "See all →" link (`/digging/tracks`, `/digging/albums`).

Cards use `overflow-x-auto` with `flex` and `snap-x snap-mandatory` for smooth mobile swipe. Cover art comes from Deezer via `deezer_id` (same pattern as existing `AlbumCard`).

### Files to create/modify

- `src/pages/Home.tsx` — new carousel page
- `src/App.tsx` — wire `/` to `Home` instead of `Search`

---

## Step 3: Mobile Tracklist Fix

### Grid Layout

`TrackList.tsx` uses a single `gridCols` constant. Replace with two responsive values:

```
Mobile:  grid-cols-[36px_1fr_44px]        (track# · title/artist · action)
Desktop: grid-cols-[44px_1fr_120px_72px]  (unchanged)
```

Applied via: `grid-cols-[36px_1fr_44px] md:grid-cols-[44px_1fr_120px_72px]`

### Date Column

Wrap date cell and its header in `hidden md:block` — invisible on mobile, visible on desktop. No data is removed, just conditionally rendered.

### Heart Button (touch fix)

Remove `opacity-0 group-hover:opacity-100` on mobile. Strategy:

```
opacity-100 md:opacity-0 md:group-hover:opacity-100
```

On screens below `md`, the heart is always visible (full opacity). On desktop, hover behaviour is unchanged.

This fix applies everywhere `TrackList` is used: Digging tracks list, album detail page, and the expanded queue in the player.

### Files to modify

- `src/components/TrackList.tsx` — grid, date column visibility, heart button opacity

---

## Verification

1. **Search dropdown** — type in header bar, press Enter, confirm spinner appears then all three sections render together with External first.
2. **Mobile search** — on a 375px viewport, confirm bar is full-width, dropdown doesn't overflow.
3. **Home carousels** — both rows visible, horizontal scroll works, "See all →" navigates correctly, tapping a track plays it.
4. **TrackList mobile** — on 375px: title not truncated, heart always visible, date column absent.
5. **TrackList desktop** — all four columns present, hover interactions unchanged.
6. **Queue in player** — expanded tracklist on mobile shows correctly with new grid.
