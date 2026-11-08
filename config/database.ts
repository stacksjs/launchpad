import { subscriptionModelNames } from '../app/Services/subscription-models'

export default {
  default: 'sqlite',
  models: { include: [...subscriptionModelNames] },
  connections: { sqlite: { database: process.env.DB_DATABASE_PATH || 'database/subscriptions.sqlite', prefix: '' } },
  backups: { destination: process.env.DB_BACKUP_DESTINATION || '' },
}
