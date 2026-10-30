import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { releaseOrm } from '@stacksjs/query-builder'
import { createNativeModelApi, openNativeDatabase } from '@stacksjs/orm/native'
import AppPreference from '../app/Models/AppPreference'
import CatalogPackage from '../app/Models/CatalogPackage'
import ClipboardEntry from '../app/Models/ClipboardEntry'
import Command from '../app/Models/Command'
import ExchangeRate from '../app/Models/ExchangeRate'
import Extension from '../app/Models/Extension'
import LaunchRecord from '../app/Models/LaunchRecord'
import LauncherActivity from '../app/Models/LauncherActivity'
import LauncherUsageDay from '../app/Models/LauncherUsageDay'
import PantryInstallation from '../app/Models/PantryInstallation'
import UsageRecordingPeriod from '../app/Models/UsageRecordingPeriod'

// The models every earlier release shipped. Newer releases add tables; they never change or remove these.
const previous = { Command, LaunchRecord, ClipboardEntry, AppPreference, LauncherActivity, LauncherUsageDay, UsageRecordingPeriod, PantryInstallation, CatalogPackage }
const current = { ...previous, ExchangeRate, Extension }

test('a database from the previous release upgrades in place and keeps every row', async () => {
  const root = mkdtempSync(join(tmpdir(), 'launchpad-upgrade-'))
  const path = join(root, 'launchpad.sqlite')
  try {
    const first = openNativeDatabase({ path, models: previous })
    await AppPreference.create({ key: 'appearance', value: 'dark' })
    await AppPreference.create({ key: 'usage', value: '{"enabled":true}' })
    await LaunchRecord.create({ key: '/Applications/Mail.app', favorite: true, launches: 7, lastUsed: 123 })
    await Command.create({ title: 'Docs', kind: 'quicklink', content: 'https://example.com/?q={query}', alias: 'docs' })
    releaseOrm()
    first.close()

    const upgraded = openNativeDatabase({ path, models: current })
    try {
      expect((await AppPreference.where('key', 'appearance').first())?.value).toBe('dark')
      expect((await LaunchRecord.where('key', '/Applications/Mail.app').first())?.launches).toBe(7)
      expect((await Command.where('alias', 'docs').first())?.title).toBe('Docs')

      // The new tables work, and the new preference key is accepted by the generated API.
      const api = createNativeModelApi({ models: current, authorize: () => true })
      const post = (uri: string, body: object) => api(new Request(`http://localhost/api/${uri}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }))
      expect((await post('preferences', { key: 'search', value: '{"files":false}' }))?.status).toBe(201)
      expect((await post('extensions', { name: 'Pack', manifest: '{"schema":1}', enabled: true }))?.status).toBe(201)
      await ExchangeRate.create({ currency: 'USD', perEuro: 1.1, publishedAt: 1, fetchedAt: 2 })
      expect(await ExchangeRate.count()).toBe(1)
      expect((await post('exchange-rates', { currency: 'GBP', perEuro: 0.8 }))?.status).toBe(405)
    }
    finally {
      releaseOrm()
      upgraded.close()
    }

    // Opening it a third time with nothing new to apply changes nothing.
    const again = openNativeDatabase({ path, models: current })
    try {
      expect(await AppPreference.count()).toBe(3)
      expect(await ExchangeRate.count()).toBe(1)
    }
    finally {
      releaseOrm()
      again.close()
    }
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})
