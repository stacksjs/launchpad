import { expect, test } from 'bun:test'
import { launcherDiagnostics, launcherTrayMenu, supportLinks } from '../resources/functions/tray-menu'

test('the native menu offers working support, community, subscription and app actions', () => {
  expect(supportLinks.follow).toBe('https://bsky.app/profile/stacksjs.com')
  expect(supportLinks.subscribe).toBe('https://launchpad.stacksjs.com/#updates')
  const actions = launcherTrayMenu.flatMap(item => item.action ? [item.action] : [])
  expect(new Set(actions).size).toBe(actions.length)
  for (const key of Object.keys(supportLinks)) expect(actions).toContain(`launchpad.${key}`)
  for (const action of ['open', 'about', 'updates', 'settings', 'console', 'diagnostics']) expect(actions).toContain(`launchpad.${action}`)
  expect(actions).toContain('quit')
  expect(launcherDiagnostics({ version: '1.1.11', bundleId: 'com.stacksjs.launchpad', sandboxed: true })).toBe('Launchpad diagnostics\nVersion: 1.1.11\nBundle: com.stacksjs.launchpad\nSandboxed: yes')
})
