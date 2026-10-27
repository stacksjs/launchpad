import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseSVG, rasterize } from '@stacksjs/ts-svg'
import { createImageData, drawImage, encode, generateMacOSAppIcons, resize } from 'ts-images'

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, '..')
  await copyFile(join(root, 'assets/brand/launchpad.svg'), join(root, 'public/images/launchpad.svg'))
  const vector = rasterize(parseSVG(await Bun.file(join(root, 'assets/brand/launchpad.svg')).text()), { width: 896, height: 896 })
  const mark = createImageData(vector.width, vector.height)
  mark.data.set(vector.data)
  const image = createImageData(1024, 1024)
  drawImage(image, mark, { x: 64, y: 64, width: 896, height: 896 })
  await Bun.write(join(root, 'assets/app-icon.png'), await encode(image, 'png'))
  await Bun.write(join(root, 'public/images/launchpad.png'), await encode(resize(image, { width: 256, height: 256 }), 'png'))
  process.stdout.write('Generated the shared Launchpad app and website mark with ts-images.\n')

  if (process.platform === 'darwin') {
    const scratch = await mkdtemp(join(tmpdir(), 'launchpad-brand-'))
    try {
      const generated = await generateMacOSAppIcons(join(root, 'assets/app-icon.png'), join(scratch, 'assets'))
      const iconset = join(scratch, 'Launchpad.iconset')
      await mkdir(iconset)
      for (const icon of generated.sizes) {
        const name = icon.filename.replace(/^AppIcon-(\d+)(@2x)?\.png$/, 'icon_$1x$1$2.png')
        await copyFile(icon.path, join(iconset, name))
      }
      const result = Bun.spawnSync(['/usr/bin/iconutil', '--convert', 'icns', iconset, '--output', join(root, 'assets/Launchpad.icns')], { stdout: 'pipe', stderr: 'pipe' })
      if (result.exitCode !== 0) throw new Error(result.stderr.toString())
      process.stdout.write('Packaged the macOS icon set with Apple iconutil.\n')
    }
    finally { await rm(scratch, { recursive: true, force: true }) }
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
