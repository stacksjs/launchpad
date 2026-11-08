import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { tsCloud } from '../config/cloud'

test('Launchpad owns both public routes and attaches to the shared host', () => {
  expect(tsCloud.project.slug).toBe('launchpad')
  expect(tsCloud.cloud?.attachTo).toBe('stacks')
  expect(tsCloud.sites?.website?.domain).toBe('launchpad.stacksjs.com')
  expect(tsCloud.sites?.website?.path).toBe('/')
  expect(tsCloud.sites?.api?.domain).toBe('launchpad.stacksjs.com')
  expect(tsCloud.sites?.api?.path).toBe('/api')
  expect(tsCloud.sites?.api?.root).toBe('.')
})

test('Launchpad deploys from its own main workflow with a dedicated web key', () => {
  const workflow = Bun.YAML.parse(readFileSync(new URL('../.github/workflows/native.yml', import.meta.url), 'utf8')) as any
  const job = workflow.jobs['deploy-website']
  expect(job.needs).toEqual(['website', 'subscriptions', 'browser'])
  expect(job.environment.name).toBe('website-production')
  expect(job.if).toContain("github.ref == 'refs/heads/main'")
  const deploy = job.steps.find((step: any) => step.name === 'Attach and deploy Launchpad with native Stacks')
  expect(deploy.run).toBe('bun run deploy:website')
  expect(deploy.env.DOTENV_PRIVATE_KEY_WEB).toBe('${{ secrets.DOTENV_PRIVATE_KEY_WEB }}')
})
