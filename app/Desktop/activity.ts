import { toAttrs } from '@stacksjs/orm/define-model'
import LauncherActivity from '../Models/LauncherActivity'
import AppPreference from '../Models/AppPreference'
import { ActivityAccumulator } from '../../resources/functions/activity'
import pkg from '../../package.json'

type ModelApi = (request: Request) => Promise<Response | null>
const badRequest = (message: string) => Response.json({ error: message }, { status: 422 })

async function trackingEnabled() {
  const preference = await AppPreference.where('key', 'usage').first()
  if (!preference) return true
  try { return JSON.parse(preference.value).enabled === true }
  catch { return false }
}

async function summary(year: number) {
  const accumulator = new ActivityAccumulator(year)
  const start = Date.UTC(year, 0, 1) - 15 * 3600000
  const end = Date.UTC(year + 1, 0, 1) + 15 * 3600000
  let cursor = 0
  while (true) {
    const rows = await LauncherActivity.where('occurred_at', '>=', start).where('occurred_at', '<', end).where('id', '>', cursor).orderBy('id').limit(1000).get()
    for (const model of rows) {
      const row = toAttrs<Record<string, unknown>>(model)
      accumulator.add({ action: String(row.action), kind: String(row.kind), applicationName: String(row.applicationName ?? row.application_name ?? ''), occurredAt: Number(row.occurredAt ?? row.occurred_at), timezoneOffset: Number(row.timezoneOffset ?? row.timezone_offset) })
      cursor = Number(row.id)
    }
    if (rows.length < 1000) break
  }
  return { ...accumulator.finish(), enabled: await trackingEnabled() }
}

/** One session belongs to one bundled backend, including across WebView reloads. */
export function createActivityApi(modelApi: ModelApi) {
  const sessionId = crypto.randomUUID()
  const startedAt = Date.now()
  const startedOffset = new Date().getTimezoneOffset()
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (url.pathname === '/api/activity-summary' && request.method === 'GET') {
      const year = Number(url.searchParams.get('year') || new Date().getFullYear())
      if (!Number.isInteger(year) || year < 1970 || year > 9999) return badRequest('Choose a valid year.')
      return Response.json({ data: await summary(year) }, { headers: { 'cache-control': 'private, no-store' } })
    }
    if (url.pathname === '/api/activity-events' && request.method === 'DELETE') {
      await LauncherActivity.where('id', '>', 0).delete()
      return new Response(null, { status: 204 })
    }
    if (url.pathname !== '/api/activity-events' || request.method !== 'POST') return null
    if (!await trackingEnabled()) return new Response(null, { status: 204 })
    const input: unknown = await request.json().catch(() => null)
    if (!input || typeof input !== 'object' || Array.isArray(input)) return badRequest('Provide an activity event.')
    const body = input as Record<string, unknown>
    const isSession = body.action === 'session_started'
    const eventId = isSession ? sessionId : body.eventId
    if (typeof eventId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(eventId)) return badRequest('Provide a unique event ID.')
    const applicationName = body.kind === 'application' ? body.applicationName : ''
    if (typeof applicationName !== 'string' || /[/\\]/.test(applicationName)) return badRequest('Usage records accept application names, without file paths.')
    const payload = {
      eventId, action: body.action, kind: isSession ? 'launcher' : body.kind, applicationName,
      occurredAt: isSession ? startedAt : body.occurredAt,
      timezoneOffset: isSession ? startedOffset : body.timezoneOffset,
      durationMs: body.durationMs ?? 0, sessionId, recordedAt: Date.now(), appVersion: pkg.version,
    }
    const headers = new Headers(request.headers)
    headers.set('content-type', 'application/json')
    headers.delete('content-length')
    // Model-native validation and mass-assignment rules remain the write boundary.
    const response = await modelApi(new Request(request.url, { method: 'POST', headers, body: JSON.stringify(payload) }))
    const existing = response?.status === 409 ? await LauncherActivity.where('event_id', eventId).first() : null
    if (existing) {
      const previous = toAttrs<Record<string, unknown>>(existing)
      if (previous.action !== payload.action || previous.kind !== payload.kind || (previous.applicationName ?? previous.application_name) !== applicationName || Number(previous.occurredAt ?? previous.occurred_at) !== payload.occurredAt)
        return Response.json({ error: 'This event ID already belongs to another activity.' }, { status: 409 })
      return Response.json({ data: previous })
    }
    return response
  }
}
