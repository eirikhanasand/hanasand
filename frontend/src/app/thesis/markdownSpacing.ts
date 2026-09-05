import type { Root, RootContent } from 'mdast'

// Markdown normally discards blank lines between blocks. Keep them as editable visual space.
export default function markdownSpacing() {
    return (tree: Root, file: { value: unknown }) => {
        const lines = String(file.value).split('\n')
        const children: RootContent[] = []
        let next = 1
        function blanks(end: number) {
            for (; next < end; next++) {
                if (lines[next - 1]?.trim()) continue
                children.push({
                    type: 'paragraph',
                    data: { hProperties: { className: 'thesis-markdown-blank' } },
                    position: { start: { line: next, column: 1 }, end: { line: next, column: 1 } },
                    children: [{ type: 'text', value: '\u00a0' }],
                })
            }
        }
        for (const child of tree.children) {
            blanks(child.position?.start.line ?? next)
            children.push(child)
            next = (child.position?.end.line ?? next) + 1
        }
        blanks(lines.length + 1)
        tree.children = children
    }
}
