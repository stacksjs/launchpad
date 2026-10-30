import type { Result } from './search'

interface UnitDefinition {
  /** Canonical symbol shown in results. */
  symbol: string
  /** Case-insensitive spellings, matched after normalization. */
  names: readonly string[]
  /** Case-sensitive spellings, tried first, for units whose case changes their meaning. */
  exact?: readonly string[]
  /** Size of one unit in the category's base unit. */
  factor: number
}
interface Category { name: string, units: readonly UnitDefinition[] }

const plural = (...singulars: string[]) => singulars.flatMap(name => [name, `${name}s`])

const categories: readonly Category[] = [
  { name: 'length', units: [
    { symbol: 'mm', names: ['mm', ...plural('millimeter', 'millimetre')], factor: 0.001 },
    { symbol: 'cm', names: ['cm', ...plural('centimeter', 'centimetre')], factor: 0.01 },
    { symbol: 'm', names: ['m', ...plural('meter', 'metre')], factor: 1 },
    { symbol: 'km', names: ['km', ...plural('kilometer', 'kilometre')], factor: 1000 },
    { symbol: 'in', names: ['in', 'inch', 'inches', '"'], factor: 0.0254 },
    { symbol: 'ft', names: ['ft', 'foot', 'feet', "'"], factor: 0.3048 },
    { symbol: 'yd', names: ['yd', ...plural('yard')], factor: 0.9144 },
    { symbol: 'mi', names: ['mi', ...plural('mile')], factor: 1609.344 },
    { symbol: 'nmi', names: ['nmi', ...plural('nautical mile')], factor: 1852 },
  ] },
  { name: 'mass', units: [
    { symbol: 'mg', names: ['mg', ...plural('milligram')], factor: 0.001 },
    { symbol: 'g', names: ['g', ...plural('gram')], factor: 1 },
    { symbol: 'kg', names: ['kg', 'kgs', ...plural('kilogram', 'kilo')], factor: 1000 },
    { symbol: 't', names: ['t', ...plural('tonne', 'metric ton')], factor: 1_000_000 },
    { symbol: 'oz', names: ['oz', ...plural('ounce')], factor: 28.349523125 },
    { symbol: 'lb', names: ['lb', 'lbs', ...plural('pound')], factor: 453.59237 },
    { symbol: 'st', names: ['st', 'stone', 'stones'], factor: 6350.29318 },
  ] },
  { name: 'volume', units: [
    { symbol: 'ml', names: ['ml', ...plural('milliliter', 'millilitre')], factor: 1 },
    { symbol: 'cl', names: ['cl', ...plural('centiliter', 'centilitre')], factor: 10 },
    { symbol: 'dl', names: ['dl', ...plural('deciliter', 'decilitre')], factor: 100 },
    { symbol: 'l', names: ['l', ...plural('liter', 'litre')], factor: 1000 },
    { symbol: 'tsp', names: ['tsp', ...plural('teaspoon')], factor: 4.92892159375 },
    { symbol: 'tbsp', names: ['tbsp', ...plural('tablespoon')], factor: 14.78676478125 },
    { symbol: 'fl oz', names: ['fl oz', 'floz', ...plural('fluid ounce')], factor: 29.5735295625 },
    { symbol: 'cup', names: plural('cup'), factor: 236.5882365 },
    { symbol: 'pt', names: ['pt', ...plural('pint')], factor: 473.176473 },
    { symbol: 'qt', names: ['qt', ...plural('quart')], factor: 946.352946 },
    { symbol: 'gal', names: ['gal', ...plural('gallon')], factor: 3785.411784 },
  ] },
  { name: 'speed', units: [
    { symbol: 'm/s', names: ['m/s', 'mps', ...plural('meter per second', 'metre per second')], factor: 1 },
    { symbol: 'km/h', names: ['km/h', 'kmh', 'kph', 'kmph', ...plural('kilometer per hour', 'kilometre per hour')], factor: 1000 / 3600 },
    { symbol: 'mph', names: ['mph', ...plural('mile per hour')], factor: 0.44704 },
    { symbol: 'kn', names: ['kn', 'kt', 'kts', ...plural('knot')], factor: 1852 / 3600 },
    { symbol: 'ft/s', names: ['ft/s', 'fps', ...plural('foot per second')], factor: 0.3048 },
  ] },
  { name: 'area', units: [
    { symbol: 'cm²', names: ['cm2', 'sq cm', ...plural('square centimeter', 'square centimetre')], factor: 0.0001 },
    { symbol: 'm²', names: ['m2', 'sqm', 'sq m', ...plural('square meter', 'square metre')], factor: 1 },
    { symbol: 'km²', names: ['km2', 'sq km', ...plural('square kilometer', 'square kilometre')], factor: 1_000_000 },
    { symbol: 'ha', names: ['ha', ...plural('hectare')], factor: 10_000 },
    { symbol: 'ft²', names: ['ft2', 'sqft', 'sq ft', ...plural('square foot'), 'square feet'], factor: 0.09290304 },
    { symbol: 'ac', names: ['ac', ...plural('acre')], factor: 4046.8564224 },
    { symbol: 'mi²', names: ['mi2', 'sq mi', ...plural('square mile')], factor: 2_589_988.110336 },
  ] },
  { name: 'data', units: [
    { symbol: 'bit', names: ['bit', 'bits'], factor: 1 / 8 },
    { symbol: 'B', names: ['b', 'byte', 'bytes'], exact: ['B'], factor: 1 },
    { symbol: 'KB', names: ['kb', ...plural('kilobyte')], exact: ['KB', 'kB'], factor: 1e3 },
    { symbol: 'MB', names: ['mb', ...plural('megabyte')], exact: ['MB'], factor: 1e6 },
    { symbol: 'GB', names: ['gb', ...plural('gigabyte')], exact: ['GB'], factor: 1e9 },
    { symbol: 'TB', names: ['tb', ...plural('terabyte')], exact: ['TB'], factor: 1e12 },
    { symbol: 'PB', names: ['pb', ...plural('petabyte')], exact: ['PB'], factor: 1e15 },
    { symbol: 'KiB', names: ['kib', ...plural('kibibyte')], exact: ['KiB'], factor: 1024 },
    { symbol: 'MiB', names: ['mib', ...plural('mebibyte')], exact: ['MiB'], factor: 1024 ** 2 },
    { symbol: 'GiB', names: ['gib', ...plural('gibibyte')], exact: ['GiB'], factor: 1024 ** 3 },
    { symbol: 'TiB', names: ['tib', ...plural('tebibyte')], exact: ['TiB'], factor: 1024 ** 4 },
    { symbol: 'kbit', names: ['kbit', 'kbits', ...plural('kilobit')], exact: ['Kb', 'kb/s'], factor: 125 },
    { symbol: 'Mbit', names: ['mbit', 'mbits', ...plural('megabit')], exact: ['Mb'], factor: 125_000 },
    { symbol: 'Gbit', names: ['gbit', 'gbits', ...plural('gigabit')], exact: ['Gb'], factor: 125_000_000 },
  ] },
  { name: 'time', units: [
    { symbol: 'ms', names: ['ms', ...plural('millisecond')], factor: 0.001 },
    { symbol: 's', names: ['s', 'sec', 'secs', ...plural('second')], factor: 1 },
    { symbol: 'min', names: ['min', 'mins', ...plural('minute')], factor: 60 },
    { symbol: 'h', names: ['h', 'hr', 'hrs', ...plural('hour')], factor: 3600 },
    { symbol: 'd', names: ['d', ...plural('day')], factor: 86_400 },
    { symbol: 'wk', names: ['wk', 'wks', ...plural('week')], factor: 604_800 },
    { symbol: 'mo', names: ['mo', ...plural('month')], factor: 2_629_746 },
    { symbol: 'yr', names: ['yr', 'yrs', 'y', ...plural('year')], factor: 31_557_600 },
  ] },
]

type Temperature = 'C' | 'F' | 'K'
const temperatureNames: Record<string, Temperature> = {
  c: 'C', celsius: 'C', centigrade: 'C', '°c': 'C', 'degrees c': 'C', 'degrees celsius': 'C',
  f: 'F', fahrenheit: 'F', '°f': 'F', 'degrees f': 'F', 'degrees fahrenheit': 'F',
  k: 'K', kelvin: 'K', kelvins: 'K',
}

const exactUnits = new Map<string, { category: string, unit: UnitDefinition }>()
const looseUnits = new Map<string, { category: string, unit: UnitDefinition }>()
for (const category of categories) {
  for (const unit of category.units) {
    for (const name of unit.exact ?? []) exactUnits.set(name, { category: category.name, unit })
    for (const name of unit.names) if (!looseUnits.has(name)) looseUnits.set(name, { category: category.name, unit })
  }
}

function normalizeUnit(value: string): string {
  return value.trim().replace(/\.$/, '').replace(/²/g, '2').replace(/\s+/g, ' ')
}

export interface ResolvedUnit { category: string, symbol: string, factor: number, temperature?: Temperature }

export function resolveUnit(value: string): ResolvedUnit | null {
  const raw = normalizeUnit(value)
  const exact = exactUnits.get(raw)
  if (exact) return { category: exact.category, symbol: exact.unit.symbol, factor: exact.unit.factor }
  const name = raw.toLocaleLowerCase()
  const temperature = Object.hasOwn(temperatureNames, name) ? temperatureNames[name] : undefined
  if (temperature) return { category: 'temperature', symbol: `°${temperature}`, factor: 1, temperature }
  const found = looseUnits.get(name)
  return found ? { category: found.category, symbol: found.unit.symbol, factor: found.unit.factor } : null
}

const toKelvin = { C: (v: number) => v + 273.15, F: (v: number) => (v - 32) * 5 / 9 + 273.15, K: (v: number) => v }
const fromKelvin = { C: (v: number) => v - 273.15, F: (v: number) => (v - 273.15) * 9 / 5 + 32, K: (v: number) => v }

/** Null when the units belong to different categories, such as kilograms and kilometers. */
export function convertUnit(amount: number, from: ResolvedUnit, to: ResolvedUnit): number | null {
  if (from.category !== to.category) return null
  if (from.temperature && to.temperature) return fromKelvin[to.temperature](toKelvin[from.temperature](amount))
  return amount * from.factor / to.factor
}

export interface ParsedConversion { amount: number, from: string, to: string }

const symbolCurrencies: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }
const number = String.raw`[-+]?(?:\d{1,3}(?:,\d{3})+|\d*)(?:\.\d+)?(?:e[-+]?\d+)?`
const separator = String.raw`\s*(?:\s(?:in|to|as|into)\s|=|->|→|=>)\s*`
const pattern = new RegExp(String.raw`^\s*([$€£¥])?\s*(${number})\s*([^\d\s=→-][^=→]*?)?${separator}(.+?)\s*$`, 'iu')

const hasSeparator = /\s(?:in|to|as|into)\s|=|->|→/i

export function parseConversion(input: string): ParsedConversion | null {
  if (input.length > 120) return null
  // Almost every keystroke is not a conversion; two cheap tests rule most of them out before the pattern runs.
  if (!/\d/.test(input) || !hasSeparator.test(input)) return null
  const match = pattern.exec(input.replace(/\bsq\.?\s+/gi, 'sq '))
  if (!match) return null
  const [, symbol, digits, unit, target] = match
  if (!digits || !/\d/.test(digits)) return null
  const amount = Number(digits.replaceAll(',', ''))
  const from = symbol ? symbolCurrencies[symbol]! : (unit ?? '').trim()
  if (!Number.isFinite(amount) || !from || !target) return null
  return { amount, from, to: target.trim() }
}

export const currencyCodes = ['AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'] as const
const currencyNames: Record<string, string> = { dollar: 'USD', dollars: 'USD', buck: 'USD', bucks: 'USD', euro: 'EUR', euros: 'EUR', pound: 'GBP', pounds: 'GBP', sterling: 'GBP', yen: 'JPY', franc: 'CHF', francs: 'CHF', rupee: 'INR', rupees: 'INR', yuan: 'CNY', won: 'KRW', peso: 'MXN', pesos: 'MXN', krona: 'SEK', rand: 'ZAR', lira: 'TRY' }

export function resolveCurrency(value: string): string | null {
  const key = value.trim().replace(/\.$/, '')
  const code = key.toUpperCase()
  if ((currencyCodes as readonly string[]).includes(code) && /^[a-z]{3}$/i.test(key)) return code
  const name = key.toLocaleLowerCase()
  return Object.hasOwn(currencyNames, name) ? currencyNames[name]! : null
}

/** Rates are quoted per one euro, as published by the European Central Bank. EUR itself is implied. */
export interface ExchangeRates { rates: Record<string, number>, updatedAt: number }

export function convertCurrency(amount: number, from: string, to: string, table: ExchangeRates): number | null {
  const rate = (code: string) => code === 'EUR' ? 1 : table.rates[code]
  const source = rate(from)
  const target = rate(to)
  if (!source || !target || !(source > 0) || !(target > 0)) return null
  return amount / source * target
}

/** Plain decimal text that pastes cleanly into other apps: no grouping, no exponent unless huge or tiny. */
export function formatQuantity(value: number, digits = 10): string {
  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'
  const magnitude = Math.abs(value)
  if (magnitude >= 1e15 || magnitude < 1e-6) return value.toExponential(6).replace(/\.?0+e/, 'e').replace('e+', 'e')
  return String(Number(value.toPrecision(digits)))
}

export type RatesState = { enabled: false } | { enabled: true, table: ExchangeRates | null }

/** A unit or currency conversion shaped like a calculator row, or a prompt to enable rates. Null when the text is not a conversion. */
export function conversionResult(input: string, rates: RatesState = { enabled: false }): Result | null {
  const parsed = parseConversion(input)
  if (!parsed) return null
  const fromUnit = resolveUnit(parsed.from)
  const toUnit = resolveUnit(parsed.to)
  if (fromUnit && toUnit) {
    const value = convertUnit(parsed.amount, fromUnit, toUnit)
    if (value === null) return null
    const answer = formatQuantity(value)
    return { key: 'conversion', title: `${formatQuantity(parsed.amount)} ${fromUnit.symbol} = ${answer} ${toUnit.symbol}`, subtitle: 'Conversion · Copy result', kind: 'calculator', content: answer }
  }
  const from = resolveCurrency(parsed.from)
  const to = resolveCurrency(parsed.to)
  if (!from || !to) return null
  if (!rates.enabled) return { key: 'conversion-setup', title: `Turn on exchange rates to convert ${from} to ${to}`, subtitle: 'Settings · Rates download once a day, with no search text', kind: 'setup', content: 'search' }
  if (!rates.table) return { key: 'conversion-setup', title: 'Exchange rates are still downloading', subtitle: 'Try again in a moment', kind: 'setup', content: 'search' }
  const value = convertCurrency(parsed.amount, from, to, rates.table)
  if (value === null) return null
  const answer = value >= 1000 ? value.toFixed(2) : formatQuantity(Number(value.toFixed(4)))
  const day = new Date(rates.table.updatedAt).toISOString().slice(0, 10)
  return { key: 'conversion', title: `${formatQuantity(parsed.amount)} ${from} = ${answer} ${to}`, subtitle: `Conversion · European Central Bank rates from ${day} · Copy result`, kind: 'calculator', content: answer }
}
