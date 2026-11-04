import { expect, test } from 'bun:test'
import {
  gridColumns, gridPageRows, gridPosition, gridScrollTop, gridTarget,
  gridTileSize, maxGridColumns, minGridColumns, usesGrid,
} from '../resources/functions/grid'

const press = (key: string, extra: Record<string, boolean> = {}) => ({ key, ...extra })

test('only results that are mostly a glyph earn a grid', () => {
  expect(usesGrid('emoji')).toBe(true)
  for (const category of ['all', 'application', 'file', 'clipboard', 'window', 'music', 'github']) expect(usesGrid(category)).toBe(false)
})

test('the column count follows the window, within what stays readable', () => {
  expect(gridColumns(gridTileSize * 8)).toBe(8)
  // A narrow window still shows a grid rather than collapsing to one column.
  expect(gridColumns(0)).toBe(minGridColumns)
  expect(gridColumns(10)).toBe(minGridColumns)
  // A very wide one stops widening, so tiles do not scatter across the window.
  expect(gridColumns(gridTileSize * 40)).toBe(maxGridColumns)
  expect(gridColumns(Number.NaN)).toBe(minGridColumns)
})

test('an index knows which row and column it sits on', () => {
  expect(gridPosition(0, 6)).toEqual({ row: 0, column: 0 })
  expect(gridPosition(7, 6)).toEqual({ row: 1, column: 1 })
  // A column count of zero would divide by nothing, so it is treated as one.
  expect(gridPosition(3, 0)).toEqual({ row: 3, column: 0 })
  expect(gridPosition(-5, 6)).toEqual({ row: 0, column: 0 })
})

test('scrolling follows the row, not the index', () => {
  expect(gridScrollTop(0, 6)).toBe(0)
  expect(gridScrollTop(5, 6)).toBe(0)
  expect(gridScrollTop(6, 6)).toBe(gridTileSize)
  expect(gridScrollTop(13, 6, 50)).toBe(100)
})

test('left and right step one tile, and carry across a row end the way reading does', () => {
  expect(gridTarget(press('ArrowRight'), 0, 20, 6)).toBe(1)
  expect(gridTarget(press('ArrowLeft'), 6, 20, 6)).toBe(5)
  // The first and last tiles are walls, not wrap points.
  expect(gridTarget(press('ArrowLeft'), 0, 20, 6)).toBe(0)
  expect(gridTarget(press('ArrowRight'), 19, 20, 6)).toBe(19)
})

test('up and down move a whole row, and the last row keeps the selection', () => {
  expect(gridTarget(press('ArrowDown'), 2, 20, 6)).toBe(8)
  expect(gridTarget(press('ArrowUp'), 8, 20, 6)).toBe(2)
  // Down from the last row lands on the final tile rather than falling off the end.
  expect(gridTarget(press('ArrowDown'), 17, 20, 6)).toBe(19)
  expect(gridTarget(press('ArrowUp'), 3, 20, 6)).toBe(0)
})

test('page keys move several rows, and Home and End reach the ends', () => {
  expect(gridTarget(press('PageDown'), 0, 100, 6)).toBe(6 * gridPageRows)
  expect(gridTarget(press('PageUp'), 60, 100, 6)).toBe(60 - 6 * gridPageRows)
  expect(gridTarget(press('Home'), 40, 100, 6)).toBe(0)
  expect(gridTarget(press('End'), 0, 100, 6)).toBe(99)
})

test('control keys match the list, and a modified key is left to its own shortcut', () => {
  expect(gridTarget(press('n', { ctrlKey: true }), 0, 20, 6)).toBe(6)
  expect(gridTarget(press('p', { ctrlKey: true }), 6, 20, 6)).toBe(0)
  expect(gridTarget(press('f', { ctrlKey: true }), 0, 20, 6)).toBe(1)
  expect(gridTarget(press('b', { ctrlKey: true }), 1, 20, 6)).toBe(0)
  // Command and Option belong to the palette's own shortcuts, and an empty grid has nowhere to go.
  expect(gridTarget(press('ArrowDown', { metaKey: true }), 0, 20, 6)).toBeNull()
  expect(gridTarget(press('ArrowDown', { altKey: true }), 0, 20, 6)).toBeNull()
  expect(gridTarget(press('ArrowDown'), 0, 0, 6)).toBeNull()
  expect(gridTarget(press('a'), 0, 20, 6)).toBeNull()
})
