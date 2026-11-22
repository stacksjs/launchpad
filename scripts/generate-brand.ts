import { Buffer } from 'node:buffer'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseSVG, rasterize } from '@stacksjs/ts-svg'
import { createImageData, drawImage, encode, generateMacOSAppIcons, resize } from 'ts-images'

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, '..')
  const source = join(root, 'assets/brand/scout.svg')
  const svg = await Bun.file(source).text()
  await copyFile(source, join(root, 'public/images/scout.svg'))
  const glyph = svg.match(/<g id="mark"[^>]*>[\s\S]*?<\/g>/)?.[0]
  if (!glyph) throw new Error('Scout artwork is missing its mark group.')
  const monochrome = glyph.replaceAll(/fill="(?!none")[^"]+"/g, 'fill="#000"')
  const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="172 172 680 680">${monochrome}</svg>`
  const tray = rasterize(parseSVG(traySvg), { width: 44, height: 44 })
  const trayImage = createImageData(tray.width, tray.height)
  trayImage.data.set(tray.data)
  const trayPng = await encode(trayImage, 'png')
  const markUrl = `data:image/svg+xml,${encodeURIComponent(svg.trim()).replaceAll("'", '%27')}`
  const trayUrl = `data:image/png;base64,${Buffer.from(trayPng).toString('base64')}`
  await Bun.write(join(root, 'resources/functions/scout-brand.ts'), `// Generated from assets/brand/scout.svg by bun run generate:brand.\nexport const scoutMark = '${markUrl}'\nexport const scoutTrayIcon = '${trayUrl}'\n`)
  const vector = rasterize(parseSVG(svg), { width: 896, height: 896 })
  const mark = createImageData(vector.width, vector.height)
  mark.data.set(vector.data)
  const image = createImageData(1024, 1024)
  drawImage(image, mark, { x: 64, y: 64, width: 896, height: 896 })
  await Bun.write(join(root, 'assets/app-icon.png'), await encode(image, 'png'))
  await Bun.write(join(root, 'public/images/scout.png'), await encode(resize(image, { width: 256, height: 256 }), 'png'))
  process.stdout.write('Generated the shared Scout app and website mark with ts-images.\n')

  if (process.platform === 'darwin') {
    const scratch = await mkdtemp(join(tmpdir(), 'launchpad-brand-'))
    try {
      const generated = await generateMacOSAppIcons(join(root, 'assets/app-icon.png'), join(scratch, 'assets'))
      const iconset = join(scratch, 'Scout.iconset')
      await mkdir(iconset)
      for (const icon of generated.sizes) {
        const name = icon.filename.replace(/^AppIcon-(\d+)(@2x)?\.png$/, 'icon_$1x$1$2.png')
        await copyFile(icon.path, join(iconset, name))
      }
      const result = Bun.spawnSync(['/usr/bin/iconutil', '--convert', 'icns', iconset, '--output', join(root, 'assets/Scout.icns')], { stdout: 'pipe', stderr: 'pipe' })
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
