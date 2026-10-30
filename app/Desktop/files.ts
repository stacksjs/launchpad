import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, sep } from 'node:path'
import AppPreference from '../Models/AppPreference'
import { readSearchSettings } from '../../resources/functions/search-settings'
import { normalizeSearchText } from '../../resources/functions/search-text'

export interface FileMatch { path: string, name: string, folder: string, directory: boolean, modifiedAt: number }
export interface FileSearchResult { files: FileMatch[], available: boolean }

const maxWords = 6
const maxWordLength = 64
/** Folders whose contents are implementation detail, not something a person looks for by name. */
const packageSuffixes = ['.app', '.photoslibrary', '.framework', '.bundle', '.xcodeproj', '.xcworkspace', '.fcpbundle', '.imovielibrary', '.logicx', '.band', '.musiclibrary', '.sparsebundle', '.rtfd']

export function searchWords(query: string): string[] {
  return query.normalize('NFC').split(/\s+/).map(word => word.replace(/[*?]/g, '').slice(0, maxWordLength)).filter(Boolean).slice(0, maxWords)
}

/** Every word must appear in the file name, ignoring case and accents. Quotes and backslashes are escaped. */
export function spotlightPredicate(words: readonly string[], anchored = false): string {
  return words.map((word, index) => `kMDItemFSName == "${anchored && index === 0 ? '' : '*'}${word.replace(/[\\"]/g, '\\$&')}*"cd`).join(' && ')
}

/** Keep documents, folders and media people look for; drop caches, hidden items, dependencies and app internals. */
export function isIndexable(path: string, home = homedir()): boolean {
  if (!path.startsWith(home + sep)) return false
  const relative = path.slice(home.length + 1)
  const parts = relative.split(sep).filter(Boolean)
  if (!parts.length) return false
  if (parts.some(part => part.startsWith('.') || part === 'node_modules' || part === '__pycache__')) return false
  if (parts[0] === 'Library') return false
  const last = parts.at(-1)!.toLocaleLowerCase()
  if (last.endsWith('.app')) return false
  return !parts.slice(0, -1).some(part => packageSuffixes.some(suffix => part.toLocaleLowerCase().endsWith(suffix)))
}

export function nameScore(name: string, words: readonly string[], query: string): number {
  const full = name.toLocaleLowerCase()
  const stem = basename(full, extname(full))
  const wanted = query.trim().toLocaleLowerCase()
  if (full === wanted || stem === wanted) return 5
  if (full.startsWith(wanted)) return 4
  const tokens = full.split(/[\s._()[\]-]+/)
  if (words.every(word => tokens.some(token => token.startsWith(word.toLocaleLowerCase())))) return 3
  return 2
}

/** Name quality first, then the most recently changed, then the shortest path. */
export function rankFiles(files: readonly FileMatch[], query: string): FileMatch[] {
  const words = searchWords(query)
  return files.map(file => ({ file, score: nameScore(file.name, words, query) }))
    .sort((a, b) => b.score - a.score || b.file.modifiedAt - a.file.modifiedAt || a.file.path.length - b.file.path.length || a.file.path.localeCompare(b.file.path))
    .map(entry => entry.file)
}

export type ReadStatus = 'done' | 'capped' | 'timeout' | 'aborted' | 'unavailable'
export interface ReadResult { lines: string[], status: ReadStatus }

/** Read at most `maxLines` lines from a command, then stop it. The status says why it stopped, so a cut-off answer is never mistaken for a complete one. */
export async function readLines(command: string, args: readonly string[], options: { maxLines: number, timeoutMs: number, signal?: AbortSignal }): Promise<ReadResult> {
  let process: ReturnType<typeof Bun.spawn>
  try { process = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' }) }
  catch { return { lines: [], status: 'unavailable' } }
  let timedOut = false
  const stop = () => {
    try { process.kill() }
    catch { /* already finished */ }
  }
  const timer = setTimeout(() => {
    timedOut = true
    stop()
  }, options.timeoutMs)
  options.signal?.addEventListener('abort', stop, { once: true })
  if (options.signal?.aborted) stop()
  const lines: string[] = []
  let pending = ''
  let capped = false
  try {
    const reader = (process.stdout as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    while (!capped) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const parts = pending.split('\n')
      pending = parts.pop() ?? ''
      for (const line of parts) {
        if (!line) continue
        lines.push(line)
        // Reaching the limit counts as cut off, since more may follow.
        if (lines.length >= options.maxLines) {
          capped = true
          break
        }
      }
    }
    if (!capped && pending) {
      lines.push(pending)
      capped = lines.length >= options.maxLines
    }
    stop()
    const code = await process.exited
    if (options.signal?.aborted) return { lines, status: 'aborted' }
    if (timedOut) return { lines, status: 'timeout' }
    if (capped) return { lines, status: 'capped' }
    // A command that failed without printing anything is not installed or not allowed to run.
    return !lines.length && code !== 0 ? { lines, status: 'unavailable' } : { lines, status: 'done' }
  }
  catch { return { lines, status: options.signal?.aborted ? 'aborted' : timedOut ? 'timeout' : lines.length ? 'capped' : 'unavailable' } }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', stop)
  }
}

const foldName = (value: string) => normalizeSearchText(value)

/** True when every word appears in the file name, ignoring case and accents. */
export function nameMatches(name: string, words: readonly string[]): boolean {
  const folded = foldName(name)
  return words.every(word => folded.includes(foldName(word)))
}

/** Results for the longer query are always inside results for the shorter one when each old word sits inside some new word. */
export function extendsQuery(oldWords: readonly string[], newWords: readonly string[]): boolean {
  const folded = newWords.map(foldName)
  return oldWords.length > 0 && oldWords.every(old => folded.some(word => word.includes(foldName(old))))
}

export interface FileSearchOptions {
  home?: string
  limit?: number
  timeoutMs?: number
  maxLines?: number
  /** How long a stored answer may be reused. */
  cacheMs?: number
  now?: () => number
  /** Replaced in tests. Receives the Spotlight arguments and reports what came back and why it stopped. */
  list?: (args: readonly string[], signal?: AbortSignal) => Promise<ReadResult>
  stat?: (path: string) => Promise<{ isDirectory: () => boolean, mtimeMs: number }>
}

/** `complete` is false for an answer that hit the line limit: fine to repeat, unsafe to narrow. */
interface Remembered { words: string[], paths: string[], complete: boolean, at: number }

/**
 * One Spotlight query per search, because Spotlight's evaluation is the cost and a second query only competes with the first.
 * Complete answers are remembered, so typing more letters, backspacing and repeating a search never ask Spotlight again.
 */
export function createFileSearch(options: FileSearchOptions = {}) {
  const home = options.home ?? homedir()
  const limit = options.limit ?? 30
  const maxLines = options.maxLines ?? 1000
  const cacheMs = options.cacheMs ?? 30_000
  const now = options.now ?? Date.now
  const list = options.list ?? ((args, signal) => readLines('/usr/bin/mdfind', args, { maxLines, timeoutMs: options.timeoutMs ?? 2500, signal }))
  const status = options.stat ?? stat
  const remembered = new Map<string, Remembered>()
  const inflight = new Map<string, Promise<{ paths: string[], available: boolean }>>()
  const capacity = 24

  function remember(key: string, entry: Remembered) {
    remembered.delete(key)
    remembered.set(key, entry)
    while (remembered.size > capacity) remembered.delete(remembered.keys().next().value!)
  }

  async function candidates(words: string[], signal?: AbortSignal): Promise<{ paths: string[], available: boolean }> {
    const key = words.map(foldName).join(' ')
    const fresh = [...remembered.entries()].filter(([, entry]) => now() - entry.at < cacheMs)
    // The same search gives the same answer, so an exact repeat can reuse even a cut-off one.
    const exact = fresh.find(([name]) => name === key)
    if (exact) {
      remember(exact[0], exact[1])
      return { paths: exact[1].paths, available: true }
    }
    // Only a complete answer can stand in for a longer search: a cut-off one may be missing the matches.
    const covering = fresh.filter(([, entry]) => entry.complete && extendsQuery(entry.words, words)).sort((a, b) => a[1].paths.length - b[1].paths.length)[0]
    if (covering) {
      const paths = covering[1].paths.filter(path => nameMatches(basename(path), words))
      remember(key, { words, paths, complete: true, at: covering[1].at })
      return { paths, available: true }
    }
    const pending = inflight.get(key)
    if (pending) return pending
    const task = (async () => {
      const outcome = await list(['-onlyin', home, spotlightPredicate(words)], signal)
      if (outcome.status === 'unavailable') return { paths: [], available: false }
      // Only an answer that finished is safe to reuse. Timeouts, cancellations and the line limit are not.
      if ((outcome.status === 'done' || outcome.status === 'capped') && !signal?.aborted) remember(key, { words, paths: outcome.lines, complete: outcome.status === 'done', at: now() })
      return { paths: outcome.lines, available: true }
    })().finally(() => { inflight.delete(key) })
    inflight.set(key, task)
    return task
  }

  return async (query: string, signal?: AbortSignal): Promise<FileSearchResult> => {
    const words = searchWords(query)
    if (words.join('').length < 2) return { files: [], available: true }
    const { paths, available } = await candidates(words, signal)
    if (!available) return { files: [], available: false }
    // Name quality needs no disk access, so every candidate is scored first and only the best few are examined for date and type.
    const usable = [...new Set(paths)].filter(path => isIndexable(path, home))
    const picked = usable.map(path => ({ path, score: nameScore(basename(path), words, query) }))
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
      .slice(0, limit * 3).map(entry => entry.path)
    const files = (await Promise.all(picked.map(async (path): Promise<FileMatch | null> => {
      try {
        const info = await status(path)
        return { path, name: basename(path), folder: dirname(path).replace(home, '~'), directory: info.isDirectory(), modifiedAt: info.mtimeMs }
      }
      catch { return null }
    }))).filter((file): file is FileMatch => file !== null)
    return { files: rankFiles(files, query).slice(0, limit), available: true }
  }
}

/** The preference is read once a second at most, not on every keystroke. */
export function createFilesApi(search = createFileSearch(), options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now
  let enabled = true
  let checkedAt = -Infinity
  async function filesEnabled(): Promise<boolean> {
    if (now() - checkedAt < 1000) return enabled
    const preference = await AppPreference.where('key', 'search').first()
    enabled = readSearchSettings(preference?.value).files
    checkedAt = now()
    return enabled
  }
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (url.pathname !== '/api/files' || request.method !== 'GET') return null
    const headers = { 'cache-control': 'private, no-store' }
    if (!await filesEnabled()) return Response.json({ data: [], available: true, enabled: false }, { headers })
    const query = (url.searchParams.get('q') ?? '').slice(0, 120)
    const result = await search(query, request.signal)
    return Response.json({ data: result.files, available: result.available, enabled: true }, { headers })
  }
}
