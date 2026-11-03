/**
 * The palette draws every colour from a CSS custom property on `:root`, with a dark override. A theme is that same set
 * of names carrying values of someone's choosing, so applying one means setting those properties rather than swapping a
 * stylesheet. Nothing here touches the document: these are the values and the rules about them.
 */
export const themeTokens = [
  'surface', 'ink', 'muted', 'line', 'accent', 'selected', 'icon-surface', 'footer',
  'key', 'field', 'border', 'outline', 'selected-border', 'error-bg', 'error-ink',
] as const

export type ThemeToken = typeof themeTokens[number]
export type ThemeColors = Record<ThemeToken, string>
export type ThemeMode = 'light' | 'dark'
export interface ThemeFont { family: string, size: number }
export interface Theme { name: string, light: ThemeColors, dark: ThemeColors, font: ThemeFont }

/** Below 11 the result rows stop being readable; above 18 they stop fitting the window the app opens at. */
export const minFontSize = 11
export const maxFontSize = 18
/** An empty family means the stylesheet's own stack, so a theme that says nothing about type changes nothing. */
export const defaultFont: ThemeFont = { family: '', size: 13 }
/** What the stylesheet asks for when a theme names no family of its own. */
export const defaultFontStack = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

/** The values the stylesheet ships with. A new theme starts here, and any value a saved theme omits falls back here. */
export const builtInTheme: Theme = {
  name: 'Launchpad',
  light: {
    'surface': '#ffffff', 'ink': '#202735', 'muted': '#566173', 'line': '#d9e0e9', 'accent': '#245eb7',
    'selected': '#e7edf6', 'icon-surface': '#e8eef7', 'footer': '#f3f5f8', 'key': '#e0e6ee', 'field': '#ffffff',
    'border': '#8391a5', 'outline': '#b8c3d3', 'selected-border': '#b6c9e4', 'error-bg': '#fde9e9', 'error-ink': '#922634',
  },
  dark: {
    'surface': '#202226', 'ink': '#f2f3f5', 'muted': '#b2b8c4', 'line': '#35383f', 'accent': '#a9cbff',
    'selected': '#343943', 'icon-surface': '#2d323c', 'footer': '#1c1e22', 'key': '#32363e', 'field': '#272a31',
    'border': '#657185', 'outline': '#525a68', 'selected-border': '#53627a', 'error-bg': '#432b2e', 'error-ink': '#ffccd1',
  },
  font: defaultFont,
}

/**
 * Only `#rgb` and `#rrggbb`. Named colours and functional notation are refused so a value can never carry a `url()`,
 * a variable reference or anything else that would mean more than a colour.
 */
export function isThemeColor(value: unknown): value is string {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

/**
 * A family is a list of names, so the separators stay. Everything outside letters, digits, spaces, quotes, commas,
 * hyphens, underscores and periods is dropped, which leaves nothing that could end a declaration.
 */
export function readFontFamily(value: unknown): string {
  if (typeof value !== 'string') return defaultFont.family
  return value.replace(/[^\w ,'".-]/g, '').trim().slice(0, 200)
}

export function readFontSize(value: unknown): number {
  const size = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(size)) return defaultFont.size
  return Math.min(maxFontSize, Math.max(minFontSize, Math.round(size)))
}

export function readThemeFont(value: unknown): ThemeFont {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return { family: readFontFamily(saved.family), size: readFontSize(saved.size) }
}

/** Every token is filled: a saved value is used when it is a colour, and the built-in value stands in when it is not. */
export function readThemeColors(value: unknown, fallback: ThemeColors): ThemeColors {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const colors = {} as ThemeColors
  for (const token of themeTokens) colors[token] = isThemeColor(saved[token]) ? (saved[token] as string).trim().toLowerCase() : fallback[token]
  return colors
}

/** Accepts a parsed object or the JSON a stored theme holds. Anything unreadable becomes the built-in theme. */
export function readTheme(value: unknown, name = builtInTheme.name): Theme {
  let source = value
  if (typeof source === 'string') {
    try { source = JSON.parse(source) }
    catch { source = {} }
  }
  const saved = source && typeof source === 'object' && !Array.isArray(source) ? source as Record<string, unknown> : {}
  const title = typeof saved.name === 'string' && saved.name.trim() ? saved.name.trim().slice(0, 60) : name
  return {
    name: title,
    light: readThemeColors(saved.light, builtInTheme.light),
    dark: readThemeColors(saved.dark, builtInTheme.dark),
    font: readThemeFont(saved.font),
  }
}

export function serializeTheme(theme: Theme): string {
  return JSON.stringify({ name: theme.name, light: theme.light, dark: theme.dark, font: theme.font })
}

/** The custom properties to set for one mode, keyed by their CSS names, ready to hand to `setProperty`. */
export function themeVariables(theme: Theme, mode: ThemeMode): Record<string, string> {
  const colors = mode === 'dark' ? theme.dark : theme.light
  const variables: Record<string, string> = {}
  for (const token of themeTokens) variables[`--${token}`] = colors[token]
  return variables
}

/**
 * The type properties. Sizes elsewhere in the palette are expressed against `--font-size`, so setting it moves the
 * query field, the result titles and their subtitles together instead of each needing a value of its own.
 */
export function themeFontVariables(theme: Theme): Record<string, string> {
  return { '--font-family': theme.font.family || defaultFontStack, '--font-size': `${theme.font.size}px` }
}

/** A row as the model stores it, where each part is held as JSON text rather than an object. */
export function readStoredTheme(row: { name?: unknown, light?: unknown, dark?: unknown, font?: unknown }): Theme {
  const part = (value: unknown) => {
    if (typeof value !== 'string') return value
    try { return JSON.parse(value) }
    catch { return {} }
  }
  return readTheme({ name: row.name, light: part(row.light), dark: part(row.dark), font: part(row.font) })
}

/**
 * A theme someone was given. It is refused rather than quietly corrected, because a theme that silently loses half its
 * colours looks like the app ignoring it. `readTheme` still fills anything the document simply does not mention.
 */
export function parseThemeDocument(text: string): { ok: true, theme: Theme } | { ok: false, errors: string[] } {
  const trimmed = (text || '').trim()
  if (!trimmed) return { ok: false, errors: ['Paste a theme first.'] }
  let parsed: unknown
  try { parsed = JSON.parse(trimmed) }
  catch { return { ok: false, errors: ['That is not valid JSON.'] } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, errors: ['A theme is a JSON object.'] }
  const source = parsed as Record<string, unknown>
  const errors: string[] = []
  for (const mode of ['light', 'dark'] as const) {
    const colors = source[mode]
    if (colors === undefined) continue
    if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
      errors.push(`"${mode}" is a set of colours.`)
      continue
    }
    for (const [token, value] of Object.entries(colors as Record<string, unknown>)) {
      if (!(themeTokens as readonly string[]).includes(token)) {
        errors.push(`"${token}" is not a colour this palette uses.`)
      }
      else if (!isThemeColor(value)) {
        errors.push(`"${token}" is not a hex colour such as #245eb7.`)
      }
    }
  }
  if (source.light === undefined && source.dark === undefined) errors.push('A theme needs light or dark colours.')
  return errors.length ? { ok: false, errors: errors.slice(0, 8) } : { ok: true, theme: readTheme(source) }
}

/** True when a theme is the built-in one in every respect, which is how the app knows it has nothing to apply. */
export function isBuiltInTheme(theme: Theme): boolean {
  return themeTokens.every(token => theme.light[token] === builtInTheme.light[token] && theme.dark[token] === builtInTheme.dark[token])
    && theme.font.family === defaultFont.family && theme.font.size === defaultFont.size
}
