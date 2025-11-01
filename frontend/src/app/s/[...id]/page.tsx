import randomId from '@/utils/random/randomId'
import SharePageClient from './clientPage'
import { cookies } from 'next/headers'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const random = randomId()
    const Cookies = await cookies()
    const openFoldersCookie = Cookies.get('openFolders')
    const openFolders: string[] = JSON.parse(openFoldersCookie?.value ?? '') || [] as string[]

    return (
        <div className='w-full h-[93.5vh]'>
            <SharePageClient id={id} randomId={random} openFolders={openFolders} />
        </div>
    )
}
