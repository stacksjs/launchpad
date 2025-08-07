import type { BuddyBotConfig } from 'buddy-bot'

// Extended configuration with nullable respectLatest
interface ExtendedBuddyBotConfig extends BuddyBotConfig {
  packages?: {
    strategy?: string
    ignore?: string[]
    ignorePaths?: string[]
    respectLatest?: boolean | null // Nullable, defaults to true
  }
}

const config: ExtendedBuddyBotConfig = {
  repository: {
    owner: 'stacksjs',
    name: 'launchpad',
    provider: 'github',
    // token: process.env.BUDDY_BOT_TOKEN,
  },
  dashboard: {
    enabled: true,
    title: 'Dependency Dashboard',
    // issueNumber: undefined, // Auto-generated
  },
  workflows: {
    enabled: true,
    outputDir: '.github/workflows',
    templates: {
      daily: true,
      weekly: true,
      monthly: true,
    },
    custom: [],
  },
  packages: {
    strategy: 'all',
    ignore: [
      // Add packages to ignore here
      // Example: '@types/node', 'eslint'
      'python.org', // Keep as 'latest' instead of pinning to specific versions
    ],
    ignorePaths: [
      // Add file/directory paths to ignore using glob patterns
      // Example: 'packages/test-*/**', '**/*test-envs/**', 'apps/legacy/**'
      'packages/launchpad/test/fixtures/pkgx.yml', // Ignore test fixtures that use 'latest'
    ],
    // Configuration for respecting 'latest' versions (nullable, defaults to true)
    respectLatest: process.env.BUDDY_BOT_RESPECT_LATEST === 'false' ? false : 
                   process.env.BUDDY_BOT_RESPECT_LATEST === 'true' ? true : 
                   null, // null means use default behavior (true)
  },
  verbose: false,
}

export default config
