import type { Result } from './search'

export const resultRowHeight = 52

/** Keep only the viewport and two overscan rows mounted while retaining absolute indexes. */
export function resultWindow(count: number, scrollTop: number, height: number) {
  const offset = Math.max(0, scrollTop)
  const start = Math.max(0, Math.min(Math.floor(offset / resultRowHeight) - 2, Math.max(0, count - 1)))
  const end = Math.min(count, Math.ceil((offset + height) / resultRowHeight) + 2)
  return { start, end, top: start * resultRowHeight, bottom: (count - end) * resultRowHeight }
}

/** Unchanged keyed rows keep their objects when query results or unrelated icons change. */
export function createResultPresentation() {
  const decorated = new WeakMap<Result, { icon: string, result: Result }>()
  return (items: readonly Result[], icons: Record<string, string>): Result[] => items.map((item) => {
    const icon = item.icon || icons[item.content]
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
  const control = event.ctrlKey && !event.metaKey && !event.altKey ? event.key.toLowerCase() : ''
  const step = event.key === 'ArrowDown' || control === 'n' ? 1 : event.key === 'ArrowUp' || control === 'p' ? -1 : event.key === 'PageDown' ? page : event.key === 'PageUp' ? -page : 0
  if (!step) return null
  return Math.max(0, Math.min(count - 1, index + step))
}

/** System commands, emoji and extension commands help once you search for them; a long list of them does not belong in the idle view. */
export function idleVisible(item: Pick<Result, 'kind' | 'key'>): boolean {
  return item.kind !== 'system' && item.kind !== 'emoji' && !item.key.startsWith('extension:')
}
