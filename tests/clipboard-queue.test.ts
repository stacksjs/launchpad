import { expect, test } from 'bun:test'
import { createClipboardQueue } from '../resources/functions/clipboard-queue'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const capture = (text: string) => ({ text, sourceApp: '', capturedAt: 1 })

test('pause discards a delayed read and any write queued before it', async () => {
  const writes: string[] = []
  const queue = createClipboardQueue(async value => { writes.push(value.text); return true }, async () => {})
  const token = queue.token()
  const queued = queue.save(capture('queued'), token)
  queue.invalidate()
  expect(await queued).toBe(false)
  expect(await queue.save(capture('delayed read'), token)).toBe(false)
  expect(writes).toEqual([])
  expect(await queue.save(capture('explicit new save'))).toBe(true)
})

test('clear drains an active write, cancels queued and late reads, and shares concurrent clear requests', async () => {
  const started = deferred()
  const finish = deferred()
  const events: string[] = []
  const queue = createClipboardQueue(async value => {
    events.push(value.text); started.resolve(); await finish.promise; events.push('write finished'); return true
  }, async () => { events.push('clear') })
  const oldToken = queue.token()
  const running = queue.save(capture('running'))
  await started.promise
  const queued = queue.save(capture('queued'))
  const clearing = queue.clear()
  expect(queue.clear()).toBe(clearing)
  expect(await queue.save(capture('during clear'))).toBe(false)
  finish.resolve()
  await Promise.all([running, queued, clearing])
  expect(events).toEqual(['running', 'write finished', 'clear'])
  expect(await queue.save(capture('late read'), oldToken)).toBe(false)
  expect(queue.current(queue.token())).toBe(true)
})

test('pause does not cancel an explicit save requested after pause and can await an accepted write', async () => {
  const finish = deferred()
  const started = deferred()
  const writes: string[] = []
  const queue = createClipboardQueue(async value => { writes.push(value.text); started.resolve(); await finish.promise; return true }, async () => {})
  const active = queue.save(capture('accepted before pause'))
  await started.promise
  queue.invalidate()
  let drained = false
  const drain = queue.drain().then(() => { drained = true })
  await Promise.resolve()
  expect(drained).toBe(false)
  finish.resolve()
  await Promise.all([active, drain])
  expect(await queue.save(capture('explicit save while paused'))).toBe(true)
  expect(writes).toEqual(['accepted before pause', 'explicit save while paused'])
})

test('failed writes and clears do not poison future work or reopen invalidated reads', async () => {
  let failWrite = true
  let failClear = true
  const queue = createClipboardQueue(async () => {
    if (failWrite) throw new Error('write failed')
    return true
  }, async () => { if (failClear) throw new Error('clear failed') })
  await expect(queue.save(capture('failure'))).rejects.toThrow('write failed')
  const token = queue.token()
  await expect(queue.clear()).rejects.toThrow('clear failed')
  expect(queue.current(token)).toBe(false)
  failWrite = false
  expect(await queue.save(capture('retry'))).toBe(true)
  failClear = false
  await queue.clear()
  expect(await queue.save(capture('after clear'))).toBe(true)
})
