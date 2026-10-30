import { expect, test } from 'bun:test'
import { convertCurrency, conversionResult, formatQuantity, parseConversion, resolveCurrency, resolveUnit } from '../resources/functions/convert'

const answer = (input: string) => conversionResult(input)?.content ?? null
const rates = { rates: { USD: 1.1, GBP: 0.85, JPY: 160 }, updatedAt: Date.parse('2026-10-30T00:00:00Z') }

test('lengths, mass, volume, speed, area, data and time convert correctly', () => {
  expect(answer('5 km in miles')).toBe('3.106855961')
  expect(answer('1 mi to km')).toBe('1.609344')
  expect(answer('6 ft in cm')).toBe('182.88')
  expect(answer('10 kg to lb')).toBe('22.04622622')
  expect(answer('16 oz = lb')).toBe('1')
  expect(answer('1 gal in l')).toBe('3.785411784')
  expect(answer('2 cups in ml')).toBe('473.176473')
  expect(answer('60 mph in km/h')).toBe('96.56064')
  expect(answer('1 acre in sq m')).toBe('4046.856422')
  expect(answer('1 ha to m2')).toBe('10000')
  expect(answer('2 hours in minutes')).toBe('120')
  expect(answer('1 week -> days')).toBe('7')
  expect(answer('1.5 GB in MB')).toBe('1500')
  expect(answer('1 GiB in MiB')).toBe('1024')
  expect(answer('8 bits to bytes')).toBe('1')
})

test('temperatures convert through kelvin without drifting', () => {
  expect(answer('0 c in f')).toBe('32')
  expect(answer('212 °F to °C')).toBe('100')
  expect(answer('-40 f to c')).toBe('-40')
  expect(answer('300 kelvin in celsius')).toBe('26.85')
  expect(answer('72 degrees fahrenheit in celsius')).toBe('22.22222222')
})

test('compact, grouped and signed numbers parse; anything else is not a conversion', () => {
  expect(parseConversion('5km in mi')).toEqual({ amount: 5, from: 'km', to: 'mi' })
  expect(parseConversion('1,250 m to km')).toEqual({ amount: 1250, from: 'm', to: 'km' })
  expect(parseConversion('.5 kg as g')).toEqual({ amount: 0.5, from: 'kg', to: 'g' })
  expect(parseConversion('$20 in eur')).toEqual({ amount: 20, from: 'USD', to: 'eur' })
  for (const text of ['', 'km in mi', '5 km', '5 in', 'in the morning', 'x'.repeat(200), '5 km in']) expect(parseConversion(text)).toBeNull()
})

test('units from different categories never convert', () => {
  expect(conversionResult('5 kg in km')).toBeNull()
  expect(conversionResult('5 foo in bar')).toBeNull()
  expect(resolveUnit('kg')?.category).toBe('mass')
  expect(resolveUnit('Kg')?.category).toBe('mass')
  expect(resolveUnit('furlongs')).toBeNull()
})

test('data units respect the case that changes their meaning', () => {
  expect(resolveUnit('Mb')?.symbol).toBe('Mbit')
  expect(resolveUnit('MB')?.symbol).toBe('MB')
  expect(resolveUnit('mb')?.symbol).toBe('MB')
  expect(answer('1 MB in KB')).toBe('1000')
  expect(answer('8 Mb to MB')).toBe('1')
})

test('results read well and copy as plain numbers', () => {
  expect(conversionResult('5 km in miles')?.title).toBe('5 km = 3.106855961 mi')
  expect(conversionResult('5 km in miles')?.kind).toBe('calculator')
  expect(formatQuantity(1234567.891)).toBe('1234567.891')
  expect(formatQuantity(0.1 + 0.2)).toBe('0.3')
  expect(formatQuantity(1e21)).toBe('1e21')
  expect(formatQuantity(0.0000001234)).toBe('1.234e-7')
  expect(formatQuantity(0)).toBe('0')
})

test('currencies resolve by code, name and symbol', () => {
  expect(resolveCurrency('usd')).toBe('USD')
  expect(resolveCurrency('Euros')).toBe('EUR')
  expect(resolveCurrency('pounds')).toBe('GBP')
  expect(resolveCurrency('xyz')).toBeNull()
  expect(resolveCurrency('use')).toBeNull()
})

test('currency conversion needs opt-in, then waits for rates, then uses euro based rates', () => {
  expect(conversionResult('100 usd to eur')).toMatchObject({ kind: 'setup', content: 'search' })
  expect(conversionResult('100 usd to eur', { enabled: true, table: null })).toMatchObject({ kind: 'setup', title: 'Exchange rates are still downloading' })
  const on = { enabled: true as const, table: rates }
  expect(conversionResult('110 usd to eur', on)?.content).toBe('100')
  expect(conversionResult('100 eur to usd', on)?.content).toBe('110')
  expect(conversionResult('$110 in gbp', on)?.content).toBe('85')
  expect(conversionResult('1 gbp in jpy', on)?.content).toBe('188.2353')
  expect(conversionResult('1000 eur in jpy', on)?.content).toBe('160000.00')
  expect(conversionResult('100 usd to xyz', on)).toBeNull()
  expect(conversionResult('100 usd to cad', on)).toBeNull()
  expect(conversionResult('100 usd to eur', on)?.subtitle).toContain('2026-10-30')
  expect(convertCurrency(1, 'EUR', 'EUR', rates)).toBe(1)
  expect(convertCurrency(1, 'USD', 'EUR', { rates: { USD: 0 }, updatedAt: 0 })).toBeNull()
})
