import SharePageClient from '@/app/s/[...id]/clientPage'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getProject from '@/utils/projects/getProject'
import { getShare } from '@/utils/share/get'

export default async function Page(props: {
    params: Promise<{ id: string[] }>
    searchParams: Promise<{ file?: string }>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const alias = params.id[0]
    const Cookies = await cookies()
    const openFoldersCookie = Cookies.get('openFolders')
    const openFilesCookie = Cookies.get('openFiles')
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const sharePageWidth = Number(Cookies.get('sharePageWidth')?.value) || 0
    const shareTerminalHeight = Number(Cookies.get('shareTerminalHeight')?.value) || 0
    const openFolders = parseCookieJson<string[]>(openFoldersCookie?.value, [])
    const openFiles = parseCookieJson<OpenFile[]>(openFilesCookie?.value, [])
    const project = await getProject({ alias, token, userId })
    const activeShare = searchParams.file
        ? await getShare({ id: searchParams.file, token, userId })
        : null

    if (!project) {
        const share = await getShare({ id: alias, token, userId })
        if (typeof share !== 'string') {
            redirect(`/s/${alias}`)
        }
    }

    if (!project) {
        redirect(`/s/${alias}`)
    }

    return (
        <div className='w-full h-[92.5vh]'>
            <SharePageClient
                id={project.share.id}
                share={typeof activeShare === 'string' || !activeShare ? project.share : activeShare}
                openFolders={openFolders}
                tree={project.tree}
                sharePageWidth={sharePageWidth}
                shareTerminalHeight={shareTerminalHeight}
                serverOpenFiles={openFiles}
                autoCreate={false}
                replaceUrlOnCreate={false}
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
        console.warn(`Failed to parse project route cookie JSON: ${error}`)
        return fallback
    }
}
