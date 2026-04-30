import SharePageClient from './clientPage'
import { cookies } from 'next/headers'
import { getTree } from '@/utils/share/getTree'
import { getShare } from '@/utils/share/get'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const Cookies = await cookies()
    const openFoldersCookie = Cookies.get('openFolders')
    const openFilesCookie = Cookies.get('openFiles')
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const sharePageWidth = Number(Cookies.get('sharePageWidth')?.value) || 0
    const shareTerminalHeight = Number(Cookies.get('shareTerminalHeight')?.value) || 0
    const openFolders = parseCookieJson<string[]>(openFoldersCookie?.value, [])
    const openFiles = parseCookieJson<OpenFile[]>(openFilesCookie?.value, [])
    const [tree, share] = await Promise.all([
        getTree({ id, token, userId }),
        getShare({ id, token, userId }),
    ])
    const safeShare = typeof share === 'string' ? null : share

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
            />
        </div>
    )
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
