import { resultRowHeight } from './result-list'
import type { Result } from './search'

/** Visible rows first, then three screens ahead, then behind, then the remaining results for warm scrolling. */
export function iconPrefetchPaths(results: readonly Result[], scrollTop = 0, height = 450, direction: 1 | -1 = 1): string[] {
  const top = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0
  const size = Number.isFinite(height) ? Math.max(resultRowHeight, height) : 450
  const first = Math.min(results.length, Math.floor(top / resultRowHeight))
  const count = Math.ceil(size / resultRowHeight)
  const end = Math.min(results.length, Math.ceil((top + size) / resultRowHeight))
  const before = results.slice(Math.max(0, first - count * 3), first).reverse()
  const after = results.slice(end, end + count * 3)
  const ordered = [...results.slice(first, end), ...(direction === 1 ? after : before), ...(direction === 1 ? before : after), ...results]
  return [...new Set(ordered.flatMap(item => !item.icon && item.kind === 'application' ? [item.content] : !item.icon && item.kind === 'clipboard' && item.sourceAppPath ? [item.sourceAppPath] : []))]
}

/** Prepare an image before publishing its URL, so painting a prefetched row does not start image decoding. */
export async function decodeApplicationIcon(source: string): Promise<void> {
  const icon = new Image()
  icon.decoding = 'async'
  icon.src = source
  await icon.decode()
}

/** Reorder pending work on every scroll without restarting active reads or queueing the whole list at the bridge. */
export function createIconPrefetcher(options: {
  load: (path: string) => Promise<string | null>
  publish: (path: string, icon: string) => void
  prepare?: (icon: string) => Promise<void>
  concurrency?: number
}) {
  const concurrency = Math.max(1, Math.floor(options.concurrency || 4))
  const settled = new Set<string>()
  const active = new Set<string>()
  let queue: string[] = []
  let disposed = false
  let waiters: (() => void)[] = []
  function pump() {
    while (!disposed && active.size < concurrency && queue.length) {
      const path = queue.shift()!
      active.add(path)
      void Promise.resolve().then(() => options.load(path)).then(async (icon) => {
        if (!icon || disposed) return
        await options.prepare?.(icon)
        if (!disposed) options.publish(path, icon)
      }).catch(() => {
        // Unreadable and invalid icons keep their fallback without retrying on every scroll event.
      }).finally(() => {
        active.delete(path)
        settled.add(path)
        pump()
      })
    }
    if (!active.size && !queue.length) {
      const ready = waiters
      waiters = []
      for (const resolve of ready) resolve()
    }
  }
  return {
    update(paths: readonly string[]) {
      if (disposed) return
      queue = [...new Set(paths)].filter(path => path && !settled.has(path) && !active.has(path))
      pump()
    },
    idle(): Promise<void> {
      return !active.size && !queue.length ? Promise.resolve() : new Promise(resolve => waiters.push(resolve))
    },
    dispose() {
      disposed = true
      queue = []
      pump()
    },
  }
}

/** Cache native icons and share concurrent bridge calls. Missing icons must not cause render loops. */
export function createApplicationIconLoader(load: (path: string) => Promise<string | null>, concurrency = 4) {
  const cache = new Map<string, string | null>()
  const pending = new Map<string, Promise<string | null>>()
  let active = 0
  const waiting: (() => void)[] = []
  async function read(path: string): Promise<string | null> {
    if (active >= concurrency) await new Promise<void>(resolve => waiting.push(resolve))
    else active++
    try { return await load(path) }
    finally {
      const next = waiting.shift()
      if (next) next()
      else active--
    }
  }
  return async (paths: string[]): Promise<Record<string, string>> => {
    const icons: Record<string, string> = {}
    await Promise.all([...new Set(paths)].map(async (path) => {
      if (!cache.has(path)) {
        let task = pending.get(path)
        if (!task) {
          task = read(path).then((icon) => {
            cache.set(path, icon)
            return icon
          }).catch(() => {
            cache.set(path, null)
            return null
          }).finally(() => { pending.delete(path) })
          pending.set(path, task)
        }
        await task
      }
      const icon = cache.get(path)
      if (icon) icons[path] = icon
    }))
    return icons
  }
}
