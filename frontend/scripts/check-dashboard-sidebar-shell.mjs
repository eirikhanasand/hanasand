import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8')
const desktopBlock = css.match(/@media \(min-width: 1024px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''

if (!desktopBlock.includes('top: 0.5rem') || !desktopBlock.includes('max-height: calc(100dvh - 5.5rem)')) {
    throw new Error('Desktop dashboard sidebar must keep a header-safe inset and bounded height.')
}

if (desktopBlock.includes('height: 100%')) {
    throw new Error('Desktop dashboard sidebar must size to its content instead of stretching to the shell height.')
}

console.log('Dashboard sidebar shell contract passed.')
