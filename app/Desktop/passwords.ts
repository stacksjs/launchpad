import AppPreference from '../Models/AppPreference'
import { readSearchSettings } from '../../resources/functions/search-settings'
import { parseVaultItems, vaultListArguments } from '../../resources/functions/passwords'
import type { VaultItem } from '../../resources/functions/passwords'

/**
 * Asks the 1Password CLI for the titles of saved items. The command is fixed, the query never reaches it, and the
 * answer is read for titles and identifiers only. Nothing is stored, here or anywhere else.
 *
 * The CLI owns the vault session: if it is locked or not signed in, `op` says so on its own and this reports the
 * feature as unavailable rather than prompting for anything.
 */
export interface VaultListing { items: VaultItem[], available: boolean, reason: string }

/** Long enough for a large vault to answer, short enough that a locked one does not hang the palette. */
const timeoutMs = 4000
/** A vault listing is the same for every keystroke, so it is read once and reused briefly. */
const cacheMs = 20_000

/** Where a CLI installed by Homebrew or by the 1Password installer ends up. The PATH of a bundled app is not the shell's. */
const candidates = ['/opt/homebrew/bin/op', '/usr/local/bin/op', '/usr/bin/op']

async function readAll(command: string, args: readonly string[]): Promise<{ text: string, ok: boolean }> {
  let child: ReturnType<typeof Bun.spawn>
  try { child = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' }) }
  catch { return { text: '', ok: false } }
  const timer = setTimeout(() => {
    try { child.kill() }
    catch { /* already finished */ }
  }, timeoutMs)
  try {
    // `stdout: 'pipe'` always gives a stream, but the type allows a descriptor, so the other shapes read as empty.
    const stream = child.stdout
    const text = stream && typeof stream !== 'number' ? await new Response(stream).text() : ''
    const code = await child.exited
    return { text, ok: code === 0 }
  }
  catch { return { text: '', ok: false } }
  finally { clearTimeout(timer) }
}

export function createPasswordsApi(options: { now?: () => number, find?: () => Promise<string | null> } = {}) {
  const now = options.now ?? Date.now
  const locate = options.find ?? (async () => {
    for (const path of candidates) if (await Bun.file(path).exists()) return path
    return null
  })
  let cached: { at: number, listing: VaultListing } | null = null
  let enabled = false
  let checkedAt = -Infinity

  async function passwordsEnabled(): Promise<boolean> {
    if (now() - checkedAt < 1000) return enabled
    const preference = await AppPreference.where('key', 'search').first()
    enabled = readSearchSettings(preference?.value).passwords
    checkedAt = now()
    return enabled
  }

  async function listing(): Promise<VaultListing> {
    if (cached && now() - cached.at < cacheMs) return cached.listing
    const command = await locate()
    const answer: VaultListing = !command
      ? { items: [], available: false, reason: 'The 1Password command line tool is not installed.' }
      : await (async () => {
          const { text, ok } = await readAll(command, vaultListArguments)
          if (!ok) return { items: [], available: false, reason: '1Password is locked or not signed in. Unlock it and try again.' }
          return { items: parseVaultItems(text), available: true, reason: '' }
        })()
    cached = { at: now(), listing: answer }
    return answer
  }

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (url.pathname !== '/api/passwords' || request.method !== 'GET') return null
    const headers = { 'cache-control': 'private, no-store' }
    if (!await passwordsEnabled()) return Response.json({ items: [], available: false, reason: 'off' }, { headers })
    return Response.json(await listing(), { headers })
  }
}
