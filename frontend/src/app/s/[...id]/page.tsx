import randomId from '@/utils/random/randomId'
import SharePageClient from './clientPage'
import { cookies } from 'next/headers'
import { getTree } from '@/utils/share/getTree'
import { getShare } from '@/utils/share/get'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const random = randomId()
    const Cookies = await cookies()
    const openFoldersCookie = Cookies.get('openFolders')
    const openFilesCookie = Cookies.get('openFiles')
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const sharePageWidth = Number(Cookies.get('sharePageWidth')?.value) || 0
    const shareTerminalHeight = Number(Cookies.get('shareTerminalHeight')?.value) || 0
    const openFolders: string[] = openFoldersCookie?.value ? JSON.parse(openFoldersCookie?.value ?? '') || [] as string[] : [] as string[]
    const openFiles: OpenFile[] = openFilesCookie?.value ? JSON.parse(openFilesCookie?.value ?? null) || [] as OpenFile[] : [] as OpenFile[]
    const tree = await getTree({ id, token, userId })
    const share = await getShare({ id, token, userId })
    const safeShare = typeof share === 'string' ? null : share

    return (
        <div className='w-full h-[92.5vh]'>
            <SharePageClient 
                id={id} 
                share={safeShare} 
                randomId={random} 
                openFolders={openFolders} 
                tree={tree}
                sharePageWidth={sharePageWidth}
                shareTerminalHeight={shareTerminalHeight}
                serverOpenFiles={openFiles}
            />
        </div>
    )
}
