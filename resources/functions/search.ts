export interface Result {
  key: string
  title: string
  subtitle: string
  kind: string
  content: string
  alias?: string
  id?: number
  favorite?: boolean
  launches?: number
  lastUsed?: number
  icon?: string
}

export function rankResults(items: Result[], input: string, category = 'all'): Result[] {
  const query = input.trim().toLocaleLowerCase()
  return items.flatMap((item) => {
    if (category !== 'all' && item.kind !== category) return []
    const title = item.title.toLocaleLowerCase()
    const argument = quicklinkArgument(item, input)
    const term = argument === null ? query : (item.alias || item.title).toLocaleLowerCase()
    const haystack = `${title} ${item.alias ?? ''}`.toLocaleLowerCase()
    let score = item.favorite ? 100 : 0
    if (query) {
      if (title === term || item.alias?.toLowerCase() === term) score += 1000
      else if (title.startsWith(term)) score += 500
      else if (haystack.includes(term)) score += 300
      else {
        let position = -1
        let gaps = 0
        for (const char of term) {
          const next = haystack.indexOf(char, position + 1)
          if (next < 0) return []
          gaps += next - position - 1
          position = next
        }
        score += Math.max(1, 100 - gaps)
      }
    }
    score += Math.min(item.launches ?? 0, 25)
    return [{ item, score }]
  }).sort((a, b) => b.score - a.score || (b.item.lastUsed ?? 0) - (a.item.lastUsed ?? 0) || a.item.title.localeCompare(b.item.title)).map(value => value.item)
}

export function quicklinkArgument(item: Result, input: string): string | null {
  if (item.kind !== 'quicklink') return null
  const value = input.trim()
  const triggers = ([item.alias, item.title].filter(Boolean) as string[]).sort((a, b) => b.length - a.length)
  for (const trigger of triggers) {
    if (value.toLocaleLowerCase().startsWith(trigger.toLocaleLowerCase() + ' '))
      return value.slice(trigger.length).trim()
  }
  return null
}

export function quicklinkUrl(template: string, query: string): string {
  const value = template.replaceAll('{query}', encodeURIComponent(query))
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Quicklinks must use an http or https URL.')
  return url.href
}
