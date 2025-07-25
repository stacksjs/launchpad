import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { install_prefix } from './install'
import { shim_dir } from './shim'
import { isInPath } from './utils'

export interface DiagnosticResult {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  suggestion?: string
}

export interface DoctorReport {
  overall: 'healthy' | 'issues' | 'critical'
  results: DiagnosticResult[]
  summary: {
    passed: number
    warnings: number
    failed: number
  }
}

/**
 * Run comprehensive health checks for launchpad installation
 */
export async function runDoctorChecks(): Promise<DoctorReport> {
  const results: DiagnosticResult[] = []

  // Check installation directory
  results.push(await checkInstallationDirectory())

  // Check PATH configuration
  results.push(await checkPathConfiguration())

  // Check shim directory
  results.push(await checkShimDirectory())

  // Check permissions
  results.push(await checkPermissions())

  // Check shell integration
  results.push(await checkShellIntegration())

  // Check system dependencies
  results.push(await checkSystemDependencies())

  // Check network connectivity
  results.push(await checkNetworkConnectivity())

  // Calculate summary
  const summary = {
    passed: results.filter(r => r.status === 'pass').length,
    warnings: results.filter(r => r.status === 'warn').length,
    failed: results.filter(r => r.status === 'fail').length,
  }

  // Determine overall health
  let overall: DoctorReport['overall'] = 'healthy'
  if (summary.failed > 0) {
    overall = 'critical'
  }
  else if (summary.warnings > 0) {
    overall = 'issues'
  }

  return {
    overall,
    results,
    summary,
  }
}

async function checkInstallationDirectory(): Promise<DiagnosticResult> {
  try {
    const installPath = install_prefix()
    const binDir = path.join(installPath.string, 'bin')
    const sbinDir = path.join(installPath.string, 'sbin')

    if (!fs.existsSync(installPath.string)) {
      return {
        name: 'Installation Directory',
        status: 'fail',
        message: `Installation directory does not exist: ${installPath.string}`,
        suggestion: 'Run "launchpad bootstrap" to set up the installation directory',
      }
    }

    if (!fs.existsSync(binDir)) {
      return {
        name: 'Installation Directory',
        status: 'warn',
        message: `Binary directory missing: ${binDir}`,
        suggestion: 'Run "launchpad bootstrap" to create missing directories',
      }
    }

    if (!fs.existsSync(sbinDir)) {
      return {
        name: 'Installation Directory',
        status: 'warn',
        message: `System binary directory missing: ${sbinDir}`,
        suggestion: 'Run "launchpad bootstrap" to create missing directories',
      }
    }

    // Check if directory is writable
    try {
      const testFile = path.join(installPath.string, '.launchpad-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    }
    catch {
      return {
        name: 'Installation Directory',
        status: 'fail',
        message: `Installation directory is not writable: ${installPath.string}`,
        suggestion: 'Check directory permissions or run with appropriate privileges',
      }
    }

    return {
      name: 'Installation Directory',
      status: 'pass',
      message: `Installation directory is properly configured: ${installPath.string}`,
    }
  }
  catch (error) {
    return {
      name: 'Installation Directory',
      status: 'fail',
      message: `Error checking installation directory: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkPathConfiguration(): Promise<DiagnosticResult> {
  try {
    const installPath = install_prefix()
    const binDir = path.join(installPath.string, 'bin')
    const sbinDir = path.join(installPath.string, 'sbin')

    const binInPath = isInPath(binDir)
    const sbinInPath = isInPath(sbinDir)

    if (!binInPath && !sbinInPath) {
      return {
        name: 'PATH Configuration',
        status: 'fail',
        message: 'Neither bin nor sbin directories are in PATH',
        suggestion: `Add ${binDir} to your PATH environment variable`,
      }
    }

    if (!binInPath) {
      return {
        name: 'PATH Configuration',
        status: 'warn',
        message: `Binary directory not in PATH: ${binDir}`,
        suggestion: `Add ${binDir} to your PATH environment variable`,
      }
    }

    if (!sbinInPath) {
      return {
        name: 'PATH Configuration',
        status: 'warn',
        message: `System binary directory not in PATH: ${sbinDir}`,
        suggestion: `Consider adding ${sbinDir} to your PATH environment variable`,
      }
    }

    return {
      name: 'PATH Configuration',
      status: 'pass',
      message: 'Installation directories are properly configured in PATH',
    }
  }
  catch (error) {
    return {
      name: 'PATH Configuration',
      status: 'fail',
      message: `Error checking PATH configuration: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkShimDirectory(): Promise<DiagnosticResult> {
  try {
    const shimPath = shim_dir()

    if (!fs.existsSync(shimPath.string)) {
      return {
        name: 'Shim Directory',
        status: 'warn',
        message: `Shim directory does not exist: ${shimPath.string}`,
        suggestion: 'Shim directory will be created automatically when needed',
      }
    }

    const shimInPath = isInPath(shimPath.string)
    if (!shimInPath) {
      return {
        name: 'Shim Directory',
        status: 'warn',
        message: `Shim directory not in PATH: ${shimPath.string}`,
        suggestion: `Add ${shimPath.string} to your PATH environment variable`,
      }
    }

    return {
      name: 'Shim Directory',
      status: 'pass',
      message: `Shim directory is properly configured: ${shimPath.string}`,
    }
  }
  catch (error) {
    return {
      name: 'Shim Directory',
      status: 'fail',
      message: `Error checking shim directory: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkPermissions(): Promise<DiagnosticResult> {
  try {
    const installPath = install_prefix()
    const homeDir = os.homedir()

    // Check if we're installing to a system directory
    const isSystemInstall = installPath.string.startsWith('/usr/') || installPath.string.startsWith('/opt/')

    if (isSystemInstall && process.getuid && process.getuid() !== 0) {
      // Check if we can write to the system directory
      try {
        const testFile = path.join(installPath.string, '.permission-test')
        fs.writeFileSync(testFile, 'test')
        fs.unlinkSync(testFile)
      }
      catch {
        return {
          name: 'Permissions',
          status: 'warn',
          message: 'Installing to system directory without root privileges',
          suggestion: 'Consider using a user directory or run with sudo when needed',
        }
      }
    }

    // Check home directory access
    if (!fs.existsSync(homeDir)) {
      return {
        name: 'Permissions',
        status: 'fail',
        message: 'Cannot access home directory',
        suggestion: 'Check HOME environment variable and directory permissions',
      }
    }

    return {
      name: 'Permissions',
      status: 'pass',
      message: 'File system permissions are properly configured',
    }
  }
  catch (error) {
    return {
      name: 'Permissions',
      status: 'fail',
      message: `Error checking permissions: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkShellIntegration(): Promise<DiagnosticResult> {
  try {
    const shell = process.env.SHELL || ''
    const homeDir = os.homedir()

    if (!shell) {
      return {
        name: 'Shell Integration',
        status: 'warn',
        message: 'SHELL environment variable not set',
        suggestion: 'Set SHELL environment variable for better shell integration',
      }
    }

    // Check for common shell config files
    const shellName = path.basename(shell)
    const configFiles = {
      zsh: ['.zshrc', '.zprofile'],
      bash: ['.bashrc', '.bash_profile', '.profile'],
      fish: ['.config/fish/config.fish'],
    }

    const possibleConfigs = configFiles[shellName as keyof typeof configFiles] || ['.profile']
    const existingConfigs = possibleConfigs.filter(config =>
      fs.existsSync(path.join(homeDir, config)),
    )

    if (existingConfigs.length === 0) {
      return {
        name: 'Shell Integration',
        status: 'warn',
        message: `No shell configuration files found for ${shellName}`,
        suggestion: `Create a shell configuration file (e.g., ${possibleConfigs[0]}) for persistent PATH changes`,
      }
    }

    return {
      name: 'Shell Integration',
      status: 'pass',
      message: `Shell integration available for ${shellName}`,
    }
  }
  catch (error) {
    return {
      name: 'Shell Integration',
      status: 'fail',
      message: `Error checking shell integration: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkSystemDependencies(): Promise<DiagnosticResult> {
  try {
    const platform = os.platform()
    const arch = os.arch()

    // Check for required system tools
    const requiredTools = ['curl', 'tar']
    const missingTools: string[] = []

    for (const tool of requiredTools) {
      try {
        // Try to find the tool in PATH
        const { execSync } = await import('node:child_process')
        execSync(`which ${tool}`, { stdio: 'ignore' })
      }
      catch {
        missingTools.push(tool)
      }
    }

    if (missingTools.length > 0) {
      return {
        name: 'System Dependencies',
        status: 'fail',
        message: `Missing required system tools: ${missingTools.join(', ')}`,
        suggestion: 'Install missing tools using your system package manager',
      }
    }

    // Check platform support
    const supportedPlatforms = ['darwin', 'linux', 'win32']
    if (!supportedPlatforms.includes(platform)) {
      return {
        name: 'System Dependencies',
        status: 'warn',
        message: `Platform ${platform} may not be fully supported`,
        suggestion: 'Some features may not work correctly on this platform',
      }
    }

    return {
      name: 'System Dependencies',
      status: 'pass',
      message: `System dependencies are available (${platform}/${arch})`,
    }
  }
  catch (error) {
    return {
      name: 'System Dependencies',
      status: 'fail',
      message: `Error checking system dependencies: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function checkNetworkConnectivity(): Promise<DiagnosticResult> {
  try {
    // Test connectivity to the package distribution server
    const testUrl = 'https://dist.pkgx.sh'

    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      return {
        name: 'Network Connectivity',
        status: 'warn',
        message: `Package server returned ${response.status}: ${response.statusText}`,
        suggestion: 'Check your internet connection and firewall settings',
      }
    }

    return {
      name: 'Network Connectivity',
      status: 'pass',
      message: 'Package distribution server is accessible',
    }
  }
  catch (error) {
    return {
      name: 'Network Connectivity',
      status: 'fail',
      message: `Cannot reach package distribution server: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Check your internet connection and firewall settings',
    }
  }
}

/**
 * Format doctor report for CLI display
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = []

  // Header
  lines.push('🩺 Launchpad Health Check')
  lines.push('='.repeat(50))
  lines.push('')

  // Overall status
  const statusEmoji = {
    healthy: '✅',
    issues: '⚠️',
    critical: '❌',
  }[report.overall]

  const statusMessage = {
    healthy: 'All systems operational',
    issues: 'Some issues detected',
    critical: 'Critical issues found',
  }[report.overall]

  lines.push(`${statusEmoji} Overall Status: ${statusMessage}`)
  lines.push('')

  // Individual checks
  lines.push('Diagnostic Results:')
  lines.push('-'.repeat(30))

  for (const result of report.results) {
    const emoji = {
      pass: '✅',
      warn: '⚠️',
      fail: '❌',
    }[result.status]

    lines.push(`${emoji} ${result.name}`)
    lines.push(`   ${result.message}`)

    if (result.suggestion) {
      lines.push(`   💡 ${result.suggestion}`)
    }
    lines.push('')
  }

  // Summary
  lines.push('Summary:')
  lines.push('-'.repeat(20))
  lines.push(`✅ Passed: ${report.summary.passed}`)
  lines.push(`⚠️  Warnings: ${report.summary.warnings}`)
  lines.push(`❌ Failed: ${report.summary.failed}`)

  if (report.overall !== 'healthy') {
    lines.push('')
    lines.push('💡 Run "launchpad bootstrap" to fix common issues')
  }

  return lines.join('\n')
}
