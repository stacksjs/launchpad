export const activityActions = ['session_started', 'palette_opened', 'palette_dismissed', 'command_executed', 'command_created', 'clipboard_saved', 'package_installed', 'github_search'] as const
export const activityKinds = ['launcher', 'application', 'quicklink', 'snippet', 'clipboard', 'calculator', 'github', 'pantry'] as const
export type ActivityAction = typeof activityActions[number]
export type ActivityKind = typeof activityKinds[number]

/** Explicit allowlist: queries, URLs, paths, snippet text and clipboard text never enter usage records. */
export function activityPayload(action: ActivityAction, target: { kind: string, title?: string } = { kind: 'launcher' }, durationMs = 0) {
  const kind = activityKinds.includes(target.kind as ActivityKind) ? target.kind as ActivityKind : 'launcher'
  return {
    eventId: crypto.randomUUID(), action, kind,
    applicationName: kind === 'application' ? (target.title || '').slice(0, 120) : '',
    occurredAt: Date.now(), timezoneOffset: new Date().getTimezoneOffset(),
    durationMs: Math.max(0, Math.round(durationMs)),
  }
}

export interface ActivitySample { action: string, kind: string, applicationName: string, occurredAt: number, timezoneOffset: number }
export interface ActivitySummary { year: number, commands: number, paletteOpens: number, sessions: number, activeDays: number, longestStreak: number, daily: Record<string, number>, tools: Record<string, number>, topApplications: { name: string, count: number }[] }

/** Calendar days use the offset at the event, preserving travel and daylight-saving boundaries. */
export class ActivityAccumulator {
  private commands = 0
  private paletteOpens = 0
  private sessions = 0
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
    if (event.action !== 'command_executed') return
    this.commands++
    this.daily[day] = (this.daily[day] || 0) + 1
    this.tools[event.kind] = (this.tools[event.kind] || 0) + 1
    if (event.kind === 'application' && event.applicationName) this.applications.set(event.applicationName, (this.applications.get(event.applicationName) || 0) + 1)
  }
  finish(): ActivitySummary {
    let longestStreak = 0
    let streak = 0
    let previous = 0
    for (const day of Object.keys(this.daily).sort()) {
      const timestamp = Date.parse(day)
      streak = timestamp - previous === 86400000 ? streak + 1 : 1
      previous = timestamp
      longestStreak = Math.max(longestStreak, streak)
    }
    return { year: this.year, commands: this.commands, paletteOpens: this.paletteOpens, sessions: this.sessions, activeDays: Object.keys(this.daily).length, longestStreak, daily: this.daily, tools: this.tools, topApplications: [...this.applications].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 10) }
  }
}
