import type { Result } from './search'

/** Commands are fixed here. Nothing a user types, and nothing from a result's content, is ever run as code. */
export type SystemPlan =
  | { type: 'applescript', source: string }
  | { type: 'spawn', command: string, args: readonly string[] }
  | { type: 'url', url: string }
  | { type: 'path', path: string }

export interface SystemCommand {
  id: string
  title: string
  subtitle: string
  aliases: readonly string[]
  /** Asked before running, because the action ends work in progress or cannot be undone. */
  confirm?: string
  plan: SystemPlan
}

const script = (source: string): SystemPlan => ({ type: 'applescript', source })
const pane = (id: string): SystemPlan => ({ type: 'url', url: `x-apple.systempreferences:${id}` })

const actions: readonly SystemCommand[] = [
  { id: 'sleep', title: 'Sleep', subtitle: 'System · Put this Mac to sleep', aliases: ['suspend', 'nap'], plan: { type: 'spawn', command: '/usr/bin/pmset', args: ['sleepnow'] } },
  { id: 'lock-screen', title: 'Lock Screen', subtitle: 'System · Turn off the display; a password is asked if Lock Screen settings require one', aliases: ['lock', 'lock mac', 'secure'], plan: { type: 'spawn', command: '/usr/bin/pmset', args: ['displaysleepnow'] } },
  { id: 'screen-saver', title: 'Start Screen Saver', subtitle: 'System · Start the screen saver now', aliases: ['screensaver'], plan: { type: 'path', path: '/System/Library/CoreServices/ScreenSaverEngine.app' } },
  { id: 'restart', title: 'Restart', subtitle: 'System · Restart this Mac', aliases: ['reboot'], confirm: 'Restart this Mac now? Apps with unsaved work will ask to save.', plan: script('tell application "System Events" to restart') },
  { id: 'shut-down', title: 'Shut Down', subtitle: 'System · Turn off this Mac', aliases: ['power off', 'turn off', 'shutdown'], confirm: 'Shut down this Mac now? Apps with unsaved work will ask to save.', plan: script('tell application "System Events" to shut down') },
  { id: 'log-out', title: 'Log Out', subtitle: 'System · Sign out of this account', aliases: ['logout', 'sign out'], confirm: 'Log out of this account now? Apps with unsaved work will ask to save.', plan: script('tell application "System Events" to log out') },
  { id: 'empty-trash', title: 'Empty Trash', subtitle: 'System · Permanently delete everything in the Trash', aliases: ['trash', 'clear trash', 'bin'], confirm: 'Permanently delete everything in the Trash? This cannot be undone.', plan: script('tell application "Finder" to empty trash') },
  { id: 'eject-disks', title: 'Eject All Disks', subtitle: 'System · Eject every removable disk', aliases: ['eject', 'unmount'], plan: script('tell application "Finder" to eject (every disk whose ejectable is true)') },
  { id: 'toggle-dark-mode', title: 'Toggle Dark Mode', subtitle: 'System · Switch macOS between light and dark', aliases: ['dark mode', 'light mode', 'appearance'], plan: script('tell application "System Events" to tell appearance preferences to set dark mode to not dark mode') },
  { id: 'toggle-mute', title: 'Toggle Mute', subtitle: 'System · Mute or unmute sound output', aliases: ['mute', 'unmute', 'silence', 'volume off'], plan: script('set volume output muted (not (output muted of (get volume settings)))') },
]

const panes: readonly [id: string, title: string, aliases: readonly string[], pane: string][] = [
  ['general', 'General Settings', ['about this mac', 'storage'], 'com.apple.systempreferences.GeneralSettings'],
  ['appearance', 'Appearance Settings', ['theme', 'accent color'], 'com.apple.Appearance-Settings.extension'],
  ['accessibility', 'Accessibility Settings', ['voiceover', 'zoom', 'a11y'], 'com.apple.Accessibility-Settings.extension'],
  ['control-center', 'Control Center Settings', ['menu bar'], 'com.apple.ControlCenter-Settings.extension'],
  ['siri', 'Siri Settings', ['dictation'], 'com.apple.Siri-Settings.extension'],
  ['spotlight', 'Spotlight Settings', ['search settings'], 'com.apple.Spotlight-Settings.extension'],
  ['privacy', 'Privacy & Security Settings', ['permissions', 'security', 'full disk access', 'camera access'], 'com.apple.settings.PrivacySecurity.extension'],
  ['desktop-dock', 'Desktop & Dock Settings', ['dock', 'stage manager', 'mission control'], 'com.apple.Desktop-Settings.extension'],
  ['displays', 'Displays Settings', ['monitor', 'resolution', 'night shift', 'brightness'], 'com.apple.Displays-Settings.extension'],
  ['wallpaper', 'Wallpaper Settings', ['background', 'desktop picture'], 'com.apple.Wallpaper-Settings.extension'],
  ['screen-time', 'Screen Time Settings', ['downtime', 'app limits'], 'com.apple.Screen-Time-Settings.extension'],
  ['lock-screen-settings', 'Lock Screen Settings', ['password', 'require password'], 'com.apple.Lock-Screen-Settings.extension'],
  ['touch-id', 'Touch ID & Password Settings', ['fingerprint', 'biometrics'], 'com.apple.Touch-ID-Settings.extension'],
  ['users-groups', 'Users & Groups Settings', ['accounts', 'login options'], 'com.apple.Users-Groups-Settings.extension'],
  ['passwords', 'Passwords Settings', ['keychain', 'autofill'], 'com.apple.Passwords-Settings.extension'],
  ['internet-accounts', 'Internet Accounts Settings', ['icloud', 'email accounts'], 'com.apple.Internet-Accounts-Settings.extension'],
  ['network', 'Network Settings', ['wifi', 'wi-fi', 'ethernet', 'vpn', 'dns', 'internet'], 'com.apple.Network-Settings.extension'],
  ['bluetooth', 'Bluetooth Settings', ['pair', 'headphones'], 'com.apple.BluetoothSettings'],
  ['sound', 'Sound Settings', ['volume', 'audio', 'microphone', 'output'], 'com.apple.Sound-Settings.extension'],
  ['notifications', 'Notifications Settings', ['alerts', 'banners'], 'com.apple.Notifications-Settings.extension'],
  ['focus', 'Focus Settings', ['do not disturb', 'dnd'], 'com.apple.Focus-Settings.extension'],
  ['battery', 'Battery Settings', ['power', 'low power mode', 'energy'], 'com.apple.Battery-Settings.extension'],
  ['keyboard', 'Keyboard Settings', ['shortcuts', 'text replacement', 'input sources'], 'com.apple.Keyboard-Settings.extension'],
  ['mouse', 'Mouse Settings', ['scroll', 'pointer'], 'com.apple.Mouse-Settings.extension'],
  ['trackpad', 'Trackpad Settings', ['gestures', 'tap to click'], 'com.apple.Trackpad-Settings.extension'],
  ['printers', 'Printers & Scanners Settings', ['printing', 'scanner'], 'com.apple.Print-Scan-Settings.extension'],
  ['sharing', 'Sharing Settings', ['airdrop', 'file sharing', 'remote login', 'hostname'], 'com.apple.Sharing-Settings.extension'],
  ['date-time', 'Date & Time Settings', ['clock', 'timezone', 'time zone'], 'com.apple.Date-Time-Settings.extension'],
  ['language-region', 'Language & Region Settings', ['locale', 'language'], 'com.apple.Localization-Settings.extension'],
  ['login-items', 'Login Items Settings', ['startup', 'launch at login', 'background items'], 'com.apple.LoginItems-Settings.extension'],
  ['software-update', 'Software Update Settings', ['upgrade', 'macos update', 'updates'], 'com.apple.Software-Update-Settings.extension'],
  ['time-machine', 'Time Machine Settings', ['backup'], 'com.apple.Time-Machine-Settings.extension'],
  ['startup-disk', 'Startup Disk Settings', ['boot'], 'com.apple.Startup-Disk-Settings.extension'],
]

export const systemCommands: readonly SystemCommand[] = [
  ...actions,
  ...panes.map(([id, title, aliases, target]): SystemCommand => ({ id: `settings-${id}`, title, subtitle: 'System Settings · Open this pane', aliases: ['system settings', 'preferences', ...aliases], plan: pane(target) })),
]

const byId = new Map(systemCommands.map(command => [command.id, command]))

/** Unknown identifiers return null, so a forged result can never reach the system. */
export function systemCommand(id: string): SystemCommand | null {
  return byId.get(id) ?? null
}

export function systemCommandResults(): Result[] {
  return systemCommands.map(command => ({ key: `system:${command.id}`, title: command.title, subtitle: command.subtitle, kind: 'system', content: command.id, searchAliases: command.aliases }))
}

/** These help once you search for them, but a dozen power commands do not belong in the idle list. */
export const quietKinds: readonly string[] = ['system', 'emoji', 'extension']

export interface SystemPorts {
  appleScript: (source: string) => Promise<{ ok: boolean }>
  spawn: (command: string, args: readonly string[]) => Promise<void>
  openUrl: (url: string) => Promise<void>
  openPath: (path: string) => Promise<void>
}

/** Run one fixed plan. A refused script explains where the permission lives instead of failing silently. */
export async function runSystemPlan(command: SystemCommand, ports: SystemPorts): Promise<void> {
  const { plan } = command
  if (plan.type === 'applescript') {
    const outcome = await ports.appleScript(plan.source)
    if (!outcome.ok) throw new Error(`macOS did not run "${command.title}". Allow Launchpad under System Settings > Privacy & Security > Automation, then try again.`)
  }
  else if (plan.type === 'spawn') await ports.spawn(plan.command, plan.args)
  else if (plan.type === 'url') await ports.openUrl(plan.url)
  else await ports.openPath(plan.path)
}
