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
    const openFolders: string[] = openFoldersCookie?.value ? JSON.parse(openFoldersCookie?.value ?? '') || [] as string[] : [] as string[]
    const tree = await getTree(id)
    const share = await getShare(id)

    return (
        <div className='w-full h-[90.5vh]'>
            <SharePageClient id={id} share={share} randomId={random} openFolders={openFolders} tree={tree} />
        </div>
    )
}
