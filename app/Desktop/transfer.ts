import { hostname } from 'node:os'
import { isAbsolute } from 'node:path'
import AppPreference from '../Models/AppPreference'
import Command from '../Models/Command'
import Extension from '../Models/Extension'
import LaunchRecord from '../Models/LaunchRecord'
import Theme from '../Models/Theme'
import {
  buildDocument,
  carriedPreferences,
  describePlan,
  documentName,
  identity,
  planMerge,
  readDocument,
  sameRow,
  serializeDocument,
} from '../../resources/functions/transfer'
import type { ConflictChoice, TransferCommand, TransferDocument, TransferExtension, TransferFavorite, TransferKind, TransferPreference, TransferRow, TransferSource, TransferTheme } from '../../resources/functions/transfer'

/**
 * Writing a setup to a file the person chose, and reading one back.
 *
 * The file is the only thing that moves. Launchpad never reaches the network for this and never puts the document
 * anywhere the person did not name, so a folder watched by a syncing service is a choice they make rather than a
 * service this app connects to. `resources/functions/transfer.ts` owns the format and the merge; this owns the disk
 * and the database.
 */

/** Large enough for any real setup, small enough that a wrong file is refused rather than read into memory. */
const maxBytes = 4 * 1024 * 1024
/** One page of rows. Every table read here is configuration, so none of them is expected to be long. */
const page = 1000

/** Read a whole table by paging on the identifier, so one long table cannot be silently cut off at a page. */
async function allRows<T extends { id: number }>(fetch: (cursor: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = []
  for (let cursor = 0; ;) {
    const part = await fetch(cursor)
    rows.push(...part)
    if (part.length < page) return rows
    cursor = part.at(-1)!.id
  }
}

/** The configuration as it stands on this Mac, with the row identifiers an import needs to update anything. */
async function readLocal(): Promise<{ source: TransferSource, ids: Map<string, number> }> {
  const [commands, themes, extensions, preferences, favorites] = await Promise.all([
    allRows(cursor => Command.where('id', '>', cursor).orderBy('id').limit(page).get()),
    allRows(cursor => Theme.where('id', '>', cursor).orderBy('id').limit(page).get()),
    allRows(cursor => Extension.where('id', '>', cursor).orderBy('id').limit(page).get()),
    allRows(cursor => AppPreference.where('id', '>', cursor).orderBy('id').limit(page).get()),
    allRows(cursor => LaunchRecord.where('id', '>', cursor).orderBy('id').limit(page).get()),
  ])
  const source: TransferSource = {
    commands: commands.map(row => ({ title: row.title, kind: row.kind, content: row.content, alias: row.alias ?? '', shortcut: row.shortcut ?? '' })),
    themes: themes.map(row => ({ name: row.name, light: row.light, dark: row.dark, font: row.font ?? '' })),
    // SQLite has no boolean type, so these columns come back as 0 and 1. Comparing them against `true` would have
    // quietly dropped every favourite and exported every disabled extension as enabled.
    extensions: extensions.map(row => ({ name: row.name, manifest: row.manifest, enabled: Boolean(row.enabled) })),
    preferences: preferences.map(row => ({ key: row.key, value: row.value })),
    favorites: favorites.map(row => ({ key: row.key, aliases: row.aliases ?? '', favorite: Boolean(row.favorite) })),
  }
  const ids = new Map<string, number>()
  const remember = (kind: TransferKind, rows: readonly { id: number }[], values: readonly unknown[]) => {
    rows.forEach((row, index) => { ids.set(`${kind}:${identity(kind, values[index] as TransferRow)}`, row.id) })
  }
  remember('command', commands, source.commands)
  remember('theme', themes, source.themes)
  remember('extension', extensions, source.extensions)
  remember('preference', preferences, source.preferences)
  remember('favorite', favorites, source.favorites)
  return { source, ids }
}

export interface ImportReport { added: number, replaced: number, unchanged: number, conflicts: number, summary: string }

/**
 * Apply an already-read document.
 *
 * The plan the person agreed to is advisory: it is derived again here against the rows as they are now, so an import
 * cannot act on a view of the database that has moved on. A conflict is written only when its incoming side was
 * chosen, and a favourite keeps its launch count either way — that number belongs to this Mac.
 */
async function applyDocument(document: TransferDocument, choice: ConflictChoice): Promise<ImportReport> {
  const { source, ids } = await readLocal()
  const plan = planMerge(document, source)
  const here = new Map<string, TransferRow>()
  for (const entry of [...plan.conflicts]) here.set(`${entry.kind}:${identity(entry.kind, entry.row)}`, entry.mine)
  let added = 0
  let replaced = 0
  const write = async (kind: TransferKind, row: TransferRow) => {
    const key = `${kind}:${identity(kind, row)}`
    const id = ids.get(key)
    const existing = here.get(key)
    if (id !== undefined && existing) {
      if (!sameRow(kind, existing, row) && choice === 'theirs') {
        await updateRow(kind, id, row)
        replaced++
      }
      return
    }
    if (id !== undefined) return
    await createRow(kind, row)
    added++
  }
  for (const entry of [...plan.add, ...plan.conflicts]) await write(entry.kind, entry.row)
  return {
    added,
    replaced,
    unchanged: plan.unchanged,
    conflicts: plan.conflicts.length,
    summary: describePlan(plan),
  }
}

async function createRow(kind: TransferKind, row: TransferRow): Promise<void> {
  if (kind === 'command') {
    const { title, kind: sort, content, alias, shortcut } = row as TransferCommand
    await Command.create({ title, kind: sort, content, alias, shortcut })
  }
  else if (kind === 'theme') {
    const { name, light, dark, font } = row as TransferTheme
    await Theme.create({ name, light, dark, font })
  }
  else if (kind === 'extension') {
    const { name, manifest, enabled } = row as TransferExtension
    await Extension.create({ name, manifest, enabled })
  }
  else if (kind === 'preference') {
    const { key, value } = row as TransferPreference
    await AppPreference.create({ key, value })
  }
  else {
    // A new ranking row starts with no launches: the favourite travelled, the count did not.
    const { key, aliases, favorite } = row as TransferFavorite
    await LaunchRecord.create({ key, aliases, favorite, launches: 0, lastUsed: 0 })
  }
}

async function updateRow(kind: TransferKind, id: number, row: TransferRow): Promise<void> {
  if (kind === 'command') {
    const { title, kind: sort, content, alias, shortcut } = row as TransferCommand
    await Command.update(id, { title, kind: sort, content, alias, shortcut })
  }
  else if (kind === 'theme') {
    const { name, light, dark, font } = row as TransferTheme
    await Theme.update(id, { name, light, dark, font })
  }
  else if (kind === 'extension') {
    const { name, manifest, enabled } = row as TransferExtension
    await Extension.update(id, { name, manifest, enabled })
  }
  else if (kind === 'preference') {
    await AppPreference.update(id, { value: (row as TransferPreference).value })
  }
  else {
    // Only the two chosen fields are written, so an import can never rewrite a launch count or a last-used time.
    const { aliases, favorite } = row as TransferFavorite
    await LaunchRecord.update(id, { aliases, favorite })
  }
}

export interface TransferPorts {
  read?: (path: string) => Promise<{ text: string, bytes: number }>
  write?: (path: string, text: string) => Promise<number>
  machine?: () => string
  now?: () => Date
  version?: string
}

const refuse = (reason: string, status = 400) => Response.json({ error: reason }, { status, headers: { 'cache-control': 'private, no-store' } })

/** A path the person picked in a native dialog, which is still checked: an export writes, and writing the wrong thing is unrecoverable. */
function checkPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 1024) return null
  if (!isAbsolute(value) || value.includes('\0')) return null
  return value
}

export function createTransferApi(options: TransferPorts = {}) {
  const machine = options.machine ?? hostname
  const now = options.now ?? (() => new Date())
  const version = options.version ?? ''
  const read = options.read ?? (async (path: string) => {
    const file = Bun.file(path)
    const bytes = file.size
    if (bytes > maxBytes) throw new Error('That file is too large to be a Launchpad settings file.')
    return { text: await file.text(), bytes }
  })
  const write = options.write ?? (async (path: string, text: string) => {
    await Bun.write(path, text)
    return new TextEncoder().encode(text).length
  })

  async function document(): Promise<TransferDocument> {
    const { source } = await readLocal()
    return buildDocument(source, { version, at: now() })
  }

  return async (request: Request): Promise<Response | null> => {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/transfer')) return null
    const headers = { 'cache-control': 'private, no-store' }

    if (pathname === '/api/transfer' && request.method === 'GET') {
      const built = await document()
      return Response.json({ data: { document: built, name: documentName(machine()), carried: carriedPreferences } }, { headers })
    }

    if (request.method !== 'POST') return refuse('Method not allowed', 405)
    let body: Record<string, unknown>
    try { body = await request.json() as Record<string, unknown> }
    catch { return refuse('Expected a JSON body.') }
    const path = checkPath(body.path)
    if (!path) return refuse('That is not a usable file path.')

    if (pathname === '/api/transfer/export') {
      const text = serializeDocument(await document())
      try {
        const bytes = await write(path, text)
        return Response.json({ data: { path, bytes } }, { headers })
      }
      catch { return refuse('That file could not be written. Choose another folder.') }
    }

    if (pathname === '/api/transfer/preview' || pathname === '/api/transfer/import') {
      let text: string
      try { text = (await read(path)).text }
      catch (reason) { return refuse(reason instanceof Error && reason.message.includes('too large') ? reason.message : 'That file could not be read.') }
      const parsed = readDocument(text)
      if (!parsed.ok) return refuse(parsed.reason)
      if (pathname === '/api/transfer/preview') {
        const { source } = await readLocal()
        const plan = planMerge(parsed.document, source)
        return Response.json({
          data: {
            from: parsed.document.launchpad,
            exportedAt: parsed.document.exportedAt,
            add: plan.add.map(entry => ({ kind: entry.kind, label: entry.label })),
            conflicts: plan.conflicts.map(entry => ({ kind: entry.kind, label: entry.label })),
            unchanged: plan.unchanged,
            summary: describePlan(plan),
          },
        }, { headers })
      }
      const choice: ConflictChoice = body.choice === 'theirs' ? 'theirs' : 'mine'
      return Response.json({ data: await applyDocument(parsed.document, choice) }, { headers })
    }

    return refuse('Not found', 404)
  }
}
