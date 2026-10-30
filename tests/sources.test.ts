import { expect, test } from 'bun:test'
import { createLatest, createSources, SourceError } from '../resources/functions/sources'

const windowOutput = '501\t1\tSafari\tApple\n77\t1\tLaunchpad\tSelf\n'
const contactOutput = 'AB12CD34-0000-4000-8000-000000000001:ABPerson\tAda Lovelace\tada@example.com\t\tAnalytical Engines\n'
const eventOutput = 'A-1\tStandup\t2026-10-30T09:00:00\tfalse\tWork\n'

function ports(overrides: Partial<Parameters<typeof createSources>[0]> = {}) {
  const scripts: string[] = []
  return { scripts, value: { accessibility: async () => 'granted', appleScript: async (source: string) => { scripts.push(source); return { ok: true, result: source.includes('System Events') ? windowOutput : source.includes('Contacts') ? contactOutput : eventOutput } }, ...overrides } }
}

test('windows need Accessibility and ask for it once when missing', async () => {
  let requested = 0
  const denied = ports({ accessibility: async () => 'denied', requestAccessibility: async () => { requested++ } })
  const error = await createSources(denied.value).windows().catch(reason => reason)
  expect(error).toBeInstanceOf(SourceError)
  expect(error.permission).toBe('accessibility')
  expect(requested).toBe(1)
  expect(denied.scripts).toEqual([])
  const granted = ports()
  expect((await createSources(granted.value).windows()).map(item => item.title)).toEqual(['Apple'])
})

test('a refused script points at the Automation permission for that app', async () => {
  const refuse = ports({ appleScript: async () => ({ ok: false }) })
  const sources = createSources(refuse.value)
  expect(await sources.windows().catch(reason => reason.message)).toContain('System Events')
  expect(await sources.contacts('ada').catch(reason => reason.message)).toContain('Contacts')
  expect(await sources.events().catch(reason => reason.message)).toContain('Calendar')
  expect((await sources.contacts('ada').catch(reason => reason)).permission).toBe('automation')
})

test('contacts ignore one letter queries and never run a script for them', async () => {
  const fake = ports()
  const sources = createSources(fake.value)
  expect(await sources.contacts(' a ')).toEqual([])
  expect(fake.scripts).toEqual([])
  const found = await sources.contacts('ada')
  expect(found[0]).toMatchObject({ kind: 'contact', title: 'Ada Lovelace', detail: 'ada@example.com' })
  expect(fake.scripts).toHaveLength(1)
  expect(fake.scripts[0]).toContain('name contains "ada"')
})

test('events come back sorted and described relative to now', async () => {
  const events = await createSources(ports().value).events(new Date(2026, 9, 30, 8, 0, 0))
  expect(events[0]).toMatchObject({ kind: 'event', title: 'Standup', subtitle: 'Today 09:00 · Work' })
})

test('only the newest request is applied, and cancelling drops a late answer', async () => {
  const applied: string[] = []
  const errors: unknown[] = []
  const finished: string[] = []
  const releases = new Map<string, () => void>()
  const latest = createLatest<string>((input, signal) => new Promise((resolve, reject) => {
    releases.set(input, () => resolve(input.toUpperCase()))
    signal.addEventListener('abort', () => { if (input === 'fail') reject(new Error('aborted')) })
  }), { result: value => applied.push(value), error: reason => errors.push(reason), done: () => finished.push('done') })
  const first = latest('one')
  const second = latest('two')
  releases.get('one')!()
  releases.get('two')!()
  await Promise.all([first, second])
  expect(applied).toEqual(['TWO'])
  expect(finished).toEqual(['done'])
  const third = latest('three')
  latest.cancel()
  releases.get('three')!()
  await third
  expect(applied).toEqual(['TWO'])
  const failing = latest('fail')
  releases.get('fail')
  latest.cancel()
  await failing
  expect(errors).toEqual([])
})

test('the newest failure is reported', async () => {
  const errors: string[] = []
  const latest = createLatest<string>(async () => { throw new Error('boom') }, { result: () => {}, error: reason => errors.push((reason as Error).message) })
  await latest('x')
  expect(errors).toEqual(['boom'])
})

test('serial loaders never overlap: the newest request waits its turn and replaces older waiting ones', async () => {
  const log: string[] = []
  const applied: string[] = []
  const releases: Array<() => void> = []
  let active = 0
  let peak = 0
  const latest = createLatest<string>(input => new Promise((resolve) => {
    active++
    peak = Math.max(peak, active)
    log.push(`start:${input}`)
    releases.push(() => { active--; resolve(input) })
  }), { result: value => applied.push(value), error: () => {} }, { serial: true })
  const first = latest('a')
  expect(latest.busy()).toBe(true)
  const second = latest('b')
  const third = latest('c')
  await Promise.resolve()
  expect(log).toEqual(['start:a'])
  releases.shift()!()
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(log).toEqual(['start:a', 'start:c'])
  releases.shift()!()
  await Promise.all([first, second, third])
  expect(applied).toEqual(['c'])
  expect(peak).toBe(1)
  expect(latest.busy()).toBe(false)
})

test('cancelling clears the waiting request and settles its caller', async () => {
  const started: string[] = []
  let release = () => {}
  const latest = createLatest<string>(input => new Promise((resolve) => { started.push(input); release = () => resolve(input) }), { result: () => started.push('applied'), error: () => {} }, { serial: true })
  const running = latest('a')
  const waiting = latest('b')
  latest.cancel()
  await waiting
  release()
  await running
  expect(started).toEqual(['a'])
})

test('repeated contact searches are answered from memory until they expire', async () => {
  let clock = 0
  const fake = ports()
  const sources = createSources(fake.value, { now: () => clock, cacheMs: 1000 })
  const first = await sources.contacts('Ada')
  expect(await sources.contacts(' ada ')).toBe(first)
  expect(fake.scripts).toHaveLength(1)
  await sources.contacts('grace')
  expect(fake.scripts).toHaveLength(2)
  clock = 1001
  await sources.contacts('ada')
  expect(fake.scripts).toHaveLength(3)
})
