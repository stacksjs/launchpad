import { describeScriptFailure } from './applescript'
import type { ScriptOutcome } from './applescript'
import { contactResults, contactSearchScript, parseContacts } from './contacts'
import { eventResults, parseEvents, upcomingEventsScript } from './calendar'
import { parseWindows, windowListScript, windowResults } from './windows'
import type { Result } from './search'

/** A failure the person can act on, with the permission to visit when there is one. */
export class SourceError extends Error {
  constructor(message: string, readonly permission?: 'accessibility' | 'automation') { super(message) }
}

export interface SourcePorts {
  appleScript: (source: string) => Promise<ScriptOutcome>
  /** Accessibility permission as reported by macOS. */
  accessibility: () => Promise<string>
  requestAccessibility?: () => Promise<unknown>
}

function failure(app: string, outcome: ScriptOutcome): SourceError {
  const { message, permission } = describeScriptFailure(app, outcome)
  return new SourceError(message, permission)
}

/** Live views of other apps. Nothing here is stored: each call asks the app and returns fresh rows. */
export function createSources(ports: SourcePorts, options: { now?: () => number, cacheMs?: number } = {}) {
  const now = options.now ?? Date.now
  const cacheMs = options.cacheMs ?? 30_000
  const found = new Map<string, { at: number, results: Result[] }>()
  return {
    async windows(): Promise<Result[]> {
      if (await ports.accessibility() !== 'granted') {
        await ports.requestAccessibility?.().catch(() => {})
        throw new SourceError('Allow Launchpad under System Settings > Privacy & Security > Accessibility to list and switch windows.', 'accessibility')
      }
      const outcome = await ports.appleScript(windowListScript)
      if (!outcome.ok) throw failure('System Events', outcome)
      return windowResults(parseWindows(outcome.result ?? ''))
    },
    async contacts(query: string): Promise<Result[]> {
      const text = query.trim()
      if (text.length < 2) return []
      // Contacts is slow to search on a large address book, so repeating a search or backspacing is answered from memory.
      const key = text.toLocaleLowerCase()
      const previous = found.get(key)
      if (previous && now() - previous.at < cacheMs) return previous.results
      const outcome = await ports.appleScript(contactSearchScript(text))
      if (!outcome.ok) throw failure('Contacts', outcome)
      const results = contactResults(parseContacts(outcome.result ?? ''))
      found.delete(key)
      found.set(key, { at: now(), results })
      while (found.size > 20) found.delete(found.keys().next().value!)
      return results
    },
    async events(now = new Date()): Promise<Result[]> {
      const outcome = await ports.appleScript(upcomingEventsScript)
      if (!outcome.ok) throw failure('Calendar', outcome)
      return eventResults(parseEvents(outcome.result ?? ''), now)
    },
  }
}

/**
 * The newest request wins. Older answers, and answers that arrive after a cancel, are dropped.
 * With `serial`, a call that is still running is never overlapped: the newest request waits its turn and replaces any
 * request already waiting. That is how scripts that cannot be cancelled are kept from piling up.
 */
export function createLatest<T>(load: (input: string, signal: AbortSignal) => Promise<T>, handlers: { start?: () => void, result: (value: T) => void, error: (reason: unknown) => void, done?: () => void }, options: { serial?: boolean } = {}) {
  let epoch = 0
  let controller: AbortController | null = null
  let running = false
  let queued: { input: string, resolve: () => void } | null = null

  const settle = () => {
    queued?.resolve()
    queued = null
  }
  const cancel = () => {
    epoch++
    controller?.abort()
    controller = null
    settle()
  }
  const execute = async (input: string): Promise<void> => {
    const mine = epoch
    const own = controller = new AbortController()
    running = true
    handlers.start?.()
    try {
      const value = await load(input, own.signal)
      if (mine === epoch) handlers.result(value)
    }
    catch (reason) { if (mine === epoch) handlers.error(reason) }
    finally {
      running = false
      if (mine === epoch) handlers.done?.()
    }
  }
  const drain = async () => {
    while (queued && !running) {
      const next = queued
      queued = null
      await execute(next.input)
      next.resolve()
    }
  }
  const run = async (input: string): Promise<void> => {
    if (options.serial && running) {
      // The running call's answer is already out of date, so it is dropped; the newest request takes its place in line.
      epoch++
      controller?.abort()
      settle()
      const waiting = new Promise<void>((resolve) => { queued = { input, resolve } })
      return waiting
    }
    cancel()
    await execute(input)
    if (options.serial) await drain()
  }
  return Object.assign(run, { cancel, busy: () => running })
}
