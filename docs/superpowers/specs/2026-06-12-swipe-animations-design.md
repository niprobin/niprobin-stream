# Swipe Animation Design — MobilePlayer

Date: 2026-06-12

## Goal

Make swipe gestures on the MobilePlayer self-explanatory by providing real-time visual feedback as the user drags, rather than firing actions only on `touchend`.

## Approved behaviour (from brainstorming)

| Gesture | What moves | What stays fixed | Action on commit |
|---|---|---|---|
| Swipe left (→ next) | Album art + track title translate left, next-track art peeks in from right | Progress bar, controls, action buttons | Play next track |
| Swipe right (→ prev) | Album art + track title translate right, prev-track art peeks in from left | Progress bar, controls, action buttons | Play previous track |
| Swipe up (→ queue) | Queue panel slides up from bottom, follows finger | Entire player behind it | Snap queue fully open |
| Swipe down (queue open) | Queue panel slides back down | — | Close queue |
| Swipe down (queue closed) | Whole player slides down | — | Close player |

## Layout changes in MobilePlayer

The current single flex column needs to split into two independently-positioned layers:

1. **Draggable art layer** (`position: absolute`, top half of screen)
   - Album art image / placeholder
   - Track title + artist name
   - Ghost art for prev/next track (rendered off-screen, peeks in during drag)

2. **Fixed controls layer** (`position: absolute`, bottom half of screen)
   - Progress bar + timestamps
   - Prev / Play / Next buttons
   - Like / Share / Download / Queue action row

3. **Queue panel** (`position: absolute`, `bottom: 0`, starts at `translateY(100%)`)
   - Existing queue content unchanged
   - Drag handle bar at top

## Hook changes — `usePlayerGestures`

Add `touchmove` tracking alongside the existing `touchstart`/`touchend` logic.

New callbacks added to `GestureHandlers`:

```ts
onDragX?: (deltaX: number) => void   // fired every touchmove for horizontal drags
onDragY?: (deltaY: number) => void   // fired every touchmove for vertical drags
onDragEnd?: () => void               // fired on touchend so component can spring-back
```

- `onDragX` / `onDragY` are called only for the dominant axis (same axis-lock logic as today)
- Existing `onSwipeLeft/Right/Up/Down` still fire on `touchend` after threshold

## State in MobilePlayer

```ts
const [dragX, setDragX] = useState(0)   // horizontal drag delta (px)
const [dragY, setDragY] = useState(0)   // vertical drag delta (px), positive = finger moving up
const [isDragging, setIsDragging] = useState(false)
```

- **During drag**: `isDragging = true`, `transition: none` so the element follows the finger with zero lag
- **After drag**: `isDragging = false`, `transition: transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)` (spring-like ease-out)
- **On commit** (`onSwipeLeft/Right`): animate art fully off-screen, then reset to 0 after the track changes (track change triggers re-render of art)
- `dragX` is clamped so the art can't slide more than ~screen width
- `dragY` is clamped between 0 (queue fully hidden) and `window.innerHeight * 0.85` (queue fully open)

## Ghost art for horizontal peek

A second `<img>` (or placeholder box) rendered adjacent to the current art:
- For a left swipe, it appears to the right of current art at `translateX(artWidth + gap)`
- It shows the next track's cover art (from `albumTracks[currentTrackIndex + 1]`)
- Fades in proportionally to `Math.abs(dragX) / threshold`
- Same applies for previous track on right swipe

## Queue panel drag

The queue panel's `transform` is driven directly by `dragY`:

```
translateY(calc(100% - clamp(0px, dragY, 85vh)))
```

Snap thresholds on `touchend`:
- `dragY > window.innerHeight * 0.3` → snap open (`showQueue = true`, `dragY = 0`)
- `dragY ≤ window.innerHeight * 0.3` → snap back (`dragY = 0`)

When queue is already open, `onSwipeDown` resets `showQueue = false`.

## Axis lock

The hook already picks the dominant axis on `touchend`. For `onDragX`/`onDragY` during `touchmove`, apply the same axis lock after the first 8px of movement, so the user can't accidentally drift diagonally.

## Files to change

| File | Change |
|---|---|
| `src/hooks/usePlayerGestures.ts` | Add `touchmove` handler, `onDragX`, `onDragY`, `onDragEnd` callbacks, axis lock |
| `src/components/MobilePlayer.tsx` | Split into draggable-art layer + fixed-controls layer; add `dragX`/`dragY` state; wire new callbacks; render ghost art; drive queue panel transform |

No other files need changes.

## What is NOT changing

- Swipe down to close player (existing `onClose` call) — just gains a slide-down animation
- Queue content, track list, like modal — unchanged
- Desktop Player component — unaffected
- All existing haptic feedback (`navigator.vibrate`) — preserved
