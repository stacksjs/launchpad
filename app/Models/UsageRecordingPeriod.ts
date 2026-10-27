import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

/** Recording preference intervals also cover Pantry jobs completed while the app is closed. */
export default defineModel({
  name: 'UsageRecordingPeriod', table: 'usage_recording_periods',
  traits: { useTimestamps: true, useApi: { uri: 'usage-periods', middleware: [], routes: ['index', 'show'] } },
  indexes: [{ name: 'usage_recording_period_start', columns: ['startedAt', 'endedAt'] }],
  attributes: {
    startedAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).max(8640000000000000).required() } },
    endedAt: { fillable: true, default: 0, validation: { rule: schema.number().min(0).max(8640000000000000) } },
  },
} as const)
