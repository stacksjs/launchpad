import type { NativeTrayMenuItem } from '@stacksjs/desktop/browser'

export const supportLinks: Record<string, string> = {
  feedback: 'https://github.com/stacksjs/launchpad/issues/new',
  manual: 'https://github.com/stacksjs/launchpad#readme',
  troubleshooting: 'https://github.com/stacksjs/launchpad/blob/main/docs/troubleshooting.md',
  subscribe: 'https://launchpad.stacksjs.com/#updates',
  community: 'https://stacksjs.com/discord',
  follow: 'https://bsky.app/profile/stacksjs.com',
  releases: 'https://github.com/stacksjs/launchpad/releases',
}

export const launcherTrayMenu: NativeTrayMenuItem[] = [
  { label: 'Open Launchpad', action: 'launchpad.open', shortcut: 'cmd+space' },
  { type: 'separator' },
  { label: 'Send Feedback…', action: 'launchpad.feedback' },
  { label: 'Manual', action: 'launchpad.manual' },
  { label: 'Troubleshooting', action: 'launchpad.troubleshooting' },
  { type: 'separator' },
  { label: 'Subscribe for Updates', action: 'launchpad.subscribe' },
  { label: 'Join our Community', action: 'launchpad.community' },
  { label: 'Follow Us', action: 'launchpad.follow' },
  { type: 'separator' },
  { label: 'About Launchpad', action: 'launchpad.about' },
  { label: 'Release Notes', action: 'launchpad.releases' },
  { label: 'Check for Updates…', action: 'launchpad.updates' },
  { label: 'Settings…', action: 'launchpad.settings', shortcut: 'cmd+,' },
  { type: 'separator' },
  { label: 'Open Console', action: 'launchpad.console' },
  { label: 'Copy Diagnostics', action: 'launchpad.diagnostics' },
  { type: 'separator' },
  { label: 'Quit Launchpad', action: 'quit', shortcut: 'cmd+q' },
]

/** Diagnostics describe capabilities only. No paths, clipboard, tokens or usage history. */
export function launcherDiagnostics(info: { version: string, bundleId?: string, sandboxed?: boolean }): string {
  return ['Launchpad diagnostics', `Version: ${info.version}`, `Bundle: ${info.bundleId || 'com.stacksjs.launchpad'}`, `Sandboxed: ${info.sandboxed ? 'yes' : 'no'}`].join('\n')
}
