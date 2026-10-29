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

const splitWords = (value: string) => value.split(/[^\p{L}\p{N}+#]+/u).filter(Boolean)
function prepareField(value: string) {
  const text = value.toLocaleLowerCase()
  const parts = text.split(/[\s._/-]+/)
  return { text, parts, tokens: splitWords(text), initials: parts.map(word => word[0] || '').join('') }
}
type SearchField = ReturnType<typeof prepareField>

/** A bounded cache belongs to one data snapshot, so edits naturally invalidate it. */
export function cacheResultQueries(search: (input: string, category: string) => Result[], capacity = 64) {
  const cache = new Map<string, Result[]>()
  return (input: string, category = 'all'): Result[] => {
    const key = JSON.stringify([category, input.trim().toLocaleLowerCase()])
    const previous = cache.get(key)
    if (previous) {
      cache.delete(key)
      cache.set(key, previous)
      return previous
    }
    const result = search(input, category)
    if (cache.size >= capacity) cache.delete(cache.keys().next().value!)
    cache.set(key, result)
    return result
  }
}

/** Prepare an immutable result snapshot once. Optional keys select SDK catalog candidates. */
export function createResultSearch(items: readonly Result[]) {
  const prepared = items.map((item) => {
    const title = prepareField(item.title)
    const aliases = [item.alias, ...(item.searchAliases ?? [])].filter((value): value is string => Boolean(value)).map(prepareField)
    return { item, title, aliases, fields: [title, ...aliases], versionless: withoutVersion(title.text), description: splitWords(item.searchText?.toLocaleLowerCase() || ''), order: 0 }
  })
  // Explicit favorites lead each relevance tier. Frequency is never capped; recency breaks frequency ties.
  const compare = (a: typeof prepared[number], b: typeof prepared[number]) => Number(Boolean(b.item.favorite)) - Number(Boolean(a.item.favorite)) || (b.item.launches ?? 0) - (a.item.launches ?? 0) || (b.item.lastUsed ?? 0) - (a.item.lastUsed ?? 0) || Number(b.item.kind === 'application') - Number(a.item.kind === 'application') || a.item.title.localeCompare(b.item.title)
  const ordered = prepared.slice().sort(compare)
  for (let index = 1; index < ordered.length; index++) ordered[index]!.order = ordered[index - 1]!.order + (compare(ordered[index - 1]!, ordered[index]!) === 0 ? 0 : 1)
  const byKey = new Map(prepared.map(entry => [entry.item.key, entry]))
  const defaults = new Map<string, Result[]>()
  const search = (input: string, category = 'all', keys?: readonly string[]): Result[] => {
    const query = input.trim().toLocaleLowerCase()
    if (!query && !keys) {
      if (!defaults.has(category)) defaults.set(category, ordered.filter(entry => category === 'all' || entry.item.kind === category).map(entry => entry.item))
      return defaults.get(category)!
    }
    const queryWords = splitWords(query)
    const compactQuery = query.replace(/\s+/g, '')
    const candidates = keys ? keys.flatMap((key) => {
      const entry = byKey.get(key)
      return entry ? [entry] : []
    }) : prepared
    const matches = candidates.flatMap(({ item, title, aliases, fields, versionless, description, order }) => {
      if (category !== 'all' && item.kind !== category) return []
      let relevance = 0
      let distance = 0
      if (query) {
        const argument = quicklinkArgument(item, input)
        const term = argument === null ? query : (item.alias || item.title).toLocaleLowerCase()
        const words = argument === null ? queryWords : splitWords(term)
        const compact = argument === null ? compactQuery : term.replace(/\s+/g, '')
        let abbreviation: number | null = null
        if (title.text === term || versionless === term) relevance = 6
        else if (aliases.some(alias => alias.text === term)) relevance = 5
        else if (title.text.startsWith(term) || title.parts.some(word => word.startsWith(term))) relevance = 4
        else if (item.kind === 'application' && (abbreviation = fuzzyDistance(title, compact)) !== null && abbreviation <= 2) {
          relevance = 4
          distance = abbreviation
        }
        else if (aliases.some(alias => alias.text.startsWith(term))) relevance = 3
        else if (fields.some(field => field.text.includes(term)) || (words.length > 0 && words.every(word => fields.some(field => field.tokens.some(token => token.startsWith(word)))))) relevance = 2
        else {
          const descriptionMatch = category === 'pantry' && words.length > 0 && words.every(word => fields.some(field => field.tokens.some(token => token.startsWith(word))) || description.some(token => token.startsWith(word)))
          if (!descriptionMatch) {
            // Fuzzy names stay within one identity field. Descriptions never supply scattered letters.
            const distances = fields.map(field => fuzzyDistance(field, compact)).filter((value): value is number => value !== null)
            if (!distances.length) return []
            relevance = 1
            distance = Math.min(...distances)
          }
        }
      }
      return [{ item, relevance, distance, order }]
    })
    const hasIdentityMatch = Boolean(query) && matches.some(match => match.relevance >= 2)
    return matches.filter(match => !hasIdentityMatch || match.relevance !== 1)
      .sort((a, b) => b.relevance - a.relevance || a.distance - b.distance || a.order - b.order).map(value => value.item)
  }
  const cached = cacheResultQueries(search)
  return (input: string, category = 'all', keys?: readonly string[]) => keys ? search(input, category, keys) : cached(input, category)
}

export function rankResults(items: Result[], input: string, category = 'all'): Result[] {
  return createResultSearch(items)(input, category)
}

function withoutVersion(title: string): string {
  let end = title.length
  if (title.at(-1)! < '0' || title.at(-1)! > '9') return title
  while (end > 0 && ((title[end - 1]! >= '0' && title[end - 1]! <= '9') || title[end - 1] === '.')) end--
  return title.slice(0, end).trimEnd()
}

function fuzzyDistance(field: SearchField, term: string): number | null {
  if (term.length < 2) return null
  const words = field.parts
  const initials = field.initials
  if (initials === term) return 0
  const prefix = initials.slice(0, -1)
  if (words.length > 1 && term.length > prefix.length && term.startsWith(prefix) && words.at(-1)!.startsWith(term.slice(prefix.length))) return 0
  let best: number | null = null
  for (const part of [field.text, ...words]) {
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
