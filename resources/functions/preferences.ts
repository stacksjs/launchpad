export const historyRetentionDays = [1, 7, 30] as const

/** Preferences are stored as JSON text. A damaged value must never keep Launchpad from starting. */
export function parsePreference(value: string | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch { return {} }
}

export function historyPreference(value: string | undefined): { enabled: boolean, days: number } {
  const saved = parsePreference(value)
  const days = historyRetentionDays.find(option => option === saved.days)
  return { enabled: saved.enabled === true, days: days ?? 7 }
}
