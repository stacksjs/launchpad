import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const bundle = resolve(process.argv[2] || 'dist/Launchpad.app/Contents/Resources/index.html')
if (!existsSync(bundle)) throw new Error('Build the native app with ./buddy build before running browser acceptance checks.')
const evidence = resolve('dist/ui-evidence')
mkdirSync(evidence, { recursive: true })
for (const mode of ['light', 'dark']) {
  const env = {
    ...process.env,
    LAUNCHPAD_UI_DARK: mode === 'dark' ? '1' : '',
    LAUNCHPAD_CLIPBOARD_SCREENSHOT: resolve(evidence, `clipboard-${mode}.png`),
    LAUNCHPAD_UPDATE_SCREENSHOT: resolve(evidence, `updates-${mode}.png`),
    LAUNCHPAD_HEADER_SCREENSHOT: resolve(evidence, `header-${mode}.png`),
    LAUNCHPAD_PANTRY_SCREENSHOT: resolve(evidence, `pantry-${mode}.png`),
  }
  for (const script of ['verify-icons', 'verify-clipboard', 'verify-clipboard-reliability', 'verify-updates', 'verify-pantry']) {
    console.log(`UI acceptance: ${script} (${mode})`)
    const result = spawnSync(process.execPath, [`scripts/${script}.mjs`, bundle], { env, stdio: 'inherit', timeout: 120000 })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status || 1)
  }
}
console.log(`All browser acceptance checks passed. Screenshots: ${evidence}`)
