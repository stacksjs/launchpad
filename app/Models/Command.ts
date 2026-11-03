import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Command', table: 'commands',
  traits: { useTimestamps: true, useApi: { uri: 'commands', middleware: [], routes: ['index', 'show', 'store', 'update', 'destroy'] } },
  attributes: {
    title: { fillable: true, required: true, validation: { rule: schema.string().min(1).max(120).required() } },
    kind: { fillable: true, required: true, validation: { rule: schema.enum(['quicklink', 'snippet']).required() } },
    content: { fillable: true, required: true, validation: { rule: schema.string().min(1).max(20000).required() } },
    alias: { fillable: true, default: '', validation: { rule: schema.string().max(40) } },
    // A global shortcut that runs this command from anywhere, stored in the one spelling `normalizeShortcut` produces.
    shortcut: { fillable: true, default: '', validation: { rule: schema.string().max(60) } },
  },
} as const)
