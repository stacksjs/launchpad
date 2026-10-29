import { createApplicationDiscovery } from '../app/Desktop/applications'

for (const watch of [false, true]) {
  const discovery = createApplicationDiscovery(undefined, { watch })
  try {
    const apps = await discovery()
    for (let run = 0; run < 3; run++) await discovery()
    const samples: number[] = []
    const cpu = process.cpuUsage()
    for (let run = 0; run < 120; run++) {
      const start = performance.now()
      await discovery()
      samples.push(performance.now() - start)
    }
    const elapsedCpu = process.cpuUsage(cpu)
    samples.sort((a, b) => a - b)
    process.stdout.write(JSON.stringify({ mode: watch ? 'watched-snapshot' : 'rescan', applications: apps.length, reads: samples.length, p50Ms: Number(samples[60]!.toFixed(4)), p95Ms: Number(samples[114]!.toFixed(4)), cpuMs: Number(((elapsedCpu.user + elapsedCpu.system) / 1000).toFixed(3)) }) + '\n')
  }
  finally { discovery.close() }
}
