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
