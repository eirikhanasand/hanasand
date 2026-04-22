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
    await writeTemplateFile(absolutePath, '.env.example', 'PORT=3001\nDATABASE_URL=postgres://postgres:postgres@db:5432/app\n')
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
    await writeTemplateFile(absolutePath, 'src/index.ts', `import Fastify from 'fastify'
import pg from 'pg'

const app = Fastify({ logger: true })
const port = Number(process.env.PORT || 3001)
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/app'

const pool = new pg.Pool({ connectionString })

app.get('/health', async () => {
  const result = await pool.query('select now() as now')
  return {
    ok: true,
    service: '${appName}',
    databaseTime: result.rows[0]?.now || null,
  }
})

app.get('/', async () => {
  return {
    app: '${appName}',
    status: 'ready',
    endpoints: ['/health'],
  }
})

const start = async () => {
  try {
    await app.listen({ host: '0.0.0.0', port })
  } catch (error) {
    app.log.error(error)
    process.exit(1)
  }
}

void start()
`)
    await writeTemplateFile(absolutePath, 'README.md', `# ${appName}

## Local

\`\`\`bash
npm install
npm run dev
\`\`\`

## Docker Compose

\`\`\`bash
API_HOST_PORT=3201 POSTGRES_HOST_PORT=55432 docker compose up --build
\`\`\`

API: http://127.0.0.1:3001
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
