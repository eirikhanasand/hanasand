import runCommand from '#utils/tools/runCommand.ts'

type ComposeArgs = {
    cwd: string
    file?: string
    projectName?: string
}

function composePrefix(args: ComposeArgs) {
    const parts = ['docker', 'compose']
    if (args.file) {
        parts.push('-f', shellEscape(args.file))
    }
    if (args.projectName) {
        parts.push('-p', shellEscape(args.projectName))
    }
    return parts.join(' ')
}

function shellEscape(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function composeUp(args: ComposeArgs & { build?: boolean }) {
    const prefix = composePrefix(args)
    const result = await runCommand({
        command: `${prefix} up${args.build === false ? '' : ' --build'} -d`,
        cwd: args.cwd,
        timeoutMs: 10 * 60 * 1000,
    })
    return {
        ...result,
        composeCommand: `${prefix} up${args.build === false ? '' : ' --build'} -d`,
    }
}

export async function composeDown(args: ComposeArgs) {
    const prefix = composePrefix(args)
    const result = await runCommand({
        command: `${prefix} down --remove-orphans`,
        cwd: args.cwd,
        timeoutMs: 10 * 60 * 1000,
    })
    return {
        ...result,
        composeCommand: `${prefix} down --remove-orphans`,
    }
}

export async function composeLogs(args: ComposeArgs & { tail?: number }) {
    const prefix = composePrefix(args)
    const tail = Math.max(20, Math.min(args.tail ?? 200, 1000))
    const result = await runCommand({
        command: `${prefix} logs --tail=${tail}`,
        cwd: args.cwd,
        timeoutMs: 120000,
    })
    return {
        ...result,
        composeCommand: `${prefix} logs --tail=${tail}`,
    }
}
