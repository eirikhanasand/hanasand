import hljs from 'highlight.js'

export function applyHighlightedCode(codeElement: HTMLElement | null, value: string, syntaxHighlighting: boolean) {
    if (!codeElement) {
        return
    }

    codeElement.removeAttribute('data-highlighted')
    if (syntaxHighlighting) {
        codeElement.innerHTML = hljs.highlightAuto(value).value
        return
    }

    codeElement.textContent = value
}
