import { expect, test } from 'bun:test'
import { calculate } from '../resources/functions/calculator'
import { actionLabelFor, categoryOrder, composeResults, fileResults, inlineFiles, isRankable, nextCategory, secondaryActions } from '../resources/functions/launcher-results'
import { emojiResults } from '../resources/functions/emoji'
import { createResultSearch } from '../resources/functions/search'
import type { Result } from '../resources/functions/search'
import { defaultSearchSettings } from '../resources/functions/search-settings'
import { systemCommandResults } from '../resources/functions/system-commands'
import { extensionResults, sampleManifest } from '../resources/functions/extensions'

const app = (title: string): Result => ({ key: `/Applications/${title}.app`, title, subtitle: 'Application', kind: 'application', content: `/Applications/${title}.app` })
const file = (name: string): Result => ({ key: `file:/h/${name}`, title: name, subtitle: '~', kind: 'file', content: `/h/${name}`, detail: `/h/${name}` })
const local = createResultSearch([app('Mail'), app('Maps'), app('Notes'), ...systemCommandResults(), ...extensionResults([{ name: 'Team shortcuts', manifest: sampleManifest }])])
const emoji = createResultSearch(emojiResults())

function compose(overrides: Partial<Parameters<typeof composeResults>[0]> = {}) {
  return composeResults({ category: 'all', query: '', searchLocal: local, searchEmoji: emoji, files: [], windows: [], contacts: [], events: [], rates: { enabled: false }, settings: defaultSearchSettings, calculate, ...overrides })
}
const titles = (items: Result[]) => items.map(item => item.title)

test('the idle list shows apps and commands, never system actions, emoji or extension commands', () => {
  const idle = compose()
  expect(titles(idle)).toEqual(['Mail', 'Maps', 'Notes'])
  expect(compose({ category: 'quicklink' }).every(item => item.kind === 'quicklink')).toBe(true)
})

test('an ordinary search leads with an answer, then local matches, then files, then the web', () => {
  const files = Array.from({ length: 9 }, (_, i) => file(`mail ${i}.txt`))
  const results = compose({ query: 'mail', files })
  expect(titles(results).slice(0, 1)).toEqual(['Mail'])
  const kinds = results.map(item => item.kind)
  expect(kinds.filter(kind => kind === 'file')).toHaveLength(inlineFiles)
  expect(kinds.at(-1)).toBe('web')
  expect(kinds.indexOf('file')).toBeGreaterThan(kinds.indexOf('application'))
  expect(results.at(-1)!.title).toBe('Search the web for “mail”')
})

test('math and conversions lead the list, and a conversion never competes with a calculation', () => {
  expect(compose({ query: '2+2' })[0]).toMatchObject({ kind: 'calculator', content: '4' })
  expect(compose({ query: '5 km in miles' })[0]).toMatchObject({ kind: 'calculator', title: '5 km = 3.106855961 mi' })
  expect(compose({ query: '100 usd to eur' })[0]).toMatchObject({ kind: 'setup', content: 'search' })
  const rates = { enabled: true as const, table: { rates: { USD: 1.25 }, updatedAt: Date.parse('2026-10-30') } }
  expect(compose({ query: '100 usd to eur', rates })[0]).toMatchObject({ kind: 'calculator', content: '80' })
  expect(compose({ query: '2020' })[0]?.kind).not.toBe('calculator')
})

test('system commands are found by search', () => {
  expect(compose({ query: 'dark mode' })[0]).toMatchObject({ kind: 'system', content: 'toggle-dark-mode' })
  expect(compose({ query: 'docs onboarding' }).some(item => item.key === 'extension:Team shortcuts:docs')).toBe(true)
})

test('settings turn files and the web fallback off', () => {
  const files = [file('mail.txt')]
  const off = compose({ query: 'mail', files, settings: { ...defaultSearchSettings, files: false, web: 'off' } })
  expect(off.some(item => item.kind === 'file' || item.kind === 'web')).toBe(false)
  expect(compose({ query: 'm', files }).some(item => item.kind === 'file')).toBe(false)
  expect(compose({ query: 'zzzz', settings: { ...defaultSearchSettings, web: 'google' } }).map(item => item.subtitle)).toEqual(['Google · Opens in your browser'])
})

test('a leading colon or the Emoji tab searches only emoji', () => {
  expect(compose({ query: ':rocket' })[0]).toMatchObject({ kind: 'emoji', content: '🚀' })
  expect(compose({ query: ':rocket' }).every(item => item.kind === 'emoji')).toBe(true)
  expect(compose({ category: 'emoji', query: 'rocket' })[0]?.content).toBe('🚀')
  expect(compose({ category: 'emoji', query: '' }).length).toBeGreaterThan(300)
})

test('each live tab shows its own list and filters locally where it can', () => {
  const windows: Result[] = [{ key: 'window:1:1', title: 'Inbox', subtitle: 'Mail · Window', kind: 'window', content: '{}', searchAliases: ['Mail'] }, { key: 'window:2:1', title: 'Budget', subtitle: 'Numbers · Window', kind: 'window', content: '{}', searchAliases: ['Numbers'] }]
  expect(compose({ category: 'window', windows })).toHaveLength(2)
  expect(titles(compose({ category: 'window', query: 'budget', windows }))).toEqual(['Budget'])
  expect(titles(compose({ category: 'window', query: 'mail', windows }))).toEqual(['Inbox'])
  const contacts: Result[] = [{ key: 'contact:1', title: 'Ada', subtitle: 'Contact', kind: 'contact', content: '1' }]
  expect(compose({ category: 'contact', query: 'a', contacts })).toEqual([])
  expect(compose({ category: 'contact', query: 'ad', contacts })).toEqual(contacts)
  const events: Result[] = [{ key: 'event:1', title: 'Standup', subtitle: 'Today', kind: 'event', content: '1' }, { key: 'event:2', title: 'Dentist', subtitle: 'Tomorrow', kind: 'event', content: '2' }]
  expect(compose({ category: 'event', events })).toHaveLength(2)
  expect(titles(compose({ category: 'event', query: 'dent', events }))).toEqual(['Dentist'])
  expect(compose({ category: 'file', query: '', files: [file('a')] })).toEqual([])
  expect(titles(compose({ category: 'file', query: 'a', files: [file('a')] }))).toEqual(['a'])
})

test('only stable things earn favorites and launch counts', () => {
  for (const kind of ['application', 'quicklink', 'snippet', 'clipboard', 'github', 'system', 'emoji']) expect(isRankable(kind)).toBe(true)
  for (const kind of ['file', 'window', 'contact', 'event', 'web', 'setup', 'calculator', 'pantry']) expect(isRankable(kind)).toBe(false)
})

test('buttons say what Return does, and secondary actions exist only where they mean something', () => {
  expect(Object.fromEntries(['application', 'system', 'setup', 'window', 'file', 'web', 'emoji', 'snippet', 'pantry', undefined].map(kind => [String(kind), actionLabelFor(kind)]))).toEqual({
    application: 'Open', system: 'Run', setup: 'Settings', window: 'Switch', file: 'Open', web: 'Open', emoji: 'Copy', snippet: 'Copy', pantry: 'Details', undefined: 'Copy',
  })
  expect(secondaryActions(file('a.txt'))).toEqual({ reveal: true, copy: '/h/a.txt' })
  expect(secondaryActions({ kind: 'contact', content: 'id', detail: 'ada@example.com' })).toEqual({ reveal: false, copy: 'ada@example.com' })
  expect(secondaryActions({ kind: 'application', content: '/x' })).toEqual({ reveal: false, copy: '' })
  expect(secondaryActions(undefined)).toEqual({ reveal: false, copy: '' })
})

test('file rows show their folder, mark directories, and carry the path for Copy', () => {
  const rows = fileResults([{ path: '/h/Documents/Plan.pdf', name: 'Plan.pdf', folder: '~/Documents', directory: false }, { path: '/h/Documents/Plans', name: 'Plans', folder: '~/Documents', directory: true }])
  expect(rows[0]).toMatchObject({ key: 'file:/h/Documents/Plan.pdf', title: 'Plan.pdf', subtitle: '~/Documents', kind: 'file', content: '/h/Documents/Plan.pdf', detail: '/h/Documents/Plan.pdf' })
  expect(rows[1]!.subtitle).toBe('Folder · ~/Documents')
})

test('category cycling wraps in both directions and recovers from an unknown tab', () => {
  expect(nextCategory('all', 1)).toBe('application')
  expect(nextCategory('all', -1)).toBe('pantry')
  expect(nextCategory('pantry', 1)).toBe('all')
  expect(nextCategory('nonsense', 1)).toBe('application')
  let current = 'all'
  const seen = new Set<string>()
  for (let step = 0; step < categoryOrder.length; step++) { seen.add(current); current = nextCategory(current, 1) }
  expect(seen.size).toBe(categoryOrder.length)
  expect(current).toBe('all')
})
