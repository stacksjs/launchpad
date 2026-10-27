import ClipboardEntry from '../Models/ClipboardEntry'
import AppPreference from '../Models/AppPreference'
import LaunchRecord from '../Models/LaunchRecord'

/** Keep a bounded local text history. Credential material never belongs here. */
export async function pruneClipboardHistory(days?: number, now = Date.now()) {
  if (days === undefined) {
    const preference = await AppPreference.where('key', 'history').first()
    try {
      const configured = JSON.parse(preference?.value || '{}').days
      days = [1, 7, 30].includes(configured) ? configured : 7
    }
    catch { days = 7 }
  }
  const rows = await ClipboardEntry.orderBy('id', 'desc').limit(1000).get()
  for (const [index, row] of rows.entries()) {
    const captured = Number(row.capturedAt ?? row.captured_at ?? 0)
    if (index >= 200 || (captured > 0 && captured < now - days! * 86400000)) {
      await ClipboardEntry.destroy(row.id)
      await LaunchRecord.where('key', `clipboard:${row.id}`).delete()
    }
  }
}

export async function clearClipboardHistory() {
  await ClipboardEntry.where('id', '>', 0).delete()
  await LaunchRecord.where('key', 'like', 'clipboard:%').delete()
}
