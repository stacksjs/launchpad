import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, sep } from 'node:path'
import AppPreference from '../Models/AppPreference'
import { readSearchSettings } from '../../resources/functions/search-settings'

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

function relevance(name: string, words: readonly string[], query: string): number {
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
  return files.map(file => ({ file, score: relevance(file.name, words, query) }))
    .sort((a, b) => b.score - a.score || b.file.modifiedAt - a.file.modifiedAt || a.file.path.length - b.file.path.length || a.file.path.localeCompare(b.file.path))
    .map(entry => entry.file)
}

/** Read at most `maxLines` lines from a command, then stop it. A slow or missing command returns null. */
export async function readLines(command: string, args: readonly string[], options: { maxLines: number, timeoutMs: number, signal?: AbortSignal }): Promise<string[] | null> {
  let process: ReturnType<typeof Bun.spawn>
  try { process = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' }) }
  catch { return null }
  const stop = () => { try { process.kill() } catch { /* already finished */ } }
  const timer = setTimeout(stop, options.timeoutMs)
  options.signal?.addEventListener('abort', stop, { once: true })
  if (options.signal?.aborted) stop()
  const lines: string[] = []
  let pending = ''
  try {
    const reader = (process.stdout as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    while (lines.length < options.maxLines) {
      const { done, value } = await reader.read()
      if (done) break
      pending += decoder.decode(value, { stream: true })
      const parts = pending.split('\n')
      pending = parts.pop() ?? ''
      for (const line of parts) if (line && lines.length < options.maxLines) lines.push(line)
    }
    if (pending && lines.length < options.maxLines) lines.push(pending)
    stop()
    const code = await process.exited
    // A killed process exits non-zero after producing results; only an empty failure means the tool is unavailable.
    return !lines.length && code !== 0 && !options.signal?.aborted && code !== 143 && code !== 137 ? null : lines
  }
  catch { return lines.length ? lines : null }
  finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', stop)
  }
}

export interface FileSearchOptions {
  home?: string
  limit?: number
  timeoutMs?: number
  /** Replaced in tests. Receives the Spotlight arguments and returns matching paths. */
  list?: (args: readonly string[], signal?: AbortSignal) => Promise<string[] | null>
  stat?: (path: string) => Promise<{ isDirectory: () => boolean, mtimeMs: number }>
}

export function createFileSearch(options: FileSearchOptions = {}) {
  const home = options.home ?? homedir()
  const limit = options.limit ?? 30
  const list = options.list ?? ((args, signal) => readLines('/usr/bin/mdfind', args, { maxLines: 300, timeoutMs: options.timeoutMs ?? 2500, signal }))
  const status = options.stat ?? stat
  return async (query: string, signal?: AbortSignal): Promise<FileSearchResult> => {
    const words = searchWords(query)
    if (words.join('').length < 2) return { files: [], available: true }
    // Names that start with the first word are few and usually what was meant, so they are asked for separately and never crowded out.
    const [anchored, contained] = await Promise.all([list(['-onlyin', home, spotlightPredicate(words, true)], signal), list(['-onlyin', home, spotlightPredicate(words)], signal)])
    if (anchored === null && contained === null) return { files: [], available: false }
    const candidates = [...new Set([...(anchored ?? []), ...(contained ?? [])])].filter(path => isIndexable(path, home)).slice(0, limit * 3)
    const files = (await Promise.all(candidates.map(async (path): Promise<FileMatch | null> => {
      try {
        const info = await status(path)
        return { path, name: basename(path), folder: dirname(path).replace(home, '~'), directory: info.isDirectory(), modifiedAt: info.mtimeMs }
      }
      catch { return null }
    }))).filter((file): file is FileMatch => file !== null)
    return { files: rankFiles(files, query).slice(0, limit), available: true }
  }
}

export function createFilesApi(search = createFileSearch()) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (url.pathname !== '/api/files' || request.method !== 'GET') return null
    const headers = { 'cache-control': 'private, no-store' }
    const preference = await AppPreference.where('key', 'search').first()
    if (!readSearchSettings(preference?.value).files) return Response.json({ data: [], available: true, enabled: false }, { headers })
    const query = (url.searchParams.get('q') ?? '').slice(0, 120)
    const result = await search(query, request.signal)
    return Response.json({ data: result.files, available: result.available, enabled: true }, { headers })
  }
}
