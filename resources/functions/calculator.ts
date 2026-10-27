/** A bounded arithmetic parser. Never evaluates JavaScript or loads code. */
export function calculate(input: string): string | null {
  if (input.length > 200 || !/\d/.test(input)) return null
  const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/^%]/gi)
  if (!tokens || tokens.join('') !== input.replace(/\s/g, '')) return null
  let index = 0
  function expression(min = 0): number {
    const token = tokens![index++]
    let value: number
    if (token === '+' || token === '-') value = (token === '-' ? -1 : 1) * expression(3)
    else if (token === '(') {
      value = expression()
      if (tokens![index++] !== ')') throw new Error('Missing parenthesis')
    }
    else if (token !== undefined && /^\d|^\.\d/.test(token)) value = Number(token)
    else throw new Error('Expected a number')
    while (index < tokens!.length) {
      const op = tokens![index]
      if (op === '%') {
        value /= 100
        index++
        continue
      }
      const precedence = op === '+' || op === '-' ? 1 : op === '*' || op === '/' ? 2 : op === '^' ? 4 : 0
      if (!precedence || precedence < min) break
      index++
      const rhs = expression(op === '^' ? precedence : precedence + 1)
      value = op === '+' ? value + rhs : op === '-' ? value - rhs : op === '*' ? value * rhs : op === '/' ? value / rhs : value ** rhs
    }
    return value
  }
  try {
    const value = expression()
    if (index !== tokens.length || !Number.isFinite(value)) return null
    return String(Number(value.toPrecision(12)))
  }
  catch { return null }
}
