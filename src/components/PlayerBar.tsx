import { Player } from './Player'

/**
 * Desktop docked player bar (>= lg). Placeholder wrapper around the existing
 * Player for now — full visual restyle is Task 4. Wrapped in `hidden lg:block`
 * so the fixed player bar (and its queue drawer / like modal) is desktop-only;
 * mobile uses MobileBottomNav + MobileFullPlayer instead.
 */
export function PlayerBar() {
  return (
    <div className="hidden lg:block">
      <Player />
    </div>
  )
}
