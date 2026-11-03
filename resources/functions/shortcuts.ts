/**
 * A saved command can carry a shortcut that runs it from anywhere. That makes it a global shortcut, which fires
 * wherever focus happens to be, so the rules here are stricter than they would be for a key the palette handles
 * itself: a shortcut without a modifier would swallow an ordinary keystroke in every other app.
 */
export const shortcutModifiers = ['Cmd', 'Ctrl', 'Alt', 'Shift'] as const
export type ShortcutModifier = typeof shortcutModifiers[number]

/** What opens the palette. It is registered before any command shortcut and cannot be taken. */
export const launcherShortcut = 'Cmd+Space'

/**
 * The palette's own keys. These are handled inside the window, but a global shortcut fires first and everywhere, so
 * letting one be assigned would quietly stop the matching key working in the palette.
 */
export const reservedShortcuts: readonly string[] = [
  launcherShortcut, 'Cmd+N', 'Cmd+D', 'Cmd+E', 'Cmd+G', 'Cmd+,', 'Cmd+Delete', 'Cmd+Return',
  'Cmd+Shift+C', 'Cmd+Shift+V', 'Cmd+[', 'Cmd+]',
]

const modifierAliases: Record<string, ShortcutModifier> = {
  cmd: 'Cmd', command: 'Cmd', meta: 'Cmd', super: 'Cmd', '⌘': 'Cmd',
  ctrl: 'Ctrl', control: 'Ctrl', '⌃': 'Ctrl',
  alt: 'Alt', opt: 'Alt', option: 'Alt', '⌥': 'Alt',
  shift: 'Shift', '⇧': 'Shift',
}

const keyAliases: Record<string, string> = {
  space: 'Space', spacebar: 'Space', ' ': 'Space',
  return: 'Return', enter: 'Return', '⏎': 'Return',
  esc: 'Escape', escape: 'Escape',
  del: 'Delete', delete: 'Delete', backspace: 'Delete', '⌫': 'Delete',
  tab: 'Tab', up: 'Up', arrowup: 'Up', down: 'Down', arrowdown: 'Down',
  left: 'Left', arrowleft: 'Left', right: 'Right', arrowright: 'Right',
  plus: 'Plus', comma: ',', period: '.', slash: '/',
}

/** Punctuation that sits on an unshifted key, so it can be typed as part of a shortcut without needing Shift. */
const punctuation = new Set([',', '.', '/', ';', '\'', '[', ']', '\\', '-', '=', '`'])

function normalizeKey(value: string): string | null {
  const key = value.trim()
  if (!key) return null
  const lower = key.toLowerCase()
  if (keyAliases[lower]) return keyAliases[lower]
  if (/^f(?:[1-9]|1[0-2])$/.test(lower)) return lower.toUpperCase()
  if (/^[a-z0-9]$/.test(lower)) return lower.toUpperCase()
  if (key.length === 1 && punctuation.has(key)) return key
  return null
}

/**
 * Reads a shortcut written in any of the usual ways and returns the one spelling the app stores, with the modifiers
 * always in the same order. Anything it cannot read is null, so a stored value can never be half understood.
 */
export function normalizeShortcut(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parts = value.split('+').map(part => part.trim()).filter(Boolean)
  if (!parts.length) return null
  const seen = new Set<ShortcutModifier>()
  const keys: string[] = []
  for (const part of parts) {
    const modifier = modifierAliases[part.toLowerCase()]
    if (modifier) seen.add(modifier)
    else keys.push(part)
  }
  if (keys.length !== 1) return null
  const key = normalizeKey(keys[0]!)
  if (!key) return null
  return [...shortcutModifiers.filter(name => seen.has(name)), key].join('+')
}

/** The same shortcut written the way a Mac shows it, for the editor and the list in Settings. */
export function formatShortcut(value: string): string {
  const normalized = normalizeShortcut(value)
  if (!normalized) return ''
  const symbols: Record<string, string> = { Cmd: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Space: 'Space', Return: '↩', Delete: '⌫', Escape: '⎋', Tab: '⇥', Up: '↑', Down: '↓', Left: '←', Right: '→' }
  return normalized.split('+').map(part => symbols[part] ?? part).join('')
}

/** Built from a key press, so the editor can record a shortcut instead of asking someone to type its name. */
export function shortcutFromEvent(event: { key: string, metaKey?: boolean, ctrlKey?: boolean, altKey?: boolean, shiftKey?: boolean }): string | null {
  const parts: string[] = []
  if (event.metaKey) parts.push('Cmd')
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  // A press of a modifier on its own is someone still reaching for the shortcut, not the shortcut.
  if (modifierAliases[event.key.toLowerCase()]) return null
  parts.push(event.key)
  return normalizeShortcut(parts.join('+'))
}

export interface ShortcutHolder { id: unknown, title: string, shortcut?: string | null }

/**
 * Why a shortcut cannot be used, or null when it can. Conflicts the app can see are answered here; a shortcut another
 * application already owns is only discovered by asking macOS to register it, which the caller does next.
 */
export function shortcutError(value: string, taken: readonly ShortcutHolder[] = [], ownId: unknown = null): string | null {
  const normalized = normalizeShortcut(value)
  if (!normalized) return 'That is not a shortcut Launchpad can use.'
  const parts = normalized.split('+')
  const key = parts[parts.length - 1]!
  const modifiers = parts.slice(0, -1)
  if (!modifiers.length) return 'Add Command, Control or Option, so the shortcut does not swallow an ordinary key.'
  if (modifiers.length === 1 && modifiers[0] === 'Shift') return 'Shift on its own is not enough. Add Command, Control or Option.'
  if (reservedShortcuts.includes(normalized)) return `${formatShortcut(normalized)} is one of Launchpad's own shortcuts.`
  const clash = taken.find(entry => entry.id !== ownId && normalizeShortcut(entry.shortcut) === normalized)
  if (clash) return `${formatShortcut(normalized)} already runs "${clash.title}".`
  // A single letter with only Shift reads as typing that letter, which is caught above; everything else is allowed.
  return key ? null : 'That is not a shortcut Launchpad can use.'
}

/** The id a command's shortcut is registered under, kept apart from the launcher's own. */
export function shortcutId(commandId: unknown): string {
  return `launchpad.command.${commandId}`
}

/** The command a fired shortcut belongs to, or null when the event was the launcher's. */
export function commandIdFromShortcut(id: string): string | null {
  return id.startsWith('launchpad.command.') ? id.slice('launchpad.command.'.length) : null
}
