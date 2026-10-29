import { resolve } from 'node:path'
import { bundledPackageCatalog, createPackageCatalogSearch } from 'ts-pantry/catalog'
import { installedCatalog, pantryResults } from '../resources/functions/pantry'
import { createResultSearch, rankResults } from '../resources/functions/search'
import { installedApplications } from '../app/Desktop/applications'

async function main() {
  const catalog = bundledPackageCatalog()
  const installed = catalog.slice(0, 40).map(entry => ({ name: entry.domain, version: '1' }))
  const apps = await installedApplications()
  const search = createPackageCatalogSearch(catalog)
  const local = [...apps, ...pantryResults(installedCatalog(catalog, installed), apps, installed)]
  const prepareStart = performance.now()
  const searchLocal = createResultSearch(local)
  const searchPantry = createResultSearch(pantryResults(catalog, apps, installed, 'all', true))
  process.stdout.write(JSON.stringify({ preparationMs: Number((performance.now() - prepareStart).toFixed(3)) }) + '\n')
  const baselinePath = process.argv[2]
  const baseline: typeof rankResults = baselinePath ? (await import(resolve(baselinePath))).rankResults : rankResults
  const queries = ['', 't', 'thi', 'things', 'git', 'source code']
  for (const category of ['all', 'pantry']) {
    for (const mode of [baselinePath ? 'baseline' : 'per-query', 'prepared']) {
      const runSearch = (query: string) => {
        if (mode !== 'prepared') return baseline(category === 'all' ? local : pantryResults(search(query, { limit: 50000 }), apps, installed, 'all', true), query, category)
        return category === 'all' ? searchLocal(query) : searchPantry(query, category, query.trim() ? search(query, { limit: 50000 }).map(entry => `pantry:${entry.domain}`) : undefined)
      }
      for (let run = 0; run < 30; run++) runSearch(queries[run % queries.length]!)
      const samples: number[] = []
      const cpu = process.cpuUsage()
      for (let run = 0; run < 300; run++) {
        const query = queries[run % queries.length]!
        const start = performance.now()
        runSearch(query)
        samples.push(performance.now() - start)
      }
      const elapsedCpu = process.cpuUsage(cpu)
      samples.sort((a, b) => a - b)
      process.stdout.write(JSON.stringify({ category, mode, packages: catalog.length, applications: apps.length, queries: samples.length, p50Ms: Number(samples[150]!.toFixed(3)), p95Ms: Number(samples[285]!.toFixed(3)), cpuMs: Number(((elapsedCpu.user + elapsedCpu.system) / 1000).toFixed(3)) }) + '\n')
    }
  }
}

void main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
}).finally(() => installedApplications.close())
