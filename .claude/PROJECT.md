# Niprobin Stream - Project Documentation

## Overview
A personal Spotify-like PWA that streams music from n8n webhooks. Built with React, TypeScript, Tailwind CSS, and shadcn/ui with lightweight authentication that selectively unlocks gated areas of the UI (navigation tabs, likes, digging tools).

## Tech Stack
- **Framework**: Vite + React 19.2.0 + TypeScript
- **Styling**: Tailwind CSS + Inter font
- **Components**: shadcn/ui (New York style, Slate color)
- **UI Primitives**: @radix-ui/react-dialog, @radix-ui/react-tabs
- **Icons**: lucide-react
- **Backend**: n8n webhooks

## Project Structure
```
src/
??? components/
?   ??? Player.tsx        # Persistent audio player (bottom bar) with expandable album tracklist, likes, rating controls
?   ??? Search.tsx        # Track/Album search with dropdown scope switch + shared track list styling
?   ??? TrackList.tsx     # Reusable track list component for player & search
?   ??? InstallPrompt.tsx # PWA install prompt with close button
?   ??? ui/               # shadcn/ui components (button, input, progress, tabs, etc.)
??? pages/
?   ??? Albums.tsx        # Dedicated /digging ("Digging") view with in-page tabs and album discovery feed
?   ??? data/
??? contexts/
?   ??? AudioContext.tsx  # Global audio state + album context management
?   ??? AuthContext.tsx   # Simple access-code auth and storage
??? services/
?   ??? api.ts            # n8n webhook API calls (search, stream, download, likes, rating, discovery)
??? App.tsx               # Main app layout
??? main.tsx              # App entry point with AudioProvider/AuthProvider
??? index.css             # Global styles + Inter font

public/
??? icon-512.png          # PWA icon
??? manifest.json         # PWA manifest
```

## Key Features

### Authentication & Access Control
- **Inline login controls** – lightweight access-code form expands next to the header actions; authenticated users see a simple logout button.
- **UI gating** – likes, playlist modal, Digging navigation, and any future premium tools stay hidden until the session is authenticated.
- **Persistence** – access state is cached in `localStorage` for seamless reloads.

### 1. Audio Player (Player.tsx)
**Enhanced expandable player with album tracklist integration:**

#### Standard Mode (Track Playing)
- **Persistent bottom bar** - stays visible across the app
- **Play/Pause controls** - centered circle button (desktop), left-aligned (mobile)
- **Progress bar** - clickable to seek, styled with transparent/white colors
- **Track metadata** - title + artist (stacked on desktop, inline on mobile)
- **Download button** - fetches file from n8n, shows loading state
- **Show Album button** (List icon) - appears when album context is loaded, toggles tracklist
- **Like button** - opens playlist picker modal when the user is authenticated
- **Responsive layout** - desktop uses 3-column grid, mobile uses vertical stack

#### Expanded Mode (Album Tracklist)
- **Auto-expands to 80vh** by default when an album context requests expansion. Clicking an album from search now loads the album's tracklist into the player and preloads the first track, but keeps the player minimized by default (use the List icon to expand).
- **Album header** - 80x80px cover + album name + artist
- **Compact tracklist** - track number, title, artist with dividers
- **Current track highlighting** - shows which track is playing
- **Playing indicator** - ♫ when playing, ❚❚ when paused
- **Click to play** - any track in the list can be played
- **Border divider** - separates controls from album content
- **Same width** - controls and tracklist share max-w-4xl container
- **Toggle button** - List icon next to Download button (both layouts)
- **Album rating** - 1–5 clickable stars beneath artist info send a rating webhook and show inline feedback

#### Playlist Like Modal
- **Activated by heart icons** - available in player controls and by each album track entry
- **Scrollable playlist list** - displays curated destinations (Afrobeat, Beats, etc.)
- **Webhook-backed** - POSTs `{ track, artist, playlist }` to `/webhook/like-track` and surfaces success/error messages directly in the modal

### 2. Search (Search.tsx)
**Dual-mode search with dropdown scope selector:**

#### Track Search Mode
- **Search input** - rounded, gray background, white text
- **Scope switcher** - dropdown nestled between the input and submit button toggles between Tracks vs Albums
- **Results display** - uses the same `TrackList` component/styling as the album view for consistency
- **Track rows** - show cover, track name, artist, album with loading indicator
- **Click to play** - fetches stream URL and starts playback
- **Clears album context** - removes tracklist when playing single track
- **Loading states** - shows "Loading..." while fetching

#### Album Search Mode
- **Grid layout** - 2/3/4 columns (mobile/tablet/desktop)
- **Album cards** - square cover, album name, artist
- **Hover effects** - scale image + dark overlay
- **Click behavior** - populates player with album tracklist (no auto-play)
  - **Player integration** - populates the player with album tracks, preloads the first track, and keeps the player minimized by default when opened from search (use the List icon to expand).

### 6. Digging Page (/digging)
- **Navigation tab** - accessible via the Home / Digging header tabs (history API for `/` vs `/digging`); the nav hides entirely for logged-out visitors.
- **Secondary tabs** - in-page “Tracks / Albums” tabs (underline variant) sit below the routing nav and are tuned for mobile.
- **Albums tab** - fetches `/webhook/albums-to-discover` when active, paginates 10 cards per page, and reuses the discovery grid styling.
- **Tracks tab** - placeholder copy until dedicated digging tracks launch.

### 3. Audio Context (AudioContext.tsx)
**Global state with album context:**

- **Track state** - current track, play/pause, time, volume
- **Album context** - `albumTracks[]`, `albumInfo` (name, artist, cover)
- **HTML5 Audio** - single Audio instance persists across app
- **React Context** - makes audio controls available to all components
- **Key functions**:
  - `play()` - play a track
  - `pause()`, `resume()` - playback control
  - `seek()` - jump to time position
  - `setVolume()` - adjust volume
  - `setAlbumContext()` - load album tracklist
  - `clearAlbumContext()` - remove album tracklist
- **Media Session API** - integrates with OS media controls

### 4. Install Prompt (InstallPrompt.tsx)
- **PWA install banner** - shows when app is installable
- **Download icon** - clear call-to-action
- **Close button** (X icon) - dismisses the prompt
- **Install detection** - hides when already installed
- **beforeinstallprompt** event handling

### 5. API Service (api.ts)
Eight webhook endpoints:

#### Track Search
- **Endpoint**: `POST /webhook/search`
- **Request**: `{ query: string }`
- **Response**: `SearchResult[]` with cover field

#### Album Search
- **Endpoint**: `POST /webhook/search-album`
- **Request**: `{ query: string }`
- **Response**: `AlbumResult[]` with album-id, cover

#### Album Tracks
- **Endpoint**: `POST /webhook/stream-album`
- **Request**: `{ albumId: number }`
- **Response**: `AlbumTrack[]` with track-number
- **Error handling**: Ensures array return (defensive coding)

#### Stream
- **Endpoint**: `POST /webhook/stream`
- **Request**: `{ trackId: string }`
- **Response**: `{ stream_url: string }`

#### Download
- **Endpoint**: `POST /webhook/download`
- **Request**: `{ trackId, track, artist }`
- **Response**: Binary blob (MP3 file)

#### Like Track
- **Endpoint**: `POST /webhook/like-track`
- **Request**: `{ track, artist, playlist }`
- **Response**: `{ status: 'success' | 'error', message: string }`

#### Rate Album
- **Endpoint**: `POST /webhook/rate-album`
- **Request**: `{ album, artist, rating }`
- **Response**: `{ status: 'success' | 'error', message: string }`

#### Albums to Discover
- **Endpoint**: `GET /webhook/albums-to-discover`
- **Request**: none
- **Response**: `DiscoverAlbum[]` where each entry contains `{ album, artist, cover_url }`

## n8n Webhook Integration

### Search Endpoint (Tracks)
```json
POST /webhook/search
{ "query": "artist name" }

Response:
[{
  "track": "Song Name",
  "artist": "Artist Name",
  "album": "Album Name",
  "track-id": "unique-id",
  "cover": "https://cover-url.jpg"
}]
```

### Album Search Endpoint
```json
POST /webhook/search-album
{ "query": "album name" }

Response:
[{
  "album": "Album Name",
  "artist": "Artist Name",
  "album-id": 12345,
  "cover": "https://cover-url.jpg"
}]
```

### Album Tracks Endpoint
```json
POST /webhook/stream-album
{ "albumId": 12345 }

Response:
[{
  "track": "Track Name",
  "track-id": 67890,
  "artist": "Artist Name",
  "track-number": 1
}]
```

### Stream Endpoint
```json
POST /webhook/stream
{ "trackId": "unique-id" }

Response:
{ "stream_url": "https://audio-url.mp3" }
```

### Download Endpoint
```json
POST /webhook/download
{
  "trackId": "unique-id",
  "track": "Song Name",
  "artist": "Artist Name"
}

Response: Binary file (audio/mpeg)
Headers:
  Content-Type: audio/mpeg
  Content-Disposition: attachment; filename="Artist - Track.mp3"
```

### Like Track Endpoint
```json
POST /webhook/like-track
{
  "track": "Song Name",
  "artist": "Artist Name",
  "playlist": "Morning Chill"
}

Response:
{ "status": "success", "message": "Added to playlist" }
```

### Rate Album Endpoint
```json
POST /webhook/rate-album
{
  "album": "Album Name",
  "artist": "Artist Name",
  "rating": 4
}

Response:
{ "status": "success", "message": "Rating saved" }
```

### Albums to Discover Endpoint
```json
GET /webhook/albums-to-discover

Response:
[{
  "album": "Album Name",
  "artist": "Artist Name",
  "cover_url": "https://cover-url.jpg"
}]
```


## Styling Details

### Colors
- Background: `bg-slate-950` (#020617)
- Player bar: `bg-slate-900` (#0f172a)
- Cards: `bg-gray-900` hover `bg-opacity-100`, `bg-gray-800` for album grid
- Text: white primary, `text-slate-400` secondary, `text-slate-500` tertiary
- Progress track: `bg-white/20`, progress: `bg-white`
- Borders: `border-slate-800` for dividers
- Tabs: primary nav uses white-vs-slate pills, Digging tabs use underlined triggers, and search scope is now a dropdown control

### Responsive Design
- **Desktop**: 3-column player layout (metadata left, controls center, buttons right)
- **Mobile**: Vertical stack, compact spacing, metadata above play button
- **Breakpoint**: `md:` prefix (768px)
- **Full-width shell**: all primary sections stretch edge-to-edge with generous horizontal padding; player and digging grids no longer clamp at 4xl
- **Album grid**: 2 cols mobile, 3 cols tablet, 4 cols desktop

### Typography
- **Font**: Inter (400, 500, 600, 700 weights)
- **Loaded via**: Google Fonts CDN in `index.css`
- **Track list**: `text-sm` for track names, `text-xs` for artists
- **Album grid**: `text-sm` for album names, `text-xs` for artists

### Component Spacing
- **Tracklist**: `divide-y divide-slate-800` with `p-2` per item, `space-y-0.5` removed for tighter layout
- **Player padding**: `p-4 md:p-6` on main container
- **Album header**: `gap-4 mb-4` with 80x80px cover
- **Controls gap**: `gap-2` between buttons

## PWA Configuration

### manifest.json
```json
{
  "name": "Niprobin Stream",
  "short_name": "NiproStream",
  "display": "standalone",
  "theme_color": "#0f172a",
  "background_color": "#020617",
  "icons": [{ "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }]
}
```

### index.html
- Links to manifest and icon
- Theme color meta tag for mobile browsers
- Bottom padding on app container to prevent player overlap

### InstallPrompt Component
- Listens for `beforeinstallprompt` event
- Shows Download + X button when installable
- Hides after install or dismiss
- Checks `display-mode: standalone` to detect if already installed

## Key TypeScript Types

```typescript
// Track object (played in audio element)
type Track = {
  id: string
  title: string
  artist: string
  album?: string
  coverArt?: string
  streamUrl: string
}

// Search result from n8n (tracks)
type SearchResult = {
  track: string
  artist: string
  album: string
  'track-id': string
  cover: string
}

// Album search result from n8n
type AlbumResult = {
  album: string
  artist: string
  'album-id': number
  cover: string
}

// Album track listing
type AlbumTrack = {
  track: string
  'track-id': number
  artist: string
  'track-number': number
}

// Audio context type
type AudioContextType = {
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  albumTracks: AlbumTrackItem[]
  albumInfo: { name: string; artist: string; cover: string } | null
  play: (track: Track) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  setAlbumContext: (tracks: AlbumTrackItem[], albumInfo: { name: string; artist: string; cover: string }) => void
  clearAlbumContext: () => void
}
```

## User Flow

### Playing a Single Track
1. User selects the **Tracks** scope in the dropdown and runs a search
2. Clicks on a track card
3. App clears any existing album context
4. Fetches stream URL from n8n
5. Starts playing in the audio player
6. Player shows track metadata + controls (no album button)

### Playing an Album
1. User switches the dropdown to **Albums** and runs a search
2. Clicks on an album card
3. App fetches album tracklist from n8n
4. Populates audio context with tracks + album info
5. Player remains minimized by default when loaded from search; the first track is preloaded but not played. Use the List icon to expand the player and view the tracklist.
6. User can click any track to start playing
7. List icon button appears next to download button
8. Current track is highlighted in the list

### Browsing the Digging Page
1. Authenticated user clicks the **Digging** navigation tab (updates the URL to `/digging`)
2. In-page tabs default to **Tracks** placeholder; switching to **Albums** fetches `/albums-to-discover`, paginates results, and shows the grid

### Switching Between Modes
- **Album → Single Track**: Playing a search result track clears album context
- **Single Track → Album**: Selecting an album populates context and shows tracklist
- **Search scope changes**: Dropdown updates API calls without any route changes
- **Expand/Collapse**: List icon button toggles tracklist visibility

## Development Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Dependencies
```json
{
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-tabs": "latest",
  "lucide-react": "latest",
  "tailwindcss": "latest"
}
```

## Deployment (Vercel)
- Push to GitHub
- Connect repository in Vercel
- Auto-deploys on push to main branch
- Build command: `npm run build`
- Output directory: `dist`

## Recent Changes

### Loading & Routing
- Added a global full-screen loading overlay for network-heavy actions (search, albums fetch, downloads). Short inline loading indicators remain for per-row feedback.
- Removed the `/track/<hash>` URL behavior: tracks are no longer encoded into the URL and are loaded only via UI interactions (search results, album clicks, tracklist).

### Enhanced Audio Player Loading States (January 16, 2026)
**Files Modified**: `src/contexts/AudioContext.tsx`, `src/hooks/useTrackPlayer.ts`, `src/components/Player.tsx`, `src/components/TrackList.tsx`

Implemented comprehensive loading state management providing immediate visual feedback during track loading and audio buffering:

- **AudioContext Enhancement**: Added `AudioLoadingState` type with 'idle', 'fetching-stream', 'buffering', 'ready', 'error' states. Added audio event listeners (loadstart, waiting, canplay, play, error) for comprehensive loading detection. Enhanced all audio functions with loading state integration.
- **Player Component**: Replaced play/pause buttons with Loader2 spinner during loading. Both desktop (h-12 w-12) and mobile (h-10 w-10) buttons show loading state with disabled interaction. Added proper styling: `disabled:opacity-50 disabled:cursor-not-allowed`.
- **TrackList Enhancement**: Replaced "Loading..." text with Loader2 spinner icons (h-4 w-4, text-slate-400) in both album tracks view (line 65) and search results view (line 94).
- **useTrackPlayer Integration**: Enhanced with dual loading tracking for API fetch and audio buffering phases. Maintained backward compatibility with `loadingTrackId` while adding new `loadingState` and `isLoading` properties.
- **Loading State Flow**: User clicks track → 'fetching-stream' → API responds → 'buffering' → Audio ready → 'ready' → Playing → 'idle'. Provides clear visual feedback throughout entire loading process.

### Navigation & Player Polish (Latest)
- Merged drawer into expandable player
- Auto-expands to 80vh when album is loaded
- List icon button for show/hide toggle
- Current track highlighting, play indicator, and compact dividers
- Primary navigation tabs now hide when logged out to honor access control

### Search Scope & Results
- Replaced the Tracks/Albums tabs with a dropdown scope picker embedded in the search form
- Reused `TrackList` styling for search results (covers, loading indicators, consistent padding)
- Album grid retains hover overlays plus responsive 2/3/4 column layout

### Digging Discovery
- Digging navigation is auth-only; page hosts its own “Tracks / Albums” underline tabs
- Albums tab fetches `/albums-to-discover` on demand, paginates 10 cards per page, and mirrors the home grid
- Tracks tab remains a placeholder until digging-specific content is ready

### Install Prompt
- PWA install banner with close button
- Dismissible with X icon
- Auto-hides when installed

## Recent Changes

### TypeScript Build Error Fix (January 20, 2026)
**File**: `src/pages/Albums.tsx` - Fixed critical TypeScript build errors that prevented Vercel deployment.

**Root Cause**: Type mismatch where `DiscoverTrack['spotify-id']` (string) was being assigned to `AlbumTrackItem['track-id']` (number), causing compilation failures.

**Changes Made**:
- **Track Mapping** (line 185): Changed `'track-id': track['spotify-id'] || 'discover-${...}'` to `'track-id': (page - 1) * pageSize + index + 1` for numeric IDs
- **Track Lookup Logic**: Updated `onSelect`, `renderIndicator`, and `renderAction` callbacks to use array indexing instead of string-based spotify-id matching
- **Type Compliance**: Removed `startsWith()` calls on numeric track-id values that were causing string/number type conflicts

**Impact**: Build now passes TypeScript compilation and deploys successfully on Vercel. Track selection still works correctly using numeric indexing.

### Dynamic Curator Dropdown (January 20, 2026)
**File**: `src/pages/Albums.tsx` - Made curator dropdown populate dynamically from actual track data instead of hardcoded list.

**Root Cause**: The curator dropdown was populated from a hardcoded `CURATORS` array that didn't reflect new curators added to the backend track data.

**Changes Made**:
- **Removed hardcoded array** (lines 14-28): Deleted static `CURATORS` array
- **Dynamic curator extraction** (lines 145-151): Dropdown now extracts unique curators from track data using `Array.from(new Set(...)).sort()`
- **Real-time updates**: Curator options automatically reflect any new curators in the track data without code changes

**Impact**: Dropdown now shows all curators present in the actual track data, automatically including any new curators added via the backend without requiring frontend updates.

### Like Button State Fix (January 20, 2026)
**File**: `src/components/Player.tsx` - Fixed like button staying active across different tracks.

**Root Cause**: Like button state was tracked using potentially non-unique track IDs, causing different tracks to incorrectly appear as "liked" when they shared similar IDs.

**Changes Made**:
- **Improved like tracking** (line 194): Changed from track ID to `track|artist` combination for reliable uniqueness
- **Updated isTrackLiked function** (line 191): Now uses `title` and `artist` parameters instead of potentially duplicate `trackId`
- **Fixed like storage** (line 227): Like state now stored using `${title}|${artist}` key format
- **Updated all call sites**: Removed unused trackId parameters and pass track title/artist instead

**Impact**: Like button now correctly shows liked state only for the specific track+artist combination, preventing false positives when switching between tracks.

### Navbar Redesign (January 15, 2026)
**File**: `src/App.tsx` - Made navbar sticky at top with restructured left/right layout (logo + tabs on left, auth controls on right).

### Cache Duration Extended (January 15, 2026)
**File**: `src/pages/Albums.tsx` - Increased discovery page cache duration from 5 minutes to 6 hours for album and track lists.

### Digging Sub-tabs Underline Style (January 16, 2026)
**File**: `src/App.tsx`
- Changed Tracks/Albums sub-tabs from pills to underline style
- Desktop (lines 236-265): Wrapped nav in container with `border-b border-slate-700`, added `-mb-px` to align tab underlines with divider
- Mobile (lines 311-340): Same pattern with `border-b border-slate-800`
- Active state: `border-white text-white` (white underline)
- Inactive state: `border-transparent text-slate-400 hover:border-slate-600`
- Main nav border hidden on mobile (`md:border-b`) so only sub-tabs divider shows

## Known Issues & Refactoring Opportunities

### Code Duplication Areas (Future Improvement)

The following areas contain duplicated logic that could be consolidated into shared hooks:

1. **API Response Parsing** (~80 lines) - `src/services/api.ts`
   - `likeTrack()` and `rateAlbum()` have identical response parsing logic
   - **Solution**: Extract into shared `parseApiResponse()` utility

2. **Cache Management** (~80 lines) - `src/pages/Albums.tsx`
   - Album and track loading effects have identical cache validation/storage
   - **Solution**: Create generic `useCachedData<T>()` hook

3. **Album Loading Handler** (~40 lines) - `src/components/Search.tsx`, `src/pages/Albums.tsx`
   - Identical `handleAlbumClick()` logic across components
   - **Solution**: Consolidate to `useAlbumLoader()` hook (already exists)

4. **Track Playing Logic** (~60 lines) - Multiple components
   - Similar patterns for loading and playing tracks
   - **Solution**: Consolidate to `useTrackPlayer()` hook (already exists)

5. **Hide Item Logic** (~30 lines) - `src/pages/Albums.tsx`
   - `handleHideAlbum()` and `handleHideTrack()` are identical patterns
   - **Solution**: Create generic `useHideItem()` hook

**Estimated total reduction**: 400-500 lines of duplicated code

## Future Enhancements
- Queue/playlist management
- Favorites/liked songs
- Recently played history
- Keyboard shortcuts (space to play/pause, arrow keys for seek)
- Service worker for offline support
- Better error handling UI
- Album art in player when no track is playing (album-only mode)
- Shuffle and repeat controls
- Volume slider
- Next/Previous track buttons when in album context
