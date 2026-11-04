/**
 * A quoted AppleScript string literal. Control characters become spaces, then backslashes and quotes are escaped,
 * so text from a window title or a search can never end the literal and add code.
 */
export function appleScriptString(value: string): string {
  const clean = value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ')
  return `"${clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Fields come back tab separated and records line separated. Neither may appear inside a value. */
export function parseRecords(output: string, fields: number): string[][] {
  return output.split(/\r?\n|\r/).filter(line => line.trim()).map(line => line.split('\t')).filter(parts => parts.length === fields)
}

/** AppleScript renders a missing value as this text. */
export const cleanField = (value: string | undefined) => {
  const text = (value ?? '').trim()
  return text === 'missing value' ? '' : text
}

/**
 * `error` is what a host that reports AppleScript error numbers returns. `reason` is what the Craft runtime returns
 * when the bridge itself could not start, such as `NSAppleScript unavailable`: no Apple event is ever sent, so nothing
 * is refused and nothing appears in the Automation pane. Craft's own `AppleScriptResult` declares neither.
 */
export interface ScriptOutcome { ok: boolean, result?: string, reason?: string, error?: { code?: number, message?: string } }
export interface ScriptFailure { message: string, permission?: 'accessibility' | 'automation' }

/** A failure the person can act on, carrying the privacy pane that settles it when there is one. */
export class PermissionError extends Error {
  constructor(message: string, readonly permission?: 'accessibility' | 'automation') { super(message) }
}

/**
 * The Automation pane has no way to add an app: a row for Launchpad appears only once macOS has asked, and each app
 * Launchpad controls is a separate switch underneath it. So the advice names both the prompt and the switch, instead of
 * sending someone to a pane that may still be empty.
 */
const automationAdvice = (app: string) => `Launchpad needs your permission to control ${app}. Choose OK when macOS asks, or, if you answered Don't Allow before, switch ${app} on under Launchpad in System Settings > Privacy & Security > Automation.`

/**
 * What to tell someone when a script did not run. The pinned Craft runtime reports what the Apple event itself did, as an
 * error number or a message, which separates a refused permission from a script that broke. `app` is the name of the app
 * the script was talking to.
 */
export function describeScriptFailure(app: string, outcome: ScriptOutcome): ScriptFailure {
  const code = typeof outcome.error?.code === 'number' ? outcome.error.code : undefined
  const detail = outcome.error?.message?.trim()
  const reason = outcome.reason?.trim()
  // A failure carrying neither an error nor a reason never left the bridge: the host answers a dispatched event with one
  // or the other. A script that never ran was never refused, so sending someone to a privacy pane would waste their time.
  if (code === undefined && !detail) {
    const because = reason ? ` (${reason})` : ''
    return { message: `The script never reached ${app}${because}, so no permission is missing.` }
  }
  if (code === -1743 || code === -1744) return { message: automationAdvice(app), permission: 'automation' }
  if (code === -25211 || code === -1719) return { message: 'Allow Launchpad under System Settings > Privacy & Security > Accessibility, then try again.', permission: 'accessibility' }
  if (code === -128) return { message: 'The request was cancelled.' }
  if (code === -600) return { message: `${app} is not running and could not be opened.` }
  // A dialog of the app's own, such as the Finder warning before the Trash is emptied, holds the event open until it times out.
  if (code === -1712) return { message: `${app} is waiting for an answer. Switch to ${app}, finish what it is asking, then try again.` }
  return { message: detail ? `${app} could not do that: ${detail}` : `${app} could not do that (error ${code}).` }
}
