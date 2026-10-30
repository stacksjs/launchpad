import { calculate } from '../resources/functions/calculator'
import { emojiResults } from '../resources/functions/emoji'
import { composeResults } from '../resources/functions/launcher-results'
import { createResultSearch } from '../resources/functions/search'
import type { Result } from '../resources/functions/search'
import { defaultSearchSettings } from '../resources/functions/search-settings'
import { systemCommandResults } from '../resources/functions/system-commands'
import { extensionResults, sampleManifest } from '../resources/functions/extensions'
import { installedApplications } from '../app/Desktop/applications'

const percentile = (samples: number[], p: number) => samples.sort((a, b) => a - b)[Math.min(samples.length - 1, Math.floor(samples.length * p))]!
const round = (value: number) => Number(value.toFixed(3))

async function main() {
  const apps = await installedApplications()
  const files: Result[] = Array.from({ length: 30 }, (_, i) => ({ key: `file:/h/Document ${i}.pdf`, title: `Document ${i}.pdf`, subtitle: '~/Documents', kind: 'file', content: `/h/Document ${i}.pdf`, detail: `/h/Document ${i}.pdf` }))

  let start = performance.now()
  const local = createResultSearch([...apps, ...systemCommandResults(), ...extensionResults([{ name: 'Team shortcuts', manifest: sampleManifest }])])
  const localMs = performance.now() - start
  start = performance.now()
  const emoji = createResultSearch(emojiResults())
  const emojiMs = performance.now() - start
  process.stdout.write(JSON.stringify({ applications: apps.length, prepareLocalMs: round(localMs), prepareEmojiMs: round(emojiMs) }) + '\n')

  const base = { searchLocal: local, searchEmoji: emoji, files, windows: [], contacts: [], events: [], rates: { enabled: false } as const, settings: defaultSearchSettings, calculate }
  const typed = (word: string) => Array.from({ length: word.length }, (_, i) => word.slice(0, i + 1))
  const scenarios: Record<string, string[]> = {
    typing: [...typed('safari'), ...typed('dark mode'), ...typed('annual report')],
    math: ['2', '2+', '2+2', '12 * 3', '5 km in', '5 km in mi', '100 usd to eur'],
    emoji: [':', ':r', ':ro', ':roc', ':rocket'],
    idle: ['', '', ''],
  }
  for (const [name, queries] of Object.entries(scenarios)) {
    for (let warm = 0; warm < 20; warm++) for (const query of queries) composeResults({ ...base, category: 'all', query })
    const samples: number[] = []
    const cpu = process.cpuUsage()
    for (let run = 0; run < 400; run++) {
      const query = queries[run % queries.length]!
      const begin = performance.now()
      composeResults({ ...base, category: 'all', query })
      samples.push(performance.now() - begin)
    }
    const used = process.cpuUsage(cpu)
    process.stdout.write(JSON.stringify({ scenario: name, runs: samples.length, p50Ms: round(percentile(samples, 0.5)), p95Ms: round(percentile(samples, 0.95)), maxMs: round(Math.max(...samples)), cpuMs: round((used.user + used.system) / 1000) }) + '\n')
  }
}

void main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
}).finally(() => installedApplications.close())
