/** Matches the ClipboardEntry model, which refuses longer text. */
export const maxClipboardText = 20000

/** Classify copied text before it reaches the local API, so one bad copy never stops recording. */
export function clipboardDecision(text: string | null | undefined): 'save' | 'empty' | 'too-large' {
  if (!text || !text.trim()) return 'empty'
  return text.length > maxClipboardText ? 'too-large' : 'save'
}

/** One line, at most 100 characters, never splitting an emoji or other surrogate pair. */
export function clipboardTitle(content: string): string {
  return Array.from(content.slice(0, 400).replace(/\s+/g, ' ').trim()).slice(0, 100).join('')
}
