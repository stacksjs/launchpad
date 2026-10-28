import { bundledPackageCatalog, createPackageCatalogSearch, searchPackageCatalog } from 'ts-pantry/catalog'
import { installedCatalog, pantryResults } from '../resources/functions/pantry'
import { rankResults } from '../resources/functions/search'
import { installedApplications } from '../app/Desktop/applications'

async function main() {
  const catalog = bundledPackageCatalog()
  const installed = catalog.slice(0, 40).map(entry => ({ name: entry.domain, version: '1' }))
  const apps = await installedApplications()
  const search = createPackageCatalogSearch(catalog)
  const local = [...apps, ...pantryResults(installedCatalog(catalog, installed), apps, installed)]
  const queries = ['', 't', 'thi', 'things', 'git', 'source code']
  for (const category of ['all', 'pantry']) {
    for (const mode of ['previous', 'prepared']) {
      const samples: number[] = []
      for (let run = 0; run < 120; run++) {
        const query = queries[run % queries.length]!
        const start = performance.now()
        if (mode === 'previous') {
          const packages = pantryResults(searchPackageCatalog(catalog, query, { limit: 50000 }), apps, installed, 'all', category === 'pantry')
          rankResults(category === 'all' ? [...apps, ...packages.filter(item => item.installedVersion)] : packages, query, category)
        }
        else if (category === 'all') rankResults(local, query)
        else rankResults(pantryResults(search(query, { limit: 50000 }), apps, installed, 'all', true), query, category)
        samples.push(performance.now() - start)
      }
      samples.sort((a, b) => a - b)
      process.stdout.write(JSON.stringify({ category, mode, packages: catalog.length, applications: apps.length, p50Ms: Number(samples[60]!.toFixed(3)), p95Ms: Number(samples[114]!.toFixed(3)) }) + '\n')
    }
  }
}

void main().catch((error) => {
  process.stderr.write(String(error) + '\n')
  process.exitCode = 1
})
