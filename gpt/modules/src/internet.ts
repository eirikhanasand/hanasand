export type SearchWebOptions = {
    query: string
    limit?: number
    visitTopResults?: number
}

export type SearchWebPage = {
    title: string
    url: string
    excerpt: string
}

export type SearchWebResult = {
    query: string
    searchedUrl: string
    results: Result[]
    pages: SearchWebPage[]
    markdown: string
}

const DEFAULT_HEADERS = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function decodeHtml(input: string) {
    return input
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripTags(input: string) {
    return decodeHtml(input.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function cleanText(input: string, maxLength: number) {
    return input.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function parseDuckDuckGoResults(html: string, limit: number) {
    const results: Result[] = []
    const regex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let match: RegExpExecArray | null

    while ((match = regex.exec(html)) && results.length < limit) {
        const rawHref = decodeHtml(match[1])
        const title = stripTags(match[2])
        const startIndex = match.index
        const windowHtml = html.slice(startIndex, startIndex + 2000)
        const snippetMatch = windowHtml.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a?>/i)
        const snippet = snippetMatch ? stripTags(snippetMatch[1]) : ''

        if (!title) {
            continue
        }

        let link = rawHref
        try {
            const candidate = new URL(rawHref, 'https://duckduckgo.com')
            const uddg = candidate.searchParams.get('uddg')
            if (uddg) {
                link = decodeURIComponent(uddg)
            } else {
                link = candidate.toString()
            }
        } catch {
            continue
        }

        results.push({
            title: cleanText(title, 200),
            link,
            snippet: cleanText(snippet, 400),
        })
    }

    return results
}

async function searchResults(query: string, limit: number) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(searchUrl, {
        headers: DEFAULT_HEADERS,
    })

    if (!response.ok) {
        throw new Error(`Search request failed with status ${response.status}`)
    }

    const html = await response.text()
    return {
        searchedUrl: searchUrl,
        results: parseDuckDuckGoResults(html, limit),
    }
}

async function fetchPage(url: string): Promise<SearchWebPage | null> {
    try {
        const response = await fetch(url, {
            headers: DEFAULT_HEADERS,
            redirect: 'follow',
        })

        if (!response.ok) {
            return null
        }

        const html = await response.text()
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
        const title = cleanText(stripTags(titleMatch?.[1] || url), 200)
        const text = cleanText(
            html
                .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
                .replace(/<[^>]+>/g, ' '),
            1200,
        )

        if (!text) {
            return null
        }

        return {
            title,
            url: response.url,
            excerpt: text,
        }
    } catch {
        return null
    }
}

async function fetchTopPages(results: Result[], visitTopResults: number) {
    const pages: SearchWebPage[] = []

    for (const result of results.slice(0, visitTopResults)) {
        const page = await fetchPage(result.link)
        if (page) {
            pages.push(page)
        }
    }

    return pages
}

function toMarkdown(result: SearchWebResult) {
    const resultSections = result.results.map((item, index) => {
        const snippet = item.snippet ? `\n${item.snippet}` : ''
        return `### Result ${index + 1}: [${item.title}](${item.link})${snippet}`
    })

    const pageSections = result.pages.map((page, index) => {
        return `### Page ${index + 1}: [${page.title}](${page.url})\n${page.excerpt}`
    })

    return [
        `# Web search for "${result.query}"`,
        `Search URL: ${result.searchedUrl}`,
        ...resultSections,
        ...pageSections,
    ].join('\n\n')
}

export default async function searchWeb(options: SearchWebOptions): Promise<SearchWebResult> {
    const limit = clamp(options.limit ?? 5, 1, 10)
    const visitTopResults = clamp(options.visitTopResults ?? 3, 0, limit)
    const searched = await searchResults(options.query, limit)
    const pages = await fetchTopPages(searched.results, visitTopResults)

    const output: SearchWebResult = {
        query: options.query,
        searchedUrl: searched.searchedUrl,
        results: searched.results,
        pages,
        markdown: '',
    }

    output.markdown = toMarkdown(output)
    return output
}
