import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

/** Cumulative checkpoints keep an always-running launcher to a few rows per day. */
export default defineModel({
  name: 'LauncherUsageDay', table: 'launcher_usage_days',
  traits: { useTimestamps: true, useApi: { uri: 'usage-days', middleware: [], routes: ['index', 'show'] } },
  indexes: [{ name: 'launcher_usage_day', columns: ['day'] }, { name: 'launcher_usage_day_session', columns: ['sessionId'] }],
  attributes: {
    bucketKey: { fillable: true, required: true, unique: true, validation: { rule: schema.string().max(64).required() } },
    sessionId: { fillable: true, required: true, validation: { rule: schema.string().min(36).max(36).required() } },
    day: { fillable: true, required: true, validation: { rule: schema.string().min(10).max(10).required() } },
    timezoneOffset: { fillable: true, required: true, validation: { rule: schema.number().min(-840).max(840).required() } },
    runningMs: { fillable: true, default: 0, validation: { rule: schema.number().min(0).max(Number.MAX_SAFE_INTEGER) } },
    visibleMs: { fillable: true, default: 0, validation: { rule: schema.number().min(0).max(Number.MAX_SAFE_INTEGER) } },
    lastSeenAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).required() } },
    appVersion: { fillable: true, required: true, validation: { rule: schema.string().max(40).required() } },
  },
} as const)
