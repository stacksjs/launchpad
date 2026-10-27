import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import Command from '../Models/Command'
import LaunchRecord from '../Models/LaunchRecord'
import ClipboardEntry from '../Models/ClipboardEntry'
import AppPreference from '../Models/AppPreference'
import LauncherActivity from '../Models/LauncherActivity'
import LauncherUsageDay from '../Models/LauncherUsageDay'
import CatalogPackage from '../Models/CatalogPackage'
import { pantryApi } from './pantry'
import { clearClipboardHistory, pruneClipboardHistory } from './history'
import { createActivityApi, startActivityRuntime } from './activity'

const models = { Command, LaunchRecord, ClipboardEntry, AppPreference, LauncherActivity, LauncherUsageDay, CatalogPackage }
// Craft/stx owns the authenticated loopback session and backend process.
openNativeDatabase({ path: join(homedir(), 'Library/Application Support/Launchpad/launchpad.sqlite'), models })
const modelApi = createNativeModelApi({ models, authorize: () => true })
const activityApi = createActivityApi(modelApi)
export const shutdown = startActivityRuntime(activityApi)

export async function installedApplications() {
  const roots = ['/Applications', '/System/Applications', '/System/Applications/Utilities', join(homedir(), 'Applications')]
  const apps: { key: string, title: string, subtitle: string, kind: string, content: string }[] = []
  for (const root of roots) {
    let entries
    try { entries = await readdir(root, { withFileTypes: true }) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (!entry.name.endsWith('.app')) continue
      const path = join(root, entry.name)
      apps.push({ key: path, title: entry.name.slice(0, -4), subtitle: 'Application', kind: 'application', content: path })
    }
  }
  return apps.sort((a, b) => a.title.localeCompare(b.title))
}

export default async function handle(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  const pantry = await pantryApi(request)
  if (pantry) return pantry
  if (pathname === '/api/applications' && request.method === 'GET')
    return Response.json({ data: await installedApplications() }, { headers: { 'cache-control': 'private, no-store' } })
  if (pathname === '/api/clipboard-history' && request.method === 'DELETE') {
    await clearClipboardHistory()
    return new Response(null, { status: 204 })
  }
  if (pathname === '/api/clipboard-entries' && request.method === 'GET') await pruneClipboardHistory()
  const activity = await activityApi(request)
  if (activity) return activity
  const response = await modelApi(request)
  if (pathname === '/api/clipboard-entries' && request.method === 'POST' && response?.ok) await pruneClipboardHistory()
  return response
}
