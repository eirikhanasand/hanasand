type User = {
    name: string
    username: string
    time: number
    score: number
    solved: UserSolved[]
}

type LoggedInUser = {
    name: string
    username: string
    time: number
}

type Theme = 'light' | 'dark' | undefined

type Cookie = {
    name: string
    value: string
}

type Commit = {
    sha: string
    node_id: string
    commit: InnerCommit
}

type InnerCommit = {
    author: Author
    committer: Committer
    message: string
    tree: Tree
    url: string
    comment_count: number
    verification: Verification
}

type Author = {
    name: string
    email: string
    date: string
}

type Committer = {
    name: string
    email: string
    date: string
}

type Tree = {
    sha: string
    url: string
}

type Verification = {
    verified: boolean
    reason: string
    signature: null
    payload: null
    verified_at: null
}

type Article = {
    title: string
    image: string
    href: string
    description: string
    length: ArticleLength
    created: string
    updated: string
}

type ArticleLength = {
    wordCount: number
    estimatedMinutes: number
}

type GithubContent = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    _links: ContentLinks
}

type ContentLinks = {
    self: string
    git: string
    html: string
}

type GitHubContentFile = {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    content: string
    encoding: string
    _links: ContentLinks
}

type GitHubFile = {
    name: string
    text: string
    commits: Commit[]
}
