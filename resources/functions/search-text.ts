/** Fold Latin accents and compatibility forms without removing other scripts' vowels. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
}

/** Custom aliases live on the app's existing local ranking record. */
export function parseApplicationAliases(value = ''): string[] {
  const seen = new Set<string>()
  return value.split(/[,;\n]+/u).flatMap((value) => {
    const alias = value.trim()
    const key = normalizeSearchText(alias)
    if (!key || seen.has(key)) return []
    seen.add(key)
    return [alias]
  })
}
