import assert from 'node:assert/strict'

const opening = 'return { get "'

/**
 * The built page, patched so a browser can drive the launcher without its native host.
 *
 * Two edits are needed. The component's returned object is bound to `window.__launcher`, so a script can read and
 * set state directly, and `onMount` is neutered, because the boot sequence expects a Craft bridge, a backend and a
 * real window that none of these checks have.
 *
 * The first edit used to match the component's opening getter by name. That quietly stopped matching the day a
 * binding was added that sorted ahead of it alphabetically: the replacement became a no-op, `window.__launcher` was
 * never assigned, and every script failed thirty seconds later on a `waitForFunction` timeout with an empty log —
 * thirty seconds of silence that said nothing about the cause. The object is now found by a binding it contains,
 * wherever that binding sits in it, and a shape this no longer fits fails here, by name, instead.
 */
export function launcherPage(source) {
  const marker = source.indexOf('get "actionLabel"')
  assert.ok(marker > 0, 'The built page no longer exposes actionLabel, so the launcher component could not be found.')
  const start = source.lastIndexOf(opening, marker)
  assert.ok(start > 0, 'The launcher component is no longer returned as an object of getters.')
  const html = `${source.slice(0, start)}return window.__launcher = { get "${source.slice(start + opening.length)}`
    .replace('onMount(async () => {', 'onMount(async () => { return;')
  assert.ok(html.includes('return window.__launcher = {'), 'Failed to bind window.__launcher.')
  assert.ok(html.includes('onMount(async () => { return;'), 'Failed to stop onMount from running.')
  return html
}
