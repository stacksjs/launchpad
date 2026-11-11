import { app, appleScript, clipboard, fs, globalShortcuts, nativeWindow, nativeTray, nativeAutoLaunch, permissions, serviceMenu, shell, showOpenDialog, showSaveDialog, windowEvents, menu, standardMenus } from '@stacksjs/desktop/browser'
import { launcherDiagnostics, launcherTrayMenu, supportLinks } from './tray-menu'
import { createExecutor } from './execution'
import { createApplicationIconLoader } from './application-icons'
import { bookmarkBrowsers, bookmarkFile, bookmarkRoot, maxBookmarks, orderProfiles, parseChromiumBookmarks } from './bookmarks'
import type { Bookmark } from './bookmarks'
import { browseEntries } from './browse'
import type { BrowseEntry } from './browse'
import { clipboardDecision } from './clipboard'
import { PermissionError, describeScriptFailure } from './applescript'
import { contactOpenScript } from './contacts'
import { eventOpenScript } from './calendar'
import { playTrackScript } from './music'
import { readSelection } from './selection'
import type { Selection } from './selection'
import { createSources } from './sources'
import { expandSnippet } from './snippets'
import { commandIdFromShortcut, shortcutId, shortcutPlan } from './shortcuts'
import type { ShortcutHolder } from './shortcuts'
import { runSystemPlan } from './system-commands'
import { windowFocusScript } from './windows'

export { nativeWindow, nativeAutoLaunch, clipboard, shell, windowEvents, menu, standardMenus }

export async function configureTray(show: () => void, settings: () => void, updates: () => void, about: () => void = settings, failed: (reason: unknown) => void = () => {}): Promise<() => void> {
  const stopClick = nativeTray.onClick(() => { void nativeWindow.show().then(() => nativeWindow.focus()).then(show) })
  const open = async () => {
    await nativeWindow.show()
    await nativeWindow.focus()
    show()
  }
  const stopMenu = nativeTray.onMenuAction(event => {
    const action = event.action.replace(/^launchpad\./, '')
    if (action === 'open') void open().catch(failed)
    else if (action === 'settings') settings()
    else if (action === 'updates') updates()
    else if (action === 'about') about()
    else if (action === 'console') void shell.openPath('/System/Applications/Utilities/Console.app').catch(failed)
    else if (action === 'diagnostics') void app.getInfo().then(info => clipboard.writeText(launcherDiagnostics(info))).catch(failed)
    else if (supportLinks[action]) void shell.openExternal(supportLinks[action]!).catch(failed)
  })
  try {
    await nativeWindow.center()
    await nativeTray.setIcon('command')
    await nativeTray.setTitle('')
    await nativeTray.setTooltip('Launchpad · Command + Space')
    await nativeTray.setMenu(launcherTrayMenu)
    return () => {
      stopClick()
      stopMenu()
    }
  }
  catch (reason) {
    stopClick()
    stopMenu()
    throw reason
  }
}

export const applicationIcons = createApplicationIconLoader(path => app.icon(path))

export async function registerLauncher(show: () => void): Promise<() => void> {
  if (!nativeWindow.available) throw new Error('Launchpad requires its native Craft window.')
  const unsubscribe = globalShortcuts.on(async (event) => {
    if (event.id !== 'launchpad.toggle') return
    await nativeWindow.show()
    await nativeWindow.focus()
    show()
  })
  try {
    await globalShortcuts.register('launchpad.toggle', 'Cmd+Space')
    const registered = await globalShortcuts.list()
    if (!registered.some(entry => entry.id === 'launchpad.toggle' && entry.enabled))
      throw new Error('Command + Space is in use. Quit the other launcher or change its shortcut, then reopen Launchpad.')
    return () => {
      unsubscribe()
      void globalShortcuts.unregister('launchpad.toggle')
    }
  }
  catch (error) {
    unsubscribe()
    throw error
  }
}

/**
 * Puts the saved commands' shortcuts in place and reports the ids macOS would not give us. A shortcut another
 * application already owns is only discovered this way: `register` resolves either way, and the entry comes back
 * from `list` disabled, which is the same check the launcher's own shortcut makes.
 */
export async function applyCommandShortcuts(commands: readonly ShortcutHolder[]): Promise<string[]> {
  const registered = await globalShortcuts.list().catch(() => [])
  const { drop, add } = shortcutPlan(commands, registered)
  for (const id of drop) await globalShortcuts.unregister(id).catch(() => {})
  for (const entry of add) await globalShortcuts.register(entry.id, entry.accelerator).catch(() => {})
  if (!add.length) return []
  const settled = await globalShortcuts.list().catch(() => [])
  return add.filter(entry => !settled.some(row => row.id === entry.id && row.enabled)).map(entry => entry.id)
}

/** Fires when a command's own shortcut is pressed, with the command's id. The launcher's own shortcut is not ours. */
export function onCommandShortcut(run: (commandId: string) => void): () => void {
  return globalShortcuts.on((event) => {
    const commandId = commandIdFromShortcut(event.id)
    if (commandId) run(commandId)
  })
}

/** Lets the view name a registration without knowing how ids are built. */
export const commandShortcutId = shortcutId

/** The name macOS advertises this Service under. It has to match `NSMessage` in the bundle, or nothing appears. */
const selectionServiceName = 'searchWithLaunchpad'

/**
 * Offers Launchpad in the Services menu of every app, and reports what was handed over. macOS reads `NSServices` from
 * the installed bundle, so a build without that key registers happily here and still never appears in the menu.
 *
 * Returns a function that withdraws the registration and stops listening.
 */
export async function onSelectionService(run: (selection: Selection) => void): Promise<() => void> {
  const stop = serviceMenu.onInvoked((event) => {
    if (event.name === selectionServiceName) run(readSelection(event.payload))
  })
  const outcome = await serviceMenu.register(selectionServiceName).catch((): { ok: boolean, reason?: string } => ({ ok: false }))
  // A refused registration leaves the listener attached but idle, which costs nothing and keeps the caller simple.
  if (!outcome.ok) return stop
  return () => {
    stop()
    void serviceMenu.unregister(selectionServiceName).catch(() => {})
  }
}

/**
 * Reads the chosen browsers' bookmarks. A browser that is not installed, a profile that cannot be read, and a file
 * the browser happens to be rewriting are each skipped rather than failing the set: one of them must not cost the
 * others. Nothing is read for a browser that was not chosen.
 */
export async function readBookmarks(chosen: readonly string[]): Promise<Bookmark[]> {
  if (!chosen.length) return []
  const home = await fs.homeDir().catch(() => '')
  if (!home) return []
  const found: Bookmark[] = []
  for (const browser of bookmarkBrowsers) {
    if (!chosen.includes(browser.id) || found.length >= maxBookmarks) continue
    const root = bookmarkRoot(home, browser)
    const entries = await fs.readDir(root).catch(() => [])
    const profiles = orderProfiles(entries.filter(entry => entry.isDirectory).map(entry => entry.name))
    for (const profile of profiles) {
      if (found.length >= maxBookmarks) break
      const text = await fs.readFile(bookmarkFile(home, browser, profile)).catch(() => '')
      if (text) found.push(...parseChromiumBookmarks(text, browser.name))
    }
  }
  return found.slice(0, maxBookmarks)
}

/** Where browsing starts and the furthest up it goes. Empty when macOS will not say, which turns browsing off. */
export const homeDirectory = (): Promise<string> => fs.homeDir().then(path => path || '').catch(() => '')

/** Lists a folder. One that cannot be read gives an empty listing rather than throwing, as a search would. */
export async function readDirectory(path: string): Promise<BrowseEntry[]> {
  const entries = await fs.readDir(path).catch(() => [])
  return browseEntries(entries.map(entry => ({ name: entry.name, path: entry.path, isDirectory: entry.isDirectory })))
}

/** Settings that change how a launch behaves. The launcher view keeps this in step with the saved preference. */
export const behavior = { paste: false }

const runScript = (source: string) => appleScript.execute(source)
/** `app` is the application the script talks to, so a refusal names the Automation switch that has to be on. */
async function script(source: string | null, app: string, refusal: string) {
  if (!source) throw new Error(refusal)
  const outcome = await runScript(source)
  if (!outcome.ok) {
    const { message, permission } = describeScriptFailure(app, outcome)
    throw new PermissionError(`${refusal} ${message}`, permission)
  }
}

/** Type Command V into the app that regains focus when the palette hides. Needs the Accessibility permission. */
export async function pasteIntoFrontmost(): Promise<void> {
  if (await permissions.check('accessibility') !== 'granted') {
    await permissions.request('accessibility').catch(() => {})
    throw new Error('Allow Launchpad under System Settings > Privacy & Security > Accessibility to paste snippets into other apps.')
  }
  // The palette is hiding; wait for macOS to hand focus back before sending the keystroke.
  await new Promise(resolve => setTimeout(resolve, 180))
  await script('tell application "System Events" to keystroke "v" using command down', 'System Events', 'Launchpad could not paste.')
}

/**
 * The shell bridge opens web and file links only and drops every other scheme without an error, so a System Settings
 * address is handed to `open` instead. Nothing a user typed reaches it: the addresses are the fixed ones in this app.
 */
const openSettings = (url: string) => shell.spawn(`settings-${Date.now()}`, '/usr/bin/open', [url])

export const execute = createExecutor({
  openApplication: path => shell.openPath(path), openLink: url => shell.openExternal(url), copyText: text => clipboard.writeText(text), dismiss: () => nativeWindow.hide(),
  restore: async () => {
    await nativeWindow.show()
    await nativeWindow.focus()
  },
  openPath: path => shell.openPath(path),
  runSystem: command => runSystemPlan(command, {
    appleScript: runScript,
    spawn: (program, args) => shell.spawn(`system-${command.id}-${Date.now()}`, program, [...args]),
    openUrl: openSettings,
    openPath: path => shell.openPath(path),
  }),
  focusWindow: token => script(windowFocusScript(token), 'System Events', 'Launchpad could not switch to that window.'),
  openContact: id => script(contactOpenScript(id), 'Contacts', 'Launchpad could not open that contact.'),
  openEvent: uid => script(eventOpenScript(uid), 'Calendar', 'Launchpad could not open that event.'),
  playTrack: id => script(playTrackScript(id), 'Music', 'Launchpad could not play that track.'),
  expandText: text => expandSnippet(text, { now: new Date(), uuid: () => crypto.randomUUID(), clipboard: () => clipboard.readText().then(value => value ?? '') }),
  pasteText: async () => { if (behavior.paste) await pasteIntoFrontmost() },
})

export const sources = createSources({
  appleScript: runScript,
  accessibility: () => permissions.check('accessibility'),
  requestAccessibility: () => permissions.request('accessibility'),
})

export const revealInFinder = (path: string) => shell.showInFinder(path)

/**
 * Asking for a file or a folder through the system's own dialog.
 *
 * Launchpad never picks a path on someone's behalf: the place a settings file is written to, or read from, is chosen
 * in the dialog macOS puts up, and a cancelled dialog returns nothing rather than a guess. In the sandboxed build
 * this is also what grants access to the place they picked.
 */
export async function chooseSaveFile(name: string): Promise<string> {
  const result = await showSaveDialog({ title: 'Export Launchpad Settings', defaultPath: name, buttonLabel: 'Export', filters: [{ name: 'Launchpad Settings', extensions: ['json'] }], canCreateDirectories: true })
  return result.canceled ? '' : result.filePath ?? ''
}

export async function chooseOpenFile(): Promise<string> {
  const result = await showOpenDialog({ title: 'Import Launchpad Settings', buttonLabel: 'Open', filters: [{ name: 'Launchpad Settings', extensions: ['json'] }], canChooseFiles: true, canChooseDirectories: false })
  return result.canceled ? '' : result.filePaths[0] ?? ''
}

export async function chooseFolder(): Promise<string> {
  const result = await showOpenDialog({ title: 'Choose a Folder for Launchpad Settings', buttonLabel: 'Choose', canChooseFiles: false, canChooseDirectories: true, canCreateDirectories: true })
  return result.canceled ? '' : result.filePaths[0] ?? ''
}
export const openPrivacySettings = (name: 'accessibility' | 'automation') => name === 'accessibility' ? permissions.openSettings('accessibility') : openSettings('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation')

export async function captureClipboard(): Promise<string> {
  const content = await clipboard.readText()
  const decision = clipboardDecision(content)
  if (decision === 'empty') throw new Error('There is no text on the clipboard, or macOS has denied access.')
  if (decision === 'too-large') throw new Error('Clipboard text is too large to save.')
  return content
}
