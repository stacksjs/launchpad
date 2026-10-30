import { createFileSearch, readLines } from '../app/Desktop/files'

// Types each word one letter at a time against the real Spotlight index, the way the launcher asks for it.
// Re-run with your own words: bun scripts/benchmark-files.ts invoice budget
async function main() {
  const words = process.argv.slice(2).length ? process.argv.slice(2) : ['invoice', 'budget', 'readme']
  let queries = 0
  const search = createFileSearch({
    list: (args, signal) => {
      queries++
      return readLines('/usr/bin/mdfind', args, { maxLines: 1000, timeoutMs: 2500, signal })
    },
  })
  for (const word of words) {
    const steps: string[] = []
    for (let length = 2; length <= word.length; length++) {
      const before = queries
      const begin = performance.now()
      const { files } = await search(word.slice(0, length))
      steps.push(`${word.slice(0, length)} ${Math.round(performance.now() - begin)}ms ${files.length} files${queries === before ? ' (from memory)' : ''}`)
    }
    process.stdout.write(`${steps.join(' | ')}\n`)
  }
  const begin = performance.now()
  await search(words[0]!)
  process.stdout.write(`repeat of "${words[0]}": ${Math.round(performance.now() - begin)}ms, Spotlight queries so far: ${queries}\n`)
}

// The backend module keeps a database handle open, so end the process explicitly.
void main().finally(() => process.exit(0))
