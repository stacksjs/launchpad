/**
 * Carrying a Launchpad setup to another Mac, as one file.
 *
 * Everything Launchpad knows lives in one local SQLite database on one machine, so a second Mac starts empty and the
 * two drift apart from there. This is the document that moves the configuration across: what it contains, how it is
 * read back, and what merging it into an existing setup would do.
 *
 * Three things are deliberately absent.
 *
 * Clipboard history and usage records are not configuration. They are the most revealing rows in the database and the
 * least useful to copy, so they are never written to the file at all — not filtered out on import, simply never there.
 *
 * Launch counts are left behind for the same reason. Favourites and aliases are choices someone made and they travel;
 * how often an app was opened is a record of what they did, and it belongs to the Mac it happened on.
 *
 * Tokens are not here either, because they are not in the database: the GitHub and Pantry credentials live in the
 * login keychain. The second Mac asks for its own, which is the right outcome and not a gap to close.
 */

/** The format this build writes. An older document still reads; a newer one is refused rather than guessed at. */
export const documentVersion = 1

/**
 * The preferences that travel.
 *
 * `usage` is left out although it is a preference: recording is opt-in, and carrying the choice over would start
 * recording on a Mac whose owner never agreed to it there. `loginInitialized` records that this Mac's login item has
 * been set up, which is true of one machine and not the other. `pantryCatalog` is a cache revision.
 */
export const carriedPreferences = ['appearance', 'history', 'githubScope', 'search', 'updates', 'theme'] as const

export type CarriedPreference = typeof carriedPreferences[number]

export interface TransferCommand { title: string, kind: 'quicklink' | 'snippet', content: string, alias: string, shortcut: string }
export interface TransferTheme { name: string, light: string, dark: string, font: string }
export interface TransferExtension { name: string, manifest: string, enabled: boolean }
export interface TransferPreference { key: CarriedPreference, value: string }
/** A favourite or its aliases, without the launch count that sits in the same row. */
export interface TransferFavorite { key: string, aliases: string, favorite: boolean }

export interface TransferDocument {
  /** Names the file for a person who opens it in a text editor, and nothing reads it back. */
  launchpad: string
  version: number
  exportedAt: string
  commands: TransferCommand[]
  themes: TransferTheme[]
  extensions: TransferExtension[]
  preferences: TransferPreference[]
  favorites: TransferFavorite[]
}

/** Enough for any real setup, and a bound on what a damaged or hostile file can ask Launchpad to read. */
const limits = { commands: 2000, themes: 200, extensions: 200, preferences: 50, favorites: 5000 }

const text = (value: unknown, max: number): string | null => typeof value === 'string' && value.length <= max ? value : null
const fold = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase()

/** What counts as the same logical row on both Macs. Everything else about a row is content that can differ. */
export function identity(kind: TransferKind, row: TransferRow): string {
  if (kind === 'command') return `${(row as TransferCommand).kind}:${fold((row as TransferCommand).title)}`
  if (kind === 'theme') return fold((row as TransferTheme).name)
  if (kind === 'extension') return fold((row as TransferExtension).name)
  if (kind === 'preference') return (row as TransferPreference).key
  return (row as TransferFavorite).key
}

export type TransferKind = 'command' | 'theme' | 'extension' | 'preference' | 'favorite'
export type TransferRow = TransferCommand | TransferTheme | TransferExtension | TransferPreference | TransferFavorite

/** The fields compared to decide whether two rows of the same identity actually differ. */
const compared: Record<TransferKind, readonly string[]> = {
  command: ['title', 'kind', 'content', 'alias', 'shortcut'],
  theme: ['name', 'light', 'dark', 'font'],
  extension: ['name', 'manifest', 'enabled'],
  preference: ['key', 'value'],
  favorite: ['key', 'aliases', 'favorite'],
}

export function sameRow(kind: TransferKind, a: TransferRow, b: TransferRow): boolean {
  const left = a as unknown as Record<string, unknown>
  const right = b as unknown as Record<string, unknown>
  return compared[kind].every(field => left[field] === right[field])
}

/** What a row is called when it is described to someone, rather than by the key used to match it. */
export function rowLabel(kind: TransferKind, row: TransferRow): string {
  if (kind === 'command') return (row as TransferCommand).title
  if (kind === 'theme') return (row as TransferTheme).name
  if (kind === 'extension') return (row as TransferExtension).name
  if (kind === 'preference') return (row as TransferPreference).key
  return (row as TransferFavorite).key
}

export interface TransferSource {
  commands: readonly Partial<TransferCommand>[]
  themes: readonly Partial<TransferTheme>[]
  extensions: readonly Partial<TransferExtension>[]
  /** Every preference row, carried or not: which ones travel is decided here rather than by the caller. */
  preferences: readonly { key?: string, value?: string }[]
  favorites: readonly (Partial<TransferFavorite> & { launches?: number, lastUsed?: number })[]
}

const readCommand = (row: unknown): TransferCommand | null => {
  const source = row as Partial<TransferCommand>
  const title = text(source?.title, 120)
  const content = text(source?.content, 20000)
  if (!title?.trim() || !content || (source.kind !== 'quicklink' && source.kind !== 'snippet')) return null
  return { title, kind: source.kind, content, alias: text(source.alias, 40) ?? '', shortcut: text(source.shortcut, 60) ?? '' }
}

const readTheme = (row: unknown): TransferTheme | null => {
  const source = row as Partial<TransferTheme>
  const name = text(source?.name, 60)
  const light = text(source?.light, 2000)
  const dark = text(source?.dark, 2000)
  if (!name?.trim() || !light || !dark) return null
  return { name, light, dark, font: text(source.font, 300) ?? '' }
}

const readExtension = (row: unknown): TransferExtension | null => {
  const source = row as Partial<TransferExtension>
  const name = text(source?.name, 60)
  const manifest = text(source?.manifest, 100000)
  if (!name?.trim() || !manifest) return null
  return { name, manifest, enabled: source.enabled !== false }
}

const readPreference = (row: unknown): TransferPreference | null => {
  const source = row as Partial<TransferPreference>
  const value = text(source?.value, 1000)
  // A key outside the carried set is dropped rather than refused: a newer build may carry preferences this one has
  // no business writing, and the rest of the document is still worth reading.
  const key = carriedPreferences.find(carried => carried === source?.key)
  if (!key || value === null) return null
  return { key, value }
}

const readFavorite = (row: unknown): TransferFavorite | null => {
  const source = row as Partial<TransferFavorite>
  const key = text(source?.key, 2048)
  if (!key?.trim()) return null
  const aliases = text(source.aliases, 1000) ?? ''
  const favorite = source.favorite === true
  // A row that is neither a favourite nor aliased holds nothing but a launch count, which does not travel.
  return favorite || aliases.trim() ? { key, aliases, favorite } : null
}

const readers: Record<TransferKind, (row: unknown) => TransferRow | null> = {
  command: readCommand, theme: readTheme, extension: readExtension, preference: readPreference, favorite: readFavorite,
}

/** Reading each row through the same validator used on import keeps a damaged local row out of the file. */
function clean<T extends TransferRow>(kind: TransferKind, rows: readonly unknown[], max: number): T[] {
  const seen = new Set<string>()
  const kept: T[] = []
  for (const row of rows.slice(0, max)) {
    const value = readers[kind](row) as T | null
    if (!value) continue
    const id = identity(kind, value)
    if (seen.has(id)) continue
    seen.add(id)
    kept.push(value)
  }
  return kept
}

export function buildDocument(source: TransferSource, about: { version: string, at: Date }): TransferDocument {
  return {
    launchpad: about.version,
    version: documentVersion,
    exportedAt: about.at.toISOString(),
    commands: clean<TransferCommand>('command', source.commands, limits.commands),
    themes: clean<TransferTheme>('theme', source.themes, limits.themes),
    extensions: clean<TransferExtension>('extension', source.extensions, limits.extensions),
    preferences: clean<TransferPreference>('preference', source.preferences, limits.preferences),
    favorites: clean<TransferFavorite>('favorite', source.favorites, limits.favorites),
  }
}

/** Indented, because a person may well open this file, and a syncing service stores a diff of it either way. */
export function serializeDocument(document: TransferDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

export type DocumentRead = { ok: true, document: TransferDocument } | { ok: false, reason: string }

/** Refusing a newer document is the point: a version this build does not know may mean something different by a field. */
export function readDocument(value: string): DocumentRead {
  let parsed: unknown
  try { parsed = JSON.parse(value) }
  catch { return { ok: false, reason: 'That file is not a Launchpad settings file.' } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason: 'That file is not a Launchpad settings file.' }
  const source = parsed as Record<string, unknown>
  if (typeof source.version !== 'number' || !Number.isInteger(source.version) || source.version < 1)
    return { ok: false, reason: 'That file is not a Launchpad settings file.' }
  if (source.version > documentVersion)
    return { ok: false, reason: `That file was written by a newer version of Launchpad (format ${source.version}). Update Launchpad and try again.` }
  const list = (field: string) => Array.isArray(source[field]) ? source[field] as unknown[] : []
  return {
    ok: true,
    document: {
      launchpad: text(source.launchpad, 40) ?? '',
      version: source.version,
      exportedAt: text(source.exportedAt, 40) ?? '',
      commands: clean<TransferCommand>('command', list('commands'), limits.commands),
      themes: clean<TransferTheme>('theme', list('themes'), limits.themes),
      extensions: clean<TransferExtension>('extension', list('extensions'), limits.extensions),
      preferences: clean<TransferPreference>('preference', list('preferences'), limits.preferences),
      favorites: clean<TransferFavorite>('favorite', list('favorites'), limits.favorites),
    },
  }
}

export interface TransferEntry { kind: TransferKind, label: string, row: TransferRow }
/** Both sides of a disagreement, kept whole so the interface can show what it would be replacing. */
export interface TransferConflict extends TransferEntry { mine: TransferRow }

/**
 * What importing this document would do, without doing any of it.
 *
 * A row absent here is added. A row present and identical is left alone. A row present and different is a conflict,
 * and conflicts are reported rather than resolved: the person decides whether their own setting or the incoming one
 * wins, because nothing in the file says which Mac was right.
 */
export interface MergePlan { add: TransferEntry[], conflicts: TransferConflict[], unchanged: number }

export function planMerge(incoming: TransferDocument, local: TransferSource): MergePlan {
  const plan: MergePlan = { add: [], conflicts: [], unchanged: 0 }
  const kinds: { kind: TransferKind, theirs: readonly TransferRow[], mine: readonly unknown[] }[] = [
    { kind: 'command', theirs: incoming.commands, mine: local.commands },
    { kind: 'theme', theirs: incoming.themes, mine: local.themes },
    { kind: 'extension', theirs: incoming.extensions, mine: local.extensions },
    { kind: 'preference', theirs: incoming.preferences, mine: local.preferences },
    { kind: 'favorite', theirs: incoming.favorites, mine: local.favorites },
  ]
  for (const { kind, theirs, mine } of kinds) {
    const here = new Map<string, TransferRow>()
    for (const row of mine) {
      const value = readers[kind](row)
      if (value) here.set(identity(kind, value), value)
    }
    for (const row of theirs) {
      const existing = here.get(identity(kind, row))
      if (!existing) plan.add.push({ kind, label: rowLabel(kind, row), row })
      else if (sameRow(kind, existing, row)) plan.unchanged++
      else plan.conflicts.push({ kind, label: rowLabel(kind, row), row, mine: existing })
    }
  }
  return plan
}

/** Keeping what is here is the default, so an import that is confirmed without a choice can only add. */
export type ConflictChoice = 'mine' | 'theirs'

/** The rows an import writes: every addition, plus the conflicts whose incoming side the person chose. */
export function resolveMerge(plan: MergePlan, choice: ConflictChoice = 'mine'): TransferEntry[] {
  return choice === 'theirs' ? [...plan.add, ...plan.conflicts.map(({ kind, label, row }) => ({ kind, label, row }))] : [...plan.add]
}

/** A one-line account of a plan, for the person about to accept it. */
export function describePlan(plan: MergePlan): string {
  const parts: string[] = []
  if (plan.add.length) parts.push(`${plan.add.length} to add`)
  if (plan.conflicts.length) parts.push(`${plan.conflicts.length} already different here`)
  if (plan.unchanged) parts.push(`${plan.unchanged} already the same`)
  return parts.length ? parts.join(' · ') : 'Nothing in this file is new to this Mac.'
}

/** The name an export is given, so a folder watched by a syncing service ends up with one file per Mac. */
export function documentName(machine: string): string {
  const slug = machine.normalize('NFD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLocaleLowerCase().slice(0, 40)
  return slug ? `launchpad-${slug}.json` : 'launchpad-settings.json'
}
