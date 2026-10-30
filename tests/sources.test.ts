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
