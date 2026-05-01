import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const workspaceRoot = path.resolve(frontendRoot, '..', '..')
const cdnIndexPath = path.join(workspaceRoot, 'cdn', 'src', 'index.ts')
const openrestyFiles = [
    path.join(workspaceRoot, 'openresty', 'nginx', 'conf.d', 'default.conf'),
]

const cdnIndex = fs.readFileSync(cdnIndexPath, 'utf8')
const fastifyLimitBytes = readFastifyMultipartFileLimit(cdnIndex)
const errors = []

for (const filePath of openrestyFiles) {
    const text = fs.readFileSync(filePath, 'utf8')
    const serverBlock = findServerBlock(text, 'cdn.hanasand.com')
    if (!serverBlock) {
        errors.push(`${relative(filePath)}: missing server block for cdn.hanasand.com.`)
        continue
    }

    const directive = serverBlock.text.match(/\bclient_max_body_size\s+([^;]+);/)
    if (!directive) {
        errors.push(
            `${relative(filePath)}:${lineNumber(text, serverBlock.index)}: cdn.hanasand.com must set ` +
            `client_max_body_size ${formatMegabytes(fastifyLimitBytes)}M to match the CDN multipart file limit.`
        )
        continue
    }

    const openrestyLimitBytes = parseNginxSize(directive[1].trim())
    if (!Number.isFinite(openrestyLimitBytes) || openrestyLimitBytes < fastifyLimitBytes) {
        errors.push(
            `${relative(filePath)}:${lineNumber(text, serverBlock.index + directive.index)}: ` +
            `client_max_body_size ${directive[1].trim()} is below the CDN multipart file limit ` +
            `of ${formatMegabytes(fastifyLimitBytes)}M.`
        )
    }
}

if (errors.length > 0) {
    console.error('\nUpload limit guardrail failed:\n')
    for (const error of errors) {
        console.error(`- ${error}`)
    }
    process.exit(1)
}

console.log(`Upload limit guardrail passed. CDN and OpenResty allow ${formatMegabytes(fastifyLimitBytes)}M uploads.`)

function readFastifyMultipartFileLimit(source) {
    const match = source.match(/fileSize:\s*(\d+)\s*\*\s*1024\s*\*\s*1024/)
    if (!match) {
        throw new Error(`${relative(cdnIndexPath)}: unable to find Fastify multipart fileSize limit.`)
    }

    return Number(match[1]) * 1024 * 1024
}

function findServerBlock(source, serverName) {
    const serverPattern = /\bserver\s*\{/g
    let match
    while ((match = serverPattern.exec(source)) !== null) {
        const start = match.index
        const openBrace = source.indexOf('{', start)
        const end = matchingBraceIndex(source, openBrace)
        if (end === -1) {
            continue
        }

        const block = source.slice(start, end + 1)
        if (new RegExp(`\\bserver_name\\s+${escapeRegExp(serverName)}\\s*;`).test(block)) {
            return { text: block, index: start }
        }
    }

    return null
}

function matchingBraceIndex(source, openBrace) {
    let depth = 0
    for (let i = openBrace; i < source.length; i += 1) {
        if (source[i] === '{') {
            depth += 1
        } else if (source[i] === '}') {
            depth -= 1
            if (depth === 0) {
                return i
            }
        }
    }

    return -1
}

function parseNginxSize(value) {
    const match = value.match(/^(\d+)([kKmMgG])?$/)
    if (!match) {
        return Number.NaN
    }

    const amount = Number(match[1])
    const unit = (match[2] || '').toLowerCase()
    if (unit === 'g') {
        return amount * 1024 * 1024 * 1024
    }

    if (unit === 'm') {
        return amount * 1024 * 1024
    }

    if (unit === 'k') {
        return amount * 1024
    }

    return amount
}

function lineNumber(source, index) {
    return source.slice(0, index).split('\n').length
}

function formatMegabytes(bytes) {
    return bytes / 1024 / 1024
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function relative(filePath) {
    return path.relative(workspaceRoot, filePath)
}
