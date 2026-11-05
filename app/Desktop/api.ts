import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { applicationDataDirectory, createNativeUpdateApi } from '@stacksjs/desktop'
import pkg from '../../package.json'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import { models } from './models'
import { pantryApi } from './pantry'
import { clearClipboardHistory, pruneClipboardHistory } from './history'
import { createActivityApi, startActivityRuntime } from './activity'
import { installedApplications } from './applications'
import { createRatesApi } from './rates'
import { createFilesApi } from './files'
import { createPasswordsApi } from './passwords'
import { createRankingApi } from './ranking'
import { createAutomaticUpdates } from './updates'
import { asidePath, databaseSidecars, isSchemaConflict, recoveryNotice } from '../../resources/functions/database-recovery'

/**
 * The model boot refuses an upgrade that would drop anything, so a store written by a newer build leaves this one
 * unable to start — and with no Dock icon, unable to say so. A launcher that will not open is worse than one that
 * has forgotten something, so the old store is set aside and a fresh one takes its place.
 *
 * Only that one failure is recovered from. A full disk or an unwritable path still throws, because losing the store
 * would be the wrong answer to either.
 */
function openDatabase(path: string): string {
  try {
    openNativeDatabase({ path, models })
    return ''
  }
  catch (reason) {
    if (!isSchemaConflict(reason)) throw reason
    const movedTo = asidePath(path)
    renameSync(path, movedTo)
    // A journal left from the old store would be replayed against the new one.
    for (const suffix of databaseSidecars) if (existsSync(path + suffix)) renameSync(path + suffix, movedTo + suffix)
    openNativeDatabase({ path, models })
    return movedTo
  }
}

// Craft/stx owns the authenticated loopback session and backend process.
const databaseSetAside = openDatabase(join(applicationDataDirectory('Launchpad', { bundleIdentifier: 'com.stacksjs.launchpad' }), 'launchpad.sqlite'))
if (databaseSetAside) console.warn(recoveryNotice(databaseSetAside))
const modelApi = createNativeModelApi({ models, authorize: () => true })
const updates = createNativeUpdateApi({ repository: 'stacksjs/launchpad', currentVersion: pkg.version })
const automaticUpdates = createAutomaticUpdates(updates)
const updateTimer = setInterval(() => { void automaticUpdates().catch(console.error) }, 60_000)
updateTimer.unref()
const rankingApi = createRankingApi(modelApi)
const activityApi = createActivityApi(modelApi)
const stopActivity = startActivityRuntime(activityApi)
const ratesApi = createRatesApi()
const filesApi = createFilesApi()
const passwordsApi = createPasswordsApi()
export const shutdown = async () => {
  clearInterval(updateTimer)
  installedApplications.close()
  await stopActivity()
}

export default async function handle(request: Request): Promise<Response | null> {
  const update = await updates(request)
  if (update) return update
  const pathname = new URL(request.url).pathname
  const pantry = await pantryApi(request, { onJobs: activityApi.recordPantryJobs })
  if (pantry) return pantry
  if (pathname === '/api/startup' && request.method === 'GET')
    return Response.json({ databaseSetAside, notice: databaseSetAside ? recoveryNotice(databaseSetAside) : '' }, { headers: { 'cache-control': 'private, no-store' } })
  if (pathname === '/api/applications' && request.method === 'GET')
    return Response.json({ data: await installedApplications() }, { headers: { 'cache-control': 'private, no-store' } })
  if (pathname === '/api/clipboard-history' && request.method === 'DELETE') {
    await clearClipboardHistory()
    return new Response(null, { status: 204 })
  }
  if (pathname === '/api/clipboard-entries' && request.method === 'GET') await pruneClipboardHistory()
  const rates = await ratesApi(request)
  if (rates) return rates
  const files = await filesApi(request)
  if (files) return files
  const passwords = await passwordsApi(request)
  if (passwords) return passwords
  const ranking = await rankingApi(request)
  if (ranking) return ranking
  const activity = await activityApi(request)
  if (activity) return activity
  const response = await modelApi(request)
  if (pathname === '/api/clipboard-entries' && request.method === 'POST' && response?.ok) await pruneClipboardHistory()
  return response
}
