import type { CloudConfig } from '@stacksjs/ts-cloud'

/** An independent Stacks tenant: shared compute, private application state. */
export const tsCloud: CloudConfig = {
  project: { name: 'Launchpad', slug: 'launchpad', region: 'us-east-1' },
  stateDir: 'storage/cloud',
  cloud: { provider: 'hetzner', attachTo: 'stacks' },
  environments: { production: { type: 'production' } },
  sites: {
    website: {
      deploy: 'server', root: 'dist/site', domain: 'launchpad.stacksjs.com', path: '/',
      build: 'bun run build:site', pathRewriteStyle: 'directory',
    },
    api: {
      deploy: 'server', root: '.', domain: 'launchpad.stacksjs.com', path: '/api',
      start: 'bun run serve:api', port: 31841,
      healthCheck: { path: '/api/health' },
      preStart: ['bun install --frozen-lockfile', './buddy migrate --generate'],
      env: { HOST: '127.0.0.1', PORT: '31841', PORT_API: '31841', APP_ENV: 'production', NODE_ENV: 'production', STACKS_DEFAULT_ROUTES: 'none', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/subscriptions.sqlite' },
    },
  },
}
export default {}
