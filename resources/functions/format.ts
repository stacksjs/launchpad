/** "1 application", "2 applications". Counts are shown to people, so singular must read correctly. */
export function plural(count: number, noun: string, many = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : many}`
}

/** Pairing codes are shown in groups; accept spaces and dashes and keep the digits. */
export function pairingDigits(value: string): string {
  return value.replace(/\D/g, '')
}
