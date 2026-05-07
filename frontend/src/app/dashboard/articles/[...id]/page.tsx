import fetchArticle from '@/utils/articles/fetchArticle'
import { redirect } from 'next/navigation'
import EditorClient from './editorClient'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const article = await fetchArticle(id)

    if (!article) {
        return redirect('/dashboard/articles')
    }

    return (
        <div className='h-full'>
            <div className='px-4 py-8 md:px-10 lg:px-16'>
                <EditorClient article={article} />
            </div>
        </div>
    )
}
