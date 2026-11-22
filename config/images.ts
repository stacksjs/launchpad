import type { ImagesConfig } from '@stacksjs/types'

export default {
  brand: 'Scout',
  mark: 'assets/brand/scout.svg',
  markPlate: false,
  fonts: {
    title: 'assets/fonts/Geist-SemiBold.ttf',
    body: 'assets/fonts/Geist-Regular.ttf',
  },
  color: '#142238',
  accent: '#215ccf',
  background: { color: '#f5f8fd' },
  social: {
    enabled: true,
    outputDir: 'public/social', publicPath: '/social',
    presets: ['og'], format: 'jpeg', quality: 90,
    foreground: 'public/images/applications.jpg',
    mutedColor: '#4d6078',
    device: { scale: 0.65, radius: 0.025, borderColor: '#ccd9eb', shadow: { blur: 24, offsetY: 12, color: '#1b386424' } },
    text: { titleSize: 70, subtitleSize: 24 },
    pages: [{ path: '/', title: 'Apps, files,\nand commands.', eyebrow: 'KEYBOARD LAUNCHER FOR MAC', subtitle: 'Open Scout with Command + Space.' }],
  },
} satisfies ImagesConfig
