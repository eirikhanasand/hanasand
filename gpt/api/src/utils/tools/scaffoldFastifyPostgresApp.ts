import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import config from '#constants'
import runCommand from '#utils/tools/runCommand.ts'

type ScaffoldFastifyPostgresAppArgs = {
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

export default async function scaffoldFastifyPostgresApp(args: ScaffoldFastifyPostgresAppArgs) {
    const absolutePath = resolveTargetDir(args.targetDir.trim())
    const relativePath = path.relative(config.repo_root, absolutePath)
    const appName = args.appName || path.basename(relativePath)

    await mkdir(absolutePath, { recursive: true })

    await writeTemplateFile(absolutePath, 'package.json', JSON.stringify({
        name: appName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts: {
            dev: 'tsx watch src/index.ts',
            'db:migrate': 'tsx src/scripts/migrate.ts',
            build: 'tsc -p tsconfig.json',
            start: 'node dist/index.js',
        },
        dependencies: {
            fastify: '^5.6.1',
            pg: '^8.16.3',
        },
        devDependencies: {
            '@types/node': '^24.9.0',
            '@types/pg': '^8.15.6',
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
        'DATABASE_URL=postgres://postgres:postgres@db:5432/app',
        'API_HOST_PORT=3001',
        'POSTGRES_HOST_PORT=5432',
        '',
    ].join('\n'))
    await writeTemplateFile(absolutePath, 'Dockerfile', `FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
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
    ports:
      - "\${API_HOST_PORT:-3001}:3001"
    environment:
      PORT: 3001
      DATABASE_URL: postgres://postgres:postgres@db:5432/app
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3001/ready >/dev/null 2>&1 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 12
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "\${POSTGRES_HOST_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d app"]
      interval: 5s
      timeout: 5s
      retries: 20
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
`)
    await writeTemplateFile(absolutePath, 'src/lib/env.ts', `export const env = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/app',
}
`)
    await writeTemplateFile(absolutePath, 'src/lib/schema.ts', `export const bootstrapSql = \`
create table if not exists tasks (
  id serial primary key,
  title text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

insert into tasks (title, done)
select 'Ship the first endpoint', false
where not exists (select 1 from tasks);
\`
`)
    await writeTemplateFile(absolutePath, 'src/lib/db.ts', `import pg from 'pg'
import { env } from './env.js'
import { bootstrapSql } from './schema.js'

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
})

export async function ensureSchema() {
  await pool.query(bootstrapSql)
}

export async function getDatabaseTime() {
  const result = await pool.query('select now() as now')
  return result.rows[0]?.now || null
}
`)
    await writeTemplateFile(absolutePath, 'src/routes/health.ts', `import type { FastifyInstance } from 'fastify'
import { getDatabaseTime } from '../lib/db.js'

export default async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const databaseTime = await getDatabaseTime()
    return {
      ok: true,
      service: '${appName}',
      databaseTime,
    }
  })

  app.get('/ready', async () => {
    await getDatabaseTime()
    return {
      ok: true,
      ready: true,
    }
  })
}
`)
    await writeTemplateFile(absolutePath, 'src/routes/tasks.ts', `import type { FastifyInstance } from 'fastify'
import { pool } from '../lib/db.js'

type CreateTaskBody = {
  title?: string
}

export default async function registerTaskRoutes(app: FastifyInstance) {
  app.get('/api/tasks', async () => {
    const result = await pool.query(
      'select id, title, done, created_at from tasks order by created_at desc limit 25'
    )

    return {
      items: result.rows,
    }
  })

  app.post<{ Body: CreateTaskBody }>('/api/tasks', async (request, reply) => {
    const title = String(request.body?.title || '').trim()
    if (!title) {
      reply.code(400)
      return {
        ok: false,
        error: 'title is required',
      }
    }

    const result = await pool.query(
      'insert into tasks (title, done) values ($1, false) returning id, title, done, created_at',
      [title]
    )

    reply.code(201)
    return {
      ok: true,
      item: result.rows[0],
    }
  })
}
`)
    await writeTemplateFile(absolutePath, 'src/scripts/migrate.ts', `import { ensureSchema, pool } from '../lib/db.js'

const run = async () => {
  try {
    await ensureSchema()
    console.log('Database schema is ready.')
  } finally {
    await pool.end()
  }
}

void run()
`)
    await writeTemplateFile(absolutePath, 'src/index.ts', `import Fastify from 'fastify'
import { env } from './lib/env.js'
import { ensureSchema, pool } from './lib/db.js'
import registerHealthRoutes from './routes/health.js'
import registerTaskRoutes from './routes/tasks.js'

const app = Fastify({ logger: true })

app.get('/', async () => {
  return {
    app: '${appName}',
    status: 'ready',
    endpoints: ['/health', '/ready', '/api/tasks'],
  }
})

void app.register(registerHealthRoutes)
void app.register(registerTaskRoutes)

const start = async () => {
  try {
    await ensureSchema()
    await app.listen({ host: '0.0.0.0', port: env.port })
  } catch (error) {
    app.log.error(error)
    await pool.end().catch(() => null)
    process.exit(1)
  }
}

void start()
`)
    await writeTemplateFile(absolutePath, 'README.md', `# ${appName}

## What you get

- Fastify + Postgres starter with a real connection pool
- idempotent bootstrap migration via \`npm run db:migrate\`
- health endpoints at \`/health\` and \`/ready\`
- sample CRUD-ish endpoint at \`/api/tasks\`
- Docker Compose with database + API health checks

## Local development

\`\`\`bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
\`\`\`

## Docker Compose

\`\`\`bash
API_HOST_PORT=3201 POSTGRES_HOST_PORT=55432 docker compose up --build
\`\`\`

## Smoke checks

\`\`\`bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/api/tasks
curl -X POST http://127.0.0.1:3001/api/tasks \\
  -H 'content-type: application/json' \\
  -d '{"title":"Verify the starter"}'
\`\`\`

API default: http://127.0.0.1:3001
`)

    const installResult = await runCommand({
        command: 'npm install',
        cwd: relativePath,
        timeoutMs: 10 * 60 * 1000,
    })

    return {
        ...installResult,
        absolutePath,
        appName,
    }
}
