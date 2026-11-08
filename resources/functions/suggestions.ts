import type { Result } from './search'

const familiarApps = ['com.apple.MobileSMS', 'com.apple.Notes', 'com.apple.mail', 'com.apple.Safari', 'com.apple.iCal', 'com.apple.Passwords']
const eligible = new Set(['application', 'quicklink', 'snippet', 'bookmark'])

/** Suggestions use existing local launch records. No new collection, paths or query history. */
export function suggestedResults(items: readonly Result[], now = Date.now(), limit = 5): { items: Result[], count: number } {
  if (limit <= 0) return { items: [...items], count: 0 }
  const candidates = items.filter(item => eligible.has(item.kind))
  const score = (item: Result) => {
    const days = Math.max(0, now - Math.min(now, item.lastUsed ?? 0)) / 86_400_000
    const frequency = Math.log2(1 + Math.max(0, item.launches ?? 0))
    return (item.favorite ? 100 : 0) + frequency / (1 + days / 14) + (item.lastUsed ? 4 / (1 + days) : 0)
  }
  const used = candidates.filter(item => item.favorite || (item.launches ?? 0) > 0 || (item.lastUsed ?? 0) > 0)
  const fallback = candidates.filter(item => item.kind === 'application').sort((a, b) => {
    const order = (item: Result) => {
      const index = familiarApps.indexOf(item.bundleId ?? '')
      return index < 0 ? familiarApps.length : index
    }
    return order(a) - order(b) || a.title.localeCompare(b.title)
  })
  const ranked = [...used].sort((a, b) => score(b) - score(a) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0) || a.title.localeCompare(b.title))
  const chosen: Result[] = []
  const seen = new Set<string>()
  for (const item of [...ranked, ...fallback]) {
    if (seen.has(item.key)) continue
    seen.add(item.key)
    chosen.push(item)
    if (chosen.length >= limit) break
  }
  return { items: [...chosen, ...items.filter(item => !seen.has(item.key))], count: chosen.length }
}
