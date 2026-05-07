import { redirect } from 'next/navigation'
import EditorClient from './editorClient'
import fetchThought from '@/utils/thoughts/fetchThought'

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const thought = await fetchThought(id)

    if (!thought) {
        return redirect('/dashboard/thoughts')
    }

    return (
        <div className='h-full'>
            <div className='px-4 py-8 md:px-10 lg:px-16'>
                <EditorClient thought={thought} />
            </div>
        </div>
    )
}
