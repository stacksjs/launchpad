import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { config } from '../src/config'
import { getAllServiceDefinitions, getServiceDefinition, isServiceSupported } from '../src/services/definitions'
import { disableService, enableService, getServiceStatus, initializeServiceManager, listServices, restartService, startService, stopService } from '../src/services/manager'
import { generateLaunchdPlist, generateSystemdService, getServiceManagerName, isPlatformSupported } from '../src/services/platform'

describe('Service Management', () => {
  let originalEnv: NodeJS.ProcessEnv
  let tempDir: string
  let originalConfig: typeof config.services

  beforeEach(() => {
    originalEnv = { ...process.env }
    originalConfig = { ...config.services }
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'launchpad-services-test-'))

    // Set test environment
    process.env.NODE_ENV = 'test'

    // Override service directories for testing
    config.services.dataDir = path.join(tempDir, 'services')
    config.services.logDir = path.join(tempDir, 'logs')
    config.services.configDir = path.join(tempDir, 'config')
  })

  afterEach(() => {
    process.env = originalEnv
    Object.assign(config.services, originalConfig)

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('Service Definitions', () => {
    it('should have predefined service definitions', () => {
      const definitions = getAllServiceDefinitions()

      expect(definitions.length).toBeGreaterThan(0)

      // Check that common services are defined
      const serviceNames = definitions.map(def => def.name)
      expect(serviceNames).toContain('postgres')
      expect(serviceNames).toContain('redis')
      expect(serviceNames).toContain('mysql')
      expect(serviceNames).toContain('nginx')
    })

    it('should provide correct service definition for postgres', () => {
      const postgres = getServiceDefinition('postgres')

      expect(postgres).toBeDefined()
      expect(postgres!.name).toBe('postgres')
      expect(postgres!.displayName).toBe('PostgreSQL')
      expect(postgres!.packageDomain).toBe('postgresql.org')
      expect(postgres!.executable).toBe('postgres')
      expect(postgres!.port).toBe(5432)
      expect(postgres!.supportsGracefulShutdown).toBe(true)
    })

    it('should support service detection', () => {
      expect(isServiceSupported('postgres')).toBe(true)
      expect(isServiceSupported('redis')).toBe(true)
      expect(isServiceSupported('nonexistent-service')).toBe(false)
    })
  })

  describe('Platform Support', () => {
    it('should detect platform support correctly', () => {
      const supported = isPlatformSupported()
      const platform = process.platform

      if (platform === 'darwin' || platform === 'linux') {
        expect(supported).toBe(true)
      }
      else {
        expect(supported).toBe(false)
      }
    })

    it('should return correct service manager name', () => {
      const managerName = getServiceManagerName()
      const platform = process.platform

      if (platform === 'darwin') {
        expect(managerName).toBe('launchd')
      }
      else if (platform === 'linux') {
        expect(managerName).toBe('systemd')
      }
      else {
        expect(managerName).toBe('unknown')
      }
    })
  })

  describe('Service File Generation', () => {
    it('should generate valid launchd plist', () => {
      const service = {
        definition: getServiceDefinition('postgres')!,
        status: 'stopped' as const,
        lastCheckedAt: new Date(),
        enabled: true,
        config: {},
      }

      const plist = generateLaunchdPlist(service)

      expect(plist.Label).toBe('com.launchpad.postgres')
      expect(plist.ProgramArguments).toContain('postgres')
      expect(plist.RunAtLoad).toBe(true)
      expect(plist.KeepAlive).toBeDefined()
    })

    it('should generate valid systemd service', () => {
      const service = {
        definition: getServiceDefinition('postgres')!,
        status: 'stopped' as const,
        lastCheckedAt: new Date(),
        enabled: true,
        config: {},
      }

      const systemdService = generateSystemdService(service)

      expect(systemdService.Unit.Description).toContain('PostgreSQL')
      expect(systemdService.Service.ExecStart).toContain('postgres')
      expect(systemdService.Service.Type).toBe('simple')
      expect(systemdService.Install?.WantedBy).toContain('multi-user.target')
    })
  })

  describe('Service Manager Operations', () => {
    beforeEach(async () => {
      // Initialize service manager for tests
      await initializeServiceManager()
    })

    it('should initialize service manager', async () => {
      const manager = await initializeServiceManager()

      expect(manager).toBeDefined()
      expect(manager.services).toBeInstanceOf(Map)
      expect(manager.operations).toBeArray()
      expect(manager.config).toBeDefined()
    })

    it('should handle starting unknown service', async () => {
      await expect(startService('unknown-service')).rejects.toThrow('Unknown service: unknown-service')
    })

    it('should handle service status checking', async () => {
      const status = await getServiceStatus('postgres')
      expect(['stopped', 'running', 'starting', 'stopping', 'failed', 'unknown']).toContain(status)
    })

    it('should list services', async () => {
      const services = await listServices()
      expect(services).toBeArray()
      // Should be empty initially since no services are registered
      expect(services.length).toBe(0)
    })

    it('should handle enabling non-existent service', async () => {
      await expect(enableService('unknown-service')).rejects.toThrow('Unknown service: unknown-service')
    })

    it('should handle disabling non-registered service', async () => {
      // This should succeed gracefully
      const result = await disableService('postgres')
      expect(result).toBe(true)
    })

    it('should handle stopping non-registered service', async () => {
      // This should succeed gracefully
      const result = await stopService('postgres')
      expect(result).toBe(true)
    })
  })

  describe('Mock Service Operations', () => {
    let originalSpawn: any
    let mockChildProcess: any

    beforeEach(async () => {
      // Set test environment to avoid real system calls
      process.env.NODE_ENV = 'test'
      process.env.LAUNCHPAD_TEST_MODE = 'true'

      // Create a mock child process that resolves quickly
      mockChildProcess = {
        on: mock((event: string, callback: (code?: number) => void) => {
          if (event === 'close') {
            // Resolve immediately to avoid timeouts
            setImmediate(() => callback(0))
          }
          else if (event === 'error') {
            // Don't call error callback unless we want to test errors
          }
        }),
        pid: 12345,
      }

      // Mock spawn function
      const childProcessModule = await import('node:child_process')
      originalSpawn = childProcessModule.spawn

      // Replace spawn with our mock
      Object.defineProperty(childProcessModule, 'spawn', {
        value: mock(() => mockChildProcess),
        writable: true,
      })

      await initializeServiceManager()
    })

    afterEach(async () => {
      // Clean up test environment
      delete process.env.LAUNCHPAD_TEST_MODE

      // Restore original spawn
      if (originalSpawn) {
        const childProcessModule = await import('node:child_process')
        Object.defineProperty(childProcessModule, 'spawn', {
          value: originalSpawn,
          writable: true,
        })
      }
    })

    it('should handle service lifecycle with mocked commands', async () => {
      // Skip on platforms that don't support service management
      if (!isPlatformSupported()) {
        return
      }

      const serviceName = 'redis'

      // Test enabling service
      const enableResult = await enableService(serviceName)
      expect(enableResult).toBe(true)

      // Test starting service
      const startResult = await startService(serviceName)
      expect(startResult).toBe(true)

      // Test stopping service
      const stopResult = await stopService(serviceName)
      expect(stopResult).toBe(true)

      // Test disabling service
      const disableResult = await disableService(serviceName)
      expect(disableResult).toBe(true)
    })

    it('should handle restart operation', async () => {
      if (!isPlatformSupported()) {
        return
      }

      const serviceName = 'redis'

      // Enable and start the service first
      await enableService(serviceName)
      await startService(serviceName)

      // Test restart
      const restartResult = await restartService(serviceName)
      expect(restartResult).toBe(true)
    })
  })

  describe('Service Configuration', () => {
    it('should create configuration directories', async () => {
      await initializeServiceManager()

      // Wait a bit to ensure directories are created
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(fs.existsSync(config.services.dataDir)).toBe(true)
      expect(fs.existsSync(config.services.logDir)).toBe(true)
      expect(fs.existsSync(config.services.configDir)).toBe(true)
    })

    it('should respect configuration overrides', () => {
      const originalDataDir = config.services.dataDir
      config.services.dataDir = '/custom/data/dir'

      expect(config.services.dataDir).toBe('/custom/data/dir')

      // Restore original
      config.services.dataDir = originalDataDir
    })
  })

  describe('Error Handling', () => {
    it('should handle platform not supported error', async () => {
      // Mock platform to unsupported
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      })

      try {
        await expect(startService('postgres')).rejects.toThrow('not supported')
      }
      finally {
        // Restore original platform
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          configurable: true,
        })
      }
    })

    it('should handle service definition not found', async () => {
      await expect(startService('completely-unknown-service')).rejects.toThrow('Unknown service: completely-unknown-service')
    })
  })

  describe('Service Health Checks', () => {
    it('should have health check definitions for services', () => {
      const postgres = getServiceDefinition('postgres')
      const redis = getServiceDefinition('redis')

      expect(postgres!.healthCheck).toBeDefined()
      expect(postgres!.healthCheck!.command).toContain('pg_isready')
      expect(postgres!.healthCheck!.expectedExitCode).toBe(0)

      expect(redis!.healthCheck).toBeDefined()
      expect(redis!.healthCheck!.command).toContain('redis-cli')
      expect(redis!.healthCheck!.expectedExitCode).toBe(0)
    })
  })

  describe('Service Dependencies', () => {
    it('should define service dependencies correctly', () => {
      const definitions = getAllServiceDefinitions()

      definitions.forEach((def) => {
        expect(def.dependencies).toBeArray()
        // Most services should not have dependencies (they are independent)
        // But the structure should be there
      })
    })
  })

  describe('Service Ports', () => {
    it('should define correct default ports for services', () => {
      expect(getServiceDefinition('postgres')!.port).toBe(5432)
      expect(getServiceDefinition('mysql')!.port).toBe(3306)
      expect(getServiceDefinition('redis')!.port).toBe(6379)
      expect(getServiceDefinition('mongodb')!.port).toBe(27017)
      expect(getServiceDefinition('nginx')!.port).toBe(8080)
    })
  })
})
