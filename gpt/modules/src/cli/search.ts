import searchWeb from '../internet.ts'

type SearchCliInput = {
    query: string
    limit?: number
    visitTopResults?: number
}

function isSearchCliInput(value: unknown): value is SearchCliInput {
    if (!value || typeof value !== 'object') {
        return false
    }

    const candidate = value as Record<string, unknown>
    return typeof candidate.query === 'string'
}

async function readJsonFromStdin() {
    const chunks: string[] = []

    for await (const chunk of process.stdin) {
        chunks.push(String(chunk))
    }

    const raw = chunks.join('').trim()
    if (!raw) {
        throw new Error('Missing JSON payload on stdin')
    }

    const parsed = JSON.parse(raw) as unknown
    if (!isSearchCliInput(parsed)) {
        throw new Error('Invalid search payload')
    }

    return parsed
}

async function main() {
    const input = await readJsonFromStdin()
    const result = await searchWeb({
        query: input.query,
        limit: input.limit,
        visitTopResults: input.visitTopResults,
    })

    process.stdout.write(`${JSON.stringify(result)}\n`)
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
})
