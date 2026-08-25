# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build      # tsc -b (project references type-check) then vite build
npm run lint       # eslint .
npm run preview    # preview production build
```

There is no test suite/framework configured in this repo.

## Architecture

Niprobin Stream is a React 19 + TypeScript PWA that is a thin client over an **n8n webhook backend** — there is no app server or database in this repo; all data comes from `n8n.niprobin.com` webhooks. See `services/api.ts` for the full endpoint list (search, stream, download, curation/"digging" feeds, like/rate/hide actions).

### State: Contexts, not a store library

All app state lives in React Context providers under `src/contexts/`, composed in `App.tsx`:
- **AudioContext** (`AudioContext.tsx`, ~700 lines) — the largest and most central piece of state. Owns the `<audio>` element, current track/album, play/pause/seek, queue and album-context navigation, and download. Most player-related components (`Player.tsx`, `PlayerBar.tsx`, `MobileFullPlayer.tsx`, `Queue.tsx`) consume this rather than owning their own playback state.
- **AuthContext** — simple access-code login; gates the Digging page and like features. Session persisted to `localStorage`.
- **DiscoveryContext** — state for the Digging page (curated tracks/albums, curator filter, pagination).
- **LoadingContext** — drives the single `GlobalLoadingOverlay` used for network-heavy actions app-wide.
- **NotificationContext** — centralized toast/banner system (`showNotification(message, type)`); prefer this over ad hoc inline error UI — the codebase intentionally moved away from scattered per-component error messages toward this single system.

### Data flow and caching

- All backend calls go through `src/services/api.ts` (typed request/response via `src/types/api.ts`). Don't call webhooks directly from components.
- Curated "digging" data (tracks/albums) is cached client-side in `localStorage` for 5 minutes (`niprobin-tracks-cache`, `niprobin-albums-cache`); Sync buttons in the UI clear this cache. When changing digging data flows, keep cache invalidation in mind.
- The PWA service worker (`vite-plugin-pwa`, configured in `vite.config.ts`) additionally does `NetworkFirst` runtime caching of `n8n.niprobin.com` requests for 24h — two caching layers exist (localStorage app-cache and SW HTTP-cache).

### Pages vs. components

- `src/pages/` — top-level routed screens (`Home` = search, `Digging` = curated tracks/albums, `Album`, `Artist`, `Login`).
- `src/components/` — reusable UI, including player chrome (`Player.tsx`, `PlayerBar.tsx`, `MobileFullPlayer.tsx`), `TrackList.tsx` (used for both search results and album views via a variant prop), and `src/components/ui/` which is shadcn/ui-generated (new-york style, slate base color) — treat these as generated/vendor components and prefer composing over heavily editing them.
- Path alias `@/*` maps to `src/*` (configured in both `vite.config.ts` and `tsconfig.json`).

### Styling

Tailwind CSS with a dark slate theme (`slate-900`/`slate-950` backgrounds). No light theme. `class-variance-authority` + `tailwind-merge`/`clsx` (via `src/lib/utils.ts` `cn()`) are the standard pattern for variant-based component styling, matching shadcn/ui conventions.

### Docs

`docs/superpowers/plans/` and `docs/superpowers/specs/` contain dated planning/design docs for past features (search & mobile UI, album download button, swipe animations) — useful for understanding *why* a feature was built a certain way before changing it.
