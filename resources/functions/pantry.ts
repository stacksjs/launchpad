import { keychain } from '@stacksjs/desktop/browser'
import { PantryDesktopClient, PantryDesktopError } from 'ts-pantry/desktop'
import type { DesktopInstalledPackage, DesktopInstallJob } from 'ts-pantry/desktop'
import { searchPackageCatalog } from 'ts-pantry/catalog'
import type { PackageCatalogEntry, PackageKind } from 'ts-pantry/catalog'
import type { Result } from './search'

export type { PackageCatalogEntry, DesktopInstalledPackage, DesktopInstallJob }
const service = 'com.stacksjs.launchpad.pantry'
let credential = ''
const client = () => new PantryDesktopClient({ token: credential, fetch: (input, init) => fetch(`/api/pantry/desktop${new URL(String(input)).pathname}`, init) })
export async function restorePantry(): Promise<DesktopInstalledPackage[]> {
  credential = await keychain.get(service, 'token') || ''
  if (!credential) return []
  try { return await client().installed() }
  catch (error) {
    if (error instanceof PantryDesktopError && error.status === 401) {
      await keychain.delete(service, 'token')
      credential = ''
    }
    throw error
  }
}
export function pantryConnected(): boolean { return Boolean(credential) }
export async function connectPantry(code: string): Promise<DesktopInstalledPackage[]> {
  const token = await client().pair(code.trim(), 'Launchpad')
  await keychain.set(service, 'token', token)
  credential = token
  return await client().installed()
}
export async function disconnectPantry(): Promise<void> {
  await client().disconnect()
  await keychain.delete(service, 'token')
  credential = ''
}
export async function installedPantry(): Promise<DesktopInstalledPackage[]> { return await client().installed() }
export async function installPantry(domain: string, requestId: string): Promise<DesktopInstallJob> { return await client().install(domain, requestId) }
export async function pantryJob(id: string): Promise<DesktopInstallJob> { return await client().job(id) }

const identity = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
export function pantryResults(catalog: readonly PackageCatalogEntry[], applications: Result[], installed: DesktopInstalledPackage[], filter = 'all', includeInstalledApps = false, query = ''): Result[] {
  const apps = new Set(applications.filter(item => item.kind === 'application').map(item => identity(item.title)))
  const versions = new Map(installed.map(item => [item.name, item.version]))
  const appPaths = new Map(installed.filter(item => item.applicationPath).map(item => [item.name, item.applicationPath!]))
  const matching = searchPackageCatalog(catalog, query, { kind: filter === 'all' ? undefined : filter as PackageKind, limit: 50000 })
  return matching.filter(entry => (filter === 'all' || entry.kind === filter) && (includeInstalledApps || !(entry.kind === 'app' && apps.has(identity(entry.name))))).map(entry => ({
    key: `pantry:${entry.domain}`, title: entry.name,
    subtitle: `${versions.has(entry.domain) ? `Installed · ${versions.get(entry.domain)}` : `Pantry · ${entry.kind}`} · ${entry.description}`,
    kind: !includeInstalledApps && entry.kind === 'app' && appPaths.has(entry.domain) ? 'application' : 'pantry', content: !includeInstalledApps && entry.kind === 'app' && appPaths.has(entry.domain) ? appPaths.get(entry.domain)! : entry.domain, alias: [entry.domain, ...entry.aliases, ...entry.programs, entry.description].join(' '),
    icon: entry.logo?.url, package: entry, installedVersion: versions.get(entry.domain),
  }))
}

export async function pantryJobs(): Promise<DesktopInstallJob[]> { return await client().jobs() }
