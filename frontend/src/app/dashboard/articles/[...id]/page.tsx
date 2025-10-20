import fetchArticle from '@/utils/articles/fetchArticle'
import { redirect } from 'next/navigation'
import Editorclient from './editorClient'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const article = await fetchArticle(id)

    if (!article) {
        return redirect('/dashboard/articles')
    }

    return (
        <div className="h-full">
            <div className="p-16">
                <Editorclient article={article} />
            </div>
        </div>
    )
}
