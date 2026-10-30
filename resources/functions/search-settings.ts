import { parsePreference } from './preferences'

export const webEngines = {
  duckduckgo: { name: 'DuckDuckGo', template: 'https://duckduckgo.com/?q={query}' },
  google: { name: 'Google', template: 'https://www.google.com/search?q={query}' },
  bing: { name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
  brave: { name: 'Brave Search', template: 'https://search.brave.com/search?q={query}' },
  kagi: { name: 'Kagi', template: 'https://kagi.com/search?q={query}' },
} as const
export type WebEngine = keyof typeof webEngines

export interface SearchSettings {
  /** Search file names on this Mac through Spotlight's index. */
  files: boolean
  /** Download daily exchange rates so currency conversions work. Off until opted in. */
  currency: boolean
  /** Engine for the final "Search the web" row, or off. */
  web: WebEngine | 'off'
  /** Paste a chosen snippet into the app that was frontmost, not only copy it. */
  paste: boolean
}

export const defaultSearchSettings: SearchSettings = { files: true, currency: false, web: 'duckduckgo', paste: false }

/** Stored as JSON text on the `search` preference. Unknown or damaged fields fall back to their defaults. */
export function readSearchSettings(value: string | undefined): SearchSettings {
  const saved = parsePreference(value)
  return {
    files: typeof saved.files === 'boolean' ? saved.files : defaultSearchSettings.files,
    currency: saved.currency === true,
    web: saved.web === 'off' || (typeof saved.web === 'string' && saved.web in webEngines) ? saved.web as SearchSettings['web'] : defaultSearchSettings.web,
    paste: saved.paste === true,
  }
}
