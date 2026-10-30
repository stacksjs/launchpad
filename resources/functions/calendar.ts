import { appleScriptString, cleanField, parseRecords } from './applescript'
import type { Result } from './search'

export interface EventEntry { uid: string, title: string, start: number, allDay: boolean, calendar: string }

export const eventDays = 14
export const maxEvents = 60
/** Calendar identifiers are UUIDs, sometimes with a recurrence suffix. */
export const eventUid = /^[A-Za-z0-9][A-Za-z0-9:@_.\/+=-]{0,200}$/

/** Upcoming events in every calendar, newest first by start. Dates come back in ISO 8601 local time. */
export const upcomingEventsScript = `set output to ""
set windowStart to current date
set windowEnd to windowStart + (${eventDays} * days)
tell application "Calendar"
  repeat with c in calendars
    try
      set found to (every event of c whose start date is greater than or equal to windowStart and start date is less than or equal to windowEnd)
      set total to count of found
      if total > ${maxEvents} then set total to ${maxEvents}
      repeat with i from 1 to total
        set e to item i of found
        set output to output & (uid of e) & tab & (summary of e) & tab & ((start date of e) as «class isot» as string) & tab & (allday event of e) & tab & (name of c) & linefeed
      end repeat
    end try
  end repeat
end tell
return output`

/** Local ISO text without a zone, such as 2026-10-30T09:00:00, is read in the local time zone. */
export function parseLocalIso(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number]
  const date = new Date(year, month - 1, day, hour, minute, second)
  return Number.isFinite(date.getTime()) && date.getMonth() === month - 1 ? date.getTime() : null
}

export function parseEvents(output: string): EventEntry[] {
  return parseRecords(output, 5).flatMap(([uid, title, start, allDay, calendar]) => {
    const time = parseLocalIso(start ?? '')
    const entry = { uid: cleanField(uid), title: cleanField(title) || 'Untitled event', start: time ?? 0, allDay: cleanField(allDay) === 'true', calendar: cleanField(calendar) }
    return time !== null && eventUid.test(entry.uid) ? [entry] : []
  }).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** "Today 14:30", "Tomorrow", "Mon, Nov 2 09:00". All-day events omit the time. */
export function describeEventStart(entry: Pick<EventEntry, 'start' | 'allDay'>, now = new Date()): string {
  const start = new Date(entry.start)
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
  const day = sameDay(start, now) ? 'Today' : sameDay(start, tomorrow) ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return entry.allDay ? day : `${day} ${time}`
}

export function eventResults(entries: readonly EventEntry[], now = new Date()): Result[] {
  return entries.map(entry => ({
    key: `event:${entry.uid}`, title: entry.title, subtitle: `${describeEventStart(entry, now)} · ${entry.calendar || 'Calendar'}`, kind: 'event', content: entry.uid,
    searchText: entry.calendar,
  }))
}

/** Show an event in Calendar. Null when the identifier is not one Calendar could have produced. */
export function eventOpenScript(uid: string): string | null {
  if (!eventUid.test(uid)) return null
  return `tell application "Calendar"
  activate
  repeat with c in calendars
    try
      set found to (every event of c whose uid is ${appleScriptString(uid)})
      if (count of found) > 0 then
        show item 1 of found
        exit repeat
      end if
    end try
  end repeat
end tell`
}
