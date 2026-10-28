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
