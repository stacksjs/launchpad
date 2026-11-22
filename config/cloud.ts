import type { CloudConfig } from '@stacksjs/ts-cloud'

/** An independent Stacks tenant: shared compute, private application state. */
export const tsCloud: CloudConfig = {
  project: { name: 'Scout', slug: 'launchpad', region: 'us-east-1' },
  stateDir: 'storage/cloud',
  cloud: { provider: 'hetzner', attachTo: 'stacks' },
  environments: { production: { type: 'production' } },
  sites: {
    website: {
      deploy: 'server', root: 'dist/site', domain: 'scout.stacksjs.com', path: '/',
      build: 'bun run build:site', pathRewriteStyle: 'directory',
    },
    api: {
      deploy: 'server', root: '.', domain: 'scout.stacksjs.com', path: '/api',
      start: 'bun run serve:api', port: 31841,
      healthCheck: { path: '/api/health' },
      preStart: ['bun install --frozen-lockfile', './buddy migrate --generate'],
      env: { HOST: '127.0.0.1', PORT: '31841', PORT_API: '31841', APP_ENV: 'production', NODE_ENV: 'production', STACKS_DEFAULT_ROUTES: 'none', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/subscriptions.sqlite' },
    },
    legacy: {
      domain: 'launchpad.stacksjs.com',
      redirect: { to: 'https://scout.stacksjs.com', status: 308 },
    },
  },
}
export default {}
