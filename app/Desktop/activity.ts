import { toAttrs } from '@stacksjs/orm/define-model'
import LauncherActivity from '../Models/LauncherActivity'
import AppPreference from '../Models/AppPreference'
import LauncherUsageDay from '../Models/LauncherUsageDay'
import UsageRecordingPeriod from '../Models/UsageRecordingPeriod'
import PantryInstallation from '../Models/PantryInstallation'
import type { DesktopInstallJob } from 'ts-pantry/desktop'
import { ActivityAccumulator, pantryPackageKinds } from '../../resources/functions/activity'
import type { PantryPackageKind, PantryReceiptSample } from '../../resources/functions/activity'
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
  cursor = 0
  while (true) {
    const rows = await LauncherUsageDay.where('day', '>=', `${year}-01-01`).where('day', '<=', `${year}-12-31`).where('id', '>', cursor).orderBy('id').limit(1000).get()
    for (const model of rows) {
      const row = toAttrs<Record<string, unknown>>(model)
      accumulator.addTime(String(row.day), Number(row.runningMs ?? row.running_ms), Number(row.visibleMs ?? row.visible_ms))
      cursor = Number(row.id)
    }
    if (rows.length < 1000) break
  }
  cursor = 0
  while (true) {
    const rows = await PantryInstallation.where('finished_at', '>=', start).where('finished_at', '<', end).where('id', '>', cursor).orderBy('id').limit(1000).get()
    for (const model of rows) {
      const row = toAttrs<Record<string, unknown>>(model)
      accumulator.addInstallation({ domain: String(row.domain), packageKind: String(row.packageKind ?? row.package_kind) as PantryPackageKind, status: row.status as 'succeeded' | 'failed', requestedAt: Number(row.requestedAt ?? row.requested_at), startedAt: Number(row.startedAt ?? row.started_at), finishedAt: Number(row.finishedAt ?? row.finished_at), timezoneOffset: Number(row.timezoneOffset ?? row.timezone_offset) })
      cursor = Number(row.id)
    }
    if (rows.length < 1000) break
  }
  return { ...accumulator.finish(), enabled: await trackingEnabled() }
}

/** One session belongs to one bundled backend, including across WebView reloads. */
export function createActivityApi(modelApi: ModelApi, clock: { now?: () => number, monotonic?: () => number, offset?: () => number } = {}) {
  const now = clock.now ?? Date.now
  const monotonic = clock.monotonic ?? (() => performance.now())
  const sessionId = crypto.randomUUID()
  let startedAt = now()
  const offset = clock.offset ?? (() => new Date(now()).getTimezoneOffset())
  let startedOffset = offset()
  let lastTick = monotonic()
  let enabled: boolean | undefined
  let visible = false
  let sessionRecorded = false
  let finished = false
  const days = new Map<string, { bucketKey: string, sessionId: string, day: string, timezoneOffset: number, runningMs: number, visibleMs: number, lastSeenAt: number, appVersion: string }>()
  const dirtyDays = new Set<string>()
  type Receipt = PantryReceiptSample & { jobId: string, recordedAt: number, appVersion: string }
  const pendingInstalls = new Map<string, Receipt>()
  let pending: Promise<unknown> = Promise.resolve()
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const result = pending.then(work, work)
    pending = result.catch(() => {})
    return result
  }
  async function store(body: Record<string, unknown>, headers?: HeadersInit) {
    const isSession = body.action === 'session_started'
    const payload = { eventId: isSession ? sessionId : body.eventId, action: body.action, kind: isSession ? 'launcher' : body.kind, applicationName: !isSession && body.kind === 'application' ? body.applicationName : '', occurredAt: isSession ? startedAt : body.occurredAt, timezoneOffset: isSession ? startedOffset : body.timezoneOffset, durationMs: isSession ? 0 : body.durationMs ?? 0, sessionId, recordedAt: now(), appVersion: pkg.version }
    const requestHeaders = new Headers(headers)
    requestHeaders.set('content-type', 'application/json')
    requestHeaders.delete('content-length')
    const response = await modelApi(new Request('http://localhost/api/activity-events', { method: 'POST', headers: requestHeaders, body: JSON.stringify(payload) }))
    if (response?.status === 409) {
      const model = await LauncherActivity.where('event_id', String(payload.eventId)).first()
      if (model) {
        const previous = toAttrs<Record<string, unknown>>(model)
        if (previous.action !== payload.action || previous.kind !== payload.kind || (previous.applicationName ?? previous.application_name) !== payload.applicationName || Number(previous.occurredAt ?? previous.occurred_at) !== payload.occurredAt || Number(previous.durationMs ?? previous.duration_ms) !== payload.durationMs || Number(previous.timezoneOffset ?? previous.timezone_offset) !== payload.timezoneOffset)
          return Response.json({ error: 'This event ID already belongs to another activity.' }, { status: 409 })
        return Response.json({ data: previous })
      }
    }
    return response
  }
  function timedEvent(action: string, durationMs = 0) {
    return { eventId: crypto.randomUUID(), action, kind: 'launcher', occurredAt: now(), timezoneOffset: offset(), durationMs }
  }
  async function record(action: string, durationMs = 0) {
    const response = await store(timedEvent(action, durationMs))
    if (!response?.ok) throw new Error('The local usage model could not save an event.')
    if (action === 'session_started') sessionRecorded = true
  }
  async function syncRecordingPeriod(recording: boolean) {
    const open = await UsageRecordingPeriod.where('ended_at', 0).get()
    if (recording && !open.length) await UsageRecordingPeriod.create({ startedAt: now(), endedAt: 0 })
    if (!recording) for (const period of open) {
      const row = toAttrs<Record<string, unknown>>(period)
      await UsageRecordingPeriod.update(Number(row.id), { endedAt: Math.max(now(), Number(row.startedAt ?? row.started_at)) })
    }
  }
  function receiptFrom(job: DesktopInstallJob): Receipt | null {
    if (!job || !['succeeded', 'failed'].includes(job.status) || !pantryPackageKinds.includes(job.kind as PantryPackageKind)) return null
    if (typeof job.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(job.id)) return null
    if (typeof job.domain !== 'string' || !job.domain || job.domain.length > 255 || /\s|:\/\/|[?#]/.test(job.domain)) return null
    const requestedAt = Date.parse(job.createdAt)
    const finishedAt = Date.parse(job.finishedAt ?? '')
    if (!Number.isFinite(requestedAt) || !Number.isFinite(finishedAt) || requestedAt < 0 || finishedAt < requestedAt) return null
    const started = Date.parse(job.startedAt ?? '')
    const startedAt = Number.isFinite(started) && started >= requestedAt && started <= finishedAt ? started : 0
    const timezoneOffset = Number.isInteger(job.timezoneOffset) && Math.abs(job.timezoneOffset!) <= 840 ? job.timezoneOffset! : new Date(finishedAt).getTimezoneOffset()
    return { jobId: job.id, domain: job.domain, packageKind: job.kind as PantryPackageKind, status: job.status as 'succeeded' | 'failed', requestedAt, startedAt, finishedAt, timezoneOffset, recordedAt: now(), appVersion: pkg.version }
  }
  async function flushInstallations(recording: boolean) {
    if (!recording) {
      pendingInstalls.clear()
      return
    }
    for (const [id, receipt] of pendingInstalls) {
      if (await PantryInstallation.where('job_id', id).first()) {
        pendingInstalls.delete(id)
        continue
      }
      const period = await UsageRecordingPeriod.where('started_at', '<=', receipt.requestedAt).orderBy('started_at', 'desc').first()
      const row = period ? toAttrs<Record<string, unknown>>(period) : null
      const endedAt = Number(row?.endedAt ?? row?.ended_at ?? 0)
      if (!row || (endedAt > 0 && receipt.finishedAt >= endedAt)) {
        pendingInstalls.delete(id)
        continue
      }
      await PantryInstallation.updateOrCreate({ jobId: id }, receipt)
      pendingInstalls.delete(id)
    }
  }
  async function checkpoint() {
    if (finished) return
    const flushTime = async () => {
      for (const key of dirtyDays) {
        // Write cumulative values, so even a retry after a committed write is idempotent.
        await LauncherUsageDay.updateOrCreate({ bucketKey: key }, days.get(key)!)
        dirtyDays.delete(key)
      }
    }
    await flushTime()
    const current = monotonic()
    const recording = await trackingEnabled()
    await syncRecordingPeriod(recording)
    const elapsed = Math.max(0, Math.round(current - lastTick))
    if (recording) {
      if (!sessionRecorded) {
        if (enabled === false) {
          startedAt = now()
          startedOffset = offset()
        }
        await record('session_started')
      }
      // A missed lease is suspended time, not evidence the app was being used.
      if (enabled === true && elapsed > 0 && elapsed <= 60000) {
        const end = now()
        const timezoneOffset = offset()
        const localEnd = end - timezoneOffset * 60000
        let position = localEnd - elapsed
        while (position < localEnd) {
          const day = new Date(position).toISOString().slice(0, 10)
          const boundary = Date.parse(day) + 86400000
          const duration = Math.min(boundary, localEnd) - position
          const key = `${sessionId}:${day}:${timezoneOffset}`
          const bucket = days.get(key) ?? { bucketKey: key, sessionId, day, timezoneOffset, runningMs: 0, visibleMs: 0, lastSeenAt: end, appVersion: pkg.version }
          bucket.runningMs += duration
          if (visible) bucket.visibleMs += duration
          bucket.lastSeenAt = end
          days.set(key, bucket)
          dirtyDays.add(key)
          position += duration
        }
      }
    }
    enabled = recording
    lastTick = current
    await flushTime()
    await flushInstallations(recording)
  }
  const handle = async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    // Preserve native preference CRUD while accounting for the exact opt-out boundary.
    if (/^\/api\/preferences(?:\/\d+)?$/.test(url.pathname) && ['POST', 'PATCH', 'PUT'].includes(request.method)) {
      await checkpoint()
      const response = await modelApi(request)
      await checkpoint()
      return response
    }
    if (url.pathname === '/api/activity-summary' && request.method === 'GET') {
      const year = Number(url.searchParams.get('year') || new Date().getFullYear())
      if (!Number.isInteger(year) || year < 1970 || year > 9999) return badRequest('Choose a valid year.')
      await checkpoint()
      return Response.json({ data: await summary(year) }, { headers: { 'cache-control': 'private, no-store' } })
    }
    if (url.pathname === '/api/activity-events' && request.method === 'DELETE') {
      await LauncherActivity.where('id', '>', 0).delete()
      await LauncherUsageDay.where('id', '>', 0).delete()
      await PantryInstallation.where('id', '>', 0).delete()
      await UsageRecordingPeriod.where('id', '>', 0).delete()
      days.clear()
      dirtyDays.clear()
      pendingInstalls.clear()
      sessionRecorded = false
      startedAt = now()
      startedOffset = offset()
      lastTick = monotonic()
      return new Response(null, { status: 204 })
    }
    if (url.pathname !== '/api/activity-events' || request.method !== 'POST') return null
    const input: unknown = await request.json().catch(() => null)
    if (!input || typeof input !== 'object' || Array.isArray(input)) return badRequest('Provide an activity event.')
    const body = input as Record<string, unknown>
    if (['session_time', 'palette_time', 'session_ended'].includes(String(body.action))) return badRequest('Session timing belongs to the local backend.')
    const isSession = body.action === 'session_started'
    const eventId = isSession ? sessionId : body.eventId
    if (typeof eventId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(eventId)) return badRequest('Provide a unique event ID.')
    const applicationName = body.kind === 'application' ? body.applicationName : ''
    if (typeof applicationName !== 'string' || /[/\\]/.test(applicationName)) return badRequest('Usage records accept application names, without file paths.')
    const isVisibility = body.action === 'palette_opened' || body.action === 'palette_dismissed'
    if (isVisibility) {
      if (body.kind !== 'launcher' || typeof body.occurredAt !== 'number' || !Number.isFinite(body.occurredAt) || typeof body.timezoneOffset !== 'number' || Math.abs(body.timezoneOffset) > 840 || (body.durationMs ?? 0) !== 0) return badRequest('Provide a valid palette transition.')
      if (!await trackingEnabled()) {
        visible = body.action === 'palette_opened'
        return new Response(null, { status: 204 })
      }
      const previous = await LauncherActivity.where('event_id', eventId).first()
      if (previous) return await store({ ...body, eventId, applicationName }, request.headers)
      await checkpoint()
      const nextVisible = body.action === 'palette_opened'
      if (visible === nextVisible) return new Response(null, { status: 204 })
      const response = await store({ ...body, eventId, applicationName }, request.headers)
      if (response?.ok) visible = nextVisible
      return response
    }
    if (!await trackingEnabled()) return new Response(null, { status: 204 })
    // Model-native validation and mass-assignment rules remain the write boundary.
    const response = await store({ ...body, eventId, applicationName }, request.headers)
    if (isSession && response?.ok) sessionRecorded = true
    return response
  }
  return Object.assign((request: Request) => serial(() => handle(request)), {
    checkpoint: () => serial(checkpoint),
    recordPantryJobs: (jobs: readonly DesktopInstallJob[]) => serial(async () => {
      if (finished) return
      for (const job of jobs) {
        const receipt = receiptFrom(job)
        if (receipt) pendingInstalls.set(receipt.jobId, receipt)
      }
      await checkpoint()
    }),
    finish: () => serial(async () => {
      if (finished) return
      await checkpoint()
      if (enabled && sessionRecorded) await record('session_ended')
      finished = true
    }),
  })
}

/** Native backend checkpoints survive a hidden or reloaded WebView. */
export function startActivityRuntime(api: ReturnType<typeof createActivityApi>) {
  const pulse = () => { void api.checkpoint().catch(() => console.warn('Local usage checkpoint failed; it will retry.')) }
  const timer = setInterval(pulse, 15000)
  timer.unref()
  pulse()
  return async () => {
    clearInterval(timer)
    await api.finish()
  }
}
