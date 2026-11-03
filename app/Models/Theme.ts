import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'Theme', table: 'themes',
  traits: { useTimestamps: true, useApi: { uri: 'themes', middleware: [], routes: ['index', 'show', 'store', 'update', 'destroy'] } },
  attributes: {
    name: { fillable: true, required: true, validation: { rule: schema.string().min(1).max(60).required() } },
    // The colours for each mode, as the JSON object `readTheme` validates. Unreadable values fall back to the built-in theme.
    light: { fillable: true, required: true, validation: { rule: schema.string().min(2).max(2000).required() } },
    dark: { fillable: true, required: true, validation: { rule: schema.string().min(2).max(2000).required() } },
    font: { fillable: true, default: '', validation: { rule: schema.string().max(300) } },
  },
} as const)
