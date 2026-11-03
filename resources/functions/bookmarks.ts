import type { Result } from './search'

/**
 * Bookmarks are a set of links someone has already curated, so the palette reads them rather than asking for the
 * same links again. Chromium browsers keep theirs as a JSON file under a profile directory, which is what this
 * understands. Reading is the whole of it: Launchpad never writes to a browser's bookmarks.
 */
export const bookmarkBrowsers = [
  { id: 'chrome', name: 'Chrome', support: 'Google/Chrome' },
  { id: 'brave', name: 'Brave', support: 'BraveSoftware/Brave-Browser' },
  { id: 'edge', name: 'Edge', support: 'Microsoft Edge' },
  { id: 'vivaldi', name: 'Vivaldi', support: 'Vivaldi' },
  { id: 'chromium', name: 'Chromium', support: 'Chromium' },
  { id: 'arc', name: 'Arc', support: 'Arc/User Data' },
] as const

export type BookmarkBrowserId = typeof bookmarkBrowsers[number]['id']
export interface Bookmark { id: string, title: string, url: string, folder: string, browser: string }

/** Enough for a large collection, and a stop before a damaged file turns into unbounded work. */
export const maxBookmarks = 2000
/** Folders nest, and a file could claim to nest forever. */
const maxDepth = 20

/** The roots a Chromium profile keeps, in the order someone would expect to find them. */
const roots = ['bookmark_bar', 'other', 'synced'] as const

export function bookmarkFile(home: string, browser: { support: string }, profile = 'Default'): string {
  return `${home.replace(/\/$/, '')}/Library/Application Support/${browser.support}/${profile}/Bookmarks`
}

/**
 * Only `http` and `https` are kept. A bookmark is opened through the shell, so a `javascript:`, `file:` or `data:`
 * entry would be handing whatever a page saved straight to the system.
 */
export function isOpenableBookmark(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2000) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch { return false }
}

/** The part of a URL worth showing next to the title: the site, and the path when there is one. */
export function bookmarkDetail(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${host}${path}`.slice(0, 80)
  }
  catch { return url.slice(0, 80) }
}

interface RawNode { type?: unknown, name?: unknown, url?: unknown, guid?: unknown, id?: unknown, children?: unknown }

/**
 * Reads one profile's bookmark file. Anything unreadable gives an empty list rather than throwing, because a browser
 * that is mid-write, or a file from a version that moved on, must not stop the rest of the palette loading.
 */
export function parseChromiumBookmarks(text: string, browser: string): Bookmark[] {
  let parsed: unknown
  try { parsed = JSON.parse(text) }
  catch { return [] }
  if (!parsed || typeof parsed !== 'object') return []
  const tree = (parsed as { roots?: unknown }).roots
  if (!tree || typeof tree !== 'object') return []
  const found: Bookmark[] = []
  const seen = new Set<string>()

  const walk = (node: RawNode, folder: string, depth: number) => {
    if (found.length >= maxBookmarks || depth > maxDepth) return
    const name = typeof node.name === 'string' ? node.name.trim() : ''
    if (node.type === 'folder' || Array.isArray(node.children)) {
      const children = Array.isArray(node.children) ? node.children : []
      const next = folder && name ? `${folder}/${name}` : (name || folder)
      for (const child of children) {
        if (child && typeof child === 'object') walk(child as RawNode, next, depth + 1)
      }
      return
    }
    if (node.type !== 'url' || !isOpenableBookmark(node.url)) return
    // The same page bookmarked twice is one row; the first one wins, which keeps the browser's own order.
    const key = node.url.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    const id = typeof node.guid === 'string' ? node.guid : String(node.id ?? found.length)
    found.push({ id, title: name || bookmarkDetail(node.url), url: node.url, folder, browser })
  }

  for (const root of roots) {
    const branch = (tree as Record<string, unknown>)[root]
    if (branch && typeof branch === 'object') walk(branch as RawNode, '', 0)
  }
  return found
}

/** Rows for the palette. The folder is shown when there is one, because it is how people remember where a link lives. */
export function bookmarkResults(bookmarks: readonly Bookmark[]): Result[] {
  return bookmarks.map(bookmark => ({
    key: `bookmark:${bookmark.browser}:${bookmark.id}`,
    title: bookmark.title,
    subtitle: ['Bookmark', bookmark.browser, bookmark.folder, bookmarkDetail(bookmark.url)].filter(Boolean).join(' · '),
    kind: 'bookmark',
    content: bookmark.url,
    detail: bookmark.url,
    searchText: `${bookmark.title} ${bookmark.folder} ${bookmarkDetail(bookmark.url)}`,
  }))
}
