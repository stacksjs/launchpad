import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { dump } from '../src/dev'

describe('Environment Activation Behavior', () => {
  let tempDir: string
  let testEnvDir: string
  let testGlobalEnvDir: string

  beforeEach(() => {
    // Create temporary directories for testing
    tempDir = fs.mkdtempSync(path.join(import.meta.dir, 'test-activation-'))
    testEnvDir = path.join(tempDir, 'local-env')
    testGlobalEnvDir = path.join(tempDir, 'global-env')

    // Create empty environment directories
    fs.mkdirSync(path.join(testEnvDir, 'bin'), { recursive: true })
    fs.mkdirSync(path.join(testGlobalEnvDir, 'bin'), { recursive: true })
  })

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test('should generate shell code with warnings when required packages are missing from environment directories', async () => {
    // Create a project with dependency requirements
    const projectDir = path.join(tempDir, 'project')
    fs.mkdirSync(projectDir)

    // Create deps.yaml with packages that don't exist to ensure installation failure
    const depsFile = path.join(projectDir, 'deps.yaml')
    fs.writeFileSync(depsFile, `
dependencies:
  completely-nonexistent-package-12345: ^1.0.0  # Package that doesn't exist to trigger installation failure
  another-nonexistent-package-xyz: ^1.0.0  # Another non-existent package
`)

    // Mock console.error to capture shell output
    let shellOutput = ''
    let errorOutput = ''

    const originalStdout = process.stdout.write
    const originalStderr = process.stderr.write

    process.stdout.write = (chunk: any) => {
      shellOutput += chunk
      return true
    }
    process.stderr.write = (chunk: any) => {
      errorOutput += chunk
      return true
    }

    try {
      // Test shell output mode - should NOT generate shell code when packages missing
      await dump(projectDir, {
        shellOutput: true,
        quiet: false,
        skipGlobal: true, // Focus on local environment for this test
      })

      // Shell output should be generated for development workflows even when packages missing
      expect(shellOutput).toContain('export PATH=')
      expect(shellOutput).toContain('LAUNCHPAD_ORIGINAL_PATH')

      // Should have error messages about missing packages
      expect(errorOutput).toContain('Environment not ready')
      expect(errorOutput).toContain('Local packages need installation')
      expect(errorOutput).toContain('Generating minimal shell environment for development')
    }
    finally {
      // Restore original stdout/stderr
      process.stdout.write = originalStdout
      process.stderr.write = originalStderr
    }
  })

  test('should generate shell code with warnings when environment directories are empty', async () => {
    // Create a project directory
    const projectDir = path.join(tempDir, 'project')
    fs.mkdirSync(projectDir)

    // Create deps.yaml
    const depsFile = path.join(projectDir, 'deps.yaml')
    fs.writeFileSync(depsFile, `
dependencies:
  test-package: ^1.0.0
`)

    // Mock the environment with an installed package
    const envDir = path.join(tempDir, 'test-env')
    fs.mkdirSync(path.join(envDir, 'bin'), { recursive: true })
    fs.mkdirSync(path.join(envDir, 'test-package.com'), { recursive: true })
    fs.mkdirSync(path.join(envDir, 'test-package.com', 'v1.0.0'), { recursive: true })

    // Create a mock binary in the environment
    const mockBinary = path.join(envDir, 'bin', 'test-package')
    fs.writeFileSync(mockBinary, '#!/bin/bash\necho "test-package v1.0.0"')
    fs.chmodSync(mockBinary, 0o755)

    let shellOutput = ''
    let errorOutput = ''

    const originalStdout = process.stdout.write
    const originalStderr = process.stderr.write

    process.stdout.write = (chunk: any) => {
      shellOutput += chunk
      return true
    }
    process.stderr.write = (chunk: any) => {
      errorOutput += chunk
      return true
    }

    try {
      // This test verifies the principle - in real usage, packages would be properly installed
      // For now, just verify that empty environments are correctly detected as not ready
      await dump(projectDir, {
        shellOutput: true,
        quiet: false,
        skipGlobal: true,
      })

      // With empty environment, should still generate shell code for development workflows
      expect(shellOutput).toContain('export PATH=')
      expect(errorOutput).toContain('Environment not ready')
      expect(errorOutput).toContain('Generating minimal shell environment for development')
    }
    finally {
      process.stdout.write = originalStdout
      process.stderr.write = originalStderr
    }
  })

  test('should show helpful messages when system binaries satisfy constraints but packages not installed', async () => {
    const projectDir = path.join(tempDir, 'project')
    fs.mkdirSync(projectDir)

    const depsFile = path.join(projectDir, 'deps.yaml')
    fs.writeFileSync(depsFile, `
dependencies:
  nonexistent-test-package: ^1.0.0  # Package that doesn't exist to trigger installation failure
`)

    let errorOutput = ''
    const originalStderr = process.stderr.write
    process.stderr.write = (chunk: any) => {
      errorOutput += chunk
      return true
    }

    try {
      await dump(projectDir, {
        shellOutput: true,
        skipGlobal: true,
      })

      // Should provide helpful guidance when installation fails
      expect(errorOutput).toContain('Environment not ready')
      expect(errorOutput).toContain('packages need installation')
    }
    finally {
      process.stderr.write = originalStderr
    }
  })
})
