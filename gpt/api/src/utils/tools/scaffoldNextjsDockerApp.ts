import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import config from '#constants'
import runCommand from '#utils/tools/runCommand.ts'

type ScaffoldNextjsDockerAppArgs = {
    targetDir: string
    appName?: string
    productBrief?: string
    productType?: string
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
    return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'hanasand-app'
}

function toTitle(value: string) {
    return value
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

function inferAppName(args: ScaffoldNextjsDockerAppArgs, relativePath: string) {
    if (args.appName?.trim()) {
        return args.appName.trim()
    }

    const brief = args.productBrief || ''
    const quoted = brief.match(/["“]([^"”]{3,48})["”]/)?.[1]
    if (quoted) {
        return quoted.trim()
    }

    return toTitle(path.basename(relativePath))
}

export default async function scaffoldNextjsDockerApp(args: ScaffoldNextjsDockerAppArgs) {
    const absolutePath = resolveTargetDir(args.targetDir.trim())
    const relativePath = path.relative(config.repo_root, absolutePath)
    const appName = inferAppName(args, relativePath)
    const packageName = toPackageName(appName)
    const productType = args.productType || 'project planning dashboard'
    const productBrief = args.productBrief || `${appName} is a polished ${productType} for small teams that need planning, analytics, pricing, and customer proof in one responsive interface.`

    await mkdir(absolutePath, { recursive: true })

    await writeTemplateFile(absolutePath, 'package.json', JSON.stringify({
        name: packageName,
        version: '0.1.0',
        private: true,
        scripts: {
            dev: 'next dev --hostname 0.0.0.0 --port 3000',
            build: 'next build',
            start: 'next start --hostname 0.0.0.0 --port 3000',
            lint: 'eslint .',
            verify: 'npm run build && docker compose config',
        },
        dependencies: {
            next: '15.5.6',
            react: '19.1.0',
            'react-dom': '19.1.0',
        },
        devDependencies: {
            '@eslint/eslintrc': '^3.3.1',
            '@types/node': '^24.9.0',
            '@types/react': '^19.1.0',
            '@types/react-dom': '^19.1.0',
            eslint: '^9.38.0',
            'eslint-config-next': '^15.5.6',
            typescript: '^5.9.3',
        },
    }, null, 2) + '\n')

    await writeTemplateFile(absolutePath, 'tsconfig.json', JSON.stringify({
        compilerOptions: {
            target: 'ES2017',
            lib: ['dom', 'dom.iterable', 'esnext'],
            allowJs: false,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: 'esnext',
            moduleResolution: 'bundler',
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: 'preserve',
            incremental: true,
            plugins: [{ name: 'next' }],
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
    }, null, 2) + '\n')

    await writeTemplateFile(absolutePath, 'next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// This file is managed by Next.js.\n')
    await writeTemplateFile(absolutePath, 'next.config.ts', 'import type { NextConfig } from "next"\n\nconst nextConfig: NextConfig = {\n  output: "standalone",\n}\n\nexport default nextConfig\n')
    await writeTemplateFile(absolutePath, 'postcss.config.mjs', 'export default {\n  plugins: {},\n}\n')
    await writeTemplateFile(absolutePath, 'eslint.config.mjs', 'import { FlatCompat } from "@eslint/eslintrc"\n\nconst compat = new FlatCompat({ baseDirectory: import.meta.dirname })\n\nexport default [\n  ...compat.extends("next/core-web-vitals", "next/typescript"),\n]\n')
    await writeTemplateFile(absolutePath, '.gitignore', 'node_modules\n.next\n.env\n')
    await writeTemplateFile(absolutePath, '.dockerignore', 'node_modules\n.next\nnpm-debug.log\n.git\n.gitignore\nREADME.md\n')
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
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
`)
    await writeTemplateFile(absolutePath, 'docker-compose.yml', `services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "\${HOST_PORT:-3000}:3000"
    environment:
      NODE_ENV: production
    restart: unless-stopped
`)
    await writeTemplateFile(absolutePath, 'src/app/layout.tsx', `import "./globals.css"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "${appName}",
  description: "${productBrief.replace(/"/g, '\\"')}",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`)
    await writeTemplateFile(absolutePath, 'src/app/page.tsx', `const metrics = [
  { label: "Active projects", value: "24", change: "+18%" },
  { label: "Sprint velocity", value: "91%", change: "+7%" },
  { label: "Client approvals", value: "14", change: "this week" },
  { label: "Launch risk", value: "Low", change: "stable" },
]

const columns = [
  {
    title: "Discover",
    tasks: ["Client brief", "Reference moodboard", "Scope estimate"],
  },
  {
    title: "Build",
    tasks: ["Landing page", "Auth flow", "CMS integration"],
  },
  {
    title: "Launch",
    tasks: ["Performance pass", "QA checklist", "Production deploy"],
  },
]

const pricing = [
  { name: "Starter", price: "$49", detail: "For solo builders validating one client project." },
  { name: "Studio", price: "$149", detail: "For teams shipping multiple websites every month." },
  { name: "Scale", price: "$399", detail: "For agencies that need priority planning and reporting." },
]

const testimonials = [
  "We went from scattered requests to a launch-ready plan in one afternoon.",
  "The dashboard makes client work feel calm, visible, and profitable.",
]

export default function Home() {
  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Autonomous project workspace</p>
          <h1>${appName}</h1>
          <p className="hero-copy">{${JSON.stringify(productBrief)}}</p>
          <div className="hero-actions">
            <a href="#pricing" className="button primary">Start a sprint</a>
            <a href="#board" className="button secondary">View workflow</a>
          </div>
        </div>
        <aside className="status-panel">
          <span className="status-dot" />
          <p>Ready for today</p>
          <strong>3 launches scheduled</strong>
        </aside>
      </section>

      <section className="metrics-grid" aria-label="Analytics overview">
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.change}</small>
          </article>
        ))}
      </section>

      <section className="workspace" id="board">
        <div className="section-heading">
          <p className="eyebrow">Delivery board</p>
          <h2>Plan, build, and launch from one focused screen.</h2>
        </div>
        <div className="kanban">
          {columns.map((column) => (
            <article key={column.title} className="kanban-column">
              <h3>{column.title}</h3>
              {column.tasks.map((task) => (
                <div key={task} className="task-card">
                  <span>{task}</span>
                  <small>Owner assigned</small>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="section-heading">
          <p className="eyebrow">Pricing</p>
          <h2>Simple plans for profitable project delivery.</h2>
        </div>
        <div className="pricing-grid">
          {pricing.map((plan) => (
            <article key={plan.name} className="price-card">
              <span>{plan.name}</span>
              <strong>{plan.price}</strong>
              <p>{plan.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="testimonials">
        {testimonials.map((quote) => (
          <blockquote key={quote}>“{quote}”</blockquote>
        ))}
      </section>

      <section className="empty-state">
        <p className="eyebrow">Empty state</p>
        <h2>No project selected</h2>
        <p>Choose a sprint from the board or create a new client workspace to start planning.</p>
      </section>
    </main>
  )
}
`)
    await writeTemplateFile(absolutePath, 'src/app/globals.css', `:root {
  color-scheme: dark;
  --bg: #0b0f14;
  --panel: #121923;
  --panel-soft: #172232;
  --line: rgba(222, 231, 242, 0.14);
  --text: #f7fafc;
  --muted: #9aa8b8;
  --accent: #2dd4bf;
  --accent-strong: #f59e0b;
}

* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
a { color: inherit; text-decoration: none; }
.app-shell { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0; }
.hero { display: grid; gap: 24px; align-items: stretch; min-height: 58vh; padding: 32px 0; }
.eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
h1, h2, h3, p { margin-top: 0; }
h1 { max-width: 11ch; margin-bottom: 18px; font-size: clamp(48px, 10vw, 112px); line-height: 0.9; }
h2 { max-width: 760px; font-size: clamp(30px, 5vw, 58px); line-height: 1; }
.hero-copy { max-width: 660px; color: var(--muted); font-size: 18px; line-height: 1.7; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.button { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; border-radius: 8px; padding: 0 18px; font-weight: 700; }
.primary { background: var(--accent); color: #04110f; }
.secondary { border: 1px solid var(--line); background: rgba(255,255,255,0.04); }
.status-panel, .metric-card, .workspace, .price-card, .empty-state, .testimonials blockquote { border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.status-panel { align-self: end; padding: 24px; }
.status-panel p { color: var(--muted); }
.status-panel strong { display: block; font-size: 28px; }
.status-dot { display: inline-block; width: 12px; height: 12px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 28px var(--accent); }
.metrics-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 18px 0; }
.metric-card { padding: 18px; }
.metric-card span, .metric-card small, .price-card span { color: var(--muted); }
.metric-card strong { display: block; margin: 12px 0 4px; font-size: 32px; }
.workspace, .pricing, .testimonials, .empty-state { margin-top: 18px; }
.workspace { padding: 24px; }
.section-heading { margin-bottom: 20px; }
.kanban, .pricing-grid { display: grid; gap: 14px; }
.kanban-column { min-width: 0; border-radius: 8px; background: var(--panel-soft); padding: 14px; }
.kanban-column h3 { font-size: 16px; }
.task-card { display: grid; gap: 6px; margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,0.04); padding: 12px; }
.task-card small { color: var(--muted); }
.pricing { padding: 24px 0; }
.price-card { padding: 20px; }
.price-card strong { display: block; margin: 12px 0; font-size: 42px; }
.price-card p { color: var(--muted); line-height: 1.6; }
.testimonials { display: grid; gap: 14px; }
.testimonials blockquote { margin: 0; padding: 22px; color: #dce6f2; font-size: 20px; line-height: 1.5; }
.empty-state { padding: 26px; text-align: center; }
.empty-state p:last-child { color: var(--muted); }
@media (min-width: 760px) {
  .hero { grid-template-columns: minmax(0, 1fr) 320px; }
  .metrics-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .kanban, .pricing-grid, .testimonials { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .testimonials { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`)
    await writeTemplateFile(absolutePath, 'public/.gitkeep', '')
    await writeTemplateFile(absolutePath, 'README.md', `# ${appName}

${productBrief}

## Local

\`\`\`bash
npm install
npm run dev
\`\`\`

## Verify

\`\`\`bash
npm run verify
\`\`\`

## Docker

\`\`\`bash
HOST_PORT=3200 docker compose up --build
\`\`\`
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
        productBrief,
        build: installResult,
        compose: composeResult,
    }
}
