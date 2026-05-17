# Album Download Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated "Download" button to the album details page that POSTs the album ID to the `/download-album` n8n webhook and shows the response as a notification.

**Architecture:** Add a `downloadAlbum()` API function following the existing `saveAlbum`/`rateAlbum` pattern, then wire a loading-state button into the Album page's auth-gated action section.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, lucide-react, n8n webhooks

---

### Task 1: Add `downloadAlbum` API function

**Files:**
- Modify: `src/services/api.ts`

Context: `src/services/api.ts` already has `authHeaders(token)` helper and similar functions like `saveAlbum`. This new function follows the same shape.

- [ ] **Step 1: Add the function at the end of `src/services/api.ts`**

Add immediately after the `saveAlbum` function (search for `export async function saveAlbum` to find the location). Add this block:

```typescript
// Trigger album download via n8n webhook
export async function downloadAlbum(
  deezer_id: string,
  token: string | null
): Promise<{ message: string; status: string }> {
  const response = await fetch('https://n8n.niprobin.com/webhook/download-album', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ deezer_id }),
  })

  if (!response.ok) {
    throw new Error('Failed to trigger album download')
  }

  return response.json()
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/api.ts
git commit -m "feat: add downloadAlbum API function"
```

---

### Task 2: Add Download button to Album page

**Files:**
- Modify: `src/pages/Album.tsx`

Context: `Album.tsx` already imports `useAuth`, `useNotification`, `Loader2`, and has `isSaving`/`handleAddAlbum` as the pattern to follow. Auth-gated buttons render inside the `ap-actions-secondary` div.

- [ ] **Step 1: Add `downloadAlbum` to the import from `@/services/api`**

Find this line in `src/pages/Album.tsx`:
```typescript
import { getAlbumById, rateAlbum, hideAlbum, saveAlbum, type AlbumTrack } from '@/services/api'
```

Replace with:
```typescript
import { getAlbumById, rateAlbum, hideAlbum, saveAlbum, downloadAlbum, type AlbumTrack } from '@/services/api'
```

- [ ] **Step 2: Add `Download` to the lucide-react icon import**

Find:
```typescript
import { Share2, X, Loader2, Music4 } from 'lucide-react'
```

Replace with:
```typescript
import { Share2, X, Loader2, Music4, Download } from 'lucide-react'
```

- [ ] **Step 3: Add `isDownloading` state**

Find the existing state declarations block (around line 29, near `isSaving`):
```typescript
const [isSaving, setIsSaving] = useState(false)
```

Add immediately after:
```typescript
const [isDownloading, setIsDownloading] = useState(false)
```

- [ ] **Step 4: Add `handleDownloadAlbum` handler**

Find the `handleAddAlbum` function in `Album.tsx`. Add this new handler immediately after it:

```typescript
// Handle download album
const handleDownloadAlbum = async () => {
  setIsDownloading(true)

  try {
    const response = await downloadAlbum(albumId.toString(), token)
    showNotification(response.message, response.status)
  } catch (err) {
    showNotification('Failed to download album', 'error')
    console.error('Failed to download album:', err)
  } finally {
    setIsDownloading(false)
  }
}
```

- [ ] **Step 5: Add the Download button in the JSX**

Find the Hide button block in the JSX:
```tsx
{/* Hide Button */}
{isAuthenticated && (
  <button
    onClick={handleHideAlbum}
    className="ap-action-btn"
  >
    <span>Hide</span>
    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
  </button>
)}
```

Add the Download button immediately after that block:
```tsx
{/* Download Button */}
{isAuthenticated && (
  <button
    onClick={handleDownloadAlbum}
    disabled={isDownloading}
    className="ap-action-btn"
  >
    {isDownloading ? (
      <>
        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" strokeWidth={1.5} />
        <span>Downloading...</span>
      </>
    ) : (
      <>
        <span>Download</span>
        <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
      </>
    )}
  </button>
)}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Smoke test in browser**

```bash
npm run dev
```

1. Navigate to any album page (e.g. `http://localhost:5173/album/510233041`)
2. **Unauthenticated:** confirm Download button is NOT visible
3. **Authenticated:** confirm Download button IS visible after logging in
4. Click Download → button shows spinner + "Downloading..." during request
5. After response: notification appears with the webhook's message
6. Button returns to normal state after completion

- [ ] **Step 8: Commit**

```bash
git add src/pages/Album.tsx
git commit -m "feat: add authenticated Download button to album page"
```
