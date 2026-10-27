import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

/** One terminal receipt per Pantry job, without installer output or credentials. */
export default defineModel({
  name: 'PantryInstallation', table: 'pantry_installations',
  traits: { useTimestamps: true, useApi: { uri: 'pantry-installations', middleware: [], routes: ['index', 'show'] } },
  indexes: [{ name: 'pantry_installation_finished', columns: ['finishedAt'] }],
  attributes: {
    jobId: { fillable: true, required: true, unique: true, validation: { rule: schema.string().min(36).max(36).required() } },
    domain: { fillable: true, required: true, personal: true, validation: { rule: schema.string().max(255).required() } },
    packageKind: { fillable: true, required: true, validation: { rule: schema.enum(['app', 'cli', 'library', 'font']).required() } },
    status: { fillable: true, required: true, validation: { rule: schema.enum(['succeeded', 'failed']).required() } },
    requestedAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).max(8640000000000000).required() } },
    startedAt: { fillable: true, default: 0, validation: { rule: schema.number().min(0).max(8640000000000000) } },
    finishedAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).max(8640000000000000).required() } },
    timezoneOffset: { fillable: true, required: true, validation: { rule: schema.number().min(-840).max(840).required() } },
    recordedAt: { fillable: true, required: true, validation: { rule: schema.number().min(0).required() } },
    appVersion: { fillable: true, required: true, validation: { rule: schema.string().max(40).required() } },
  },
} as const)
