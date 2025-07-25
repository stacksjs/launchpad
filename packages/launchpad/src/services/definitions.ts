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

  kafka: {
    name: 'kafka',
    displayName: 'Apache Kafka',
    description: 'Distributed event streaming platform',
    packageDomain: 'kafka.apache.org',
    executable: 'kafka-server-start.sh',
    args: ['{configFile}'],
    env: {
      KAFKA_HEAP_OPTS: '-Xmx1G -Xms1G',
      LOG_DIR: path.join(homedir(), '.local', 'share', 'launchpad', 'logs'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'kafka', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'kafka-server.properties'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'kafka.log'),
    port: 9092,
    dependencies: [],
    healthCheck: {
      command: ['kafka-broker-api-versions.sh', '--bootstrap-server', 'localhost:9092'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  vault: {
    name: 'vault',
    displayName: 'HashiCorp Vault',
    description: 'Secrets management, encryption as a service, and privileged access management',
    packageDomain: 'vaultproject.io',
    executable: 'vault',
    args: ['server', '-config', '{configFile}'],
    env: {
      VAULT_API_ADDR: 'http://localhost:8200',
      VAULT_ADDR: 'http://localhost:8200',
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'vault', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'vault.hcl'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'vault.log'),
    port: 8200,
    dependencies: [],
    healthCheck: {
      command: ['vault', 'status'],
      expectedExitCode: 2, // Vault returns 2 when sealed but running
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  minio: {
    name: 'minio',
    displayName: 'MinIO',
    description: 'High-performance, S3 compatible object storage',
    packageDomain: 'min.io',
    executable: 'minio',
    args: ['server', '{dataDir}', '--address', 'localhost:9000', '--console-address', 'localhost:9001'],
    env: {
      MINIO_ROOT_USER: 'minioadmin',
      MINIO_ROOT_PASSWORD: 'minioadmin',
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'minio', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'minio.log'),
    port: 9000,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:9000/minio/health/live'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  prometheus: {
    name: 'prometheus',
    displayName: 'Prometheus',
    description: 'Monitoring system and time series database',
    packageDomain: 'prometheus.io',
    executable: 'prometheus',
    args: ['--config.file={configFile}', '--storage.tsdb.path={dataDir}', '--web.console.libraries=/usr/share/prometheus/console_libraries', '--web.console.templates=/usr/share/prometheus/consoles'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'prometheus', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'prometheus.yml'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'prometheus.log'),
    port: 9090,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:9090/-/healthy'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  grafana: {
    name: 'grafana',
    displayName: 'Grafana',
    description: 'Analytics and interactive visualization web application',
    packageDomain: 'grafana.com',
    executable: 'grafana-server',
    args: ['--config={configFile}', '--homepath={dataDir}'],
    env: {
      GF_PATHS_DATA: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'grafana', 'data'),
      GF_PATHS_LOGS: path.join(homedir(), '.local', 'share', 'launchpad', 'logs'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'grafana', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'grafana.ini'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'grafana.log'),
    port: 3000,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:3000/api/health'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  jaeger: {
    name: 'jaeger',
    displayName: 'Jaeger',
    description: 'Distributed tracing platform',
    packageDomain: 'jaegertracing.io',
    executable: 'jaeger-all-in-one',
    args: ['--memory.max-traces', '10000'],
    env: {},
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'jaeger.log'),
    port: 16686,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:14269/'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  sonarqube: {
    name: 'sonarqube',
    displayName: 'SonarQube',
    description: 'Continuous code quality and security analysis',
    packageDomain: 'sonarqube.org',
    executable: 'sonar.sh',
    args: ['start'],
    env: {
      SONAR_JAVA_PATH: 'java',
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'sonarqube', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'sonar.properties'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'sonarqube.log'),
    port: 9001,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:9000/api/system/status'],
      expectedExitCode: 0,
      timeout: 30,
      interval: 60,
      retries: 5,
    },
    supportsGracefulShutdown: true,
  },

  consul: {
    name: 'consul',
    displayName: 'HashiCorp Consul',
    description: 'Service networking platform for service discovery and configuration',
    packageDomain: 'consul.io',
    executable: 'consul',
    args: ['agent', '-dev', '-config-dir', '{configDir}', '-data-dir', '{dataDir}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'consul', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'consul.json'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'consul.log'),
    port: 8500,
    dependencies: [],
    healthCheck: {
      command: ['consul', 'members'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  etcd: {
    name: 'etcd',
    displayName: 'etcd',
    description: 'Distributed reliable key-value store',
    packageDomain: 'etcd.io',
    executable: 'etcd',
    args: ['--data-dir', '{dataDir}', '--listen-client-urls', 'http://localhost:2379', '--advertise-client-urls', 'http://localhost:2379'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'etcd', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'etcd.log'),
    port: 2379,
    dependencies: [],
    healthCheck: {
      command: ['etcdctl', 'endpoint', 'health'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  influxdb: {
    name: 'influxdb',
    displayName: 'InfluxDB',
    description: 'Time series database',
    packageDomain: 'influxdata.com',
    executable: 'influxd',
    args: ['--config', '{configFile}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'influxdb', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'influxdb.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'influxdb.log'),
    port: 8086,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8086/ping'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  temporal: {
    name: 'temporal',
    displayName: 'Temporal',
    description: 'Workflow orchestration platform',
    packageDomain: 'temporal.io',
    executable: 'temporal',
    args: ['server', 'start-dev', '--db-filename', '{dataDir}/temporal.db'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'temporal', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'temporal.log'),
    port: 7233,
    dependencies: [],
    healthCheck: {
      command: ['temporal', 'operator', 'cluster', 'health'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  cockroachdb: {
    name: 'cockroachdb',
    displayName: 'CockroachDB',
    description: 'Distributed SQL database',
    packageDomain: 'cockroachlabs.com',
    executable: 'cockroach',
    args: ['start-single-node', '--insecure', '--store={dataDir}', '--listen-addr=localhost:26257', '--http-addr=localhost:8080'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'cockroachdb', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'cockroachdb.log'),
    port: 26257,
    dependencies: [],
    healthCheck: {
      command: ['cockroach', 'sql', '--insecure', '--execute=SELECT 1;'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  neo4j: {
    name: 'neo4j',
    displayName: 'Neo4j',
    description: 'Graph database',
    packageDomain: 'neo4j.com',
    executable: 'neo4j',
    args: ['console'],
    env: {
      NEO4J_HOME: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'neo4j'),
      NEO4J_DATA: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'neo4j', 'data'),
      NEO4J_LOGS: path.join(homedir(), '.local', 'share', 'launchpad', 'logs'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'neo4j', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'neo4j.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'neo4j.log'),
    port: 7474,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:7474/db/data/'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  pulsar: {
    name: 'pulsar',
    displayName: 'Apache Pulsar',
    description: 'Cloud-native distributed messaging and streaming platform',
    packageDomain: 'pulsar.apache.org',
    executable: 'pulsar',
    args: ['standalone'],
    env: {
      PULSAR_MEM: '-Xms512m -Xmx512m -XX:MaxDirectMemorySize=256m',
      PULSAR_GC: '-XX:+UseG1GC',
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'pulsar', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'standalone.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'pulsar.log'),
    port: 6650,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8080/admin/v2/clusters'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  nats: {
    name: 'nats',
    displayName: 'NATS',
    description: 'High-performance messaging system',
    packageDomain: 'nats.io',
    executable: 'nats-server',
    args: ['--config', '{configFile}'],
    env: {},
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'nats.conf'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'nats.log'),
    port: 4222,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8222/varz'],
      expectedExitCode: 0,
      timeout: 5,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  jenkins: {
    name: 'jenkins',
    displayName: 'Jenkins',
    description: 'Automation server for CI/CD',
    packageDomain: 'jenkins.io',
    executable: 'jenkins',
    args: ['--httpPort=8090', '--webroot={dataDir}/war'],
    env: {
      JENKINS_HOME: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'jenkins'),
      JAVA_OPTS: '-Xmx512m',
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'jenkins'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'jenkins.log'),
    port: 8090,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8090/login'],
      expectedExitCode: 0,
      timeout: 30,
      interval: 60,
      retries: 5,
    },
    supportsGracefulShutdown: true,
  },

  localstack: {
    name: 'localstack',
    displayName: 'LocalStack',
    description: 'Local AWS cloud stack for development',
    packageDomain: 'localstack.cloud',
    executable: 'localstack',
    args: ['start'],
    env: {
      LOCALSTACK_HOST: 'localhost:4566',
      DATA_DIR: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'localstack', 'data'),
      TMPDIR: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'localstack', 'tmp'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'localstack', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'localstack.log'),
    port: 4566,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:4566/_localstack/health'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  hasura: {
    name: 'hasura',
    displayName: 'Hasura',
    description: 'GraphQL API with real-time subscriptions',
    packageDomain: 'hasura.io',
    executable: 'graphql-engine',
    args: ['serve'],
    env: {
      HASURA_GRAPHQL_DATABASE_URL: 'postgres://localhost:5432/postgres',
      HASURA_GRAPHQL_ENABLE_CONSOLE: 'true',
      HASURA_GRAPHQL_DEV_MODE: 'true',
      HASURA_GRAPHQL_ENABLED_LOG_TYPES: 'startup, http-log, webhook-log, websocket-log, query-log',
      HASURA_GRAPHQL_SERVER_PORT: '8085',
    },
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'hasura.log'),
    port: 8085,
    dependencies: ['postgres'],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8085/healthz'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  keycloak: {
    name: 'keycloak',
    displayName: 'Keycloak',
    description: 'Identity and access management',
    packageDomain: 'keycloak.org',
    executable: 'kc.sh',
    args: ['start-dev', '--http-port=8088'],
    env: {
      KEYCLOAK_ADMIN: 'admin',
      KEYCLOAK_ADMIN_PASSWORD: 'admin',
      KC_DB: 'dev-file',
      KC_DB_URL_DATABASE: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'keycloak', 'data', 'keycloak.db'),
    },
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'keycloak', 'data'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'keycloak.log'),
    port: 8088,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8088/health'],
      expectedExitCode: 0,
      timeout: 30,
      interval: 60,
      retries: 5,
    },
    supportsGracefulShutdown: true,
  },

  clickhouse: {
    name: 'clickhouse',
    displayName: 'ClickHouse',
    description: 'Columnar database for analytics',
    packageDomain: 'clickhouse.com',
    executable: 'clickhouse-server',
    args: ['--config-file={configFile}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'clickhouse', 'data'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'clickhouse-config.xml'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'clickhouse.log'),
    port: 8123,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:8123/ping'],
      expectedExitCode: 0,
      timeout: 10,
      interval: 30,
      retries: 3,
    },
    supportsGracefulShutdown: true,
  },

  verdaccio: {
    name: 'verdaccio',
    displayName: 'Verdaccio',
    description: 'Private npm registry',
    packageDomain: 'verdaccio.org',
    executable: 'verdaccio',
    args: ['--config', '{configFile}'],
    env: {},
    dataDirectory: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'verdaccio', 'storage'),
    configFile: path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'config', 'verdaccio.yaml'),
    logFile: path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'verdaccio.log'),
    port: 4873,
    dependencies: [],
    healthCheck: {
      command: ['curl', '-f', '-s', 'http://localhost:4873/-/ping'],
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

    case 'kafka':
      return `# Kafka Server Properties
broker.id=0
listeners=PLAINTEXT://localhost:9092
advertised.listeners=PLAINTEXT://localhost:9092
num.network.threads=3
num.io.threads=8
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600
log.dirs=${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'kafka', 'data')}
num.partitions=1
num.recovery.threads.per.data.dir=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
log.retention.hours=168
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000
zookeeper.connect=localhost:2181
zookeeper.connection.timeout.ms=18000
group.initial.rebalance.delay.ms=0
`

    case 'vault':
      return `# Vault Configuration
storage "file" {
  path = "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'vault', 'data')}"
}

listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = 1
}

api_addr = "http://127.0.0.1:8200"
cluster_addr = "https://127.0.0.1:8201"
ui = true
disable_mlock = true
`

    case 'prometheus':
      return `# Prometheus Configuration
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
`

    case 'grafana':
      return `# Grafana Configuration
[server]
http_addr = 127.0.0.1
http_port = 3000
domain = localhost

[database]
type = sqlite3
path = ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'grafana', 'data', 'grafana.db')}

[session]
provider = file
provider_config = ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'grafana', 'data', 'sessions')}

[analytics]
reporting_enabled = false
check_for_updates = false

[security]
admin_user = admin
admin_password = admin

[users]
allow_sign_up = false
allow_org_create = false
auto_assign_org = true
auto_assign_org_role = Viewer

[log]
mode = file
level = info
`

    case 'consul':
      return `{
  "datacenter": "dc1",
  "data_dir": "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'consul', 'data')}",
  "log_level": "INFO",
  "server": true,
  "bootstrap_expect": 1,
  "bind_addr": "127.0.0.1",
  "client_addr": "127.0.0.1",
  "retry_join": ["127.0.0.1"],
  "ui_config": {
    "enabled": true
  },
  "connect": {
    "enabled": true
  },
  "ports": {
    "grpc": 8502
  }
}
`

    case 'influxdb':
      return `# InfluxDB Configuration
[meta]
  dir = "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'influxdb', 'data', 'meta')}"

[data]
  dir = "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'influxdb', 'data', 'data')}"
  wal-dir = "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'influxdb', 'data', 'wal')}"

[coordinator]

[retention]

[shard-precreation]

[monitor]

[http]
  enabled = true
  bind-address = ":8086"
  auth-enabled = false
  log-enabled = true
  write-tracing = false
  pprof-enabled = true
  https-enabled = false

[logging]
  format = "auto"
  level = "info"
`

    case 'neo4j':
      return `# Neo4j Configuration
dbms.default_database=neo4j
dbms.directories.data=${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'neo4j', 'data')}
dbms.directories.logs=${path.join(homedir(), '.local', 'share', 'launchpad', 'logs')}

# Network settings
dbms.default_listen_address=0.0.0.0
dbms.connector.bolt.enabled=true
dbms.connector.bolt.listen_address=:7687
dbms.connector.http.enabled=true
dbms.connector.http.listen_address=:7474

# Security settings (development mode)
dbms.security.auth_enabled=false

# Memory settings
dbms.memory.heap.initial_size=512m
dbms.memory.heap.max_size=512m
`

    case 'nats':
      return `# NATS Server Configuration
port: 4222
monitor_port: 8222

# Logging
debug: false
trace: false
logtime: true

# Security
authorization {
  default_permissions: {
    publish: ">"
    subscribe: ">"
  }
}

# JetStream (optional)
jetstream: {
  store_dir: "${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'nats', 'data')}"
  max_memory_store: 256MB
  max_file_store: 2GB
}
`

    case 'clickhouse':
      return `<?xml version="1.0"?>
<clickhouse>
    <logger>
        <level>information</level>
        <log>${path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'clickhouse.log')}</log>
        <errorlog>${path.join(homedir(), '.local', 'share', 'launchpad', 'logs', 'clickhouse-error.log')}</errorlog>
        <size>1000M</size>
        <count>10</count>
    </logger>

    <http_port>8123</http_port>
    <tcp_port>9000</tcp_port>

    <path>${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'clickhouse', 'data')}/</path>
    <tmp_path>${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'clickhouse', 'tmp')}/</tmp_path>
    <user_files_path>${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'clickhouse', 'user_files')}/</user_files_path>

    <users_config>users.xml</users_config>

    <default_profile>default</default_profile>
    <default_database>default</default_database>

    <timezone>UTC</timezone>

    <listen_host>::</listen_host>
    <listen_host>0.0.0.0</listen_host>

    <profiles>
        <default>
            <max_memory_usage>10000000000</max_memory_usage>
            <use_uncompressed_cache>0</use_uncompressed_cache>
            <load_balancing>random</load_balancing>
        </default>
    </profiles>

    <users>
        <default>
            <password></password>
            <networks incl="networks" replace="replace">
                <ip>::/0</ip>
            </networks>
            <profile>default</profile>
            <quota>default</quota>
        </default>
    </users>

    <quotas>
        <default>
            <interval>
                <duration>3600</duration>
                <queries>0</queries>
                <errors>0</errors>
                <result_rows>0</result_rows>
                <read_rows>0</read_rows>
                <execution_time>0</execution_time>
            </interval>
        </default>
    </quotas>
</clickhouse>
`

    case 'verdaccio':
      return `# Verdaccio Configuration
storage: ${path.join(homedir(), '.local', 'share', 'launchpad', 'services', 'verdaccio', 'storage')}

auth:
  htpasswd:
    file: ./htpasswd
    max_users: 1000

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  '@*/*':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs

  '**':
    access: $all
    publish: $authenticated
    unpublish: $authenticated
    proxy: npmjs

server:
  keepAliveTimeout: 60

middlewares:
  audit:
    enabled: true

logs: { type: stdout, format: pretty, level: http }

listen: 0.0.0.0:4873
`

    default:
      return null
  }
}
