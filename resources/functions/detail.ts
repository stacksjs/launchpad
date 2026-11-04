import type { Result } from './search'

/**
 * A result that needs a page rather than a row. A long snippet or a saved block of text says nothing useful in one
 * line, so it earns a view of its own.
 *
 * The text is read into blocks here and rendered as blocks by the view. Markdown is never turned into HTML: content
 * reaches the palette from the clipboard, from bookmarks and from other apps, and none of it is trusted enough to
 * become markup. That also keeps the whole of this file pure and testable.
 */
export type DetailBlock =
  | { kind: 'heading', level: 1 | 2 | 3, text: string }
  | { kind: 'paragraph', text: string }
  | { kind: 'code', text: string, language: string }
  | { kind: 'list', ordered: boolean, items: readonly string[] }
  | { kind: 'quote', text: string }
  | { kind: 'image', url: string, alt: string }
  | { kind: 'rule' }

export interface Detail { title: string, subtitle: string, blocks: readonly DetailBlock[] }

/** Past this a result says more in a page than in a row. Shorter than this and the row already shows all of it. */
export const detailMinimum = 200
/** A document longer than this is read elsewhere; the palette shows its beginning. */
export const maxDetailLength = 20000
/** Enough blocks to read, few enough that one paste cannot stall the window. */
export const maxDetailBlocks = 300

/** Only what a browser can fetch. A `data:` or `file:` image would carry content the palette never vetted. */
function imageUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  }
  catch { return null }
}

const headingAt = (line: string) => /^(#{1,3})\s+(.*)$/.exec(line)
const bulletAt = (line: string) => /^\s*[-*+]\s+(.*)$/.exec(line)
const numberAt = (line: string) => /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line)
const imageAt = (line: string) => /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim())

/**
 * A deliberate subset of Markdown: headings, fenced code, bullet and numbered lists, quotes, rules, standalone images,
 * and paragraphs. Anything else stays as the text it already is, which is the right answer for a block of prose that
 * was never Markdown in the first place.
 */
export function parseDetail(text: string): DetailBlock[] {
  const lines = (text ?? '').slice(0, maxDetailLength).replace(/\r\n?/g, '\n').split('\n')
  const blocks: DetailBlock[] = []
  let paragraph: string[] = []
  const flush = () => {
    const joined = paragraph.join(' ').trim()
    paragraph = []
    if (joined) blocks.push({ kind: 'paragraph', text: joined })
  }
  for (let index = 0; index < lines.length && blocks.length < maxDetailBlocks; index++) {
    const line = lines[index]!
    const fence = /^```\s*([\w+-]*)\s*$/.exec(line.trim())
    if (fence) {
      flush()
      const body: string[] = []
      index++
      while (index < lines.length && !/^```/.test(lines[index]!.trim())) body.push(lines[index++]!)
      blocks.push({ kind: 'code', text: body.join('\n'), language: fence[1] ?? '' })
      continue
    }
    if (!line.trim()) { flush(); continue }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { flush(); blocks.push({ kind: 'rule' }); continue }
    const image = imageAt(line)
    const url = image ? imageUrl(image[2]!) : null
    if (image && url) { flush(); blocks.push({ kind: 'image', url, alt: image[1] ?? '' }); continue }
    const heading = headingAt(line)
    if (heading) { flush(); blocks.push({ kind: 'heading', level: heading[1]!.length as 1 | 2 | 3, text: heading[2]!.trim() }); continue }
    if (/^\s*>\s?/.test(line)) {
      flush()
      const body: string[] = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index]!)) body.push(lines[index++]!.replace(/^\s*>\s?/, ''))
      index--
      blocks.push({ kind: 'quote', text: body.join(' ').trim() })
      continue
    }
    const bullet = bulletAt(line)
    const numbered = bullet ? null : numberAt(line)
    if (bullet || numbered) {
      flush()
      const ordered = Boolean(numbered)
      const items: string[] = []
      while (index < lines.length) {
        const match = ordered ? numberAt(lines[index]!) : bulletAt(lines[index]!)
        if (!match) break
        items.push(match[1]!.trim())
        index++
      }
      index--
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    paragraph.push(line.trim())
  }
  flush()
  return blocks.slice(0, maxDetailBlocks)
}

/** Every heading, so the view can offer them as places to jump to. */
export function detailOutline(blocks: readonly DetailBlock[]): { index: number, text: string, level: number }[] {
  return blocks.flatMap((block, index) => block.kind === 'heading' ? [{ index, text: block.text, level: block.level }] : [])
}

/**
 * The page a result earns, or null when its row already says everything. Only what the palette itself holds is read:
 * a file is opened by its own application rather than previewed here.
 */
export function detailFor(result: Pick<Result, 'kind' | 'title' | 'subtitle' | 'content'> | undefined): Detail | null {
  if (!result) return null
  if (result.kind !== 'clipboard' && result.kind !== 'snippet') return null
  const text = (result.content ?? '').trim()
  if (text.length < detailMinimum) return null
  return { title: result.title, subtitle: result.subtitle, blocks: parseDetail(text) }
}
