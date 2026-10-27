# Launchpad mark

The blue key and its proportions are Launchpad artwork. The Command glyph comes
from Framework7 Icons, exposed by the framework's existing Iconify collection.
Framework7 Icons is copyright Vladimir Kharlampidi and is available under the
MIT license: [Framework7 Icons license](https://github.com/framework7io/framework7-icons/blob/master/LICENSE).

Geist is bundled in `assets/fonts` under its SIL Open Font License. The font
files come from vercel/geist-font revision
`b5d164a0c066c2c9bfcd5ab65dd8244551f0ac06`.

Run `bun run generate:brand` to render the app and website icons through
`@stacksjs/image` and `ts-images`. On macOS, Apple iconutil packages the generated
macOS sizes into the app's ICNS. Run `buddy generate:images --social` to render
the page cards declared in `config/images.ts`.
