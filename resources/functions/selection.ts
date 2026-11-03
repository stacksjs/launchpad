import type { Result } from './search'

/**
 * Acting on something already selected somewhere else. macOS hands a selection to an app through the Services menu,
 * which is the supported way to ask for it: the alternative is watching other applications, which this app does not do.
 *
 * What arrives is text. What it means has to be read from the text itself, because the sender says only that it is
 * text. Nothing here is stored: a selection is classified, acted on, and forgotten.
 */
export type SelectionKind = 'text' | 'url' | 'path' | 'none'
export interface SelectionPayload { type?: string, value?: string }
export interface Selection { kind: SelectionKind, value: string }

/** Long enough for a paragraph worth searching, short enough that a whole document never becomes a query. */
export const maxSelectionLength = 2000

/** A selection of one line that is a web address. More than a line is prose that happens to contain a link. */
function looksLikeUrl(text: string): boolean {
  if (/\s/.test(text)) return false
  try {
    const parsed = new URL(text)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  }
  catch { return false }
}

/** An absolute path or one written from the home directory. A relative path has no meaning outside its own folder. */
function looksLikePath(text: string): boolean {
  if (/[\n\r]/.test(text)) return false
  return /^~?\//.test(text) && text.length > 1
}

/** Reads what macOS handed over. An empty or oversized selection is nothing to act on. */
export function readSelection(payload: SelectionPayload | null | undefined): Selection {
  const value = typeof payload?.value === 'string' ? payload.value.trim().slice(0, maxSelectionLength) : ''
  if (!value || payload?.type === 'none') return { kind: 'none', value: '' }
  if (looksLikeUrl(value)) return { kind: 'url', value }
  if (looksLikePath(value)) return { kind: 'path', value }
  return { kind: 'text', value }
}

/** A selection shown back to someone, kept to one line so a paragraph does not fill the row. */
export function selectionLabel(value: string, limit = 60): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > limit ? `${line.slice(0, limit)}…` : line
}

/**
 * The rows a selection earns beyond what typing it already offers. The palette's own search handles the rest: a
 * calculation, a conversion, a matching command or file all appear because the selection becomes the query.
 */
export function selectionActions(selection: Selection): Result[] {
  if (selection.kind === 'none') return []
  const label = selectionLabel(selection.value)
  const rows: Result[] = []
  if (selection.kind === 'url') {
    rows.push({ key: 'selection:open', title: `Open ${label}`, subtitle: 'Selection · Opens in your browser', kind: 'quicklink', content: selection.value })
  }
  if (selection.kind === 'path') {
    rows.push({ key: 'selection:file', title: `Open ${label}`, subtitle: 'Selection · Opens the file', kind: 'file', content: selection.value, detail: selection.value })
  }
  rows.push({ key: 'selection:copy', title: `Copy “${label}”`, subtitle: 'Selection · Copies to the clipboard', kind: 'clipboard', content: selection.value })
  return rows
}
