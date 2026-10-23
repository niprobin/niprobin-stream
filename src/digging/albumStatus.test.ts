import { describe, expect, it } from 'vitest'
import type { BacklogAlbum } from '@/types/api'
import { addBlocker, albumStatus, ratingsByDeezerId, shortlistBlocker } from './albumStatus'

const album = (deezer_id: string, saved?: boolean | string): BacklogAlbum =>
  ({ id: `row-${deezer_id}`, album: 'Album', artist: 'Artist', cover_url: '', deezer_id, saved })

describe('album status', () => {
  it('reads the rating n8n has, matched on deezer_id', () => {
    const ratings = ratingsByDeezerId([{ deezer_id: 42, rating: 4 }])
    expect(albumStatus('42', [], ratings).rating).toBe(4)
    expect(albumStatus('43', [], ratings).rating).toBeNull()
  })

  it('ignores rows that are not a 1–5 rating', () => {
    const ratings = ratingsByDeezerId([
      { deezer_id: '1', rating: 0 },
      { deezer_id: '2', rating: 6 },
      { deezer_id: '', rating: 3 },
      { deezer_id: '3', rating: 5 },
    ])
    expect([...ratings]).toEqual([['3', 5]])
  })

  it('a new album can be Added and Shortlisted', () => {
    const status = albumStatus('1', [], new Map())
    expect(addBlocker(status)).toBeNull()
    expect(shortlistBlocker(status)).toBeNull()
  })

  it('a backlog album is In backlog, and only Shortlisted once saved', () => {
    const listed = albumStatus('1', [album('1')], new Map())
    expect(addBlocker(listed)).toBe('In backlog')
    expect(shortlistBlocker(listed)).toBeNull()

    const saved = albumStatus('1', [album('1', 'true')], new Map())
    expect(addBlocker(saved)).toBe('In backlog')
    expect(shortlistBlocker(saved)).toBe('Shortlisted')
  })

  it('a Rated album locks both Add and Shortlist', () => {
    const status = albumStatus('1', [album('1', true)], new Map([['1', 3]]))
    expect(addBlocker(status)).toBe('Rated')
    expect(shortlistBlocker(status)).toBe('Rated')
  })
})
