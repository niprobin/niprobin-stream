import { describe, expect, it } from 'vitest'
import { isPlayPauseShortcut } from './playPauseShortcut'

function press(key: string, target: Partial<{ tagName: string; isContentEditable: boolean }> = { tagName: 'BODY' }, extra = {}) {
  return { key, target, repeat: false, ctrlKey: false, metaKey: false, altKey: false, ...extra } as unknown as KeyboardEvent
}

describe('the play/pause shortcut', () => {
  it('is Space anywhere on the page, buttons included', () => {
    expect(isPlayPauseShortcut(press(' '))).toBe(true)
    expect(isPlayPauseShortcut(press(' ', { tagName: 'BUTTON' }))).toBe(true)
  })

  it('leaves Space to fields being typed in', () => {
    expect(isPlayPauseShortcut(press(' ', { tagName: 'INPUT' }))).toBe(false)
    expect(isPlayPauseShortcut(press(' ', { tagName: 'TEXTAREA' }))).toBe(false)
    expect(isPlayPauseShortcut(press(' ', { tagName: 'SELECT' }))).toBe(false)
    expect(isPlayPauseShortcut(press(' ', { tagName: 'DIV', isContentEditable: true }))).toBe(false)
  })

  it('ignores other keys, a held Space, and Space with a modifier', () => {
    expect(isPlayPauseShortcut(press('k'))).toBe(false)
    expect(isPlayPauseShortcut(press(' ', undefined, { repeat: true }))).toBe(false)
    expect(isPlayPauseShortcut(press(' ', undefined, { ctrlKey: true }))).toBe(false)
  })
})
