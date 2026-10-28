import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Result } from '../../resources/functions/search'
import { readApplicationMetadata } from '@stacksjs/desktop/application-metadata'

/** Scan application folders without walking inside bundles or following directory symlinks. */
export function createApplicationDiscovery(roots = ['/Applications', '/System/Applications', join(homedir(), 'Applications')]) {
  let pending: Promise<Result[]> | undefined
  return (): Promise<Result[]> => {
    pending ??= (async () => {
      const apps = new Map<string, Result>()
      const directories = [...new Set(roots)].map(path => ({ path, depth: 0 }))
      while (directories.length) {
        await Promise.all(directories.splice(0, 4).map(async ({ path: root, depth }) => {
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
              const metadata = readApplicationMetadata(path)
              const title = metadata?.displayName || filename
              const searchAliases = [...new Set([filename, metadata?.bundleName, metadata?.bundleId].filter((value): value is string => Boolean(value)))].filter(value => value !== title)
              apps.set(path, { key: path, title, searchAliases, subtitle: 'Application', kind: 'application', content: path })
            }
            else if (entry.isDirectory() && depth < 4) directories.push({ path, depth: depth + 1 })
          }
        }))
      }
      return [...apps.values()].sort((a, b) => a.title.localeCompare(b.title) || a.key.localeCompare(b.key))
    })().finally(() => { pending = undefined })
    return pending
  }
}

export const installedApplications = createApplicationDiscovery()
