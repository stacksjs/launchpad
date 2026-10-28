import { app, clipboard, globalShortcuts, nativeWindow, nativeTray, nativeAutoLaunch, shell, windowEvents, menu, standardMenus } from '@stacksjs/desktop/browser'
import { createExecutor } from './execution'
import { createApplicationIconLoader } from './application-icons'

export { nativeWindow, nativeAutoLaunch, clipboard, shell, windowEvents, menu, standardMenus }

export async function configureTray(show: () => void, settings: () => void): Promise<() => void> {
  const stopClick = nativeTray.onClick(() => { void nativeWindow.show().then(() => nativeWindow.focus()).then(show) })
  const stopMenu = nativeTray.onMenuAction(event => { if (event.action === 'launchpad.settings') settings() })
  try {
    await nativeWindow.center()
    await nativeTray.setIcon('command')
    await nativeTray.setTitle('')
    await nativeTray.setTooltip('Launchpad · Command + Space')
    await nativeTray.setMenu([
      { label: 'Open Launchpad', action: 'show' },
      { label: 'Settings...', action: 'launchpad.settings' },
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

export const execute = createExecutor({ openApplication: path => shell.openPath(path), openLink: url => shell.openExternal(url), copyText: text => clipboard.writeText(text), dismiss: () => nativeWindow.hide() })

export async function captureClipboard(): Promise<string> {
  const content = await clipboard.readText()
  if (!content) throw new Error('There is no text on the clipboard, or macOS has denied access.')
  if (content.length > 20000) throw new Error('Clipboard text is too large to save.')
  return content
}
