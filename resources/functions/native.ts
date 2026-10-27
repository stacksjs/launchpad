import { app, clipboard, globalShortcuts, nativeWindow, shell, windowEvents, menu, standardMenus } from '@stacksjs/desktop/browser'
import { createExecutor } from './execution'

export { nativeWindow, clipboard, shell, windowEvents, menu, standardMenus }

export async function applicationIcons(paths: string[]): Promise<Record<string, string>> {
  const icons: Record<string, string> = {}
  let index = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < paths.length) {
      const path = paths[index++]!
      const icon = await app.icon(path)
      if (icon) icons[path] = icon
    }
  }))
  return icons
}

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
