import { expect, test } from 'bun:test'
import { quietKinds, systemCommand, systemCommandResults, systemCommands } from '../resources/functions/system-commands'
import { createResultSearch } from '../resources/functions/search'

test('every system command is unique, fixed, and described', () => {
  const ids = systemCommands.map(command => command.id)
  expect(new Set(ids).size).toBe(ids.length)
  for (const command of systemCommands) {
    expect(command.title.length).toBeGreaterThan(0)
    expect(command.subtitle).toMatch(/^(System|System Settings) · /)
    if (command.plan.type === 'url') expect(command.plan.url).toMatch(/^x-apple\.systempreferences:[\w.-]+$/)
    if (command.plan.type === 'spawn') expect(command.plan.command).toStartWith('/usr/bin/')
    if (command.plan.type === 'path') expect(command.plan.path).toMatch(/^\/System\/.+\.app$/)
    if (command.plan.type === 'applescript') expect(command.plan.source).not.toContain('${')
  }
})

test('actions that end work or delete data ask first, and harmless ones do not', () => {
  for (const id of ['restart', 'shut-down', 'log-out', 'empty-trash']) expect(systemCommand(id)?.confirm).toBeTruthy()
  for (const id of ['sleep', 'lock-screen', 'toggle-dark-mode', 'toggle-mute', 'settings-network']) expect(systemCommand(id)?.confirm).toBeUndefined()
})

test('unknown identifiers never resolve to a plan', () => {
  for (const id of ['', 'rm -rf', '__proto__', 'constructor', 'restart; reboot', 'SETTINGS-NETWORK']) expect(systemCommand(id)).toBeNull()
})

test('familiar phrases find the right command', () => {
  const search = createResultSearch(systemCommandResults())
  const first = (query: string) => search(query)[0]?.content
  expect(first('reboot')).toBe('restart')
  expect(first('dark mode')).toBe('toggle-dark-mode')
  expect(first('wifi')).toBe('settings-network')
  expect(first('empty trash')).toBe('empty-trash')
  expect(first('lock')).toBe('lock-screen')
  expect(first('backup')).toBe('settings-time-machine')
  expect(first('shutdown')).toBe('shut-down')
  expect(first('permissions')).toBe('settings-privacy')
  expect(systemCommandResults().every(item => item.kind === 'system' && item.key === `system:${item.content}`)).toBe(true)
  expect(quietKinds).toContain('system')
})
