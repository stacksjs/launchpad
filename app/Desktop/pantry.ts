import { bundledPackageCatalog, bundledPackageCatalogRevision, fetchPackageCatalog } from 'ts-pantry/catalog'
import type { PackageCatalogEntry } from 'ts-pantry/catalog'
import CatalogPackage from '../Models/CatalogPackage'
import AppPreference from '../Models/AppPreference'

let seeded: Promise<void> | undefined
let refreshing: Promise<PackageCatalogEntry[]> | undefined
async function store(entries: readonly PackageCatalogEntry[]) {
  const existing = await CatalogPackage.limit(50000).get()
  const byDomain = new Map(existing.map(row => [row.domain, row]))
  for (const entry of entries) {
    const metadata = JSON.stringify(entry)
    const previous = byDomain.get(entry.domain)
    const data = { domain: entry.domain, name: entry.name, kind: entry.kind, metadata }
    if (!previous) await CatalogPackage.create(data)
    else if (previous.metadata !== metadata) await CatalogPackage.update(previous.id, data)
  }
  const domains = new Set(entries.map(entry => entry.domain))
  for (const previous of existing) if (!domains.has(previous.domain)) await CatalogPackage.destroy(previous.id)
}
async function catalog() {
  seeded ??= (async () => {
    const saved = await AppPreference.where('key', 'pantryCatalog').first()
    if (saved?.value !== bundledPackageCatalogRevision) {
      await store(bundledPackageCatalog())
      if (saved) await AppPreference.update(saved.id, { value: bundledPackageCatalogRevision })
      else await AppPreference.create({ key: 'pantryCatalog', value: bundledPackageCatalogRevision })
    }
  })().catch(error => {
    seeded = undefined
    throw error
  })
  await seeded
  const rows = await CatalogPackage.orderBy('name').limit(50000).get()
  return rows.map(row => JSON.parse(row.metadata) as PackageCatalogEntry)
}

/** Public catalog refreshes never send a search term. The installer stays in Pantry's own process. */
export async function pantryApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url)
  const json = (data: unknown, status = 200) => Response.json({ data }, { status, headers: { 'cache-control': 'private, no-store' } })
  if (url.pathname === '/api/pantry/catalog' && request.method === 'GET') return json(await catalog())
  if (url.pathname === '/api/pantry/catalog/refresh' && request.method === 'POST') {
    await catalog()
    refreshing ??= (async () => {
      const entries = await fetchPackageCatalog()
      await store(entries)
      return entries
    })().finally(() => { refreshing = undefined })
    try { return json(await refreshing) }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Catalog refresh failed. The saved catalog is still available.' }, { status: 502 }) }
  }
  const prefix = '/api/pantry/desktop'
  if (!url.pathname.startsWith(`${prefix}/`)) return null
  const path = url.pathname.slice(prefix.length)
  const allowed = (request.method === 'GET' && (path === '/health' || path === '/v1/installed' || path === '/v1/jobs' || /^\/v1\/jobs\/[a-f0-9-]{36}$/i.test(path)))
    || (request.method === 'POST' && ['/pair', '/v1/install'].includes(path))
    || (request.method === 'DELETE' && path === '/v1/connection')
  if (!allowed) return Response.json({ error: 'Unsupported Pantry request.' }, { status: 404 })
  try {
    const headers = new Headers()
    const authorization = request.headers.get('authorization')
    if (authorization) headers.set('authorization', authorization)
    if (request.method === 'POST') headers.set('content-type', 'application/json')
    const body = request.method === 'POST' ? await request.text() : undefined
    if (body && body.length > 4096) return Response.json({ error: 'Pantry request is too large.' }, { status: 413 })
    const response = await fetch(`http://127.0.0.1:46473${path}`, { method: request.method, headers, body, signal: AbortSignal.timeout(15000), redirect: 'error' })
    return new Response(await response.text(), { status: response.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  }
  catch { return Response.json({ error: 'Pantry Desktop is unavailable. Run pantry desktop setup --yes in your terminal, then connect in Settings.' }, { status: 503 }) }
}
