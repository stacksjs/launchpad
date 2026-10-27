import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'
import { activityActions, activityKinds } from '../../resources/functions/activity'

export default defineModel({
  name: 'LauncherActivity',
  table: 'launcher_activitys',
  traits: { useTimestamps: true, useApi: { uri: 'activity-events', middleware: [], routes: ['index', 'store'] } },
  indexes: [{ name: 'launcher_activity_occurred_at', columns: ['occurredAt'] }, { name: 'launcher_activity_session', columns: ['sessionId'] }],
  attributes: {
    eventId: { fillable: true, required: true, unique: true, validation: { rule: schema.string().min(36).max(36).required() } },
    action: { fillable: true, required: true, validation: { rule: schema.enum([...activityActions]).required() } },
    kind: { fillable: true, required: true, validation: { rule: schema.enum([...activityKinds]).required() } },
    applicationName: { fillable: true, default: '', personal: true, validation: { rule: schema.string().max(120) } },
    occurredAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).max(8640000000000000).required() } },
    recordedAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).required() } },
    timezoneOffset: { fillable: true, required: true, validation: { rule: schema.number().min(-840).max(840).required() } },
    durationMs: { fillable: true, default: 0, validation: { rule: schema.number().min(0).max(600000) } },
    sessionId: { fillable: true, required: true, validation: { rule: schema.string().min(36).max(36).required() } },
    appVersion: { fillable: true, required: true, validation: { rule: schema.string().max(40).required() } },
  },
} as const)
