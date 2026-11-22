import type { ImagesConfig } from '@stacksjs/types'

export default {
  brand: 'Scout',
  mark: 'assets/brand/scout.svg',
  markPlate: false,
  fonts: {
    title: 'assets/fonts/Geist-SemiBold.ttf',
    body: 'assets/fonts/Geist-Regular.ttf',
  },
  color: '#25231f',
  accent: '#9f3715',
  background: { color: '#f8f6f1' },
  social: {
    enabled: true,
    outputDir: 'public/social', publicPath: '/social',
    presets: ['og'], format: 'jpeg', quality: 90,
    foreground: 'public/images/applications.jpg',
    mutedColor: '#625b52',
    device: { scale: 0.65, radius: 0.025, borderColor: '#d8cec0', shadow: { blur: 24, offsetY: 12, color: '#36291c24' } },
    text: { titleSize: 70, subtitleSize: 24 },
    pages: [{ path: '/', title: 'Apps, files,\nand commands.', eyebrow: 'KEYBOARD LAUNCHER FOR MAC', subtitle: 'Open Scout with Command + Space.' }],
  },
} satisfies ImagesConfig
