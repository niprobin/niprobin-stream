// Space plays and pauses, except while typing in a field. On a focused
// button it plays or pauses instead of pressing the button. The keyboard's
// own Play/Pause key goes through the Media Session (src/playback/appEngine.ts).
export function isPlayPauseShortcut(event: KeyboardEvent): boolean {
  if (event.key !== ' ' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return false
  const target = event.target as Partial<HTMLElement> | null
  if (target?.isContentEditable) return false
  return !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
}
