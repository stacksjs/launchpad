import { contactResults, contactSearchScript, parseContacts } from './contacts'
import { eventResults, parseEvents, upcomingEventsScript } from './calendar'
import { parseWindows, windowListScript, windowResults } from './windows'
import type { Result } from './search'

/** A failure the person can act on, with the permission to visit when there is one. */
export class SourceError extends Error {
  constructor(message: string, readonly permission?: 'accessibility' | 'automation') { super(message) }
}

export interface SourcePorts {
  appleScript: (source: string) => Promise<{ ok: boolean, result?: string }>
  /** Accessibility permission as reported by macOS. */
  accessibility: () => Promise<string>
  requestAccessibility?: () => Promise<unknown>
}

const automation = (app: string) => new SourceError(`Allow Launchpad to control ${app} under System Settings > Privacy & Security > Automation, then search again.`, 'automation')

/** Live views of other apps. Nothing here is stored: each call asks the app and returns fresh rows. */
export function createSources(ports: SourcePorts) {
  return {
    async windows(): Promise<Result[]> {
      if (await ports.accessibility() !== 'granted') {
        await ports.requestAccessibility?.().catch(() => {})
        throw new SourceError('Allow Launchpad under System Settings > Privacy & Security > Accessibility to list and switch windows.', 'accessibility')
      }
      const outcome = await ports.appleScript(windowListScript)
      if (!outcome.ok) throw automation('System Events')
      return windowResults(parseWindows(outcome.result ?? ''))
    },
    async contacts(query: string): Promise<Result[]> {
      const text = query.trim()
      if (text.length < 2) return []
      const outcome = await ports.appleScript(contactSearchScript(text))
      if (!outcome.ok) throw automation('Contacts')
      return contactResults(parseContacts(outcome.result ?? ''))
    },
    async events(now = new Date()): Promise<Result[]> {
      const outcome = await ports.appleScript(upcomingEventsScript)
      if (!outcome.ok) throw automation('Calendar')
      return eventResults(parseEvents(outcome.result ?? ''), now)
    },
  }
}

/** The newest request wins. Older answers, and answers that arrive after a cancel, are dropped. */
export function createLatest<T>(load: (input: string, signal: AbortSignal) => Promise<T>, handlers: { start?: () => void, result: (value: T) => void, error: (reason: unknown) => void, done?: () => void }) {
  let epoch = 0
  let controller: AbortController | null = null
  const cancel = () => {
    epoch++
    controller?.abort()
    controller = null
  }
  const run = async (input: string) => {
    cancel()
    const mine = epoch
    const own = controller = new AbortController()
    handlers.start?.()
    try {
      const value = await load(input, own.signal)
      if (mine === epoch) handlers.result(value)
    }
    catch (reason) { if (mine === epoch) handlers.error(reason) }
    finally { if (mine === epoch) handlers.done?.() }
  }
  return Object.assign(run, { cancel })
}
