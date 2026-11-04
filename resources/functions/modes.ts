import type { Result } from './search'

/**
 * The palette's modes, as things you search for rather than a row of tabs.
 *
 * A tab strip has to name every mode at once, which is a lot of chrome for something used one at a time. Typing
 * "clipboard" and pressing Return is both quieter and quicker, and it leaves room for modes that are not worth a tab.
 *
 * `id` is the category the palette switches to, so nothing about how a mode works lives here.
 */
export interface Mode { id: string, title: string, subtitle: string, aliases: readonly string[] }

export const modes: readonly Mode[] = [
  { id: 'application', title: 'Search Applications', subtitle: 'Launchpad · Every app installed on this Mac', aliases: ['apps', 'applications', 'programs'] },
  { id: 'file', title: 'Search Files', subtitle: 'Launchpad · Find a file by name, or browse a folder', aliases: ['files', 'documents', 'folders', 'finder'] },
  { id: 'quicklink', title: 'Search Links', subtitle: 'Launchpad · Your saved quicklinks', aliases: ['links', 'quicklinks', 'bookmarks', 'urls'] },
  { id: 'snippet', title: 'Search Snippets', subtitle: 'Launchpad · Your saved text', aliases: ['snippets', 'text', 'templates'] },
  { id: 'clipboard', title: 'Clipboard History', subtitle: 'Launchpad · What you have copied', aliases: ['clipboard', 'copied', 'paste', 'history'] },
  { id: 'emoji', title: 'Search Emoji', subtitle: 'Launchpad · Find an emoji and copy it', aliases: ['emoji', 'emoticon', 'symbols'] },
  { id: 'window', title: 'Switch Windows', subtitle: 'Launchpad · Every open window, by title', aliases: ['windows', 'switch', 'open windows'] },
  { id: 'contact', title: 'Search People', subtitle: 'Launchpad · Your contacts', aliases: ['people', 'contacts', 'address book'] },
  { id: 'event', title: 'Search Calendar', subtitle: 'Launchpad · What is coming up', aliases: ['calendar', 'events', 'meetings', 'schedule'] },
  { id: 'music', title: 'Music', subtitle: 'Launchpad · What is playing, and your library', aliases: ['music', 'songs', 'tracks', 'library'] },
  { id: 'github', title: 'Search GitHub', subtitle: 'Launchpad · Repositories, issues and pull requests', aliases: ['github', 'repos', 'issues', 'pull requests'] },
  { id: 'pantry', title: 'Browse Pantry', subtitle: 'Launchpad · Find and install packages', aliases: ['pantry', 'packages', 'install'] },
]

const byId = new Map(modes.map(mode => [mode.id, mode]))

/** Unknown identifiers return null, so a forged result can never switch the palette into a mode that does not exist. */
export function modeById(id: string): Mode | null {
  return byId.get(id) ?? null
}

/**
 * Rows for the searchable set. They are deliberately absent from the idle list: someone who has just opened the
 * palette wants their own things, not a menu of the palette itself.
 */
const results: readonly Result[] = modes.map(mode => ({
  key: `mode:${mode.id}`,
  title: mode.title,
  subtitle: mode.subtitle,
  kind: 'mode',
  content: mode.id,
  searchAliases: mode.aliases,
}))

export function modeResults(): readonly Result[] {
  return results
}
