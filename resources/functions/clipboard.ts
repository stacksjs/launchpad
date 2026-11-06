import type { Result } from './search'
import { normalizeSearchText } from './search-text'

/** Matches the ClipboardEntry model, which refuses longer text. */
export const maxClipboardText = 20000

/** Classify copied text before it reaches the local API, so one bad copy never stops recording. */
export function clipboardDecision(text: string | null | undefined): 'save' | 'empty' | 'too-large' {
  if (!text || !text.trim()) return 'empty'
  return text.length > maxClipboardText ? 'too-large' : 'save'
}

/** One line, at most 100 characters, never splitting an emoji or other surrogate pair. */
export function clipboardTitle(content: string): string {
  return Array.from(content.slice(0, 400).replace(/\s+/g, ' ').trim()).slice(0, 100).join('')
}

function validTime(value: unknown): number {
  const time = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number.isFinite(Number(value)) ? Number(value) : Date.parse(value) : 0
  return Number.isFinite(time) && time > 0 && time <= 8640000000000000 ? time : 0
}

/** Display and retention use the same fallback for legacy entries. */
export function clipboardCapturedAt(row: { capturedAt?: unknown, captured_at?: unknown, createdAt?: unknown, created_at?: unknown }): number {
  return validTime(row.capturedAt ?? row.captured_at) || validTime(row.createdAt ?? row.created_at)
}

/** Retain copy time, including rows created before capturedAt was populated. Never use launch recency. */
export function clipboardResult(row: { id: number, content: string, capturedAt?: unknown, captured_at?: unknown, createdAt?: unknown, created_at?: unknown, sourceApp?: string, source_app?: string }): Result {
  const source = row.sourceApp || row.source_app || ''
  const capturedAt = clipboardCapturedAt(row)
  return { key: `clipboard:${row.id}`, id: row.id, title: clipboardTitle(row.content), subtitle: source ? `Clipboard · ${source.split('.').pop()}` : 'Saved clipboard text', kind: 'clipboard', content: row.content, capturedAt, sourceApp: source }
}

/** History is chronological even when a match is starred or has been copied many times. Search all of the text. */
export function clipboardResults(items: readonly Result[], query = '', source = 'all'): Result[] {
  const words = normalizeSearchText(query).trim().split(/\s+/u).filter(Boolean)
  return items.filter((item) => {
    if (item.kind !== 'clipboard' || (source !== 'all' && (item.sourceApp || '') !== source)) return false
    if (!words.length) return true
    const text = normalizeSearchText(`${item.content}\n${item.sourceApp || ''}\n${item.sourceAppName || ''}\n${item.subtitle}`)
    return words.every(word => text.includes(word))
  }).sort((a, b) => validTime(b.capturedAt) - validTime(a.capturedAt) || (b.id ?? 0) - (a.id ?? 0) || b.key.localeCompare(a.key, undefined, { numeric: true }))
}

/** Explicit local dates stay understandable without a timer constantly aging relative labels. */
export function clipboardTime(timestamp: number | undefined, now = Date.now()): string {
  if (!validTime(timestamp)) return 'Copy time unavailable'
  const copied = new Date(timestamp!)
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(today.getDate() - 1)
  const day = copied.toDateString() === today.toDateString() ? 'Today' : copied.toDateString() === yesterday.toDateString() ? 'Yesterday' : copied.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(copied.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
  return `${day} · ${copied.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function clipboardSummary(content: string): string {
  const characters = Array.from(content).length
  const lines = content.split(/\r\n|\r|\n/u).length
  return `${characters.toLocaleString()} ${characters === 1 ? 'character' : 'characters'} · ${lines.toLocaleString()} ${lines === 1 ? 'line' : 'lines'}`
}

/** Follow new copies at the top; keep the same entry selected while someone is reviewing older text. */
export function clipboardSelection(previous: Result | undefined, index: number, next: readonly Result[], browsing = index > 0): number {
  if (!browsing || !next.length) return 0
  const found = next.findIndex(item => item.key === previous?.key)
  return found >= 0 ? found : Math.max(0, Math.min(index, next.length - 1))
}

export function clipboardSourceName(source: string): string {
  return source ? source.split('.').pop() || source : 'Unknown source'
}

/** Resolve identities from installed app metadata; clipboard content never supplies an application path. */
export function clipboardWithSources(items: readonly Result[]): Result[] {
  const apps = new Map(items.filter(item => item.kind === 'application' && item.bundleId).map(item => [item.bundleId, item]))
  return items.map((item) => {
    if (item.kind !== 'clipboard') return item
    const app = apps.get(item.sourceApp)
    const sourceAppName = app?.title || clipboardSourceName(item.sourceApp || '')
    return { ...item, sourceAppName, sourceAppPath: app?.content || '', subtitle: `Clipboard · ${sourceAppName}` }
  })
}

export interface ClipboardSource { id: string, title: string, path: string, count: number }
export function clipboardSources(items: readonly Result[]): ClipboardSource[] {
  const sources = new Map<string, ClipboardSource>()
  for (const item of items) {
    if (item.kind !== 'clipboard') continue
    const id = item.sourceApp || ''
    const source = sources.get(id)
    if (source) source.count++
    else sources.set(id, { id, title: item.sourceAppName || clipboardSourceName(id), path: item.sourceAppPath || '', count: 1 })
  }
  return [...sources.values()].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

/** Command names have a 120 UTF-16 unit limit, which is shorter than 100 emoji. */
export function clipboardSnippetTitle(content: string): string {
  let title = ''
  for (const character of clipboardTitle(content)) {
    if (title.length + character.length > 120) break
    title += character
  }
  return title || 'Clipboard snippet'
}
