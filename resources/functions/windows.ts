import { appleScriptString, cleanField, parseRecords } from './applescript'
import type { Result } from './search'

export interface WindowEntry { pid: number, index: number, app: string, title: string }

/** One line per window of every regular app: pid, window number, app name, window title. Needs Accessibility. */
export const windowListScript = `set output to ""
tell application "System Events"
  repeat with p in (every process whose background only is false)
    try
      set processName to name of p
      set processId to unix id of p
      set i to 0
      repeat with w in (windows of p)
        set i to i + 1
        set t to ""
        try
          set t to name of w as text
        end try
        set output to output & processId & tab & i & tab & processName & tab & t & linefeed
      end repeat
    end try
  end repeat
end tell
return output`

export function parseWindows(output: string, hide = ['Launchpad']): WindowEntry[] {
  return parseRecords(output, 4).flatMap(([pid, index, app, title]) => {
    const entry = { pid: Number(pid), index: Number(index), app: cleanField(app), title: cleanField(title) }
    return Number.isInteger(entry.pid) && entry.pid > 0 && Number.isInteger(entry.index) && entry.index > 0 && entry.index < 1000 && entry.app && !hide.includes(entry.app) ? [entry] : []
  })
}

/** The result token carries what is needed to find the window again; it is validated before use. */
const token = (entry: WindowEntry) => JSON.stringify({ pid: entry.pid, index: entry.index, title: entry.title.slice(0, 300) })

export function windowResults(entries: readonly WindowEntry[]): Result[] {
  return entries.map(entry => ({
    key: `window:${entry.pid}:${entry.index}`, title: entry.title || 'Untitled window', subtitle: `${entry.app} · Window`, kind: 'window', content: token(entry),
    searchAliases: [entry.app], searchText: entry.app,
  }))
}

/** Bring the app forward and raise the window, matching by title and falling back to its position. Null for an invalid token. */
export function windowFocusScript(value: string): string | null {
  let parsed: unknown
  try { parsed = JSON.parse(value) }
  catch { return null }
  if (!parsed || typeof parsed !== 'object') return null
  const { pid, index, title } = parsed as Record<string, unknown>
  if (!Number.isInteger(pid) || (pid as number) <= 0 || !Number.isInteger(index) || (index as number) < 1 || (index as number) > 999 || typeof title !== 'string') return null
  return `tell application "System Events"
  set target to first process whose unix id is ${pid}
  set frontmost of target to true
  try
    perform action "AXRaise" of (first window of target whose name is ${appleScriptString(title)})
  on error
    try
      perform action "AXRaise" of window ${index} of target
    end try
  end try
end tell`
}
