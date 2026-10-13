# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start Vite dev server
npm run build      # tsc -b (project references type-check) then vite build
npm run lint       # eslint .
npm run preview    # preview production build
npm test           # vitest run (module tests against a fake n8n, see test/)
```

## Architecture

Niprobin Stream is a React 19 + TypeScript PWA that is a thin client over an **n8n webhook backend** — there is no app server or database in this repo; all data comes from `n8n.niprobin.com` webhooks. See `services/api.ts` for the full endpoint list (search, stream, download, curation/"digging" feeds, Pick/Rate/Hide actions; webhook names are frozen, e.g. `like-track` is Pick).

### State: Contexts, not a store library

All app state lives in React Context providers under `src/contexts/`, composed in `App.tsx`:
- **AudioContext** — a thin React layer over the playback engine in `src/playback/` (copied from the native client, ADR 0001). The engine owns the queue, next/previous and auto-advance; its Track Cache runs `/stream` lookups one at a time (n8n can't take overlapping ones) and downloads each file into memory before playing it (ADR 0002). Player components (`Player.tsx`, `PlayerBar.tsx`, `MobileFullPlayer.tsx`, `Queue.tsx`) consume `useAudio()`; pages start playback with `playList(tracks, index, info)`.
- **AuthContext** — simple access-code login; gates the Digging page and the digging actions. Session persisted to `localStorage`.
- **BacklogContext** — the Track and Album Backlogs for Home and the Digging page, without the items Hidden in this browser, plus Hide (rules in `src/digging/hides.ts`).
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

`CONTEXT.md` points to the domain glossary, which lives in the native client's repo (`nipstream-native-app/CONTEXT.md`); `docs/adr/` holds this repo's decisions.

`docs/superpowers/plans/` and `docs/superpowers/specs/` contain dated planning/design docs for past features (search & mobile UI, album download button, swipe animations) — useful for understanding *why* a feature was built a certain way before changing it.
