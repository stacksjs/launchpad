export interface SnippetContext {
  now: Date
  uuid: () => string
  /** Read only when the snippet asks for {clipboard}, so unrelated snippets never touch the pasteboard. */
  clipboard: () => Promise<string>
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function date(now: Date) { return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` }
function time(now: Date) { return `${pad(now.getHours())}:${pad(now.getMinutes())}` }

export const snippetPlaceholders = ['date', 'time', 'datetime', 'weekday', 'year', 'uuid', 'clipboard'] as const

/**
 * Fill {date}, {time}, {datetime}, {weekday}, {year}, {uuid} and {clipboard} in local time.
 * {{date}} stays as the literal {date}. Unknown names are left exactly as written.
 */
export async function expandSnippet(text: string, context: SnippetContext): Promise<string> {
  const values: Record<string, () => string | Promise<string>> = {
    date: () => date(context.now),
    time: () => time(context.now),
    datetime: () => `${date(context.now)} ${time(context.now)}`,
    weekday: () => weekdays[context.now.getDay()]!,
    year: () => pad(context.now.getFullYear(), 4),
    uuid: () => context.uuid(),
    clipboard: () => context.clipboard(),
  }
  let output = ''
  let last = 0
  for (const match of text.matchAll(/\{\{(\w+)\}\}|\{(\w+)\}/g)) {
    output += text.slice(last, match.index)
    last = match.index + match[0].length
    if (match[1]) output += `{${match[1]}}`
    else if (match[2] && Object.hasOwn(values, match[2])) output += await values[match[2]]!()
    else output += match[0]
  }
  return output + text.slice(last)
}
