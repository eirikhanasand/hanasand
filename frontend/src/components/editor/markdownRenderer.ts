import hljs from 'highlight.js'
import { marked } from 'marked'

let isConfigured = false

export function configureMarkdownRenderer() {
    if (isConfigured) {
        return
    }

    marked.use({
        renderer: {
            code(token: { lang?: string, text: string }) {
                const language = hljs.getLanguage(typeof token.lang === 'string' ? token.lang : 'plaintext')
                    ? token.lang || 'plaintext'
                    : 'plaintext'
                const text = hljs.highlight(token.text, { language }).value
                return `<pre class='inline-block rounded-lg overflow-auto whitespace-pre-wrap wrap-break-word w-full'><code style='padding: 5px 10px; margin: 0;' class='hljs ${language}'>${text}</code></pre>`
            },
            image(token: { href: string, title?: string | null }) {
                return `<img src='${token.href}' alt='${token.title}' width='300' />`
            },
            link(token: { href: string, title?: string | null, text: string }) {
                return `<a href='${token.href}' title='${token.title}' target='_blank' rel='noopener noreferrer' class='text-blue-500 underline'>${token.text}</a>`
            },
            codespan(token: { text: string }) {
                return `<code class='break-all bg-extralight p-0.3 rounded-xs'>${token.text}</code>`
            },
            hr() {
                return '<hr class=\'my-6 border-t-2 border-white-400 opacity-50\' />'
            },
        }
    })

    isConfigured = true
}

export function renderMarkdown(markdown: string) {
    configureMarkdownRenderer()
    return marked.parse(markdown)
}
