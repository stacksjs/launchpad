import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'AppPreference', table: 'app_preferences',
  traits: { useTimestamps: true, useApi: { uri: 'preferences', middleware: [], routes: ['index', 'store', 'update'] } },
  attributes: {
    key: { fillable: true, required: true, unique: true, validation: { rule: schema.enum(['appearance', 'history', 'githubScope', 'usage', 'pantryCatalog', 'loginInitialized']).required() } },
    value: { fillable: true, required: true, validation: { rule: schema.string().max(1000).required() } },
  },
} as const)
