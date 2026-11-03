import { expect, test } from 'bun:test'
import {
  commandIdFromShortcut, formatShortcut, launcherShortcut, normalizeShortcut,
  reservedShortcuts, shortcutError, shortcutFromEvent, shortcutId,
} from '../resources/functions/shortcuts'

test('a shortcut is stored in one spelling however it was written', () => {
  expect(normalizeShortcut('cmd+shift+k')).toBe('Cmd+Shift+K')
  expect(normalizeShortcut('Shift+Cmd+K')).toBe('Cmd+Shift+K')
  expect(normalizeShortcut('⌘⇧+K'.replace('⌘⇧', '⌘+⇧'))).toBe('Cmd+Shift+K')
  expect(normalizeShortcut('Command + Option + J')).toBe('Cmd+Alt+J')
  expect(normalizeShortcut('control+enter')).toBe('Ctrl+Return')
  expect(normalizeShortcut('cmd+backspace')).toBe('Cmd+Delete')
  expect(normalizeShortcut('cmd+arrowup')).toBe('Cmd+Up')
  expect(normalizeShortcut('cmd+f12')).toBe('Cmd+F12')
  expect(normalizeShortcut('cmd+,')).toBe('Cmd+,')
  // Modifiers are a set, so repeating one does not change the result.
  expect(normalizeShortcut('cmd+cmd+k')).toBe('Cmd+K')
})

test('anything unreadable is refused rather than half understood', () => {
  for (const bad of ['', '   ', '+', 'cmd+', 'cmd', 'shift', 'cmd+k+j', 'cmd+f13', 'cmd+€', 'cmd+ab', null, 7, {}])
    expect(normalizeShortcut(bad)).toBeNull()
})

test('a shortcut is shown the way a Mac shows it', () => {
  expect(formatShortcut('cmd+shift+k')).toBe('⌘⇧K')
  expect(formatShortcut('Ctrl+Alt+Return')).toBe('⌃⌥↩')
  expect(formatShortcut('cmd+delete')).toBe('⌘⌫')
  expect(formatShortcut('Cmd+Space')).toBe('⌘Space')
  expect(formatShortcut('nonsense')).toBe('')
})

test('a key press becomes a shortcut, and a lone modifier does not', () => {
  expect(shortcutFromEvent({ key: 'k', metaKey: true, shiftKey: true })).toBe('Cmd+Shift+K')
  expect(shortcutFromEvent({ key: 'Enter', ctrlKey: true })).toBe('Ctrl+Return')
  // Still reaching for the shortcut, not the shortcut.
  for (const key of ['Meta', 'Shift', 'Alt', 'Control']) expect(shortcutFromEvent({ key, metaKey: true })).toBeNull()
  expect(shortcutFromEvent({ key: 'k' })).toBe('K')
})

test('a global shortcut has to carry a modifier that is not Shift alone', () => {
  expect(shortcutError('Cmd+Shift+K')).toBeNull()
  expect(shortcutError('Ctrl+J')).toBeNull()
  expect(shortcutError('Alt+Space')).toBeNull()
  // Without one it would swallow an ordinary keystroke in every other app.
  expect(shortcutError('K')).toContain('Add Command, Control or Option')
  expect(shortcutError('Shift+K')).toContain('Shift on its own')
  expect(shortcutError('nope')).toBe('That is not a shortcut Launchpad can use.')
})

test('the app\'s own keys cannot be taken', () => {
  expect(shortcutError(launcherShortcut)).toContain("Launchpad's own")
  for (const reserved of reservedShortcuts) expect(shortcutError(reserved)).toContain("Launchpad's own")
  // The same key written differently is still the same key.
  expect(shortcutError('shift+cmd+v')).toContain("Launchpad's own")
})

test('two commands cannot share a shortcut, but a command keeps its own', () => {
  const taken = [{ id: 1, title: 'Open inbox', shortcut: 'Cmd+Shift+I' }, { id: 2, title: 'Notes', shortcut: 'cmd+alt+n' }]
  expect(shortcutError('Cmd+Shift+I', taken)).toBe('⌘⇧I already runs "Open inbox".')
  // Written another way, it is still taken.
  expect(shortcutError('shift+cmd+i', taken)).toContain('already runs')
  expect(shortcutError('Cmd+Alt+N', taken)).toContain('"Notes"')
  // Editing a command does not report it conflicting with itself.
  expect(shortcutError('Cmd+Shift+I', taken, 1)).toBeNull()
  expect(shortcutError('Cmd+Shift+Y', taken)).toBeNull()
  // A command with no shortcut is never a conflict.
  expect(shortcutError('Cmd+Shift+Y', [{ id: 3, title: 'Empty', shortcut: '' }])).toBeNull()
})

test('a registration id maps back to the command it belongs to', () => {
  expect(shortcutId(42)).toBe('launchpad.command.42')
  expect(commandIdFromShortcut(shortcutId(42))).toBe('42')
  expect(commandIdFromShortcut('launchpad.toggle')).toBeNull()
})
