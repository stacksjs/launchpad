import type { Result } from './search'

/**
 * Large type is for reading a thing out, copying it by hand, or holding it up for someone across a desk. A result row
 * is too small for any of those. Nothing here touches the document: it decides what to show and how big it goes.
 */

/** Past this it stops being large type and starts being a document, which the result list already shows better. */
export const maxLargeTypeLength = 600

/** Below the first it is no longer large; above the second a single character stops looking deliberate. */
export const minLargeTypeSize = 16
export const maxLargeTypeSize = 160

/** A system font averages near this share of its size per character, which is close enough to lay text out by. */
const charWidthRatio = 0.6
const lineHeightRatio = 1.25

/** Results whose point is their text. Everything else is named by its title, which stands for a path or an address. */
const textualKinds = ['snippet', 'clipboard', 'calculator', 'emoji']

export function largeTypeText(item: Pick<Result, 'kind' | 'title' | 'content'> | null | undefined): string {
  if (!item) return ''
  const source = textualKinds.includes(item.kind) ? (item.content || item.title) : (item.title || item.content)
  return (source || '').trim().slice(0, maxLargeTypeLength)
}

/**
 * The largest size that still fits. Text wraps, so the size is bounded by both the characters a line can hold and the
 * height every line needs together; a line someone typed as its own line stays one.
 */
export function largeTypeFontSize(text: string, width: number, height: number): number {
  const content = (text || '').trim()
  if (!content || width <= 0 || height <= 0) return minLargeTypeSize
  for (let size = maxLargeTypeSize; size > minLargeTypeSize; size--) {
    const perLine = Math.floor(width / (size * charWidthRatio))
    if (perLine < 1) continue
    const lines = content.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0)
    if (lines * size * lineHeightRatio <= height) return size
  }
  return minLargeTypeSize
}
