import { expect, test } from 'bun:test'
import { pairingDigits, plural } from '../resources/functions/format'

test('counts read naturally for one and many', () => {
  expect(plural(0, 'result')).toBe('0 results')
  expect(plural(1, 'application')).toBe('1 application')
  expect(plural(2, 'package')).toBe('2 packages')
  expect(plural(1, 'entry', 'entries')).toBe('1 entry')
  expect(plural(3, 'entry', 'entries')).toBe('3 entries')
})

test('a pasted pairing code keeps only its digits', () => {
  expect(pairingDigits('1234-5678')).toBe('12345678')
  expect(pairingDigits(' 1234 5678\n')).toBe('12345678')
  expect(pairingDigits('abc')).toBe('')
})
