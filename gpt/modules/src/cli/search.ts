import searchWeb from '../internet.ts'

type SearchCliInput = {
    query: string
    limit?: number
    visitTopResults?: number
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

    return JSON.parse(raw) as SearchCliInput
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
