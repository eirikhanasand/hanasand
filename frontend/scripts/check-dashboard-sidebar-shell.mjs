import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8')
const desktopBlock = css.match(/@media \(min-width: 1024px\)\s*\{([\s\S]*?)\n\}/)?.[1] || ''

if (!desktopBlock.includes('top: 0.5rem') || !desktopBlock.includes('max-height: calc(100% - 0.5rem)')) {
    throw new Error('Desktop dashboard sidebar must keep a header-safe inset and bounded height.')
}

if (/top:\s*0;[\s\S]*height:\s*100%;[\s\S]*max-height:\s*100%/.test(desktopBlock)) {
    throw new Error('Desktop dashboard sidebar must not be flush with the app header.')
}

console.log('Dashboard sidebar shell contract passed.')
