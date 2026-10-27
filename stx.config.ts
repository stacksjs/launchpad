export default {
  root: 'resources',
  pagesDir: 'views/site',
  componentsDir: 'components',
  css: { config: 'config/css.ts' },
  build: {
    outputDir: 'dist/site',
    domain: 'https://launchpad.stacksjs.com',
    sitemap: true,
    robots: true,
  },
}
