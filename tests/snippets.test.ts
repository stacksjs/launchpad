import { expect, test } from 'bun:test'
import { expandSnippet } from '../resources/functions/snippets'
import { runSystemPlan, systemCommand } from '../resources/functions/system-commands'

const now = new Date(2026, 9, 5, 7, 4, 9)
function context(clipboard = 'copied text') {
  const reads: string[] = []
  return { reads, value: { now, uuid: () => '00000000-0000-4000-8000-000000000000', clipboard: async () => { reads.push('read'); return clipboard } } }
}

test('placeholders fill in local time with zero padding', async () => {
  const { value } = context()
  expect(await expandSnippet('{date} {time}', value)).toBe('2026-10-05 07:04')
  expect(await expandSnippet('{datetime} / {weekday} / {year}', value)).toBe('2026-10-05 07:04 / Monday / 2026')
  expect(await expandSnippet('id {uuid}', value)).toBe('id 00000000-0000-4000-8000-000000000000')
})

test('escaped and unknown placeholders stay exactly as typed', async () => {
  const { value } = context()
  expect(await expandSnippet('literal {{date}} and {name} and {} and {a b} and {date', value)).toBe('literal {date} and {name} and {} and {a b} and {date')
  expect(await expandSnippet('no placeholders at all', value)).toBe('no placeholders at all')
  expect(await expandSnippet('', value)).toBe('')
  expect(await expandSnippet('{constructor} {__proto__} {toString}', value)).toBe('{constructor} {__proto__} {toString}')
})

test('the clipboard is read only when the snippet uses it, once per use', async () => {
  const idle = context()
  await expandSnippet('Dear {date}', idle.value)
  expect(idle.reads).toEqual([])
  const used = context('hello')
  expect(await expandSnippet('[{clipboard}] and [{clipboard}]', used.value)).toBe('[hello] and [hello]')
  expect(used.reads).toHaveLength(2)
})

test('a system plan runs through exactly one port and explains a script that never ran', async () => {
  const calls: string[] = []
  const ports = {
    appleScript: async (source: string) => { calls.push(`script:${source}`); return { ok: !source.includes('Finder') } },
    spawn: async (command: string, args: readonly string[]) => { calls.push(`spawn:${command} ${args.join(' ')}`) },
    openUrl: async (url: string) => { calls.push(`url:${url}`) },
    openPath: async (path: string) => { calls.push(`path:${path}`) },
  }
  await runSystemPlan(systemCommand('sleep')!, ports)
  await runSystemPlan(systemCommand('settings-network')!, ports)
  await runSystemPlan(systemCommand('screen-saver')!, ports)
  await runSystemPlan(systemCommand('toggle-mute')!, ports)
  expect(calls).toEqual(['spawn:/usr/bin/pmset sleepnow', 'url:x-apple.systempreferences:com.apple.Network-Settings.extension', 'path:/System/Library/CoreServices/ScreenSaverEngine.app', expect.stringContaining('script:set volume output muted')])
  // A bare `{ ok: false }` is what the bridge answers when it never dispatched the event, so nothing was refused and
  // there is no switch to turn on. A genuine refusal arrives with -1743, which the next test covers.
  const refused = await runSystemPlan(systemCommand('empty-trash')!, ports).catch(reason => reason)
  expect(refused.message).toBe(`Launchpad could not run "Empty Trash". The script never reached Finder, so no permission is missing.`)
  expect(refused.permission).toBeUndefined()
})

test('a system command that fails for another reason does not blame Automation', async () => {
  const refuse = (error: { code?: number, message?: string }) => ({
    appleScript: async () => ({ ok: false, error }),
    spawn: async () => {},
    openUrl: async () => {},
    openPath: async () => {},
  })
  const run = (id: string, error: { code?: number, message?: string }) => runSystemPlan(systemCommand(id)!, refuse(error)).catch(reason => reason)
  const cancelled = await run('empty-trash', { code: -128 })
  expect(cancelled.message).toBe(`Launchpad could not run "Empty Trash". The request was cancelled.`)
  expect(cancelled.permission).toBeUndefined()
  // Finder's own warning before it empties the Trash holds the event open until it times out.
  expect((await run('empty-trash', { code: -1712 })).message).toContain('Finder is waiting for an answer')
  expect((await run('restart', { code: -1743 })).message).toContain('control System Events')
  expect((await run('eject-disks', { code: -1728, message: 'No disks.' })).message).toBe(`Launchpad could not run "Eject All Disks". Finder could not do that: No disks.`)
})
