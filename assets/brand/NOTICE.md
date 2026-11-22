# Scout mark

The Scout mark is original artwork. A search lens frames a result dot, and the
handle bends into a directional arrow. The color artwork pairs frost and mint
on an ink-blue plate. The menu bar uses the same shapes as a macOS template image.

The app uses Framework7 Icons through
Iconify. Framework7 Icons is copyright Vladimir Kharlampidi and is available
under the [MIT license](https://github.com/framework7io/framework7-icons/blob/master/LICENSE).

Geist is bundled in `assets/fonts` under its SIL Open Font License. The font
files come from vercel/geist-font revision
`b5d164a0c066c2c9bfcd5ab65dd8244551f0ac06`.

Run `bun run generate:brand` to render the app and website icons through
`@stacksjs/ts-svg` and `ts-images`. On macOS, Apple iconutil packages the generated
macOS sizes into the app's ICNS. Run `buddy generate:images --social` to render
the page cards declared in `config/images.ts`.
