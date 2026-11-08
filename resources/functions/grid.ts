/**
 * Laying results out as a grid rather than a list. Some results are mostly a glyph: a column of emoji wastes the
 * window and makes scanning slow, where a grid shows forty at once.
 *
 * Nothing here measures or draws. It decides how many columns fit, where an index sits, and which index each
 * navigation key lands on, so the keyboard reaches every tile without the mouse.
 */

/** A tile wide enough for a glyph and the gap beside it. */
export const gridTileSize = 46
/** Narrow enough that a small window still shows a grid, wide enough that a large one does not scatter the tiles. */
export const minGridColumns = 4
export const maxGridColumns = 14
/** How far Page Up and Page Down jump, in rows. */
export const gridPageRows = 4

/** Categories whose results are a glyph rather than a line of text. */
export function usesGrid(category: string): boolean {
  return category === 'emoji'
}

export function gridColumns(width: number, tile: number = gridTileSize): number {
  const usable = Number.isFinite(width) ? Math.floor(width) : 0
  const fits = Math.floor(usable / Math.max(1, tile))
  return Math.max(minGridColumns, Math.min(maxGridColumns, fits || minGridColumns))
}

export function gridPosition(index: number, columns: number): { row: number, column: number } {
  const across = Math.max(1, columns)
  const at = Math.max(0, index)
  return { row: Math.floor(at / across), column: at % across }
}

/** The row a tile sits on, in pixels, so the view can keep the selection on screen. */
export function gridScrollTop(index: number, columns: number, tile: number = gridTileSize): number {
  return Math.max(0, gridPosition(index, columns).row * tile)
}

/**
 * Where a navigation key lands. Left and right step one tile, which carries across a row end the way reading does;
 * up and down move a whole row. Every move is clamped, so the last row never drops the selection off the end.
 */
export function gridTarget(
  event: { key: string, ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean },
  index: number,
  count: number,
  columns: number,
  pageRows: number = gridPageRows,
): number | null {
  if (count <= 0 || event.metaKey || event.altKey) return null
  const across = Math.max(1, columns)
  const control = event.ctrlKey ? event.key.toLowerCase() : ''
  const step
    = event.key === 'ArrowRight' || control === 'f' ? 1
      : event.key === 'ArrowLeft' || control === 'b' ? -1
        : event.key === 'ArrowDown' || control === 'n' ? across
          : event.key === 'ArrowUp' || control === 'p' ? -across
            : event.key === 'PageDown' ? across * pageRows
              : event.key === 'PageUp' ? -across * pageRows
                : 0
  if (!step) {
    if (event.key === 'Home') return 0
    if (event.key === 'End') return count - 1
    return null
  }
  return Math.max(0, Math.min(count - 1, index + step))
}

/** Full grids scroll continuously while mounting only nearby rows of tiles. */
export function gridWindow(count: number, scrollTop: number, height: number, columns: number) {
  const width = Math.max(1, columns)
  const rows = Math.ceil(count / width)
  const first = Math.max(0, Math.min(rows, Math.floor(Math.max(0, scrollTop) / gridTileSize) - 2))
  const last = Math.min(rows, Math.ceil((Math.max(0, scrollTop) + height) / gridTileSize) + 2)
  return { start: first * width, end: Math.min(count, last * width), top: first * gridTileSize, bottom: Math.max(0, rows - last) * gridTileSize }
}
