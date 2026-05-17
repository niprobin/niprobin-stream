# Album Download Button — Design Spec
**Date:** 2026-05-17

## Overview

Add a "Download" button to the album details page (`/album/:id`) that is only visible to authenticated users. Clicking it triggers a POST to the `/download-album` n8n webhook with the album ID, then displays the webhook's response as a notification.

## Architecture

No new contexts or hooks needed. Follows the exact pattern of the existing `saveAlbum` / `rateAlbum` flows.

## Components

### `src/services/api.ts`
- Add `downloadAlbum(payload, token)` function
- POST to `https://n8n.niprobin.com/webhook/download-album`
- Payload: `{ deezer_id: string }` — matches existing album ID convention
- Auth: `authHeaders(token)` (X-Auth-Token header)
- Returns: `{ message: string; status: string }`

### `src/pages/Album.tsx`
- Add `isDownloading` state (boolean)
- Add `handleDownloadAlbum()` async handler — sets loading, calls API, shows notification, clears loading
- Add Download button in the auth-gated action buttons section, after the Hide button
- Button styled with `ap-action-btn`, uses `Download` icon from `lucide-react`
- Loading state: `Loader2` spinner + "Downloading..." label (same as Add+ button)

## Data Flow

```
User clicks Download
  → isDownloading = true
  → POST /download-album { deezer_id: albumId.toString() }
  → showNotification(response.message, response.status)
  → isDownloading = false
```

## Error Handling

- API error → `showNotification('Failed to download album', 'error')`
- Loading state always cleared in `finally` block

## Constraints

- Button only renders when `isAuthenticated === true`
- No file blob handling — this is a background trigger, not a file download
- Token sent via auth header, not in body
