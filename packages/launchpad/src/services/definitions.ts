import type { ServiceDefinition } from '../types'
import { homedir } from 'node:os'
import path from 'node:path'

/**
 * Predefined service definitions for common services
 * These services can be automatically detected and managed by Launchpad
 */
export const SERVICE_DEFINITIONS: Record<string, ServiceDefinition> = {
  postgres: {
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'PostgreSQL database server',
    packageDomain: 'postgresql.org',
    executable: 'postgres',
    args: ['-D', '{dataDir}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'postgres', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'postgres.log'),
    pidFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'postgres', 'postgres.pid'),
    port: 5432,
    dependencies: [],
    healthCheck: {
      command: ['pg_isready', '-p', '5432'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    initCommand: ['initdb', '-D', '{dataDir}'],
    supportsGracefulShutdown: true,
  },

  mysql: {
    name: 'mysql',
    displayName: 'MySQL',
    description: 'MySQL database server',
    packageDomain: 'mysql.com',
    executable: 'mysqld_safe',
    args: ['--datadir={dataDir}', '--pid-file={pidFile}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'mysql', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'mysql.log'),
    pidFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'mysql', 'mysql.pid'),
    port: 3306,
    dependencies: [],
    healthCheck: {
      command: ['mysqladmin', 'ping', '-h', '127.0.0.1', '-P', '3306'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    initCommand: ['mysql_install_db', '--datadir={dataDir}'],
    supportsGracefulShutdown: true,
  },

  redis: {
    name: 'redis',
    displayName: 'Redis',
    description: 'Redis in-memory data store',
    packageDomain: 'redis.io',
    executable: 'redis-server',
    args: ['{configFile}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'redis', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'redis.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'redis.log'),
    pidFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'redis', 'redis.pid'),
    port: 6379,
    dependencies: [],
    healthCheck: {
      command: ['redis-cli', 'ping'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  nginx: {
    name: 'nginx',
    displayName: 'Nginx',
    description: 'Nginx web server',
    packageDomain: 'nginx.org',
    executable: 'nginx',
    args: ['-c', '{configFile}', '-g', 'daemon off;'],
    env: {},
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'nginx.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'nginx.log'),
    pidFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'nginx', 'nginx.pid'),
    port: 8080,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8080/health'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  memcached: {
    name: 'memcached',
    displayName: 'Memcached',
    description: 'Memcached memory object caching system',
    packageDomain: 'memcached.org',
    executable: 'memcached',
    args: ['-p', '11211', '-m', '64', '-c', '1024'],
    env: {},
    port: 11211,
    dependencies: [],
    healthCheck: {
      command: ['nc', '-z', 'localhost', '11211'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  mongodb: {
    name: 'mongodb',
    displayName: 'MongoDB',
    description: 'MongoDB document database',
    packageDomain: 'mongodb.com',
    executable: 'mongod',
    args: ['--dbpath', '{dataDir}', '--port', '27017'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'mongodb', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'mongodb.log'),
    pidFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'mongodb', 'mongodb.pid'),
    port: 27017,
    dependencies: [],
    healthCheck: {
      command: ['mongo', '--eval', 'db.runCommand("ping")', '--quiet'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  rabbitmq: {
    name: 'rabbitmq',
    displayName: 'RabbitMQ',
    description: 'RabbitMQ message broker',
    packageDomain: 'rabbitmq.com',
    executable: 'rabbitmq-server',
    args: [],
    env: {
      RABBITMQ_MNESIA_BASE: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'rabbitmq', 'mnesia'),
      RABBITMQ_LOG_BASE: path.join(homedir(), '.local', 'share', 'launchpad', 'logs'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'rabbitmq', 'mnesia'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'rabbitmq.log'),
    port: 5672,
    dependencies: [],
    healthCheck: {
      command: ['rabbitmqctl', 'status'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  elasticsearch: {
    name: 'elasticsearch',
    displayName: 'Elasticsearch',
    description: 'Elasticsearch search engine',
    packageDomain: 'elastic.co',
    executable: 'elasticsearch',
    args: [],
    env: {
      ES_PATH_DATA: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'elasticsearch', 'data'),
      ES_PATH_LOGS: path.join(homedir(), '.local', 'share', 'launchpad', 'logs'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'elasticsearch', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'elasticsearch.log'),
    port: 9200,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:9200/_health'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  caddy: {
    name: 'caddy',
    displayName: 'Caddy',
    description: 'Caddy web server with automatic HTTPS',
    packageDomain: 'caddyserver.com',
    executable: 'caddy',
    args: ['run', '--config', '{configFile}'],
    env: {},
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'Caddyfile'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'caddy.log'),
    port: 2015,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:2015/health'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },
}

/**
 * Get service definition by name
 */
export function getServiceDefinition(serviceName: string): ServiceDefinition | undefined {
  return SERVICE_DEFINITIONS[serviceName.toLowerCase()]
}

/**
 * Get all available service definitions
 */
export function getAllServiceDefinitions(): ServiceDefinition[] {
  return Object.values(SERVICE_DEFINITIONS)
}

/**
 * Get service definitions that match a package domain
 */
export function getServiceDefinitionsByPackage(packageDomain: string): ServiceDefinition[] {
  return Object.values(SERVICE_DEFINITIONS).filter(def => def.packageDomain === packageDomain)
}

/**
 * Check if a service is supported
 */
export function isServiceSupported(serviceName: string): boolean {
  return serviceName.toLowerCase() in SERVICE_DEFINITIONS
}

/**
 * Detect services based on installed packages
 */
export function detectInstalledServices(installedPackages: string[]): ServiceDefinition[] {
  const detectedServices: ServiceDefinition[] = []

  for (const pkg of installedPackages) {
    const services = getServiceDefinitionsByPackage(pkg)
    detectedServices.push(...services)
  }

  return detectedServices
}

/**
 * Create default configuration content for a service
 */
export function createDefaultServiceConfig(serviceName: string): string | null {
  switch (serviceName.toLowerCase()) {
    case 'redis':
      return `# Redis configuration file
port 6379
bind 127.0.0.1
save 900 1
save 300 10
save 60 10000
rdbcompression yes
dbfilename dump.rdb
dir ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'redis', 'data')}
logfile ${path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'redis.log')}
loglevel notice
`

    case 'nginx':
      return `# Nginx configuration file
worker_processes auto;
error_log ${path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'nginx-error.log')};
pid ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'nginx', 'nginx.pid')};

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    access_log ${path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'nginx-access.log')};

    sendfile on;
    keepalive_timeout 65;

    server {
        listen 8080;
        server_name localhost;

        location / {
            root ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'nginx', 'html')};
            index index.html index.htm;
        }

        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
    }
}
`

    case 'caddy':
      return `# Caddyfile
:2015 {
    respond /health "healthy"
    file_server browse
    root * ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'caddy', 'html')}
}
`

    default:
      return null
  }
}
