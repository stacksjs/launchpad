import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'ClipboardEntry', table: 'clipboard_entries',
  traits: { useTimestamps: true, useApi: { uri: 'clipboard-entries', middleware: [], routes: ['index', 'store', 'destroy'] } },
  attributes: {
    content: { fillable: true, required: true, personal: true, validation: { rule: schema.string().min(1).max(20000).required() } },
    capturedAt: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
    sourceApp: { fillable: true, default: '', validation: { rule: schema.string().max(256) } },
  },
} as const)
