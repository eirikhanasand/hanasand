'use client'

import randomId from '@/utils/random/randomId'
import { getTree } from '@/utils/share/getTree'
import postShare from '@/utils/share/post'
import { updateShare } from '@/utils/share/put'
import { findTreeFileId } from '@/components/ai/shareTree'

type ScaffoldNextjsDockerWorkspaceProps = {
    projectName?: string | null
    shareId?: string | null
    token: string
    userId: string
}

type ScaffoldedWorkspace = {
    rootId: string
    rootName: string
    rootPath: string
    selectedFilePath: string
    fileCount: number
}

type WorkspaceTemplateFile = {
    path: string
    content: string
}

export async function scaffoldNextjsDockerWorkspace({
    projectName,
    shareId,
    token,
    userId,
}: ScaffoldNextjsDockerWorkspaceProps): Promise<ScaffoldedWorkspace> {
    const template = buildNextjsDockerTemplate(projectName)
    const rootId = shareId || randomId(12)
    const root = shareId
        ? await ensureExistingRoot({ rootId, template, token, userId })
        : await postShare({
            id: rootId,
            includeTree: true,
            content: '',
            name: template.rootName,
            path: template.rootPath,
            type: 'folder',
            token,
            userId,
        })

    if (!root) {
        throw new Error('Failed to create the Next.js workspace root.')
    }

    if (shareId) {
        await updateShare(rootId, { path: template.rootPath })
    }

    await syncTemplateFiles({
        rootId,
        files: template.files,
        token,
        userId,
    })

    return {
        rootId,
        rootName: template.rootName,
        rootPath: template.rootPath,
        selectedFilePath: 'README.md',
        fileCount: template.files.length,
    }
}

async function ensureExistingRoot({
    rootId,
    template,
    token,
    userId,
}: {
    rootId: string
    template: ReturnType<typeof buildNextjsDockerTemplate>
    token: string
    userId: string
}) {
    const tree = await getTree({ id: rootId, token, userId })
    if (tree) {
        return { id: rootId }
    }

    return postShare({
        id: rootId,
        includeTree: true,
        content: '',
        name: template.rootName,
        path: template.rootPath,
        type: 'folder',
        token,
        userId,
    })
}

async function syncTemplateFiles({
    rootId,
    files,
    token,
    userId,
}: {
    rootId: string
    files: WorkspaceTemplateFile[]
    token: string
    userId: string
}) {
    const initialTree = await getTree({ id: rootId, token, userId })
    const folderIds = new Map<string, string>([['', rootId]])
    if (initialTree) {
        registerFolders(initialTree, '', folderIds)
    }

    for (const file of files) {
        const latestTree = await getTree({ id: rootId, token, userId })
        const parentId = await ensureParentFolder({
            folderIds,
            filePath: file.path,
            rootId,
            token,
            userId,
        })
        const fileId = latestTree ? findTreeFileId(latestTree, file.path) : null
        if (fileId) {
            const updated = await updateShare(fileId, { content: file.content })
            if (!updated) {
                throw new Error(`Failed to update ${file.path}.`)
            }
            continue
        }

        const name = file.path.split('/').pop()
        if (!name) {
            continue
        }

        const created = await postShare({
            id: randomId(12),
            includeTree: false,
            content: file.content,
            name,
            parent: parentId,
            type: 'file',
            token,
            userId,
        })
        if (!created) {
            throw new Error(`Failed to create ${file.path}.`)
        }
    }
}

async function ensureParentFolder({
    folderIds,
    filePath,
    rootId,
    token,
    userId,
}: {
    folderIds: Map<string, string>
    filePath: string
    rootId: string
    token: string
    userId: string
}) {
    const directories = filePath.split('/').filter(Boolean).slice(0, -1)
    let parentId = rootId
    let currentPath = ''

    for (const directory of directories) {
        currentPath = currentPath ? `${currentPath}/${directory}` : directory
        const existingFolderId = folderIds.get(currentPath)
        if (existingFolderId) {
            parentId = existingFolderId
            continue
        }

        const folderId = randomId(12)
        const response = await postShare({
            id: folderId,
            includeTree: false,
            content: '',
            name: directory,
            parent: parentId,
            type: 'folder',
            token,
            userId,
        })
        if (!response) {
            throw new Error(`Failed to create folder ${currentPath}.`)
        }

        folderIds.set(currentPath, folderId)
        parentId = folderId
    }

    return parentId
}

function registerFolders(tree: Tree, prefix: string, folderIds: Map<string, string>) {
    for (const item of tree) {
        const path = prefix ? `${prefix}/${item.name}` : item.name
        if (item.type === 'folder') {
            folderIds.set(path, item.id)
            registerFolders(item.children, path, folderIds)
        }
    }
}

function buildNextjsDockerTemplate(projectName?: string | null) {
    const rootName = slugify(projectName || 'hanasand-next-docker')
    const packageName = rootName

    return {
        rootName,
        rootPath: rootName,
        files: [
            {
                path: 'package.json',
                content: JSON.stringify({
                    name: packageName,
                    version: '0.1.0',
                    private: true,
                    scripts: {
                        dev: 'next dev --hostname 0.0.0.0 --port 3000',
                        build: 'next build',
                        start: 'next start --hostname 0.0.0.0 --port 3000',
                        lint: 'next lint',
                    },
                    dependencies: {
                        next: '16.2.3',
                        react: '19.2.5',
                        'react-dom': '19.2.5',
                    },
                    devDependencies: {
                        '@types/node': '^24.0.0',
                        '@types/react': '^19.0.0',
                        '@types/react-dom': '^19.0.0',
                        eslint: '^9.0.0',
                        'eslint-config-next': '16.2.3',
                        typescript: '^5.0.0',
                    },
                }, null, 2) + '\n',
            },
            {
                path: 'tsconfig.json',
                content: JSON.stringify({
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
                        paths: {
                            '@/*': ['./*'],
                        },
                    },
                    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
                    exclude: ['node_modules'],
                }, null, 2) + '\n',
            },
            {
                path: 'next-env.d.ts',
                content: '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// This file is auto-generated by Next.js.\n',
            },
            {
                path: 'next.config.ts',
                content: "import type { NextConfig } from 'next'\n\nconst nextConfig: NextConfig = {\n  output: 'standalone',\n}\n\nexport default nextConfig\n",
            },
            {
                path: '.gitignore',
                content: "node_modules\n.next\nout\ncoverage\n.env*\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\npnpm-debug.log*\n.DS_Store\n",
            },
            {
                path: '.dockerignore',
                content: "node_modules\n.next\n.git\nnpm-debug.log\nDockerfile*\ndocker-compose*.yml\nREADME.md\n",
            },
            {
                path: 'Dockerfile',
                content: "FROM node:20-alpine AS deps\nWORKDIR /app\nCOPY package.json package-lock.json* ./\nRUN npm install\n\nFROM node:20-alpine AS builder\nWORKDIR /app\nCOPY --from=deps /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine AS runner\nWORKDIR /app\nENV NODE_ENV=production\nCOPY --from=builder /app/.next/standalone ./\nCOPY --from=builder /app/.next/static ./.next/static\nCOPY --from=builder /app/public ./public\nEXPOSE 3000\nCMD [\"node\", \"server.js\"]\n",
            },
            {
                path: 'docker-compose.yml',
                content: `services:\n  web:\n    build:\n      context: .\n      dockerfile: Dockerfile\n    ports:\n      - "\${HOST_PORT:-3000}:3000"\n    environment:\n      NODE_ENV: production\n    restart: unless-stopped\n`,
            },
            {
                path: 'app/layout.tsx',
                content: `import './globals.css'\nimport type { Metadata } from 'next'\nimport type { ReactNode } from 'react'\n\nexport const metadata: Metadata = {\n  title: '${titleCase(rootName)}',\n  description: 'A Next.js workspace scaffolded by Hanasand AI.',\n}\n\nexport default function RootLayout({ children }: { children: ReactNode }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
            },
            {
                path: 'app/page.tsx',
                content: `const features = [\n  'Next.js App Router with TypeScript',\n  'Standalone Docker image build',\n  'docker-compose ready for local orchestration',\n]\n\nexport default function HomePage() {\n  return (\n    <main className="page-shell">\n      <section className="hero-card">\n        <span className="eyebrow">Hanasand AI Workspace</span>\n        <h1>${titleCase(rootName)}</h1>\n        <p>\n          This starter is ready for npm install, local development, and Docker-based deployment.\n          Use it as a base for a richer product app, admin dashboard, or full-stack workflow.\n        </p>\n        <div className="actions">\n          <a className="primary" href="https://nextjs.org/docs">Read the docs</a>\n          <a className="secondary" href="#stack">Inspect the stack</a>\n        </div>\n      </section>\n\n      <section id="stack" className="stack-grid">\n        {features.map((feature) => (\n          <article key={feature} className="stack-card">\n            <h2>{feature}</h2>\n            <p>Extend this workspace from the browser, then deploy it through the same share-backed flow.</p>\n          </article>\n        ))}\n      </section>\n    </main>\n  )\n}\n`,
            },
            {
                path: 'app/globals.css',
                content: `:root {\n  color-scheme: dark;\n  --bg: #07111f;\n  --panel: rgba(10, 23, 39, 0.78);\n  --panel-border: rgba(148, 163, 184, 0.2);\n  --text: #f8fafc;\n  --muted: rgba(226, 232, 240, 0.72);\n  --accent: #f97316;\n  --accent-soft: rgba(249, 115, 22, 0.2);\n}\n\n* {\n  box-sizing: border-box;\n}\n\nhtml,\nbody {\n  margin: 0;\n  min-height: 100%;\n  background:\n    radial-gradient(circle at top, rgba(249, 115, 22, 0.24), transparent 32%),\n    linear-gradient(180deg, #08101c 0%, #07111f 48%, #030712 100%);\n  color: var(--text);\n  font-family: Georgia, 'Times New Roman', serif;\n}\n\nbody {\n  min-height: 100vh;\n}\n\n a {\n  color: inherit;\n  text-decoration: none;\n}\n\n.page-shell {\n  min-height: 100vh;\n  padding: 48px 20px;\n}\n\n.hero-card,\n.stack-card {\n  backdrop-filter: blur(18px);\n  background: var(--panel);\n  border: 1px solid var(--panel-border);\n  border-radius: 28px;\n  box-shadow: 0 30px 90px rgba(2, 8, 23, 0.38);\n}\n\n.hero-card {\n  max-width: 960px;\n  margin: 0 auto;\n  padding: 32px;\n}\n\n.eyebrow {\n  display: inline-flex;\n  margin-bottom: 16px;\n  padding: 8px 12px;\n  border-radius: 999px;\n  background: var(--accent-soft);\n  color: #fed7aa;\n  font-size: 12px;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n}\n\n.hero-card h1 {\n  margin: 0;\n  font-size: clamp(2.5rem, 8vw, 5rem);\n  line-height: 0.96;\n}\n\n.hero-card p {\n  max-width: 42rem;\n  color: var(--muted);\n  font-size: 1.05rem;\n  line-height: 1.8;\n}\n\n.actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 14px;\n  margin-top: 28px;\n}\n\n.primary,\n.secondary {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 46px;\n  padding: 0 18px;\n  border-radius: 999px;\n  font-weight: 600;\n}\n\n.primary {\n  background: var(--accent);\n  color: #111827;\n}\n\n.secondary {\n  border: 1px solid rgba(248, 250, 252, 0.14);\n  color: var(--text);\n}\n\n.stack-grid {\n  display: grid;\n  gap: 18px;\n  max-width: 960px;\n  margin: 24px auto 0;\n}\n\n.stack-card {\n  padding: 22px;\n}\n\n.stack-card h2 {\n  margin: 0 0 10px;\n  font-size: 1.1rem;\n}\n\n.stack-card p {\n  margin: 0;\n  color: var(--muted);\n  line-height: 1.7;\n}\n\n@media (min-width: 820px) {\n  .stack-grid {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .hero-card {\n    padding: 44px;\n  }\n}\n`,
            },
            {
                path: 'public/.gitkeep',
                content: '',
            },
            {
                path: 'README.md',
                content: `# ${titleCase(rootName)}\n\nScaffolded by Hanasand AI as a browser-native coding workspace.\n\n## Quick start\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000).\n\n## Docker\n\n\`\`\`bash\nHOST_PORT=3200 docker compose up --build\n\`\`\`\n\n## What is included\n\n- Next.js App Router with TypeScript\n- Production-ready standalone Dockerfile\n- \`docker-compose.yml\` for local orchestration\n- A polished landing page starter for further iteration\n`,
            },
        ] satisfies WorkspaceTemplateFile[],
    }
}

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'hanasand-next-docker'
}

function titleCase(value: string) {
    return value
        .split('-')
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(' ')
}
