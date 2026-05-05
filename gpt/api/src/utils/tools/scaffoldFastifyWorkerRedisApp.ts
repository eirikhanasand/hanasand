import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import config from '#constants'
import runCommand from '#utils/tools/runCommand.ts'

type ScaffoldFastifyWorkerRedisAppArgs = {
    targetDir: string
    appName?: string
}

function resolveTargetDir(targetDir: string) {
    const absolutePath = path.resolve(config.repo_root, targetDir)
    if (absolutePath !== config.repo_root && !absolutePath.startsWith(`${config.repo_root}${path.sep}`)) {
        throw new Error('targetDir must stay inside the repository root.')
    }
    return absolutePath
}

async function writeTemplateFile(targetDir: string, relativePath: string, content: string) {
    const filePath = path.join(targetDir, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content, 'utf8')
}

function toPackageName(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'fastify-worker-app'
}

export default async function scaffoldFastifyWorkerRedisApp(args: ScaffoldFastifyWorkerRedisAppArgs) {
    const absolutePath = resolveTargetDir(args.targetDir.trim())
    const relativePath = path.relative(config.repo_root, absolutePath)
    const appName = args.appName || path.basename(relativePath)
    const packageName = toPackageName(appName)

    await mkdir(absolutePath, { recursive: true })

    await writeTemplateFile(absolutePath, 'package.json', JSON.stringify({
        name: packageName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            dev: 'tsx watch src/index.ts',
            'dev:worker': 'tsx watch src/worker.ts',
            build: 'tsc -p tsconfig.json',
            start: 'node dist/index.js',
            'start:worker': 'node dist/worker.js',
        },
        dependencies: {
            fastify: '^5.6.1',
            redis: '^5.9.0',
        },
        devDependencies: {
            '@types/node': '^24.9.0',
            tsx: '^4.20.6',
            typescript: '^5.9.3',
        },
    }, null, 2) + '\n')

    await writeTemplateFile(absolutePath, 'tsconfig.json', JSON.stringify({
        compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            outDir: 'dist',
            rootDir: 'src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
        },
        include: ['src/**/*.ts'],
    }, null, 2) + '\n')

    await writeTemplateFile(absolutePath, '.gitignore', 'node_modules\ndist\n.env\n')
    await writeTemplateFile(absolutePath, '.dockerignore', 'node_modules\ndist\n.env\nnpm-debug.log\n.git\n')
    await writeTemplateFile(absolutePath, '.env.example', [
        'PORT=3001',
        'REDIS_URL=redis://redis:6379',
        'QUEUE_NAME=jobs',
        'WORKER_NAME=worker-1',
        'API_HOST_PORT=3001',
        'REDIS_HOST_PORT=6379',
        '',
    ].join('\n'))
    await writeTemplateFile(absolutePath, 'Dockerfile', `FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
`)
    await writeTemplateFile(absolutePath, 'docker-compose.yml', `services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["node", "dist/index.js"]
    ports:
      - "\${API_HOST_PORT:-3001}:3001"
    environment:
      PORT: 3001
      REDIS_URL: redis://redis:6379
      QUEUE_NAME: jobs
      WORKER_NAME: api-observer
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/ready >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["node", "dist/worker.js"]
    environment:
      REDIS_URL: redis://redis:6379
      QUEUE_NAME: jobs
      WORKER_NAME: worker-1
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "\${REDIS_HOST_PORT:-6379}:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 20
    volumes:
      - redisdata:/data

volumes:
  redisdata:
`)
    await writeTemplateFile(absolutePath, 'src/lib/env.ts', `export const env = {
  port: Number(process.env.PORT || 3001),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  queueName: process.env.QUEUE_NAME || 'jobs',
  workerName: process.env.WORKER_NAME || 'worker-1',
}
`)
    await writeTemplateFile(absolutePath, 'src/lib/redis.ts', `import { createClient } from 'redis'
import { env } from './env.js'

export function createRedisClient(name: string) {
  const client = createClient({
    url: env.redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 200, 2000),
    },
  })

  client.on('error', (error) => {
    console.error(\`[\${name}] redis error\`, error)
  })

  return client
}
`)
    await writeTemplateFile(absolutePath, 'src/lib/jobs.ts', `import { env } from './env.js'
import { createRedisClient } from './redis.js'

export type JobRecord = {
  id: string
  type: string
  payload: Record<string, unknown>
  status: 'queued' | 'processing' | 'completed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  workerName?: string
}

const workerStatusKey = 'worker:status'

export async function withRedis<T>(name: string, fn: (client: ReturnType<typeof createRedisClient>) => Promise<T>) {
  const client = createRedisClient(name)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.quit().catch(() => null)
  }
}

export async function enqueueJob(input: { type: string, payload: Record<string, unknown> }) {
  return await withRedis('api', async (client) => {
    const id = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    const job: JobRecord = {
      id,
      type: input.type,
      payload: input.payload,
      status: 'queued',
      createdAt,
    }

    await client.multi()
      .set(\`job:\${id}\`, JSON.stringify(job))
      .rPush(env.queueName, id)
      .exec()

    return job
  })
}

export async function listJobs(limit = 25) {
  return await withRedis('api', async (client) => {
    const ids = await client.lRange(env.queueName, Math.max(0, -limit), -1)
    const reversedIds = [...ids].reverse()
    if (!reversedIds.length) {
      return [] as JobRecord[]
    }

    const jobs = await Promise.all(reversedIds.map(async (id) => {
      const raw = await client.get(\`job:\${id}\`)
      if (!raw) {
        return null
      }
      return JSON.parse(raw) as JobRecord
    }))

    return jobs.filter((job): job is JobRecord => Boolean(job))
  })
}

export async function getWorkerStatus() {
  return await withRedis('api', async (client) => {
    const raw = await client.get(workerStatusKey)
    if (!raw) {
      return {
        ok: true,
        connected: true,
        worker: null,
      }
    }

    return {
      ok: true,
      connected: true,
      worker: JSON.parse(raw) as Record<string, unknown>,
    }
  })
}

export async function pingRedis() {
  return await withRedis('healthcheck', async (client) => {
    return await client.ping()
  })
}

export async function reserveNextJob() {
  return await withRedis('worker-blocking', async (client) => {
    const result = await client.blPop(env.queueName, 0)
    return result?.element || null
  })
}

export async function loadJob(id: string) {
  return await withRedis('worker-load', async (client) => {
    const raw = await client.get(\`job:\${id}\`)
    return raw ? JSON.parse(raw) as JobRecord : null
  })
}

export async function saveJob(job: JobRecord) {
  await withRedis('worker-save', async (client) => {
    await client.set(\`job:\${job.id}\`, JSON.stringify(job))
  })
}

export async function updateWorkerStatus(status: Record<string, unknown>) {
  await withRedis('worker-status', async (client) => {
    await client.set(workerStatusKey, JSON.stringify(status))
  })
}
`)
    await writeTemplateFile(absolutePath, 'src/routes/health.ts', `import type { FastifyInstance } from 'fastify'
import { env } from '../lib/env.js'
import { getWorkerStatus, pingRedis } from '../lib/jobs.js'

export default async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const redisPing = await pingRedis()
    const workerStatus = await getWorkerStatus()
    return {
      ok: true,
      service: '${appName}',
      queueName: env.queueName,
      redisPing,
      worker: workerStatus.worker,
    }
  })

  app.get('/ready', async () => {
    await pingRedis()
    return {
      ok: true,
      ready: true,
    }
  })
}
`)
    await writeTemplateFile(absolutePath, 'src/routes/jobs.ts', `import type { FastifyInstance } from 'fastify'
import { enqueueJob, getWorkerStatus, listJobs } from '../lib/jobs.js'

type CreateJobBody = {
  type?: string
  payload?: Record<string, unknown>
}

export default async function registerJobRoutes(app: FastifyInstance) {
  app.get('/api/jobs', async () => {
    const items = await listJobs()
    return {
      ok: true,
      items,
    }
  })

  app.post<{ Body: CreateJobBody }>('/api/jobs', async (request, reply) => {
    const type = String(request.body?.type || '').trim()
    const payload = request.body?.payload && typeof request.body.payload === 'object'
      ? request.body.payload
      : {}

    if (!type) {
      reply.code(400)
      return {
        ok: false,
        error: 'type is required',
      }
    }

    const job = await enqueueJob({ type, payload })
    reply.code(201)
    return {
      ok: true,
      item: job,
    }
  })

  app.get('/api/worker-status', async () => {
    return await getWorkerStatus()
  })
}
`)
    await writeTemplateFile(absolutePath, 'src/index.ts', `import Fastify from 'fastify'
import { env } from './lib/env.js'
import registerHealthRoutes from './routes/health.js'
import registerJobRoutes from './routes/jobs.js'

const app = Fastify({ logger: true })

app.get('/', async () => {
  return {
    app: '${appName}',
    status: 'ready',
    services: ['api', 'worker', 'redis'],
    endpoints: ['/health', '/ready', '/api/jobs', '/api/worker-status'],
    queueName: env.queueName,
  }
})

void app.register(registerHealthRoutes)
void app.register(registerJobRoutes)

const start = async () => {
  try {
    await app.listen({ host: '0.0.0.0', port: env.port })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
`)
    await writeTemplateFile(absolutePath, 'src/worker.ts', `import { env } from './lib/env.js'
import { loadJob, reserveNextJob, saveJob, updateWorkerStatus } from './lib/jobs.js'

const heartbeat = async (state: Record<string, unknown>) => {
  await updateWorkerStatus({
    ...state,
    workerName: env.workerName,
    heartbeatAt: new Date().toISOString(),
  })
}

async function processJob(jobId: string) {
  const job = await loadJob(jobId)
  if (!job) {
    await heartbeat({
      status: 'idle',
      lastMissingJobId: jobId,
    })
    return
  }

  job.status = 'processing'
  job.startedAt = new Date().toISOString()
  job.workerName = env.workerName
  await saveJob(job)
  await heartbeat({
    status: 'processing',
    currentJobId: job.id,
    currentJobType: job.type,
  })

  await new Promise((resolve) => setTimeout(resolve, 750))

  job.status = 'completed'
  job.completedAt = new Date().toISOString()
  await saveJob(job)
  await heartbeat({
    status: 'idle',
    lastCompletedJobId: job.id,
    lastCompletedJobType: job.type,
  })
}

const start = async () => {
  await heartbeat({
    status: 'booting',
  })

  while (true) {
    await heartbeat({
      status: 'idle',
    })
    const nextJobId = await reserveNextJob()
    if (!nextJobId) {
      continue
    }
    await processJob(nextJobId)
  }
}

void start().catch(async (error) => {
  console.error('[worker] fatal error', error)
  await heartbeat({
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
  }).catch(() => null)
  process.exit(1)
})
`)
    await writeTemplateFile(absolutePath, 'README.md', `# ${appName}

## What you get

- Fastify API plus a separate worker process
- Redis-backed queue with Docker Compose wiring
- Health endpoints at \`/health\` and \`/ready\`
- Job endpoints at \`/api/jobs\` and \`/api/worker-status\`
- One shared Dockerfile that runs both the API and worker containers

## Local development

\`\`\`bash
cp .env.example .env
npm install
docker compose up redis -d
npm run dev
npm run dev:worker
\`\`\`

## Docker Compose

\`\`\`bash
API_HOST_PORT=3201 REDIS_HOST_PORT=56379 docker compose up --build
\`\`\`

## Smoke checks

\`\`\`bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/api/worker-status
curl -X POST http://127.0.0.1:3001/api/jobs \\
  -H 'content-type: application/json' \\
  -d '{"type":"send-email","payload":{"to":"ops@login.no"}}'
curl http://127.0.0.1:3001/api/jobs
\`\`\`

## Stack notes

- The API only enqueues and inspects jobs.
- The worker consumes the queue and updates a shared heartbeat key.
- Redis is the only shared dependency in this starter, which keeps the stack easy to run locally.
`)

    const installResult = await runCommand({
        command: 'npm install && npm run build',
        cwd: relativePath,
        timeoutMs: 10 * 60 * 1000,
    })
    const composeResult = await runCommand({
        command: 'docker compose config',
        cwd: relativePath,
        timeoutMs: 120000,
    })

    return {
        ...installResult,
        absolutePath,
        appName,
        build: installResult,
        compose: composeResult,
    }
}
