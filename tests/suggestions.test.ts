import { expect, test } from 'bun:test'
import { suggestedResults } from '../resources/functions/suggestions'
import type { Result } from '../resources/functions/search'
const now = Date.UTC(2026, 10, 7)
const app = (key: string, extra: Partial<Result> = {}): Result => ({ key, title: key, kind: 'application', subtitle: '', content: key, ...extra })

test('suggests recent habits over stale frequency, with explicit favorites first and no duplicates', () => {
  const items = [app('Old', { launches: 1000, lastUsed: now - 730 * 86400000 }), app('Recent', { launches: 2, lastUsed: now - 1000 }), app('Pinned', { favorite: true }), app('Other')]
  const result = suggestedResults(items, now, 3)
  expect(result.items.slice(0, 3).map(item => item.key)).toEqual(['Pinned', 'Recent', 'Old'])
  expect(result.count).toBe(3)
  expect(new Set(result.items.map(item => item.key)).size).toBe(items.length)
  expect(result.items.at(-1)?.key).toBe('Other')
})

test('new installs suggest only familiar apps actually present and leave the rest searchable', () => {
  const items = [app('Z tool'), app('Mail', { bundleId: 'com.apple.mail' }), app('Notes', { bundleId: 'com.apple.Notes' }), app('A tool')]
  expect(suggestedResults(items, now, 2).items.map(item => item.key)).toEqual(['Notes', 'Mail', 'Z tool', 'A tool'])
  expect(items.map(item => item.key)).toEqual(['Z tool', 'Mail', 'Notes', 'A tool'])
})

test('personal clipboard, contacts, files and pantry entries never become suggestions', () => {
  const rows = ['clipboard', 'contact', 'file', 'pantry', 'password'].map(kind => app(kind, { kind, favorite: true, launches: 999 }))
  const result = suggestedResults([...rows, app('Quicklink', { kind: 'quicklink', launches: 3, lastUsed: now })], now)
  expect(result.count).toBe(1)
  expect(result.items[0]?.key).toBe('Quicklink')
  expect(result.items).toHaveLength(6)
})
