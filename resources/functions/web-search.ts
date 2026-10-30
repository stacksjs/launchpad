import type { Result } from './search'
import { webEngines } from './search-settings'
import type { SearchSettings } from './search-settings'

/** The last row of an ordinary search, so a query that matches nothing local still has somewhere to go. */
export function webSearchResult(query: string, engine: SearchSettings['web']): Result | null {
  const text = query.trim()
  if (!text || engine === 'off') return null
  const { name, template } = webEngines[engine]
  return { key: 'web-search', title: `Search the web for “${text.length > 80 ? `${text.slice(0, 80)}…` : text}”`, subtitle: `${name} · Opens in your browser`, kind: 'web', content: template }
}
