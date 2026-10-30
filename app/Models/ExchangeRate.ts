import { defineModel } from '@stacksjs/orm/define-model'
import { schema } from '@stacksjs/validation/runtime'

export default defineModel({
  name: 'ExchangeRate', table: 'exchange_rates',
  traits: { useTimestamps: true, useApi: { uri: 'exchange-rates', middleware: [], routes: ['index'] } },
  attributes: {
    currency: { fillable: true, required: true, unique: true, validation: { rule: schema.string().min(3).max(3).required() } },
    perEuro: { fillable: true, required: true, validation: { rule: schema.number().min(0).required() } },
    publishedAt: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
    fetchedAt: { fillable: true, default: 0, validation: { rule: schema.number().min(0) } },
  },
} as const)
