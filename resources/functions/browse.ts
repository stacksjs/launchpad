import type { Result } from './search'

/**
 * File search finds a file by name. Browsing is the other half: stepping into a folder and reading what is in it,
 * which is how someone looks for a file they cannot name. Nothing here touches the disk; it decides what a listing
 * shows and where stepping in or out leads.
 */
export interface BrowseEntry { name: string, path: string, isDirectory: boolean }

/** A listing longer than this stops being readable, and the palette shows a window of it anyway. */
export const maxBrowseEntries = 1000

/** Trailing separators make two spellings of one directory, so every path is compared in one form. */
export function normalizePath(path: string): string {
  const trimmed = (path || '').replace(/\/+$/, '')
  return trimmed || '/'
}

/** The folder holding this one. The root holds itself, so stepping up from it stays put. */
export function parentPath(path: string): string {
  const normalized = normalizePath(path)
  const cut = normalized.lastIndexOf('/')
  if (cut <= 0) return '/'
  return normalized.slice(0, cut)
}

/**
 * Browsing stays inside the home directory. Spotlight search is already limited to it, and a launcher walking up into
 * the system is both a surprise and, in the sandboxed build, a wall.
 */
export function isWithin(path: string, root: string): boolean {
  const target = normalizePath(path)
  const base = normalizePath(root)
  return target === base || target.startsWith(`${base}/`)
}

/** Hidden items are skipped, matching what file search already leaves out. */
export function visibleEntries(entries: readonly BrowseEntry[]): BrowseEntry[] {
  return entries.filter(entry => entry.name && !entry.name.startsWith('.'))
}

/** Folders first, then files, each by name, which is how a file list is normally read. */
export function sortEntries(entries: readonly BrowseEntry[]): BrowseEntry[] {
  return [...entries].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true })
  })
}

/** What to show for a listing: hidden items dropped, folders first, and no more than the palette can read. */
export function browseEntries(entries: readonly BrowseEntry[]): BrowseEntry[] {
  return sortEntries(visibleEntries(entries)).slice(0, maxBrowseEntries)
}

/** The path as someone would write it, with their home directory as a tilde. */
export function breadcrumb(path: string, home: string): string {
  const normalized = normalizePath(path)
  const base = normalizePath(home)
  if (normalized === base) return '~'
  return isWithin(normalized, base) ? `~${normalized.slice(base.length)}` : normalized
}

/** Rows for the palette. A folder says so, so stepping in is an obvious thing to do. */
export function browseResults(entries: readonly BrowseEntry[], home: string): Result[] {
  return entries.map(entry => ({
    key: `file:${entry.path}`,
    title: entry.name,
    subtitle: `${entry.isDirectory ? 'Folder · ' : ''}${breadcrumb(parentPath(entry.path), home)}`,
    kind: 'file',
    content: entry.path,
    detail: entry.path,
  }))
}
