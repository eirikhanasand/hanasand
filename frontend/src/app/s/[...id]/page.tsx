import SharePageClient from './clientPage'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTree } from '@/utils/share/getTree'
import { getShare } from '@/utils/share/get'
import getProject from '@/utils/projects/getProject'

export default async function Page(props: {
    params: Promise<{ id: string[] }>
    searchParams: Promise<{ chat?: string, new?: string }>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const id = params.id[0]
    const isNewWorkspace = searchParams.new === '1'
    const initialChatOpen = searchParams.chat === '1'
    const Cookies = await cookies()
    const openFoldersCookie = Cookies.get('openFolders')
    const openFilesCookie = Cookies.get('openFiles')
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const sharePageWidth = Number(Cookies.get('sharePageWidth')?.value) || 0
    const shareTerminalHeight = Number(Cookies.get('shareTerminalHeight')?.value) || 0
    const openFolders = parseCookieJson<string[]>(openFoldersCookie?.value, [])
    const openFiles = parseCookieJson<OpenFile[]>(openFilesCookie?.value, [])
    const [tree, share] = isNewWorkspace
        ? [createOptimisticTree(id), createOptimisticShare(id)] as const
        : await Promise.all([
            getTree({ id, token, userId }),
            getShare({ id, token, userId }),
        ])
    const safeShare = typeof share === 'string' ? null : share
    const isProject = safeShare && safeShare.alias !== safeShare.id && Array.isArray(tree) && flattenTree(tree).length > 1

    if (!isNewWorkspace && isProject) {
        redirect(`/p/${safeShare.alias}?file=${safeShare.id}`)
    }

    if (!isNewWorkspace && !safeShare) {
        const project = await getProject({ alias: id, token, userId })
        if (project) {
            redirect(`/p/${id}`)
        }
    }

    return (
        <div className='w-full h-[92.5vh]'>
            <SharePageClient
                id={id}
                share={safeShare}
                openFolders={openFolders}
                tree={tree}
                sharePageWidth={sharePageWidth}
                shareTerminalHeight={shareTerminalHeight}
                serverOpenFiles={openFiles}
                autoCreate={isNewWorkspace}
                initialChatOpen={initialChatOpen}
                replaceUrlOnCreate
            />
        </div>
    )
}

function createOptimisticShare(id: string): Share {
    return {
        id,
        path: id,
        content: '',
        wordCount: 0,
        estimatedMinutes: 0,
        timestamp: new Date().toISOString(),
        git: null,
        locked: false,
        owner: '',
        parent: '',
        alias: id,
    }
}

function createOptimisticTree(id: string): Tree {
    return [{
        id,
        type: 'folder',
        name: id,
        alias: id,
        parent: null,
        children: [],
    }]
}

function flattenTree(tree: Tree): FileItem[] {
    return tree.flatMap((item) => item.type === 'folder'
        ? [item, ...flattenTree(item.children)]
        : [item])
}

function parseCookieJson<T>(value: string | undefined, fallback: T): T {
    if (!value) {
        return fallback
    }

    try {
        return JSON.parse(value) as T
    } catch (error) {
        console.warn(`Failed to parse share route cookie JSON: ${error}`)
        return fallback
    }
}
