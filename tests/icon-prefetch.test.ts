import { expect, test } from 'bun:test'
import { createIconPrefetcher, iconPrefetchPaths } from '../resources/functions/application-icons'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}

test('ready icons publish independently of a slow neighboring icon', async () => {
  const slow = deferred<string | null>()
  const published: string[] = []
  const fast = deferred()
  const prefetch = createIconPrefetcher({ load: path => path === 'slow' ? slow.promise : Promise.resolve('data:fast'), publish: path => { published.push(path); fast.resolve() } })
  prefetch.update(['slow', 'fast'])
  await fast.promise
  expect(published).toEqual(['fast'])
  slow.resolve('data:slow')
  await prefetch.idle()
  expect(published).toEqual(['fast', 'slow'])
})

test('scrolling reprioritizes waiting work without duplicating active reads', async () => {
  const first = deferred<string | null>()
  const started = deferred()
  const reads: string[] = []
  const prefetch = createIconPrefetcher({ concurrency: 1, load: async path => {
    reads.push(path)
    if (path === 'first') { started.resolve(); return first.promise }
    return 'data:icon'
  }, publish: () => {} })
  prefetch.update(['first', 'old-neighbor', 'far'])
  await started.promise
  prefetch.update(['jump-target', 'first', 'far', 'old-neighbor'])
  first.resolve('data:first')
  await prefetch.idle()
  expect(reads).toEqual(['first', 'jump-target', 'far', 'old-neighbor'])
  prefetch.update(['first', 'jump-target', 'far'])
  await prefetch.idle()
  expect(reads).toHaveLength(4)
})

test('bounded prefetch prepares images before publishing and caches unavailable and broken icons', async () => {
  let active = 0
  let peak = 0
  const reads: string[] = []
  const prepared = new Set<string>()
  const published: string[] = []
  const prefetch = createIconPrefetcher({ concurrency: 2, load: async path => {
    reads.push(path)
    peak = Math.max(peak, ++active)
    await Bun.sleep(1)
    active--
    if (path === 'broken') throw new Error('unreadable')
    return path === 'missing' ? null : path
  }, prepare: async icon => {
    if (icon === 'invalid-image') throw new Error('decode failed')
    prepared.add(icon)
  }, publish: (_path, icon) => { expect(prepared.has(icon)).toBe(true); published.push(icon) } })
  const paths = ['a', 'a', 'missing', 'broken', 'invalid-image', 'b']
  prefetch.update(paths)
  await prefetch.idle()
  prefetch.update(paths)
  await prefetch.idle()
  expect(reads).toEqual(['a', 'missing', 'broken', 'invalid-image', 'b'])
  expect(published).toEqual(['a', 'b'])
  expect(peak).toBe(2)
})

test('closing the view cancels queued work and suppresses an active icon finishing afterward', async () => {
  const pending = deferred<string | null>()
  const started = deferred()
  const reads: string[] = []
  const published: string[] = []
  const prefetch = createIconPrefetcher({ concurrency: 1, load: path => { reads.push(path); started.resolve(); return pending.promise }, publish: path => { published.push(path) } })
  prefetch.update(['active', 'queued'])
  await started.promise
  prefetch.dispose()
  prefetch.update(['new'])
  pending.resolve('data:icon')
  await prefetch.idle()
  expect(reads).toEqual(['active'])
  expect(published).toEqual([])
})

test('lookahead follows scroll direction, handles short lists and deduplicates shared source icons', () => {
  const apps = Array.from({ length: 80 }, (_, index) => ({ key: String(index), title: String(index), kind: 'application', content: `/app${index}`, subtitle: '' }))
  const down = iconPrefetchPaths(apps, 20 * 52, 5 * 52)
  const up = iconPrefetchPaths(apps, 20 * 52, 5 * 52, -1)
  expect(down.slice(0, 20)).toEqual(apps.slice(20, 40).map(item => item.content))
  expect(up.slice(0, 8)).toEqual([...apps.slice(20, 25), apps[19]!, apps[18]!, apps[17]!].map(item => item.content))
  expect(new Set(down).size).toBe(80)
  expect(iconPrefetchPaths([], 500, 0)).toEqual([])
  expect(iconPrefetchPaths(apps.slice(0, 2), -52, NaN)).toEqual(['/app0', '/app1'])
  expect(iconPrefetchPaths([apps[0]!, { ...apps[0]!, kind: 'clipboard', content: 'Copied text', sourceAppPath: '/app0' }])).toEqual(['/app0'])
})
