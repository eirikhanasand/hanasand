type Result = {
    title: string
    link: string
    snippet: string
}

type Visited = {
    url: string
    screenshot: string
}

type SearchWebOptions = {
    query: string
    limit?: number
    visitTopResults?: number
}

type SearchWebPage = {
    title: string
    url: string
    excerpt: string
}

type SearchWebItem = {
    title: string
    link: string
    snippet: string
}

type SearchWebResult = {
    query: string
    searchedUrl: string
    results: SearchWebItem[]
    pages: SearchWebPage[]
    markdown: string
}
