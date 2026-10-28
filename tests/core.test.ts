import { expect, test } from 'bun:test'
import { calculate } from '../resources/functions/calculator'
import { quicklinkArgument, quicklinkUrl, rankResults } from '../resources/functions/search'

test('calculator respects precedence, unary minus, powers, parentheses and percentages', () => {
  expect(calculate('12 + 3 * 4')).toBe('24')
  expect(calculate('(12 + 3) * 4')).toBe('60')
  expect(calculate('-2^2')).toBe('-4')
  expect(calculate('2^3^2')).toBe('512')
  expect(calculate('200 * 15%')).toBe('30')
  expect(calculate('1/0')).toBeNull()
  expect(calculate('process.exit()')).toBeNull()
  expect(calculate('2 +')).toBeNull()
  expect(calculate('3 + (2')).toBeNull()
})
test('search finds fuzzy matches, exact aliases, favorites and category filters', () => {
  const items = ['Safari', 'System Settings', 'Shortcuts'].map((title, i) => ({ key: title, title, kind: 'application', content: title, subtitle: 'App', favorite: i === 2 }))
  expect(rankResults(items, '')[0].title).toBe('Shortcuts')
  expect(rankResults(items, 'ssf')[0]?.title).toBeUndefined()
  expect(rankResults(items, 'sst')[0].title).toBe('System Settings')
  expect(rankResults(items, '', 'snippet')).toEqual([])
})
test('quicklinks encode input and refuse executable URL schemes', () => {
  expect(quicklinkUrl('https://example.com/?q={query}', 'one & two')).toBe('https://example.com/?q=one%20%26%20two')
  expect(() => quicklinkUrl('javascript:alert(1)', '')).toThrow('http')
})

test('a quicklink alias keeps the command visible while typing its argument', () => {
  const item = { key: 'search', title: 'Web search', kind: 'quicklink', content: 'https://example.com/?q={query}', subtitle: 'Search', alias: 'web' }
  expect(rankResults([item], 'web one & two')).toEqual([item])
  expect(quicklinkArgument(item, 'web one & two')).toBe('one & two')
  expect(quicklinkArgument(item, 'Web search one & two')).toBe('one & two')
  expect(quicklinkArgument(item, 'web')).toBeNull()
})

test('identity matches outrank favorites and hide weak fuzzy matches', () => {
  const item = (title: string, extra = {}) => ({ key: title, title, kind: 'application', content: title, subtitle: 'Application', ...extra })
  const things = item('Things3')
  const fuzzy = item('The Interesting Grid System', { favorite: true, launches: 100 })
  const prefix = item('Things Helper', { favorite: true, launches: 100 })
  expect(rankResults([fuzzy, prefix, things], 'things').map(value => value.title)).toEqual(['Things3', 'Things Helper'])
  expect(rankResults([things, fuzzy], 'thng')[0]?.title).toBe('Things3')
})

test('aliases match independently and descriptions are literal Pantry discovery terms', () => {
  const packageResult = { key: 'package', title: 'Widget', kind: 'pantry', content: 'widget.dev', subtitle: '', searchAliases: ['alpha', 'beta'], searchText: 'A tool for formatting source code with C++ and Node.js' }
  expect(rankResults([packageResult], 'abt')).toEqual([])
  expect(rankResults([packageResult], 'formatting')).toEqual([])
  expect(rankResults([packageResult], 'formatting', 'pantry')).toEqual([packageResult])
  expect(rankResults([packageResult], 'source formatting', 'pantry')).toEqual([packageResult])
  expect(rankResults([packageResult], 'frmtng', 'pantry')).toEqual([])
  expect(rankResults([packageResult], 'c++', 'pantry')).toEqual([packageResult])
  expect(rankResults([packageResult], 'node.js', 'pantry')).toEqual([packageResult])
  expect(rankResults([packageResult], '???')).toEqual([])
})

test('word prefixes and compact app abbreviations still work', () => {
  const apps = ['Google Chrome', 'Visual Studio Code', 'System Settings'].map(title => ({ key: title, title, kind: 'application', content: title, subtitle: 'Application' }))
  expect(rankResults(apps, 'chrome').map(item => item.title)).toEqual(['Google Chrome'])
  expect(rankResults(apps, 'chrm').map(item => item.title)).toEqual(['Google Chrome'])
  expect(rankResults(apps, 'vsc').map(item => item.title)).toEqual(['Visual Studio Code'])
  expect(rankResults(apps, 'sst').map(item => item.title)).toEqual(['System Settings'])
})
