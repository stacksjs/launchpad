import type { Result } from './search'

export const resultRowHeight = 52

export interface ResultSection { index: number, title: string }
export const sectionRowHeight = 28

export function resultOffset(index: number, sections: readonly ResultSection[] = []): number {
  return index * resultRowHeight + sections.filter(section => section.index <= index).length * sectionRowHeight
}

/** Section labels occupy real scroll space but never become selectable commands. */
export function resultWindow(count: number, scrollTop: number, height: number, sections: readonly ResultSection[] = []) {
  const offset = Math.max(0, scrollTop)
  const find = (pixel: number) => {
    let low = 0
    let high = count
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (resultOffset(middle, sections) < pixel) low = middle + 1
      else high = middle
    }
    return low
  }
  const start = Math.max(0, Math.min(find(offset + resultRowHeight) - 3, Math.max(0, count - 1)))
  const end = Math.min(count, find(offset + height) + 2)
  const before = (index: number) => index * resultRowHeight + sections.filter(section => section.index < index).length * sectionRowHeight
  const total = count * resultRowHeight + sections.length * sectionRowHeight
  return { start, end, top: before(start), bottom: total - before(end) }
}

/** Unchanged keyed rows keep their objects when query results or unrelated icons change. */
export function createResultPresentation() {
  const decorated = new WeakMap<Result, { icon: string, result: Result }>()
  return (items: readonly Result[], icons: Record<string, string>): Result[] => items.map((item) => {
    const icon = item.icon || icons[item.kind === 'clipboard' ? item.sourceAppPath || '' : item.content]
    if (!icon || item.icon === icon) return item
    const previous = decorated.get(item)
    if (previous?.icon === icon) return previous.result
    const result = { ...item, icon }
    decorated.set(item, { icon, result })
    return result
  })
}

/** Park unused slots instead of destroying rows as matches shrink, including an empty result list. */
export function createResultSlots(minimum = 13) {
  const empty: Result = { key: '', title: '', subtitle: '', kind: '', content: '' }
  const slots: Result[] = Array.from({ length: minimum }, () => empty)
  return (items: readonly Result[], start: number, end: number): Result[] => {
    for (let index = 0; index < end - start; index++) slots[index] = items[start + index]!
    return slots.slice()
  }
}

/** The row a navigation key selects, or null when the key is not navigation. Control N and P match macOS text fields. */
export function selectionTarget(event: { key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean }, index: number, count: number, page = 8): number | null {
  if (!event.metaKey && !event.altKey && !event.ctrlKey && (event.key === 'Home' || event.key === 'End')) return event.key === 'Home' ? 0 : Math.max(0, count - 1)
  const control = event.ctrlKey && !event.metaKey && !event.altKey ? event.key.toLowerCase() : ''
  const step = event.key === 'ArrowDown' || control === 'n' ? 1 : event.key === 'ArrowUp' || control === 'p' ? -1 : event.key === 'PageDown' ? page : event.key === 'PageUp' ? -page : 0
  if (!step) return null
  return Math.max(0, Math.min(count - 1, index + step))
}

/** System commands, emoji, modes and extension commands help once you search for them; a long list of them does not belong in the idle view. */
export function idleVisible(item: Pick<Result, 'kind' | 'key'>): boolean {
  return item.kind !== 'system' && item.kind !== 'emoji' && item.kind !== 'mode' && !item.key.startsWith('extension:')
}
