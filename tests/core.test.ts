import { expect, test } from 'bun:test'
import { calculate } from '../resources/functions/calculator'
import { cacheResultQueries, createResultSearch, quicklinkArgument, quicklinkUrl, rankResults } from '../resources/functions/search'

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

test('normalized quicklink aliases preserve the original Unicode argument and cache semantics', () => {
  const item = { key: 'cafe', title: 'Café search', kind: 'quicklink', alias: 'café', content: 'https://example.com/?q={query}', subtitle: '' }
  const search = createResultSearch([item])
  for (const input of ['cafe résumé 🍀', 'CAFE\u0301 résumé 🍀', 'Café   search résumé 🍀']) {
    expect(search(input)).toEqual([item])
    expect(quicklinkArgument(item, input)).toBe('résumé 🍀')
  }
  expect(quicklinkUrl(item.content, quicklinkArgument(item, 'cafe résumé 🍀')!)).toBe('https://example.com/?q=r%C3%A9sum%C3%A9%20%F0%9F%8D%80')
  const literal = cacheResultQueries(input => [{ ...item, title: input }])
  expect(literal('café')[0]?.title).toBe('café')
  expect(literal('cafe')[0]?.title).toBe('cafe')
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
  const apps = ['Google Chrome', 'Visual Studio Code', 'System Settings', 'GitHub Desktop'].map(title => ({ key: title, title, kind: 'application', content: title, subtitle: 'Application' }))
  expect(rankResults(apps, 'chrome').map(item => item.title)).toEqual(['Google Chrome'])
  expect(rankResults(apps, 'chrm').map(item => item.title)).toEqual(['Google Chrome'])
  expect(rankResults(apps, 'vsc').map(item => item.title)).toEqual(['Visual Studio Code'])
  expect(rankResults(apps, 'sst').map(item => item.title)).toEqual(['System Settings'])
  expect(rankResults(apps, 'vs code').map(item => item.title)).toEqual(['Visual Studio Code'])
  expect(rankResults(apps, 'git hub').map(item => item.title)).toEqual(['GitHub Desktop'])
})

test('prepared search keeps ranking, Unicode identities, quicklink arguments and SDK candidate boundaries', () => {
  const apps = ['Things3', 'Things Helper', 'Visual Studio Code', 'Éditeur'].map(title => ({ key: title, title, kind: 'application', content: title, subtitle: 'Application' }))
  const link = { key: 'web', title: 'Web search', alias: 'web', kind: 'quicklink', content: 'https://example.com/{query}', subtitle: '' }
  const search = createResultSearch([...apps, link])
  expect(search('things').map(item => item.title)).toEqual(['Things3', 'Things Helper'])
  expect(search('vsc').map(item => item.title)).toEqual(['Visual Studio Code'])
  expect(search('ÉDIT').map(item => item.title)).toEqual(['Éditeur'])
  expect(search('web any query')).toEqual([link])
  expect(search('', 'quicklink')).toEqual([link])
  expect(search('things', 'all', ['Things Helper', 'missing'])).toEqual([apps[1]!])
  expect(search('things', 'all', [])).toEqual([])
  const changed = createResultSearch(apps.map(item => ({ ...item, favorite: item.title === 'Things Helper', searchAliases: item.title === 'Things3' ? ['task-manager'] : [] })))
  expect(changed('')[0]?.title).toBe('Things Helper')
  expect(changed('task-manager')[0]?.title).toBe('Things3')
  expect(search('task-manager')).toEqual([])
})

test('query results are reused across backspacing and categories and evicted at the cache bound', () => {
  let reads = 0
  const search = cacheResultQueries((query, category) => {
    reads++
    return [{ key: query, title: query, kind: category, content: '', subtitle: '' }]
  }, 2)
  const m = search('m')
  search('ma')
  expect(search(' M ')).toBe(m)
  expect(reads).toBe(2)
  expect(search('m', 'application')).not.toBe(m)
  expect(reads).toBe(3)
  search('ma')
  expect(reads).toBe(4)
  expect(search('m')).not.toBe(m)
  expect(reads).toBe(5)
  const item = { key: 'app', title: 'Mail', kind: 'application', content: '', subtitle: '' }
  const prepared = createResultSearch([item])
  expect(prepared('m')).toBe(prepared('M'))
  expect(prepared('m', 'all', [])).toEqual([])
  expect(createResultSearch([{ ...item, title: 'Changed' }])('m')).toEqual([])
})

test('launch frequency remains meaningful above 25 uses, with recency only breaking ties', () => {
  const app = (title: string, launches: number, lastUsed: number) => ({ key: title, title, launches, lastUsed, subtitle: 'Application', kind: 'application', content: `/Applications/${title}.app` })
  const apps = [app('Maps', 80, 500), app('Music', 150, 400), app('Mail', 400, 100), app('Messages', 150, 200)]
  const search = createResultSearch(apps)
  for (const query of ['m', 'M', ' m ', 'ma', 'mail', 'mai', 'ma', 'm']) {
    expect(search(query)[0]?.title).toBe('Mail')
    expect(search(query, 'application')[0]?.title).toBe('Mail')
  }
  expect(search('m').map(item => item.title)).toEqual(['Mail', 'Music', 'Messages', 'Maps'])
  expect(search('maps')[0]?.title).toBe('Maps')
  const updated = createResultSearch(apps.map(item => item.title === 'Maps' ? { ...item, launches: 600 } : item))
  expect(updated('M')[0]?.title).toBe('Maps')
  expect(search('M')[0]?.title).toBe('Mail')
  const favorite = createResultSearch(apps.map(item => ({ ...item, favorite: item.title === 'Messages' })))
  expect(favorite('m')[0]?.title).toBe('Messages')
  expect(favorite('mail')[0]?.title).toBe('Mail')
})

test('calculator ignores bare numbers and accepts pasted operator signs', () => {
  expect(calculate('2020')).toBeNull()
  expect(calculate('3.14')).toBeNull()
  expect(calculate('50%')).toBe('0.5')
  expect(calculate('6 × 7')).toBe('42')
  expect(calculate('84 ÷ 2')).toBe('42')
  expect(calculate('2 ** 10')).toBe('1024')
})
