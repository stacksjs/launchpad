export interface ClipboardCapture { text: string, sourceApp: string, capturedAt: number }

/** Pause invalidates reads and queued writes. Clear also waits for an already-started write before deleting. */
export function createClipboardQueue(write: (capture: ClipboardCapture) => Promise<boolean>, clear: () => Promise<void>) {
  let generation = 0
  let blocked = false
  let pending: Promise<unknown> = Promise.resolve()
  let clearing: Promise<void> | undefined
  const current = (token: number) => !blocked && token === generation
  return {
    token: () => generation,
    current,
    invalidate: () => ++generation,
    drain: () => pending,
    save(capture: ClipboardCapture, token = generation): Promise<boolean> {
      if (!current(token)) return Promise.resolve(false)
      const task = pending.then(() => current(token) ? write(capture) : false)
      pending = task.catch(() => {})
      return task
    },
    clear(): Promise<void> {
      if (clearing) return clearing
      ++generation
      blocked = true
      clearing = pending.then(clear).finally(() => {
        blocked = false
        clearing = undefined
      })
      pending = clearing.catch(() => {})
      return clearing
    },
  }
}
