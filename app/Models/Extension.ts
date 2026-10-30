import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Extension', table: 'extensions',
  traits: { useTimestamps: true, useApi: { uri: 'extensions', middleware: [], routes: ['index', 'store', 'update', 'destroy'] } },
  attributes: {
    name: { fillable: true, required: true, unique: true, validation: { rule: schema.string().min(1).max(60).required() } },
    manifest: { fillable: true, required: true, validation: { rule: schema.string().min(2).max(100000).required() } },
    enabled: { fillable: true, default: true, validation: { rule: schema.boolean() } },
  },
} as const)
