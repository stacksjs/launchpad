import { recordSuccessfulOperation } from './activity'
import { quicklinkArgument, quicklinkUrl } from './search'
import type { Result } from './search'
import { systemCommand } from './system-commands'
import type { SystemCommand } from './system-commands'

interface ExecutionPorts {
  openApplication: (path: string) => Promise<void>
  openLink: (url: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  dismiss: () => Promise<void>
  /** Open a file or folder with its default application. Falls back to the application opener. */
  openPath?: (path: string) => Promise<void>
  runSystem?: (command: SystemCommand) => Promise<void>
  focusWindow?: (token: string) => Promise<void>
  openContact?: (id: string) => Promise<void>
  openEvent?: (uid: string) => Promise<void>
  /** Resolve snippet placeholders such as {date} and {clipboard} just before use. */
  expandText?: (text: string) => Promise<string>
  /** Type the copied text into the app that was in front, after the palette is hidden. */
  pasteText?: (text: string) => Promise<void>
}

/** The same dispatch path is used by search and Pantry application details. */
export function createExecutor(ports: ExecutionPorts) {
  return async (result: Result, query: string, recorded: (durationMs: number) => void | Promise<void> = () => {}): Promise<void> => {
    if (result.kind === 'pantry') throw new Error('Open the package details to install with Pantry.')
    let pasted = ''
    // Queue confirmed activity without letting its persistence hold the window open.
    await recordSuccessfulOperation(async () => {
      if (result.kind === 'application') await ports.openApplication(result.content)
      else if (result.kind === 'github') await ports.openLink(result.content)
      else if (result.kind === 'quicklink') await ports.openLink(quicklinkUrl(result.content, quicklinkArgument(result, query) ?? ''))
      else if (result.kind === 'web') await ports.openLink(quicklinkUrl(result.content, query.trim()))
      else if (result.kind === 'file') await (ports.openPath ?? ports.openApplication)(result.content)
      else if (result.kind === 'system') {
        const command = systemCommand(result.content)
        if (!command || !ports.runSystem) throw new Error('That system command is not available.')
        await ports.runSystem(command)
      }
      else if (result.kind === 'window') {
        if (!ports.focusWindow) throw new Error('Window switching is not available.')
        await ports.focusWindow(result.content)
      }
      else if (result.kind === 'contact') {
        if (!ports.openContact) throw new Error('Contacts is not available.')
        await ports.openContact(result.content)
      }
      else if (result.kind === 'event') {
        if (!ports.openEvent) throw new Error('Calendar is not available.')
        await ports.openEvent(result.content)
      }
      else if (result.kind === 'snippet') {
        pasted = ports.expandText ? await ports.expandText(result.content) : result.content
        await ports.copyText(pasted)
      }
      else await ports.copyText(result.content)
    }, duration => Promise.all([
      Promise.resolve().then(() => recorded(duration)),
      Promise.resolve().then(() => ports.dismiss()),
    ]).then(() => {}))
    // Pasting waits for the palette to hide so the keystroke reaches the previous app. A failure keeps the copy.
    if (pasted && ports.pasteText) await ports.pasteText(pasted).catch(() => {})
  }
}
