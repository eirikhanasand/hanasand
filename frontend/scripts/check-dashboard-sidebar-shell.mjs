import { readFile, readdir } from 'node:fs/promises'

const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8')
const routeFrame = await readFile(new URL('../src/components/layout/routeFrame.tsx', import.meta.url), 'utf8')
const appSource = new URL('../src/app/', import.meta.url)
const desktopBlock = css.match(/@media \(min-width: 1024px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''

async function collectPageSource(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const sources = await Promise.all(entries.map(async entry => {
        const path = new URL(entry.name, `${directory.href.replace(/\/$/, '')}/`)
        if (entry.isDirectory()) return collectPageSource(path)
        if (!/\.tsx?$/.test(entry.name)) return []
        return [{ path: path.pathname, source: await readFile(path, 'utf8') }]
    }))
    return sources.flat()
}

const pages = await collectPageSource(appSource)
const stalePageHeights = pages.filter(({ path, source }) => path.endsWith('/global-error.tsx')
    ? false
    : source.includes('calc(100vh-4.5rem)') || /(?:^|\s)(?:min-h-screen|h-screen)(?:\s|$)/.test(source))
if (stalePageHeights.length) {
    throw new Error(`Page heights must honor the shared 16px bottom gutter: ${stalePageHeights.map(({ path }) => path).join(', ')}`)
}

if (!routeFrame.includes('mt-18 h-[calc(100dvh-5.5rem)]')) {
    throw new Error('The shared page frame must leave a 16px bottom gutter.')
}

if (!desktopBlock.includes('margin-top: 1rem') || !desktopBlock.includes('max-height: calc(100dvh - 6.5rem)')) {
    throw new Error('Desktop dashboard sidebar must keep a header-safe inset and bounded height.')
}

if (desktopBlock.includes('height: 100%')) {
    throw new Error('Desktop dashboard sidebar must size to its content instead of stretching to the shell height.')
}

console.log('Dashboard sidebar shell contract passed.')

if (!css.includes('overflow-anchor: none')) throw new Error('Expanding menus must not shift the sidebar scroll anchor.')
