import { keychain } from '@stacksjs/desktop/browser'
import { PantryDesktopClient, PantryDesktopError } from 'ts-pantry/desktop'
import type { DesktopInstalledPackage, DesktopInstallJob } from 'ts-pantry/desktop'
import { createPackageCatalogSearch } from 'ts-pantry/catalog'
import type { PackageCatalogEntry } from 'ts-pantry/catalog'
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
export { createPackageCatalogSearch }
export function installedCatalog(catalog: readonly PackageCatalogEntry[], installed: DesktopInstalledPackage[]): PackageCatalogEntry[] {
  const apps = new Set(catalog.filter(entry => entry.kind === 'app').map(entry => entry.domain))
  const names = new Set(installed.filter(item => !apps.has(item.name) || item.applicationPath).map(item => item.name))
  return catalog.filter(entry => names.has(entry.domain))
}
export function pantryResults(catalog: readonly (PackageCatalogEntry & { managedOnly?: boolean })[], applications: Result[], installed: DesktopInstalledPackage[], filter = 'all', includeInstalledApps = false): Result[] {
  const apps = new Set(applications.filter(item => item.kind === 'application').map(item => identity(item.title)))
  const appDomains = new Set(catalog.filter(entry => entry.kind === 'app').map(entry => entry.domain))
  const versions = new Map(installed.filter(item => !appDomains.has(item.name) || item.applicationPath).map(item => [item.name, item.version]))
  const appPaths = new Map(installed.filter(item => item.applicationPath).map(item => [item.name, item.applicationPath!]))
  return catalog.filter(entry => (filter === 'all' || (!entry.managedOnly && entry.kind === filter)) && (includeInstalledApps || !(entry.kind === 'app' && apps.has(identity(entry.name))))).map(entry => ({
    key: `pantry:${entry.domain}`, title: entry.name,
    subtitle: `${versions.has(entry.domain) ? `Installed · ${versions.get(entry.domain)}` : `Pantry · ${entry.kind}`} · ${entry.description}`,
    kind: !includeInstalledApps && entry.kind === 'app' && appPaths.has(entry.domain) ? 'application' : 'pantry', content: !includeInstalledApps && entry.kind === 'app' && appPaths.has(entry.domain) ? appPaths.get(entry.domain)! : entry.domain,
    searchAliases: [entry.domain, ...entry.aliases, ...entry.programs], searchText: entry.description,
    icon: entry.logo?.url, package: entry, installedVersion: versions.get(entry.domain),
  }))
}

export async function uninstallPantry(domain: string, requestId: string): Promise<DesktopInstallJob> { return await client().uninstall(domain, requestId) }
export async function pantryHealth(): Promise<Record<string, unknown>> { return await client().health() }
export async function pantryJobs(): Promise<DesktopInstallJob[]> { return await client().jobs() }

/** Installed packages remain manageable even if their catalog definition was removed. */
export function pantryInventoryCatalog(catalog: readonly PackageCatalogEntry[], installed: DesktopInstalledPackage[]): (PackageCatalogEntry & { managedOnly?: boolean })[] {
  const entries: (PackageCatalogEntry & { managedOnly?: boolean })[] = [...catalog]
  const domains = new Set(entries.map(entry => entry.domain))
  for (const item of installed) {
    if (domains.has(item.name)) continue
    domains.add(item.name)
    entries.push({ domain: item.name, name: item.name, kind: item.applicationPath ? 'app' : 'library', description: 'Installed Pantry package. Its definition is not in the public catalog.', aliases: [], programs: [], latestVersion: null, homepageUrl: null, githubUrl: null, platforms: null, logo: null, managedOnly: true })
  }
  return entries
}

/** App readiness follows a discovered bundle; uninstall ownership follows Pantry's own inventory. */
export function packageInstallState(entry: PackageCatalogEntry, installed: DesktopInstalledPackage[], job: DesktopInstallJob | null, connected: boolean, refreshing = false, removalSupported = false, catalogued = true) {
  const stored = installed.find(item => item.name === entry.domain)
  const record = stored && (entry.kind !== 'app' || stored.applicationPath) ? stored : undefined
  const applicationPath = record?.applicationPath || ''
  const removing = job?.operation === 'uninstall'
  const active = Boolean(job && ['queued', 'running'].includes(job.status))
  const checking = refreshing && !active
  const repair = !checking && !removing && entry.kind === 'app' && !applicationPath && Boolean(stored || job?.status === 'succeeded')
  const ready = Boolean(record)
  const managed = stored?.managed === true
  const external = ready && stored?.managed === false
  const removed = removing && job?.status === 'succeeded' && !managed
  const status = checking ? 'Refreshing installed packages on this Mac…' : active ? job?.status === 'queued' ? 'Waiting for another package operation to finish' : `${removing ? 'Uninstalling' : 'Installing'} ${entry.name}…`
    : job?.status === 'failed' ? job.error || `${removing ? 'Uninstall' : 'Installation'} failed. Open the details below, then try again.`
    : removed ? external ? 'Pantry-managed files were removed. Another copy remains installed outside Pantry.' : 'Uninstalled. Managed files are in Trash; app data and other packages were kept.'
    : repair ? 'The package was downloaded, but the app is missing from Applications. Install it again to finish setup.'
    : external ? 'Installed outside Pantry. Its files are not managed by Pantry.'
    : ready ? entry.kind === 'app' ? 'Ready to open' : 'Installed on this Mac'
    : connected ? entry.kind === 'app' ? 'Installs to your Applications folder' : entry.kind === 'font' ? 'Installs to your Fonts folder' : 'Installs for your user account'
    : 'Connect Pantry in Settings to manage this package.'
  return { applicationPath, active, checking, ready, managed, external, removed, removing, repair, status,
    heading: checking ? 'Refreshing package status' : active ? removing ? 'Uninstall in progress' : 'Installation in progress' : job?.status === 'failed' ? removing ? 'Uninstall needs attention' : 'Installation needs attention' : removed ? 'Uninstalled' : repair ? 'Finish app installation' : external ? 'Installed outside Pantry' : ready ? 'Installed' : 'Ready to install',
    button: !connected ? 'Connect Pantry' : checking ? 'Checking installation…' : active ? job?.status === 'queued' ? 'Queued…' : removing ? 'Uninstalling…' : 'Installing…' : !catalogued ? 'Not in catalog' : repair ? 'Repair installation' : !removing && job?.status === 'failed' ? 'Try again' : ready ? 'Reinstall latest' : 'Install',
    disabled: connected && (active || checking || !catalogued),
    canRemove: connected && removalSupported && managed && !active && !checking,
    removeButton: active && removing ? 'Uninstalling…' : removing && job?.status === 'failed' ? 'Retry uninstall' : 'Uninstall',
    removalNote: !connected ? '' : !removalSupported && stored ? 'Update Pantry Desktop to enable uninstall, then refresh the connection.' : external ? 'Only Pantry-managed user packages can be uninstalled here.' : managed && applicationPath.startsWith('/Applications/') ? 'Uninstall removes the Pantry user package. The separate copy in /Applications will remain.' : '',
  }
}
