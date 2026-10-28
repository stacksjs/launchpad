import type { Result } from './search'

/** Activation and focus can arrive together. Share their read and leave unchanged lists untouched. */
export function createApplicationRefresh(options: { load: () => Promise<Result[]>, current: () => Result[], replace: (items: Result[]) => void, count: (count: number) => void }) {
  let pending: Promise<void> | undefined
  return (): Promise<void> => {
    pending ??= options.load().then((apps) => {
      const current = options.current()
      const previous = current.filter(item => item.kind === 'application')
      if (apps.length !== previous.length || apps.some((app, index) => app.key !== previous[index]?.key || app.title !== previous[index]?.title)) {
        options.replace([...apps, ...current.filter(item => item.kind !== 'application')])
      }
      options.count(apps.length)
    }).finally(() => { pending = undefined })
    return pending
  }
}
