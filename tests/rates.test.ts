import { expect, test } from 'bun:test'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import ExchangeRate from '../app/Models/ExchangeRate'
import { createRatesApi, parseRates, ratesMaxAgeMs, ratesUrl } from '../app/Desktop/rates'

const models = { AppPreference, ExchangeRate }
const payload = { amount: 1, base: 'EUR', date: '2026-10-30', rates: { USD: 1.1, GBP: 0.85, JPY: 160, CAD: 1.5, CHF: 0.92, XXX: 5, SEK: -1, AUD: 'x' } }
const post = (api: ReturnType<typeof createRatesApi>) => api(new Request('http://localhost/api/exchange-rates/refresh', { method: 'POST' }))
const enable = () => AppPreference.create({ key: 'search', value: JSON.stringify({ currency: true }) })

function source(answer: () => Response) {
  const calls: string[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input))
    expect(init?.redirect).toBe('error')
    return answer()
  }) as typeof fetch
  return { calls, fetcher }
}

test('only known currencies with positive finite rates and a real date are accepted', () => {
  expect(parseRates(payload)).toEqual({ rates: { USD: 1.1, GBP: 0.85, JPY: 160, CAD: 1.5, CHF: 0.92 }, publishedAt: Date.parse('2026-10-30') })
  for (const bad of [null, 'x', {}, { rates: {}, date: '2026-10-30' }, { rates: payload.rates, date: 'soon' }, { rates: { USD: 1 }, date: '2026-10-30' }]) expect(parseRates(bad)).toBeNull()
})

test('nothing is downloaded until exchange rates are turned on', async () => {
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    const { calls, fetcher } = source(() => Response.json(payload))
    const api = createRatesApi({ fetch: fetcher })
    expect((await post(api))?.status).toBe(403)
    expect((await api(new Request('http://localhost/api/exchange-rates/table')))?.status).toBe(200)
    expect((await (await api(new Request('http://localhost/api/exchange-rates/table')))!.json()).data).toBeNull()
    expect(calls).toEqual([])
  }
  finally { database.close() }
})

test('rates are fetched from the fixed source, saved, reused for twelve hours, then refreshed', async () => {
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    await enable()
    let clock = Date.parse('2026-10-30T09:00:00Z')
    const { calls, fetcher } = source(() => Response.json(payload))
    const api = createRatesApi({ fetch: fetcher, now: () => clock })
    const first = await (await post(api))!.json()
    expect(first.data.rates.USD).toBe(1.1)
    expect(first.data.updatedAt).toBe(Date.parse('2026-10-30'))
    expect(calls).toEqual([ratesUrl])
    expect(await ExchangeRate.count()).toBe(5)
    clock += ratesMaxAgeMs - 1000
    expect((await (await post(api))!.json()).data.rates.GBP).toBe(0.85)
    expect(calls).toHaveLength(1)
    clock += 2000
    await post(api)
    expect(calls).toHaveLength(2)
    expect(await ExchangeRate.count()).toBe(5)
    const table = await (await api(new Request('http://localhost/api/exchange-rates/table')))!.json()
    expect(table.data.rates.JPY).toBe(160)
  }
  finally { database.close() }
})

test('concurrent refreshes share one download and failures keep the saved rates', async () => {
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    await enable()
    let clock = 1_000_000
    let mode: 'ok' | 'down' | 'junk' = 'ok'
    const { calls, fetcher } = source(() => mode === 'ok' ? Response.json(payload) : mode === 'junk' ? Response.json({ nope: true }) : new Response('down', { status: 503 }))
    const api = createRatesApi({ fetch: fetcher, now: () => clock })
    const [a, b] = await Promise.all([post(api), post(api)])
    expect(a?.status).toBe(200)
    expect(b?.status).toBe(200)
    expect(calls).toHaveLength(1)
    clock += ratesMaxAgeMs + 1
    for (mode of ['down', 'junk'] as const) {
      const response = await post(api)
      expect(response?.status).toBe(200)
      expect((await response!.json()).data.rates.USD).toBe(1.1)
    }
  }
  finally { database.close() }
})

test('without saved rates a failed download is a clear error, and the model API is read only', async () => {
  const database = openNativeDatabase({ path: ':memory:', models })
  try {
    await enable()
    const api = createRatesApi({ fetch: source(() => new Response('down', { status: 503 })).fetcher })
    const response = await post(api)
    expect(response?.status).toBe(502)
    expect((await response!.json()).error).toContain('503')
    const modelApi = createNativeModelApi({ models, authorize: () => true })
    expect((await modelApi(new Request('http://localhost/api/exchange-rates', { method: 'POST', body: '{}' })))?.status).toBe(405)
  }
  finally { database.close() }
})
