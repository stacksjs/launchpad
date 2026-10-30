import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appleScriptString, cleanField, describeScriptFailure, parseRecords } from '../resources/functions/applescript'
import { contactDetail, contactOpenScript, contactResults, contactSearchScript, maxContacts, parseContacts } from '../resources/functions/contacts'
import { describeEventStart, eventOpenScript, eventResults, parseEvents, parseLocalIso, upcomingEventsScript } from '../resources/functions/calendar'
import { parseWindows, windowFocusScript, windowListScript, windowResults } from '../resources/functions/windows'
import { systemCommands } from '../resources/functions/system-commands'

test('text can never end an AppleScript string literal', () => {
  expect(appleScriptString('plain')).toBe('"plain"')
  expect(appleScriptString('say "hi"')).toBe('"say \\"hi\\""')
  expect(appleScriptString('back\\slash')).toBe('"back\\\\slash"')
  expect(appleScriptString('line\none\rtwo\tthree\u2028')).toBe('"line one two three "')
  const attack = appleScriptString('" & (do shell script "touch /tmp/pwned") & "')
  expect(attack).toBe('"\\" & (do shell script \\"touch /tmp/pwned\\") & \\""')
  // Every quote inside the literal is escaped, so the only unescaped quotes are the two that delimit it.
  expect(attack.slice(1, -1).replace(/\\./g, '').includes('"')).toBe(false)
  expect(appleScriptString('trailing\\')).toBe('"trailing\\\\"')
})

test('records split on lines and tabs and drop malformed rows', () => {
  expect(parseRecords('a\tb\nc\td\n\n', 2)).toEqual([['a', 'b'], ['c', 'd']])
  expect(parseRecords('a\tb\tc\nx\ty', 2)).toEqual([['x', 'y']])
  expect(parseRecords('a\tb\r\nc\td\r', 2)).toHaveLength(2)
  expect(parseRecords('', 2)).toEqual([])
  expect(cleanField(' missing value ')).toBe('')
  expect(cleanField(undefined)).toBe('')
})

test('windows parse, hide Launchpad, and produce focus scripts only from valid tokens', () => {
  const entries = parseWindows(['501\t1\tSafari\tApple', '501\t2\tSafari\tmissing value', 'x\t1\tBad\tpid', '0\t1\tBad\tzero', '77\t1\tLaunchpad\tSelf', '88\t1000\tToo\tmany', '90\t1\tNotes\tShopping\tlist', ''].join('\n'))
  expect(entries).toEqual([{ pid: 501, index: 1, app: 'Safari', title: 'Apple' }, { pid: 501, index: 2, app: 'Safari', title: '' }])
  const results = windowResults(entries)
  expect(results.map(item => item.title)).toEqual(['Apple', 'Untitled window'])
  expect(results[0]).toMatchObject({ key: 'window:501:1', subtitle: 'Safari · Window', kind: 'window' })
  const script = windowFocusScript(results[0]!.content)!
  expect(script).toContain('unix id is 501')
  expect(script).toContain('whose name is "Apple"')
  expect(script).toContain('AXRaise')
  expect(windowFocusScript(JSON.stringify({ pid: 501, index: 1, title: '" & (do shell script "x") & "' }))).toContain('\\" & (do shell script \\"x\\") & \\"')
  for (const bad of ['', 'nope', 'null', '[]', '{}', JSON.stringify({ pid: '1', index: 1, title: '' }), JSON.stringify({ pid: -1, index: 1, title: '' }), JSON.stringify({ pid: 1.5, index: 1, title: '' }), JSON.stringify({ pid: 1, index: 0, title: '' }), JSON.stringify({ pid: 1, index: 1, title: 5 }), JSON.stringify({ pid: '1; do shell script "x"', index: 1, title: '' })])
    expect(windowFocusScript(bad)).toBeNull()
})

test('contacts parse, refuse odd identifiers and build escaped searches', () => {
  const entries = parseContacts(['AB12CD34-0000-4000-8000-000000000001:ABPerson\tAda Lovelace\tada@example.com\t+44 20 7946 0000\tAnalytical Engines', 'bad id\tNo\t\t\t', 'AB12CD34-0000-4000-8000-000000000002:ABPerson\tGrace Hopper\tmissing value\t\tmissing value', 'AB12CD34-0000-4000-8000-000000000003:ABPerson\t\t\t\t'].join('\n'))
  expect(entries.map(entry => entry.name)).toEqual(['Ada Lovelace', 'Grace Hopper'])
  expect(entries[1]).toMatchObject({ email: '', phone: '', organization: '' })
  const results = contactResults(entries)
  expect(results[0]).toMatchObject({ kind: 'contact', title: 'Ada Lovelace', subtitle: 'Contact · Analytical Engines · ada@example.com · +44 20 7946 0000' })
  expect(results[0]!.key).toBe(`contact:${entries[0]!.id}`)
  expect(contactDetail(entries[0]!)).toBe('ada@example.com')
  expect(contactDetail({ email: '', phone: '555' })).toBe('555')
  const script = contactSearchScript('O"Brien \\ " & x')
  expect(script).toContain('name contains "O\\"Brien \\\\ \\" & x"')
  expect(script).toContain(`${maxContacts}`)
  expect(contactOpenScript(entries[0]!.id)).toContain(`person id "${entries[0]!.id}"`)
  for (const bad of ['', ' ', 'a"b', 'x; do shell script', '../etc', 'a'.repeat(200)]) expect(contactOpenScript(bad)).toBeNull()
})

test('events parse local ISO times, sort by start and describe their day', () => {
  expect(parseLocalIso('2026-10-30T09:05:00')).toBe(new Date(2026, 9, 30, 9, 5, 0).getTime())
  for (const bad of ['', 'tomorrow', '2026-13-01T00:00:00', '2026-02-31T00:00:00', '2026-10-30 09:00:00']) expect(parseLocalIso(bad)).toBeNull()
  const output = ['B-2\tLunch\t2026-10-31T12:00:00\tfalse\tWork', 'A-1\tStandup\t2026-10-30T09:00:00\tfalse\tWork', 'C-3\tHoliday\t2026-11-02T00:00:00\ttrue\tHolidays', 'bad uid!\tX\t2026-10-30T09:00:00\tfalse\tWork', 'D-4\tBroken\tsoon\tfalse\tWork', 'E-5\tmissing value\t2026-10-30T10:00:00\tfalse\t'].join('\n')
  const events = parseEvents(output)
  expect(events.map(event => event.uid)).toEqual(['A-1', 'E-5', 'B-2', 'C-3'])
  expect(events[1]!.title).toBe('Untitled event')
  const now = new Date(2026, 9, 30, 8, 0, 0)
  expect(describeEventStart(events[0]!, now)).toBe('Today 09:00')
  expect(describeEventStart(events[2]!, now)).toBe('Tomorrow 12:00')
  expect(describeEventStart(events[3]!, now)).toBe('Mon, Nov 2')
  expect(eventResults(events, now)[0]).toMatchObject({ kind: 'event', title: 'Standup', subtitle: 'Today 09:00 · Work', key: 'event:A-1', content: 'A-1' })
  expect(eventOpenScript('A-1')).toContain('uid is "A-1"')
  for (const bad of ['', 'a"b', 'x y', 'a'.repeat(300)]) expect(eventOpenScript(bad)).toBeNull()
})

test('a failed script is explained by its error number, and older hosts keep the permission hint', () => {
  const failure = (code?: number, message?: string) => describeScriptFailure('Contacts', { ok: false, error: code === undefined && message === undefined ? undefined : { code, message } })
  expect(failure()).toMatchObject({ permission: 'automation', message: expect.stringContaining('control Contacts') })
  expect(failure(-1743)).toMatchObject({ permission: 'automation' })
  expect(failure(-1744)).toMatchObject({ permission: 'automation' })
  expect(failure(-25211)).toMatchObject({ permission: 'accessibility', message: expect.stringContaining('Accessibility') })
  expect(failure(-1719)).toMatchObject({ permission: 'accessibility' })
  expect(failure(-128)).toEqual({ message: 'The request was cancelled.' })
  expect(failure(-600)).toEqual({ message: 'Contacts is not running and could not be opened.' })
  expect(failure(-1728, "Can't get window 3.")).toEqual({ message: "Contacts could not do that: Can't get window 3." })
  expect(failure(-1728)).toEqual({ message: 'Contacts could not do that (error -1728).' })
  expect(failure(undefined, 'only a message')).toMatchObject({ permission: 'automation' })
})

// Compiling catches syntax errors without running anything or reading any data. It does not validate app terms:
// those were checked against the Contacts, Calendar and System Events dictionaries with `sdef`.
const compile = test.skipIf(process.platform !== 'darwin')
compile('every AppleScript Launchpad runs compiles on this macOS', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'launchpad-osa-'))
  try {
    const scripts: Record<string, string> = {
      windows: windowListScript,
      windowFocus: windowFocusScript(JSON.stringify({ pid: 1, index: 1, title: 'Tab "one"' }))!,
      contacts: contactSearchScript('Ada "A" \\ Lovelace'),
      contactOpen: contactOpenScript('AB12CD34-0000-4000-8000-000000000001:ABPerson')!,
      events: upcomingEventsScript,
      eventOpen: eventOpenScript('A-1')!,
    }
    for (const command of systemCommands) if (command.plan.type === 'applescript') scripts[`system-${command.id}`] = command.plan.source
    for (const [name, source] of Object.entries(scripts)) {
      const file = join(directory, `${name}.applescript`)
      await writeFile(file, source)
      const result = Bun.spawnSync(['/usr/bin/osacompile', '-o', join(directory, `${name}.scpt`), file], { stderr: 'pipe', stdout: 'pipe' })
      if (result.exitCode !== 0) throw new Error(`${name} did not compile: ${result.stderr.toString()}`)
    }
  }
  finally { await rm(directory, { recursive: true, force: true }) }
})
