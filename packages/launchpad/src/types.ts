import type { Version } from '../test/version'
import type { Path } from './path'

export interface LaunchpadConfig {
  /** Enable verbose logging (default: false) */
  verbose: boolean
  /** Path where binaries should be installed _(default: /usr/local if writable, ~/.local otherwise)_ */
  installationPath: string
  /** Password for sudo operations, loaded from .env SUDO_PASSWORD _(default: '')_ */
  sudoPassword?: string
  /** Whether to enable dev-aware installations _(default: true)_ */
  devAware: boolean
  /** Whether to auto-elevate with sudo when needed _(default: true)_ */
  autoSudo: boolean
  /** Max installation retries on failure _(default: 3)_ */
  maxRetries: number
  /** Timeout for pkgx operations in milliseconds _(default: 60000)_ */
  timeout: number
  /** Whether to symlink versions _(default: true)_ */
  symlinkVersions: boolean
  /** Whether to force reinstall if already installed _(default: false)_ */
  forceReinstall: boolean
  /** Default path for shims (default: ~/.local/bin) */
  shimPath: string
  /** Whether to automatically add shim path to the system PATH _(default: true)_ */
  autoAddToPath: boolean
  /** Whether to show shell environment activation messages _(default: true)_ */
  showShellMessages: boolean
  /** Custom message to show when environment is activated _(default: "✅ Environment activated for {path}")_ */
  shellActivationMessage: string
  /** Custom message to show when environment is deactivated _(default: "dev environment deactivated")_ */
  shellDeactivationMessage: string
  /** Whether to use a package registry _(default: true)_ */
  useRegistry: boolean
  /** Installation method _(default: 'curl')_ */
  installMethod: 'curl' | 'wget'
  /** Installation path _(default: '')_ */
  installPath: string
  /** Service management configuration */
  services: ServiceConfig
}

export type LaunchpadOptions = Partial<LaunchpadConfig>

// Types based on previous implementation
export interface Installation {
  path: Path
  pkg: {
    project: string
    version: Version
  }
}

export interface JsonResponse {
  runtime_env: Record<string, Record<string, string>>
  pkgs: Installation[]
  env: Record<string, Record<string, string>>
  pkg: Installation
}

// Service Management Types
export interface ServiceConfig {
  /** Enable service management functionality _(default: true)_ */
  enabled: boolean
  /** Default services data directory _(default: ~/.local/share/launchpad/services)_ */
  dataDir: string
  /** Default services log directory _(default: ~/.local/share/launchpad/logs)_ */
  logDir: string
  /** Default services configuration directory _(default: ~/.local/share/launchpad/services/config)_ */
  configDir: string
  /** Auto-restart failed services _(default: true)_ */
  autoRestart: boolean
  /** Service startup timeout in seconds _(default: 30)_ */
  startupTimeout: number
  /** Service shutdown timeout in seconds _(default: 10)_ */
  shutdownTimeout: number
}

export interface ServiceDefinition {
  /** Service name (e.g., 'postgres', 'redis') */
  name: string
  /** Display name for the service */
  displayName: string
  /** Service description */
  description: string
  /** Package domain that provides this service */
  packageDomain: string
  /** Executable name or path */
  executable: string
  /** Default command line arguments */
  args: string[]
  /** Environment variables to set */
  env: Record<string, string>
  /** Working directory for the service */
  workingDirectory?: string
  /** Default data directory */
  dataDirectory?: string
  /** Default configuration file path */
  configFile?: string
  /** Default log file path */
  logFile?: string
  /** Default PID file path */
  pidFile?: string
  /** Port the service listens on (if applicable) */
  port?: number
  /** Dependencies (other services that must be running) */
  dependencies: string[]
  /** Health check configuration */
  healthCheck?: ServiceHealthCheck
  /** Service initialization command (runs once before first start) */
  initCommand?: string[]
  /** Whether this service supports graceful shutdown */
  supportsGracefulShutdown: boolean
  /** Custom service configuration */
  custom?: Record<string, unknown>
}

export interface ServiceHealthCheck {
  /** Health check command to run */
  command: string[]
  /** Expected exit code for healthy service */
  expectedExitCode: number
  /** Timeout for health check in seconds */
  timeout: number
  /** Interval between health checks in seconds */
  interval: number
  /** Number of consecutive failures before marking unhealthy */
  retries: number
}

export interface ServiceInstance {
  /** Service definition */
  definition: ServiceDefinition
  /** Current service status */
  status: ServiceStatus
  /** Process ID (if running) */
  pid?: number
  /** Service startup time */
  startedAt?: Date
  /** Last status check time */
  lastCheckedAt: Date
  /** Whether service is enabled for auto-start */
  enabled: boolean
  /** Service-specific configuration overrides */
  config: Record<string, unknown>
  /** Custom data directory for this instance */
  dataDir?: string
  /** Custom log file for this instance */
  logFile?: string
  /** Custom configuration file for this instance */
  configFile?: string
}

export type ServiceStatus =
  | 'stopped' // Service is not running
  | 'starting' // Service is in the process of starting
  | 'running' // Service is running and healthy
  | 'stopping' // Service is in the process of stopping
  | 'failed' // Service failed to start or crashed
  | 'unknown' // Service status cannot be determined

export interface ServiceOperation {
  /** Operation type */
  action: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable'
  /** Service name */
  serviceName: string
  /** Timestamp when operation was initiated */
  timestamp: Date
  /** Operation result */
  result?: 'success' | 'failure' | 'timeout'
  /** Error message if operation failed */
  error?: string
  /** Duration of operation in milliseconds */
  duration?: number
}

export interface ServiceManagerState {
  /** Map of service name to service instance */
  services: Map<string, ServiceInstance>
  /** Recent operations log */
  operations: ServiceOperation[]
  /** Global service manager configuration */
  config: ServiceConfig
  /** Last time services were scanned/updated */
  lastScanTime: Date
}

// Platform-specific service file types
export interface LaunchdPlist {
  Label: string
  ProgramArguments: string[]
  WorkingDirectory?: string
  EnvironmentVariables?: Record<string, string>
  StandardOutPath?: string
  StandardErrorPath?: string
  RunAtLoad?: boolean
  KeepAlive?: boolean | { SuccessfulExit?: boolean, NetworkState?: boolean }
  StartInterval?: number
  UserName?: string
  GroupName?: string
}

export interface SystemdService {
  Unit: {
    Description: string
    After?: string[]
    Requires?: string[]
    Wants?: string[]
  }
  Service: {
    Type: 'simple' | 'forking' | 'oneshot' | 'notify' | 'exec'
    ExecStart: string
    ExecStop?: string
    ExecReload?: string
    WorkingDirectory?: string
    Environment?: string[]
    User?: string
    Group?: string
    Restart?: 'no' | 'always' | 'on-success' | 'on-failure' | 'on-abnormal' | 'on-abort' | 'on-watchdog'
    RestartSec?: number
    TimeoutStartSec?: number
    TimeoutStopSec?: number
    PIDFile?: string
  }
  Install?: {
    WantedBy?: string[]
    RequiredBy?: string[]
  }
}
