export const activityActions = ['session_started', 'session_ended', 'palette_opened', 'palette_dismissed', 'command_executed', 'link_opened', 'command_created', 'clipboard_saved', 'package_installed', 'github_search'] as const
export const activityKinds = ['launcher', 'application', 'quicklink', 'snippet', 'clipboard', 'calculator', 'github', 'pantry'] as const
export type ActivityAction = typeof activityActions[number]
export type ActivityKind = typeof activityKinds[number]

/** Record confirmed side effects, independently of later window or ranking writes. */
export async function recordSuccessfulOperation(operation: () => Promise<void>, record: (durationMs: number) => void | Promise<void>, clock = () => performance.now()): Promise<void> {
  const started = clock()
  await operation()
  await record(Math.max(0, clock() - started))
}

/** Explicit allowlist: queries, URLs, paths, snippet text and clipboard text never enter usage records. */
export function activityPayload(action: ActivityAction, target: { kind: string, title?: string } = { kind: 'launcher' }, durationMs = 0) {
  const kind = activityKinds.includes(target.kind as ActivityKind) ? target.kind as ActivityKind : 'launcher'
  return {
    eventId: crypto.randomUUID(), action, kind,
    applicationName: kind === 'application' ? (target.title || '').slice(0, 120) : '',
    occurredAt: Date.now(), timezoneOffset: new Date().getTimezoneOffset(),
    durationMs: Number.isFinite(durationMs) ? Math.min(600000, Math.max(0, Math.round(durationMs))) : 0,
  }
}

export interface ActivitySample { action: string, kind: string, applicationName: string, occurredAt: number, timezoneOffset: number }
export interface ActivitySummary { year: number, commands: number, paletteOpens: number, sessions: number, runningMs: number, visibleMs: number, applicationsOpened: number, linksOpened: number, activeDays: number, longestStreak: number, daily: Record<string, number>, tools: Record<string, number>, topApplications: { name: string, count: number }[] }

export function formatUsageTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/** Calendar days use the offset at the event, preserving travel and daylight-saving boundaries. */
export class ActivityAccumulator {
  private commands = 0
  private paletteOpens = 0
  private sessions = 0
  private runningMs = 0
  private visibleMs = 0
  private applicationsOpened = 0
  private linksOpened = 0
  private activeDates = new Set<string>()
  private daily: Record<string, number> = {}
  private tools: Record<string, number> = {}
  private applications = new Map<string, number>()
  constructor(private year: number) {}
  add(event: ActivitySample) {
    const local = new Date(event.occurredAt - event.timezoneOffset * 60000)
    if (!Number.isFinite(local.getTime())) return
    const day = local.toISOString().slice(0, 10)
    if (Number(day.slice(0, 4)) !== this.year) return
    if (event.action === 'session_started') this.sessions++
    if (event.action === 'palette_opened') this.paletteOpens++
    if (['palette_opened', 'command_executed', 'link_opened'].includes(event.action)) this.activeDates.add(day)
    if (event.action === 'link_opened') this.linksOpened++
    if (event.action !== 'command_executed') return
    this.commands++
    if (event.kind === 'application') this.applicationsOpened++
    if (event.kind === 'quicklink' || event.kind === 'github') this.linksOpened++
    this.daily[day] = (this.daily[day] || 0) + 1
    this.tools[event.kind] = (this.tools[event.kind] || 0) + 1
    if (event.kind === 'application' && event.applicationName) this.applications.set(event.applicationName, (this.applications.get(event.applicationName) || 0) + 1)
  }
  addTime(day: string, runningMs: number, visibleMs: number) {
    if (Number(day.slice(0, 4)) !== this.year) return
    this.runningMs += runningMs
    this.visibleMs += visibleMs
  }
  finish(): ActivitySummary {
    let longestStreak = 0
    let streak = 0
    let previous = 0
    for (const day of [...this.activeDates].sort()) {
      const timestamp = Date.parse(day)
      streak = timestamp - previous === 86400000 ? streak + 1 : 1
      previous = timestamp
      longestStreak = Math.max(longestStreak, streak)
    }
    return { year: this.year, commands: this.commands, paletteOpens: this.paletteOpens, sessions: this.sessions, runningMs: this.runningMs, visibleMs: this.visibleMs, applicationsOpened: this.applicationsOpened, linksOpened: this.linksOpened, activeDays: this.activeDates.size, longestStreak, daily: this.daily, tools: this.tools, topApplications: [...this.applications].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10) }
  }
}
