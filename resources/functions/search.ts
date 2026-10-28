export interface Result {
  key: string
  title: string
  subtitle: string
  kind: string
  content: string
  alias?: string
  searchAliases?: readonly string[]
  searchText?: string
  id?: number
  favorite?: boolean
  launches?: number
  lastUsed?: number
  package?: import('ts-pantry/catalog').PackageCatalogEntry
  installedVersion?: string
  icon?: string
}

export function rankResults(items: Result[], input: string, category = 'all'): Result[] {
  const query = input.trim().toLocaleLowerCase()
  const matches = items.flatMap((item) => {
    if (category !== 'all' && item.kind !== category) return []
    let relevance = 0
    let distance = 0
    let score = (item.favorite ? 100 : 0) + (item.kind === 'application' ? 10 : 0)
    if (query) {
      const title = item.title.toLocaleLowerCase()
      const argument = quicklinkArgument(item, input)
      const term = argument === null ? query : (item.alias || item.title).toLocaleLowerCase()
      const aliases = [item.alias, ...(item.searchAliases ?? [])].filter((value): value is string => Boolean(value)).map(value => value.toLocaleLowerCase())
      const fields = [title, ...aliases]
      const words = term.split(/[^\p{L}\p{N}+#]+/u).filter(Boolean)
      if (title === term || withoutVersion(title) === term) relevance = 6
      else if (aliases.includes(term)) relevance = 5
      else if (title.startsWith(term) || title.split(/[\s._/-]+/).some(word => word.startsWith(term))) relevance = 4
      else if (aliases.some(alias => alias.startsWith(term))) relevance = 3
      else if (fields.some(field => field.includes(term)) || (words.length > 0 && words.every(word => fields.some(field => field.split(/[^\p{L}\p{N}+#]+/u).some(token => token.startsWith(word)))))) relevance = 2
      else {
        // Fuzzy names stay within one identity field. Descriptions never supply scattered letters.
        const distances = fields.map(field => fuzzyDistance(field, term)).filter((value): value is number => value !== null)
        if (distances.length) {
          relevance = 1
          distance = Math.min(...distances)
        }
        else if (category !== 'pantry' || !words.length || !words.every(word => [...fields, item.searchText?.toLocaleLowerCase() || ''].some(field => field.split(/[^\p{L}\p{N}+#]+/u).some(token => token.startsWith(word))))) return []
      }
    }
    score += Math.min(item.launches ?? 0, 25)
    return [{ item, relevance, distance, score }]
  })
  const hasIdentityMatch = query && matches.some(match => match.relevance >= 2)
  return matches.filter(match => !hasIdentityMatch || match.relevance !== 1)
    .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance || b.score - a.score || (b.item.lastUsed ?? 0) - (a.item.lastUsed ?? 0) || a.item.title.localeCompare(b.item.title)).map(value => value.item)
}

function withoutVersion(title: string): string {
  let end = title.length
  if (title.at(-1)! < '0' || title.at(-1)! > '9') return title
  while (end > 0 && ((title[end - 1]! >= '0' && title[end - 1]! <= '9') || title[end - 1] === '.')) end--
  return title.slice(0, end).trimEnd()
}

function fuzzyDistance(field: string, term: string): number | null {
  if (term.length < 2 || /\s/.test(term)) return null
  const words = field.split(/[\s._/-]+/)
  const initials = words.map(word => word[0] || '').join('')
  if (initials === term) return 0
  let best: number | null = null
  for (const part of [field, ...words]) {
    let position = -1
    let first = -1
    let gaps = 0
    let complete = true
    for (const char of term) {
      const next = part.indexOf(char, position + 1)
      if (next < 0) {
        complete = false
        break
      }
      if (first < 0) first = next
      else gaps += next - position - 1
      position = next
    }
    if (complete && first <= 2 && gaps <= Math.max(2, Math.floor(term.length * 0.75))) best = Math.min(best ?? Infinity, gaps + first)
  }
  return best
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
