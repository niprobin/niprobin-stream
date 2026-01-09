# Niprobin Stream

A Progressive Web App (PWA) for streaming music from n8n webhooks. Built with React 19, TypeScript, Tailwind CSS, and shadcn/ui.

## Overview

Niprobin Stream is a Spotify-like music streaming application that integrates with n8n workflows to discover and play music. It features a clean, modern interface with two main sections: Search and Digging (curated tracks and albums).

## Tech Stack

- **React** 19.2.0 - UI framework
- **TypeScript** - Type safety
- **Vite** 7.3.0 - Build tool with HMR
- **Tailwind CSS** - Styling with slate color scheme
- **shadcn/ui** - Component library
- **Workbox** - Service worker for PWA functionality
- **n8n Webhooks** - Backend API integration

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Player.tsx      # Audio player with like/rating features
│   ├── Search.tsx      # Track and album search
│   ├── TrackList.tsx   # Track list display component
│   ├── InstallPrompt.tsx
│   └── NotificationBanner.tsx
├── contexts/           # React contexts
│   ├── AudioContext.tsx       # Audio playback state
│   ├── AuthContext.tsx        # Authentication state
│   └── NotificationContext.tsx # Notification system
├── pages/              # Page components
│   └── Albums.tsx      # Digging page (tracks & albums)
├── services/           # API services
│   └── api.ts          # n8n webhook integration
├── lib/                # Utilities
│   └── utils.ts        # Helper functions
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## Key Features

### 1. Audio Player
- **Single Track Mode**: Play individual tracks with metadata
- **Album Context Mode**: Play full albums with track navigation
- **Controls**: Play/pause, seek, download
- **Like System**: Save tracks to 19 themed playlists
- **Album Rating**: Rate albums with 1-5 stars
- **Expandable Interface**: Maximizes to show album tracklist
- **Smart Collapse**: Stays expanded when modal is open

### 2. Search (Home)
- Search for tracks or albums
- Real-time results from n8n backend
- Click tracks to play instantly
- Click albums to load into player

### 3. Digging (Authenticated)
- **Tracks Tab**: Curated tracks with curator filter dropdown
  - 13 curators: niprobin, FIP Best Of, Tim Reaper, etc.
  - Hide unwanted tracks
  - Pagination (10 tracks per page)
- **Albums Tab**: Curated albums grid
  - Visual album covers
  - Hide unwanted albums
  - Click to load into player
- **Sync Buttons**: Refresh data and clear cache

### 4. Authentication
- Simple access code login
- Unlocks Digging page and like features
- Persistent session via localStorage

### 5. Centralized Notifications
- Fixed banner at top of viewport (z-index 9999)
- Auto-dismiss after 3.5 seconds
- Manual dismiss with X button
- Three types: success (green), error (red), info (blue)
- Replaces all scattered error messages

### 6. Progressive Web App
- Installable on mobile/desktop
- Service worker caching
- Install prompt UI
- Offline-capable

## n8n Webhook Integration

### Endpoints

**Search**
- `POST /webhook/search-track` - Search tracks by query
- `POST /webhook/search-album` - Search albums by query

**Playback**
- `POST /webhook/stream-track` - Get stream URL for track
  - Params: `trackId`, `track`, `artist`
- `POST /webhook/download` - Download track as blob
  - Params: `trackId`, `track`, `artist`

**Curation**
- `GET /webhook/tracks-to-discover` - Get curated tracks
  - Returns: `track`, `artist`, `curator`, `spotify-id`
- `GET /webhook/albums-to-discover` - Get curated albums
  - Returns: `album`, `artist`, `cover_url`
- `GET /webhook/album-tracks` - Get tracks in album
  - Params: `albumId`, `album`, `artist`

**User Actions**
- `POST /webhook/like-track` - Like track to playlist
  - Params: `track`, `artist`, `playlist`, `spotify-id`
- `POST /webhook/rate-album` - Rate album 1-5 stars
  - Params: `album`, `artist`, `rating`
- `POST /webhook/hide-track` - Hide track from digging
  - Params: `track`, `artist`, `spotify-id`
- `POST /webhook/hide-album` - Hide album from digging
  - Params: `album`, `artist`

## State Management

### Audio Context
- Current track metadata
- Playback state (playing, paused, seeking)
- Album context (tracks, album info)
- Progress and duration

### Auth Context
- Authentication status
- Login/logout functions
- Session persistence

### Notification Context
- Current notification state
- `showNotification(message, type)` function
- Auto-dismiss timer management

## Caching Strategy

- **Duration**: 5 minutes for tracks and albums
- **Keys**:
  - `niprobin-albums-cache`
  - `niprobin-tracks-cache`
- **Storage**: localStorage with timestamp
- **Manual Refresh**: Sync buttons clear cache

## UI/UX Features

### Responsive Design
- Mobile-first approach
- Adaptive layouts (grid/flex)
- Touch-friendly controls on mobile
- Hide buttons always visible on mobile, hover-only on desktop

### Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- Focus management

### Animations
- Slide-down notification banner (150ms)
- Player expand/collapse (300ms)
- Smooth transitions throughout

### Dark Theme
- Slate color scheme (slate-900, slate-950)
- High contrast text (white/slate-400)
- Subtle borders and shadows

## Recent Updates

### Centralized Notification System
- Replaced scattered error messages across components
- Fixed full-width banner at viewport top
- Consistent styling and behavior
- All API responses flow through single system

### Player Improvements
- Fixed modal click collapsing player
- Fixed scroll prevention on maximized player
- Spotify ID integration for digging tracks
- Removed inline error displays from modals

### Curator Filter
- Dropdown to filter tracks by curator
- Client-side filtering for instant response
- "All Curators" default option
- Resets pagination on selection

### Mobile UX
- Larger hide buttons (32×32px on mobile vs 24×24px on desktop)
- Always-visible action buttons on mobile
- Consistent search bar height across screen sizes

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment

- Node.js 18+
- Supports modern browsers with ES2020+
- PWA requires HTTPS in production

## File Size Budget

- CSS: ~24KB (gzipped: 5KB)
- JS: ~283KB (gzipped: 88KB)
- Total bundle: ~398KB

## Key Technical Patterns

### API Integration
- Centralized in `services/api.ts`
- TypeScript types for all responses
- Error handling with try/catch
- Notification on failures

### Component Composition
- Reusable TrackList component with variants (search, album)
- Render props for custom indicators and actions
- Loading states and optimistic updates

### Event Handling
- Click-outside detection with modal exclusion
- Wheel event prevention for scroll control
- Event propagation management

### Performance
- localStorage caching for frequent data
- Pagination for long lists
- Lazy state updates
- Optimistic UI patterns

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

Proprietary - All rights reserved
