import getResults from './utils/web/getResults.ts'
import handlePageResponse from './utils/web/handlePageResponse.ts'
import openBrowserAndHandleConsent from './utils/web/openBrowserAndHandleConsent.ts'
import visitGoogle from './utils/web/visitGoogle.ts'
import visitGuaranteedSites from './utils/web/visitGuaranteedSites.ts'
import visitObligatorySites from './utils/web/visitObligatorySites.ts'
import visitResults from './utils/web/visitResults.ts'

async function searchWeb(query: string, limit: number = 5, probableSites: string[] = [], guaranteedUrls: string[], mustVisit: string[]) {
    const { browser, page } = await openBrowserAndHandleConsent(query)
    const visited = await visitGoogle(page)
    const results = await getResults(page, limit)
    const resultsVisited = await visitResults(page, results, visited, probableSites) 

    await handlePageResponse(page)
    await visitGuaranteedSites(page, visited, resultsVisited, guaranteedUrls)
    await visitObligatorySites(page, visited, mustVisit)

    const markdown = await page.evaluate((limit) => {
        console.log("eval")
        console.log("beforeedit", document)
        document.querySelectorAll('script, style, noscript').forEach(el => el.remove())
        console.log(document.querySelectorAll('h1'))
        const items = Array.from(document.querySelectorAll('div.g, .g')).slice(0, limit)
        console.log(items)
        return items.map(item => {
            const a = item.querySelector('a')
            const h3 = item.querySelector('h3') || item.querySelector('h2')
            // @ts-expect-error
            const snippet = item.querySelector('.IsZvec, .VwiC3b, .aCOpRe')?.innerText || ''
            const title = h3 ? h3.innerText.trim() : (a ? a.innerText.trim() : '')
            const link = a ? a.href : ''
            return `### [${title}](${link})\n\n${snippet.trim()}`
        })
    }, limit)

    await browser.close()
    return { results, markdown, visited }
}

;(async () => {
    const query = "check the nextjs 16 release notes"
    const { results, markdown, visited } = await searchWeb(query, 5, ["nextjs.org/blog", "nextjs.org", "nextjs", "blog"], ["https://nextjs.org/blog/next-16"], ["https://pettersen.me/"])
    console.log('RESULTS:\n', results)
    console.log('MARKDOWN RESULTS:\n', markdown.join('\n\n'))
    console.log('VISITED PAGES:\n', visited)
})()
