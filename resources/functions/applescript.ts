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
