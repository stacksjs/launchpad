import { readdir } from 'node:fs/promises'
import { watch } from 'node:fs'
import type { FSWatcher } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Result } from '../../resources/functions/search'
import { readApplicationMetadata } from '@stacksjs/desktop/application-metadata'

/** Scan application folders without walking inside bundles or following directory symlinks. */
export function createApplicationDiscovery(roots = ['/Applications', '/System/Applications', join(homedir(), 'Applications')], options: { watch?: boolean, maxAgeMs?: number } = {}) {
  let pending: Promise<Result[]> | undefined
  let snapshot: Result[] | undefined
  let scannedAt = 0
  let revision = 0
  let scannedRevision = -1
  const watchers = new Map<string, FSWatcher>()
  const metadata = new Map<string, ReturnType<typeof readApplicationMetadata>>()
  const maxAge = options.maxAgeMs ?? 30000
  function observe(root: string) {
    if (watchers.has(root)) return false
    try {
      // Watch only discovery directories, never entire app resource trees.
      const watcher = watch(root, (_event, filename) => {
        revision++
        if (filename && /\.app$/i.test(filename)) metadata.delete(join(root, filename))
        else metadata.clear()
      })
      watcher.unref()
      watcher.on('error', () => {
        watcher.close()
        watchers.delete(root)
        revision++
        metadata.clear()
      })
      watchers.set(root, watcher)
      return true
    }
    catch { /* Missing or unwatchable roots are retried on the next visible refresh. */ }
    return false
  }
  const discover = (): Promise<Result[]> => {
    if (options.watch) {
      for (const root of new Set(roots)) if (observe(root)) revision++
      if (snapshot && scannedRevision === revision && performance.now() - scannedAt < maxAge) return Promise.resolve(snapshot)
    }
    pending ??= (async () => {
      const scanningRevision = revision
      // A periodic safety scan also refreshes metadata in case a filesystem event was lost.
      if (!options.watch || performance.now() - scannedAt >= maxAge) metadata.clear()
      const apps = new Map<string, Result>()
      const neededWatchers = new Set(roots)
      const directories = [...new Set(roots)].map(path => ({ path, depth: 0 }))
      while (directories.length) {
        await Promise.all(directories.splice(0, 4).map(async ({ path: root, depth }) => {
          if (options.watch) {
            neededWatchers.add(root)
            observe(root)
          }
          let entries
          try { entries = await readdir(root, { withFileTypes: true }) }
          catch (error) {
            if (['ENOENT', 'EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code || '')) return
            throw error
          }
          for (const entry of entries) {
            if (entry.name.startsWith('.')) continue
            const path = join(root, entry.name)
            if (/\.app$/i.test(entry.name) && (entry.isDirectory() || entry.isSymbolicLink())) {
              const filename = entry.name.slice(0, -4)
              if (!metadata.has(path)) metadata.set(path, readApplicationMetadata(path))
              const info = metadata.get(path)
              const title = info?.displayName || filename
              const searchAliases = [...new Set([filename, info?.bundleName, info?.bundleId].filter((value): value is string => Boolean(value)))].filter(value => value !== title)
              apps.set(path, { key: path, title, searchAliases, subtitle: 'Application', kind: 'application', content: path })
            }
            else if (entry.isDirectory() && depth < 4) directories.push({ path, depth: depth + 1 })
          }
        }))
      }
      for (const path of metadata.keys()) if (!apps.has(path)) metadata.delete(path)
      for (const [path, watcher] of watchers) if (!neededWatchers.has(path)) {
        watcher.close()
        watchers.delete(path)
      }
      snapshot = [...apps.values()].sort((a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key))
      scannedAt = performance.now()
      scannedRevision = scanningRevision
      if (revision !== scanningRevision) metadata.clear()
      return snapshot
    })().finally(() => { pending = undefined })
    return pending
  }
  return Object.assign(discover, { close: () => {
    for (const watcher of watchers.values()) watcher.close()
    watchers.clear()
    metadata.clear()
    snapshot = undefined
    revision++
  } })
}

export const installedApplications = createApplicationDiscovery(undefined, { watch: true })
