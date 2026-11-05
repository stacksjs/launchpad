import { expect, test } from 'bun:test'
import { asidePath, databaseSidecars, isSchemaConflict, recoveryNotice } from '../resources/functions/database-recovery'

test('only a schema that will not reconcile is worth recovering from', () => {
  // The exact message the native model boot throws, which is what bricked a 1.1.0 install.
  expect(isSchemaConflict(new Error('Native model upgrade contains destructive changes; provide an explicit data migration'))).toBe(true)
  expect(isSchemaConflict('provide an explicit data migration')).toBe(true)
  // A disk that is full or a path that cannot be written should still fail loudly rather than lose the store.
  for (const reason of [new Error('SQLITE_FULL: database or disk is full'), new Error('EACCES: permission denied'), new Error(''), null, undefined, 42, {}])
    expect(isSchemaConflict(reason)).toBe(false)
})

test('the old store keeps its contents and says when it was set aside', () => {
  const path = asidePath('/d/launchpad.sqlite', new Date('2026-11-04T17:30:05.123Z'))
  expect(path).toBe('/d/launchpad.sqlite.2026-11-04T17-30-05-123.aside')
  // It sits beside the original, so nothing has to be hunted for, and the name cannot collide with the live file.
  expect(path.startsWith('/d/launchpad.sqlite')).toBe(true)
  expect(path).not.toBe('/d/launchpad.sqlite')
  expect(asidePath('/d/x.sqlite', new Date('2026-01-02T03:04:05.000Z'))).toEndWith('.aside')
})

test('the journal files move too, or they would be read against the new store', () => {
  expect(databaseSidecars).toEqual(['-wal', '-shm'])
})

test('the notice names the file, so the old history can be found again', () => {
  const notice = recoveryNotice('/d/launchpad.sqlite.2026-11-04T17-30-05-123.aside')
  expect(notice).toContain('/d/launchpad.sqlite.2026-11-04T17-30-05-123.aside')
  expect(notice).toContain('newer version')
})
