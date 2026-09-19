export function countLines(content: string): number {
    if (!content) return 0
    // A final line ending terminates the last line; it does not add another one.
    return content.split(/\r\n|\r|\n/).length - (/[\r\n]$/.test(content) ? 1 : 0)
}
