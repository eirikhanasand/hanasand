declare module 'marked' {
    export const marked: {
        use: (options: Record<string, unknown>) => void
        parse: (markdown: string) => string
    }
}
