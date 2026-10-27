import type { ImagesConfig } from '@stacksjs/types'

export default {
  brand: 'Launchpad',
  mark: 'assets/brand/launchpad.svg',
  markPlate: false,
  fonts: {
    title: 'assets/fonts/Geist-SemiBold.ttf',
    body: 'assets/fonts/Geist-Regular.ttf',
  },
  color: '#0f172a',
  accent: '#1d4ed8',
  background: { color: '#f5f7fa' },
  social: {
    enabled: true,
    outputDir: 'public/social', publicPath: '/social',
    presets: ['og'], format: 'jpeg', quality: 90,
    foreground: 'public/images/applications.jpg',
    mutedColor: '#475569',
    device: { scale: 0.65, radius: 0.025, borderColor: '#cbd5e1', shadow: { blur: 24, offsetY: 12, color: '#0f172a24' } },
    text: { titleSize: 70, subtitleSize: 24 },
    pages: [{ path: '/', title: 'Less looking.\nMore doing.', eyebrow: 'YOUR MAC, WITHIN REACH', subtitle: 'Your apps, links and tools.\nOne keyboard shortcut.' }],
  },
} satisfies ImagesConfig
