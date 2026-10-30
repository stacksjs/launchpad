import ExchangeRate from '../Models/ExchangeRate'
import AppPreference from '../Models/AppPreference'
import { currencyCodes } from '../../resources/functions/convert'
import type { ExchangeRates } from '../../resources/functions/convert'
import { readSearchSettings } from '../../resources/functions/search-settings'

/** The European Central Bank's daily reference rates, republished as JSON. The request carries no user data. */
export const ratesUrl = 'https://api.frankfurter.dev/v1/latest?base=EUR'
export const ratesMaxAgeMs = 12 * 3600 * 1000

export async function currencyEnabled(): Promise<boolean> {
  const preference = await AppPreference.where('key', 'search').first()
  return readSearchSettings(preference?.value).currency
}

/** Only known currencies with positive, finite rates and a real publication date are accepted. */
export function parseRates(payload: unknown): { rates: Record<string, number>, publishedAt: number } | null {
  if (!payload || typeof payload !== 'object') return null
  const { rates, date } = payload as { rates?: unknown, date?: unknown }
  const publishedAt = typeof date === 'string' ? Date.parse(date) : Number.NaN
  if (!rates || typeof rates !== 'object' || !Number.isFinite(publishedAt)) return null
  const accepted: Record<string, number> = {}
  for (const code of currencyCodes) {
    const value = (rates as Record<string, unknown>)[code]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) accepted[code] = value
  }
  return Object.keys(accepted).length >= 5 ? { rates: accepted, publishedAt } : null
}

export async function storedRates(): Promise<{ table: ExchangeRates | null, fetchedAt: number }> {
  const rows = await ExchangeRate.limit(100).get()
  if (!rows.length) return { table: null, fetchedAt: 0 }
  const rates: Record<string, number> = {}
  let publishedAt = 0
  let fetchedAt = 0
  for (const row of rows) {
    rates[String(row.currency)] = Number(row.perEuro)
    publishedAt = Math.max(publishedAt, Number(row.publishedAt ?? row.published_at ?? 0))
    fetchedAt = Math.max(fetchedAt, Number(row.fetchedAt ?? row.fetched_at ?? 0))
  }
  return { table: { rates, updatedAt: publishedAt }, fetchedAt }
}

export function createRatesApi(options: { fetch?: typeof fetch, now?: () => number } = {}) {
  const now = options.now ?? Date.now
  let refreshing: Promise<Response> | undefined
  const json = (data: unknown, status = 200) => Response.json({ data }, { status, headers: { 'cache-control': 'private, no-store' } })

  async function refresh(): Promise<Response> {
    if (!await currencyEnabled()) return Response.json({ error: 'Turn on exchange rates in Settings first.' }, { status: 403 })
    const stored = await storedRates()
    if (stored.table && now() - stored.fetchedAt < ratesMaxAgeMs) return json(stored.table)
    try {
      const response = await (options.fetch ?? fetch)(ratesUrl, { signal: AbortSignal.timeout(10000), redirect: 'error', headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`Rates source answered ${response.status}.`)
      const parsed = parseRates(await response.json())
      if (!parsed) throw new Error('The rates source returned an unexpected answer.')
      const fetchedAt = now()
      for (const [currency, perEuro] of Object.entries(parsed.rates)) await ExchangeRate.updateOrCreate({ currency }, { currency, perEuro, publishedAt: parsed.publishedAt, fetchedAt })
      return json({ rates: parsed.rates, updatedAt: parsed.publishedAt })
    }
    catch (error) {
      // Saved rates stay usable when the network is not.
      if (stored.table) return json(stored.table)
      return Response.json({ error: error instanceof Error ? error.message : 'Exchange rates are unavailable.' }, { status: 502 })
    }
  }

  return async (request: Request): Promise<Response | null> => {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/exchange-rates/table' && request.method === 'GET') {
      if (!await currencyEnabled()) return json(null)
      return json((await storedRates()).table)
    }
    if (pathname === '/api/exchange-rates/refresh' && request.method === 'POST') {
      refreshing ??= refresh().finally(() => { refreshing = undefined })
      return (await refreshing).clone()
    }
    return null
  }
}
