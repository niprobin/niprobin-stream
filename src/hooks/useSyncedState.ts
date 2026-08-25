import { useCallback, useRef, useState } from 'react'

// A useState whose value is also mirrored into a ref, updated synchronously
// on every set. Plain useState values can't be relied on for logic that
// must read-after-write within the same call stack (before the next
// render) — e.g. a function that calls a setter and then, later in the
// same call, needs the up-to-date value itself. The ref is always current;
// the state value still drives re-renders as usual.
export function useSyncedState<T>(initial: T) {
  const [state, setState] = useState<T>(initial)
  const ref = useRef<T>(initial)
  const setSynced = useCallback((value: T) => {
    ref.current = value
    setState(value)
  }, [])
  return [state, setSynced, ref] as const
}
