import { homedir } from 'node:os'
import { join } from 'node:path'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import Command from '../Models/Command'
import LaunchRecord from '../Models/LaunchRecord'
import ClipboardEntry from '../Models/ClipboardEntry'
import AppPreference from '../Models/AppPreference'
import LauncherActivity from '../Models/LauncherActivity'
import LauncherUsageDay from '../Models/LauncherUsageDay'
import UsageRecordingPeriod from '../Models/UsageRecordingPeriod'
import PantryInstallation from '../Models/PantryInstallation'
import CatalogPackage from '../Models/CatalogPackage'
import { pantryApi } from './pantry'
import { clearClipboardHistory, pruneClipboardHistory } from './history'
import { createActivityApi, startActivityRuntime } from './activity'
import { installedApplications } from './applications'

const models = { Command, LaunchRecord, ClipboardEntry, AppPreference, LauncherActivity, LauncherUsageDay, UsageRecordingPeriod, PantryInstallation, CatalogPackage }
// Craft/stx owns the authenticated loopback session and backend process.
openNativeDatabase({ path: join(homedir(), 'Library/Application Support/Launchpad/launchpad.sqlite'), models })
const modelApi = createNativeModelApi({ models, authorize: () => true })
const activityApi = createActivityApi(modelApi)
const stopActivity = startActivityRuntime(activityApi)
export const shutdown = async () => {
  installedApplications.close()
  await stopActivity()
}

export default async function handle(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname
  const pantry = await pantryApi(request, { onJobs: activityApi.recordPantryJobs })
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
