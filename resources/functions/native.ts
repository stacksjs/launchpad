import { app, appleScript, clipboard, globalShortcuts, nativeWindow, nativeTray, nativeAutoLaunch, permissions, shell, windowEvents, menu, standardMenus } from '@stacksjs/desktop/browser'
import { createExecutor } from './execution'
import { createApplicationIconLoader } from './application-icons'
import { clipboardDecision } from './clipboard'
import { describeScriptFailure } from './applescript'
import { contactOpenScript } from './contacts'
import { eventOpenScript } from './calendar'
import { createSources } from './sources'
import { expandSnippet } from './snippets'
import { runSystemPlan } from './system-commands'
import { windowFocusScript } from './windows'

export { nativeWindow, nativeAutoLaunch, clipboard, shell, windowEvents, menu, standardMenus }

export async function configureTray(show: () => void, settings: () => void, updates: () => void): Promise<() => void> {
  const stopClick = nativeTray.onClick(() => { void nativeWindow.show().then(() => nativeWindow.focus()).then(show) })
  const stopMenu = nativeTray.onMenuAction(event => {
    if (event.action === 'launchpad.settings') settings()
    if (event.action === 'launchpad.updates') updates()
  })
  try {
    await nativeWindow.center()
    await nativeTray.setIcon('command')
    await nativeTray.setTitle('')
    await nativeTray.setTooltip('Launchpad · Command + Space')
    await nativeTray.setMenu([
      { label: 'Open Launchpad', action: 'show' },
      { label: 'Settings...', action: 'launchpad.settings' },
      { label: 'Check for Updates...', action: 'launchpad.updates' },
      { type: 'separator' },
      { label: 'Quit Launchpad', action: 'quit' },
    ])
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

/** Settings that change how a launch behaves. The launcher view keeps this in step with the saved preference. */
export const behavior = { paste: false }

const runScript = (source: string) => appleScript.execute(source)
async function script(source: string | null, refusal: string) {
  if (!source) throw new Error(refusal)
  const outcome = await runScript(source)
  if (!outcome.ok) throw new Error(`${refusal} ${describeScriptFailure('that app', outcome).message}`)
}

/** Type Command V into the app that regains focus when the palette hides. Needs the Accessibility permission. */
export async function pasteIntoFrontmost(): Promise<void> {
  if (await permissions.check('accessibility') !== 'granted') {
    await permissions.request('accessibility').catch(() => {})
    throw new Error('Allow Launchpad under System Settings > Privacy & Security > Accessibility to paste snippets into other apps.')
  }
  // The palette is hiding; wait for macOS to hand focus back before sending the keystroke.
  await new Promise(resolve => setTimeout(resolve, 180))
  await script('tell application "System Events" to keystroke "v" using command down', 'Launchpad could not paste.')
}

export const execute = createExecutor({
  openApplication: path => shell.openPath(path), openLink: url => shell.openExternal(url), copyText: text => clipboard.writeText(text), dismiss: () => nativeWindow.hide(),
  openPath: path => shell.openPath(path),
  runSystem: command => runSystemPlan(command, {
    appleScript: runScript,
    spawn: (program, args) => shell.spawn(`system-${command.id}-${Date.now()}`, program, [...args]),
    openUrl: url => shell.openExternal(url),
    openPath: path => shell.openPath(path),
  }),
  focusWindow: token => script(windowFocusScript(token), 'Launchpad could not switch to that window.'),
  openContact: id => script(contactOpenScript(id), 'Launchpad could not open that contact.'),
  openEvent: uid => script(eventOpenScript(uid), 'Launchpad could not open that event.'),
  expandText: text => expandSnippet(text, { now: new Date(), uuid: () => crypto.randomUUID(), clipboard: () => clipboard.readText().then(value => value ?? '') }),
  pasteText: async () => { if (behavior.paste) await pasteIntoFrontmost() },
})

export const sources = createSources({
  appleScript: runScript,
  accessibility: () => permissions.check('accessibility'),
  requestAccessibility: () => permissions.request('accessibility'),
})

export const revealInFinder = (path: string) => shell.showInFinder(path)
export const openPrivacySettings = (name: 'accessibility' | 'automation') => name === 'accessibility' ? permissions.openSettings('accessibility') : shell.openExternal('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation')

export async function captureClipboard(): Promise<string> {
  const content = await clipboard.readText()
  const decision = clipboardDecision(content)
  if (decision === 'empty') throw new Error('There is no text on the clipboard, or macOS has denied access.')
  if (decision === 'too-large') throw new Error('Clipboard text is too large to save.')
  return content
}
