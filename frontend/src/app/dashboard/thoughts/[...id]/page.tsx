import { redirect } from 'next/navigation'
import EditorClient from './editorClient'
import fetchThought from '@/utils/thoughts/fetchThought'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const thought = await fetchThought(id)

    if (!thought) {
        return redirect('/dashboard/thoughts')
    }

    return (
        <div className='h-full'>
            <div className='p-16'>
                <EditorClient thought={thought} />
            </div>
        </div>
    )
}
