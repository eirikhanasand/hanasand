import type { Frame, Page } from 'puppeteer'

export default async function handleConsent(page: Page) {
    const multilingualKeywords = [
        'accept', 'agree', 'consent', 'alle', 'godta', 'tout', 'aceptar', 'accetta',
        '承認', '同意', 'akzeptieren', 'aceitar', 'aceitar tudo', 'jeg aksepterer'
    ]

    const knownSelectors = [
        'button[aria-label="Accept all"]',
        'button[aria-label="I agree"]',
        '#L2AGLb',
        'button[jsname="b3VHJd"]',
        'form[action*="consent"] button',
        'div[role="none"] button',
    ]

    async function tryClickInFrame(frame: Frame) {
        for (const sel of knownSelectors) {
            try {
                const handle = await frame.$(sel)
                if (handle) {
                    await handle.click({delay: 50})
                    return true
                }
            } catch { }
        }

        try {
            const clicked = await frame.evaluate((keywords: string[]) => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'))
                for (const b of buttons) {
                    // @ts-expect-error
                    const text = (b.innerText || b.value || b.getAttribute('aria-label') || '').toLowerCase().trim()
                    if (!text) continue
                    for (const kw of keywords) {
                        if (text.includes(kw)) {
                            // @ts-expect-error
                            try { b.click(); return true } catch {}
                        }
                    }
                }
                return false
            }, multilingualKeywords)
            if (clicked) return true
        } catch { }

        return false
    }

    try {
        const frames = page.frames()
        for (const frame of frames) {
            const url = frame.url() || ''
            if (url.includes('consent')) {
                console.log('Found candidate consent frame:', url)
                const ok = await tryClickInFrame(frame)
                if (ok) {
                    console.log('Clicked consent inside iframe:', url)
                    return true
                }
            }
        }

        for (const frame of frames) {
            const ok = await tryClickInFrame(frame)
            if (ok) {
                console.log('Clicked consent inside a frame (unknown URL).')
                return true
            }
        }

        const mainOk = await tryClickInFrame(page.mainFrame())
        if (mainOk) {
            console.log('Clicked consent on main frame.')
            return true
        }

        console.log('No consent UI detected (or none clickable).')
        return false
    } catch (err) {
        console.warn('handleConsent error:', err)
        return false
    }
}
