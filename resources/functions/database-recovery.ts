/**
 * Starting when the local database cannot be reconciled with the models this build was compiled against.
 *
 * The native model boot refuses any upgrade that would drop something, which is right for a server migration and
 * wrong for a launcher: it leaves the app unable to start, and because Launchpad has no Dock icon it fails with
 * nothing on screen at all. Rolling back to an earlier release is enough to cause it.
 *
 * A launcher that will not open is worse than a launcher that has forgotten something, so the store is set aside and
 * a fresh one takes its place. Set aside, never deleted: the file keeps its contents and its name says when it moved.
 */

/** The files SQLite keeps beside a database. A journal left from the old store would be read against the new one. */
export const databaseSidecars = ['-wal', '-shm'] as const

/**
 * Whether a failure to open is the schema refusing to reconcile, rather than a disk that is full or a path that
 * cannot be written. Only the first is worth recovering from; the rest should still fail loudly.
 */
export function isSchemaConflict(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : ''
  return /destructive changes|provide an explicit data migration/i.test(message)
}

/** Where a database is moved so it keeps its contents and says when it was set aside. */
export function asidePath(path: string, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace(/Z$/, '')
  return `${path}.${stamp}.aside`
}

/** What to tell someone whose history was set aside, naming the file so it can be found again. */
export function recoveryNotice(movedTo: string): string {
  return `Launchpad started with a new database because the old one was written by a newer version. The previous one is kept at ${movedTo}.`
}
