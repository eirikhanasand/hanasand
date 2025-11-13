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
    tree: CommitTree
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

type CommitTree = {
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
    id: string
    size: number
    created: string
    modified: string
    metadata: {
        image: string
        description: string
        wordCount: number
        estimatedMinutes: number
    }
    title: string
    content: string
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

type Share = {
    id: string
    path: string
    content: string
    wordCount: number
    estimatedMinutes: number
    timestamp: string
    git: string
    locked: boolean
    owner: string
    parent: string
    alias: string
}

type Link = {
    id: string
    path: string
}

type FullLink = {
    id: string
    path: string
    visits: number
    timestamp: string
}

type File = {
    id: string
    path: string
    content: string
    timestamp: string
}

type PostFileResponse = {
    id: string
}

type Breach = {
    ok: boolean
    count: number
    message: string
}

type BreachFile = {
    file: string
    line: number
}

type Articles = {
    recent: Article[]
    articles: Article[]
}

type User = {
    id: string
    name: string
    avatar: string
}

type UserWithRole = User & { role: string }

type Thought = {
    id: string
    title: string
    created_at: string
    created_by: string
    updated_at: string
}

type Role = {
    id: string
    name: string
    description: string
    priority: number
    created_by: string
    created_at: string
    updated_at: string
}

type Updates = {
    path?: string
    content?: string
}

type Test = {
    id: number
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    logs: string[]
    errors: string[]
    duration: { milliseconds: number }
    created_at: string
    finished_at: string
    exit_code: number
    visits: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary: any
}

type FileItemBase = {
    id: string
    name: string
    alias: string | null
    parent: string | null
}

type FileFile = FileItemBase & {
    type: 'file'
}

type FileFolder = FileItemBase & {
    type: 'folder'
    children: FileItem[]
}

type FileItem = FileFile | FileFolder

type Log = {
    content: string
    timestamp: string
    type: 'stdout' | 'stderr'
}

type Tree = FileItem[]

type Certificate = {
    id: string
    public_key: string
    name: string
    owner: string
    created_at: string
    created_by: string
}

type VM = {
    id: string
    name: string
    owner: string
    vm_ip: string
    created_at: string
    created_by: string
    access_users: string[]
}

type BlocklistEntry = {
    id: number
    type: 'ip' | 'user_agent'
    value: string
    is_vpn: boolean
    is_proxy: boolean
    is_tor: boolean
    owner?: string
    country?: string
    region?: string
    city?: string
}

type IPMetrics = {
    ip: string
    top_paths: TopPath[]
    most_common_user_agent: string | null
}

type UAMetrics = {
    user_agent: string
    top_paths: TopPath[]
    most_common_ip: string | null
}

type DomainTPS = {
    name: string
    tps: number
}

type FetchRequest = {
    type: RequestType
    path: string
    created: string
}

type RequestType = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" | "CONNECT" | "TRACE" | string

type Parameter = {
    parameter: string
    value: string
}

type SearchResult = {
    action: string
    text: string
    metadata?: {
        file?: string
        line?: number
    }
}

type OpenFile = {
    id: string
    name: string
}
