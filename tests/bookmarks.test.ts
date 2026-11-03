import { expect, test } from 'bun:test'
import {
  bookmarkBrowsers, bookmarkDetail, bookmarkFile, bookmarkResults,
  isOpenableBookmark, maxBookmarks, parseChromiumBookmarks,
} from '../resources/functions/bookmarks'

const tree = (children: unknown[]) => JSON.stringify({ roots: { bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children } } })
const link = (name: string, url: string, guid = name) => ({ type: 'url', name, url, guid })

test('a profile path is built from the home directory and the browser', () => {
  const chrome = bookmarkBrowsers.find(browser => browser.id === 'chrome')!
  expect(bookmarkFile('/Users/ada', chrome)).toBe('/Users/ada/Library/Application Support/Google/Chrome/Default/Bookmarks')
  expect(bookmarkFile('/Users/ada/', chrome, 'Profile 2')).toContain('/Google/Chrome/Profile 2/Bookmarks')
  // Every browser names a support directory, since that is the only way its file is found.
  for (const browser of bookmarkBrowsers) expect(browser.support.length).toBeGreaterThan(0)
})

test('only http and https bookmarks can be opened', () => {
  for (const good of ['http://example.com', 'https://example.com/a?b=c#d']) expect(isOpenableBookmark(good)).toBe(true)
  // A bookmark is opened through the shell, so anything else would hand what a page saved to the system.
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,<script>', 'chrome://settings', 'not a url', '', null, 7, `https://e.com/${'a'.repeat(2100)}`])
    expect(isOpenableBookmark(bad)).toBe(false)
})

test('the detail line shows the site and path, without the www', () => {
  expect(bookmarkDetail('https://www.example.com/')).toBe('example.com')
  expect(bookmarkDetail('https://example.com/docs/intro')).toBe('example.com/docs/intro')
  expect(bookmarkDetail('nonsense')).toBe('nonsense')
})

test('bookmarks are read from every root, with their folder', () => {
  const text = JSON.stringify({
    roots: {
      bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children: [
        link('Example', 'https://example.com'),
        { type: 'folder', name: 'Work', children: [link('Docs', 'https://docs.example.com')] },
      ] },
      other: { type: 'folder', name: 'Other', children: [link('Spare', 'https://spare.example.com')] },
      synced: { type: 'folder', name: 'Synced', children: [link('Phone', 'https://phone.example.com')] },
    },
  })
  const found = parseChromiumBookmarks(text, 'Chrome')
  expect(found.map(entry => entry.title)).toEqual(['Example', 'Docs', 'Spare', 'Phone'])
  expect(found[0]!.folder).toBe('Bookmarks bar')
  expect(found[1]!.folder).toBe('Bookmarks bar/Work')
  expect(found.every(entry => entry.browser === 'Chrome')).toBe(true)
})

test('a damaged or unexpected file gives nothing rather than throwing', () => {
  for (const bad of ['', 'not json', '[]', '{}', '{"roots":null}', '{"roots":"text"}', JSON.stringify({ roots: { bookmark_bar: 'text' } })])
    expect(parseChromiumBookmarks(bad, 'Chrome')).toEqual([])
})

test('entries that cannot be opened are left out', () => {
  const found = parseChromiumBookmarks(tree([
    link('Fine', 'https://example.com'),
    link('Script', 'javascript:alert(1)'),
    link('Local', 'file:///etc/passwd'),
    { type: 'url', name: 'No URL', guid: 'x' },
    'not an object',
  ]), 'Chrome')
  expect(found.map(entry => entry.title)).toEqual(['Fine'])
})

test('the same page bookmarked twice appears once', () => {
  const found = parseChromiumBookmarks(tree([
    link('First', 'https://example.com/page', 'a'),
    link('Second', 'https://EXAMPLE.com/page', 'b'),
  ]), 'Chrome')
  expect(found).toHaveLength(1)
  expect(found[0]!.title).toBe('First')
})

test('an untitled bookmark falls back to its address', () => {
  const found = parseChromiumBookmarks(tree([{ type: 'url', name: '   ', url: 'https://www.example.com/docs', guid: 'a' }]), 'Chrome')
  expect(found[0]!.title).toBe('example.com/docs')
})

test('a file cannot ask for unbounded work', () => {
  const many = Array.from({ length: maxBookmarks + 500 }, (_, index) => link(`Link ${index}`, `https://example.com/${index}`, `g${index}`))
  expect(parseChromiumBookmarks(tree(many), 'Chrome')).toHaveLength(maxBookmarks)
  // Folders nest, and a file could claim to nest forever.
  let deep: Record<string, unknown> = { type: 'url', name: 'Deep', url: 'https://example.com/deep', guid: 'd' }
  for (let level = 0; level < 60; level++) deep = { type: 'folder', name: `L${level}`, children: [deep] }
  expect(parseChromiumBookmarks(tree([deep]), 'Chrome')).toEqual([])
})

test('rows carry the folder and the site, and are searchable by both', () => {
  const found = parseChromiumBookmarks(JSON.stringify({ roots: { bookmark_bar: { type: 'folder', name: 'Bar', children: [link('Docs', 'https://docs.example.com/intro')] } } }), 'Chrome')
  const [row] = bookmarkResults(found)
  expect(row).toMatchObject({ kind: 'bookmark', title: 'Docs', content: 'https://docs.example.com/intro' })
  expect(row!.key).toBe('bookmark:Chrome:Docs')
  expect(row!.subtitle).toBe('Bookmark · Chrome · Bar · docs.example.com/intro')
  expect(row!.searchText).toContain('Bar')
  expect(row!.searchText).toContain('docs.example.com')
})
