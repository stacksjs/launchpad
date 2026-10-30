import { recordSuccessfulOperation } from './activity'
import { quicklinkArgument, quicklinkUrl } from './search'
import type { Result } from './search'

interface ExecutionPorts {
  openApplication: (path: string) => Promise<void>
  openLink: (url: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  dismiss: () => Promise<void>
}

/** The same dispatch path is used by search and Pantry application details. */
export function createExecutor(ports: ExecutionPorts) {
  return async (result: Result, query: string, recorded: (durationMs: number) => void | Promise<void> = () => {}): Promise<void> => {
    if (result.kind === 'pantry') throw new Error('Open the package details to install with Pantry.')
    // Queue confirmed activity without letting its persistence hold the window open.
    await recordSuccessfulOperation(async () => {
      if (result.kind === 'application') await ports.openApplication(result.content)
      else if (result.kind === 'github') await ports.openLink(result.content)
      else if (result.kind === 'quicklink') await ports.openLink(quicklinkUrl(result.content, quicklinkArgument(result, query) ?? ''))
      else await ports.copyText(result.content)
    }, duration => Promise.all([
      Promise.resolve().then(() => recorded(duration)),
      Promise.resolve().then(() => ports.dismiss()),
    ]).then(() => {}))
  }
}
