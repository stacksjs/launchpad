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

export interface ScriptOutcome { ok: boolean, result?: string, error?: { code?: number, message?: string } }
export interface ScriptFailure { message: string, permission?: 'accessibility' | 'automation' }

/**
 * What to tell someone when a script did not run. Newer Craft hosts report the AppleScript error number, which separates
 * a refused permission from a script that broke; older hosts report only that it failed, so the permission hint stays the
 * default. `app` is the name of the app the script was talking to.
 */
export function describeScriptFailure(app: string, outcome: ScriptOutcome): ScriptFailure {
  const code = typeof outcome.error?.code === 'number' ? outcome.error.code : undefined
  const automation: ScriptFailure = { message: `Allow Launchpad to control ${app} under System Settings > Privacy & Security > Automation, then try again.`, permission: 'automation' }
  if (code === undefined) return automation
  if (code === -1743 || code === -1744) return automation
  if (code === -25211 || code === -1719) return { message: 'Allow Launchpad under System Settings > Privacy & Security > Accessibility, then try again.', permission: 'accessibility' }
  if (code === -128) return { message: 'The request was cancelled.' }
  if (code === -600) return { message: `${app} is not running and could not be opened.` }
  const detail = outcome.error?.message?.trim()
  return { message: detail ? `${app} could not do that: ${detail}` : `${app} could not do that (error ${code}).` }
}
