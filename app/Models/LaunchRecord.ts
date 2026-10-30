import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'LaunchRecord', table: 'launch_records',
  traits: { useTimestamps: true, useApi: { uri: 'launch-records', middleware: [], routes: ['index', 'store', 'update', 'destroy'] } },
  attributes: {
    key: { fillable: true, required: true, unique: true, validation: { rule: schema.string().min(1).max(2048).required() } },
    aliases: { fillable: true, default: '', validation: { rule: schema.string().max(1000) } },
    favorite: { fillable: true, default: false, validation: { rule: schema.boolean() } },
    launches: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
    lastUsed: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
  },
} as const)
