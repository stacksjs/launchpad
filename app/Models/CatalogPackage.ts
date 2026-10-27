import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

/** Public package metadata only. Installation credentials live in Keychain. */
export default defineModel({
  name: 'CatalogPackage', table: 'catalog_packages',
  traits: { useTimestamps: true, useApi: { uri: 'catalog-packages', middleware: [], routes: ['index', 'show'] } },
  attributes: {
    domain: { fillable: true, required: true, unique: true, validation: { rule: schema.string().max(240).required() } },
    name: { fillable: true, required: true, validation: { rule: schema.string().max(240).required() } },
    kind: { fillable: true, required: true, validation: { rule: schema.enum(['app', 'cli', 'library', 'font']).required() } },
    metadata: { fillable: true, required: true, validation: { rule: schema.string().max(20000).required() } },
  },
} as const)
