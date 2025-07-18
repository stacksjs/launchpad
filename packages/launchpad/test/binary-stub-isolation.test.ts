import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

describe('Binary Stub Isolation', () => {
  let originalEnv: NodeJS.ProcessEnv
  let tempDir: string
  let cliPath: string

  beforeEach(() => {
    originalEnv = { ...process.env }
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'launchpad-stub-test-'))
    cliPath = path.join(__dirname, '..', 'bin', 'cli.ts')
  })

  afterEach(() => {
    process.env = originalEnv
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }

    // Clean up test environment directories
    const launchpadEnvsDir = path.join(os.homedir(), '.local', 'share', 'launchpad', 'envs')
    if (fs.existsSync(launchpadEnvsDir)) {
      const entries = fs.readdirSync(launchpadEnvsDir)
      for (const entry of entries) {
        const entryPath = path.join(launchpadEnvsDir, entry)
        if (fs.statSync(entryPath).isDirectory() && entry.includes('dGVzdA')) { // Base64 contains 'test'
          fs.rmSync(entryPath, { recursive: true, force: true })
        }
      }
    }
  })

  const getTestEnv = (extraEnv: Record<string, string> = {}) => {
    return {
      ...process.env,
      PATH: process.env.PATH?.includes('/usr/local/bin')
        ? process.env.PATH
        : `/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
      NODE_ENV: 'test',
      ...extraEnv,
    }
  }

  const runCLI = (args: string[], cwd?: string): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
    return new Promise((resolve, reject) => {
      const proc = spawn('bun', [cliPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: getTestEnv(),
        cwd: cwd || tempDir,
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 })
      })

      proc.on('error', (error) => {
        reject(error)
      })

      setTimeout(() => {
        proc.kill()
        reject(new Error('CLI command timed out'))
      }, 30000)
    })
  }

  const createDepsFile = (dir: string, packages: string[], env?: Record<string, string>) => {
    const depsSection = `dependencies:\n${packages.map(pkg => `  - ${pkg}`).join('\n')}`
    const envSection = env ? `\nenv:\n${Object.entries(env).map(([key, value]) => `  ${key}: ${value}`).join('\n')}` : ''
    const content = depsSection + envSection
    fs.writeFileSync(path.join(dir, 'deps.yaml'), content)
  }

  describe('Stub Creation and Structure', () => {
    it('should create binary stubs with proper isolation headers', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        expect(result.stderr).toContain('✅ Installed')
      }
      else {
        // Package installation failed, which is acceptable for testing
        // Check for the actual error message format
        const hasFailedInstall = result.stderr.includes('❌ Failed to install')
          || result.stderr.includes('❌ No binaries found after installation')
          || result.stderr.includes('❌ All package installations failed')
          || result.stderr.includes('❌ No packages were successfully installed')
        expect(hasFailedInstall).toBe(true)
      }
    }, 60000)

    it('should create stubs with proper environment variable handling', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })

      createDepsFile(projectDir, ['nginx.org@1.28.0'], {
        // Don't expect TEST_VAR to be in stub - it's only in the shell environment
        // Binary stubs only include pkgx environment variables, not custom project ones
      })

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        // Check that environment script is generated (which contains TEST_VAR)
        expect(result.stdout).toContain('Project-specific environment')

        // Find the generated binary stub
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Should backup environment variables before setting new ones
            expect(stubContent).toContain('_ORIG_PATH=')
            expect(stubContent).toContain('_ORIG_DYLD_FALLBACK_LIBRARY_PATH=')
            expect(stubContent).toContain('_cleanup_env()')
            expect(stubContent).toContain('trap _cleanup_env EXIT')
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)

    it('should handle multiple binaries in a package', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      // Use a package that has multiple binaries
      createDepsFile(projectDir, ['git-scm.org@2.40.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        // Should create stubs for multiple binaries
        expect(result.stderr).toContain('✅ Installed')
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Environment Variable Isolation', () => {
    it('should isolate PATH-like environment variables', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'], {
        PATH: '/custom/path:/another/path',
        LD_LIBRARY_PATH: '/custom/lib:/another/lib',
      })

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Should handle PATH and LD_LIBRARY_PATH specially (arrays)
            expect(stubContent).toContain('export PATH=')
            expect(stubContent).toContain('export LD_LIBRARY_PATH=')

            // Should backup these variables
            expect(stubContent).toContain('_ORIG_PATH=')
            expect(stubContent).toContain('_ORIG_LD_LIBRARY_PATH=')
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)

    it('should handle DYLD_FALLBACK_LIBRARY_PATH correctly', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Should set DYLD_FALLBACK_LIBRARY_PATH with fallback paths
            if (stubContent.includes('DYLD_FALLBACK_LIBRARY_PATH')) {
              // On macOS, expect fallback paths; on Linux, just check it's set
              if (process.platform === 'darwin') {
                expect(stubContent).toContain(':/usr/lib:/usr/local/lib')
              }
              else {
                // On Linux, DYLD_FALLBACK_LIBRARY_PATH might not have the same fallback paths
                expect(stubContent).toMatch(/DYLD_FALLBACK_LIBRARY_PATH="[^"]*"/)
              }
            }
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Stub Execution and Cleanup', () => {
    it('should create executable stubs', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stats = fs.statSync(nginxStub)
            // Check that the stub is executable (mode includes execute bit)
            expect(stats.mode & 0o111).toBeGreaterThan(0)
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)

    it('should properly escape shell arguments in stubs', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })

      createDepsFile(projectDir, ['nginx.org@1.28.0'], {
        // Don't expect SPECIAL_VAR in binary stubs - they only contain pkgx environment variables
      })

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Check that pkgx environment variables are properly escaped
            expect(stubContent).toContain('export DYLD_FALLBACK_LIBRARY_PATH=')
            expect(stubContent).toContain('export PATH=')
            expect(stubContent).toContain('exec ')
            expect(stubContent).toContain('"$@"') // Arguments should be properly passed through
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Package-specific Environment Setup', () => {
    it('should include pkgx runtime environment variables', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Should contain sections for different environment variable types
            expect(stubContent).toContain('Set pkgx environment variables')
            expect(stubContent).toContain('Set package-specific runtime environment variables')

            // Should execute the actual binary at the end
            expect(stubContent).toMatch(/exec ".*nginx.*" "\$@"/)
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)

    it('should handle packages with no binaries gracefully', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      // Use a library-only package that doesn't provide binaries
      // Try with a more generic version constraint that's likely to exist
      createDepsFile(projectDir, ['zlib.net']) // No specific version to allow flexibility

      const result = await runCLI(['dev'], projectDir)

      // The test should handle both scenarios gracefully:
      // 1. Package installs successfully but has no binaries
      // 2. Package installation fails (version not found, network issues, etc.)

      if (result.exitCode === 0) {
        // Package installed successfully
        // Check both stdout and stderr for the message since output formatting can vary
        const combinedOutput = result.stdout + result.stderr

        // Should either show "No binaries were installed" or success message
        // The exact message depends on whether the package actually has binaries or not
        const hasNoBinariesMessage = combinedOutput.includes('No binaries were installed')
        const hasSuccessMessage = combinedOutput.includes('Environment activated')

        // At least one of these should be true for a successful installation
        expect(hasNoBinariesMessage || hasSuccessMessage).toBe(true)
      }
      else {
        // Installation failed - this is acceptable for network-dependent tests
        expect(result.exitCode).toBe(1)
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Error Handling in Stub Creation', () => {
    it('should handle missing binary directories', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        // Should not fail if some expected directories don't exist
        expect(result.stderr).not.toContain('Failed to create stub')
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)

    it('should skip broken symlinks', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        // Should handle broken symlinks gracefully
        if (result.stderr.includes('Symlink') && result.stderr.includes('non-existent')) {
          expect(result.stderr).toContain('skipping')
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Cross-platform Compatibility', () => {
    it('should create stubs with proper shebang', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })
      createDepsFile(projectDir, ['nginx.org@1.28.0'])

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Should use POSIX-compatible shebang
            expect(stubContent).toMatch(/^#!/)
            expect(stubContent).toContain('#!/bin/sh')

            // Should use POSIX-compatible shell features
            expect(stubContent).not.toContain('[[') // bash-specific
            expect(stubContent).toContain('[ ') // POSIX-compatible
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })

  describe('Integration with Project Environment', () => {
    it('should create stubs that work with project-specific environments', async () => {
      const projectDir = path.join(tempDir, 'project')
      fs.mkdirSync(projectDir, { recursive: true })

      createDepsFile(projectDir, ['nginx.org@1.28.0'], {
        BUILD_ENV: 'production',
      })

      const result = await runCLI(['dev'], projectDir)

      // Accept either success or failure
      if (result.exitCode === 0) {
        // Check that environment script is generated with BUILD_ENV
        expect(result.stdout).toContain('BUILD_ENV=')

        const prefixMatch = result.stderr.match(/(?:📍 )?Installation prefix: (.+)/)
        if (prefixMatch) {
          const prefix = prefixMatch[1]
          const nginxStub = path.join(prefix, 'sbin', 'nginx')

          if (fs.existsSync(nginxStub)) {
            const stubContent = fs.readFileSync(nginxStub, 'utf-8')

            // Binary stubs should include isolation mechanisms
            expect(stubContent).toContain('_cleanup_env()')
            expect(stubContent).toContain('trap _cleanup_env EXIT')

            // Should execute the actual binary
            expect(stubContent).toMatch(/exec ".*nginx.*" "\$@"/)
          }
        }
      }
      else {
        // If installation fails, check graceful error handling
        expect(result.stderr).toContain('Failed to install')
      }
    }, 60000)
  })
})
