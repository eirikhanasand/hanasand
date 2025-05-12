import MarkdownRender from '@/components/markdown/markdown'
import fetchArticle from '@/utils/articles/fetchArticle'
import { prettyDate } from '@/utils/prettyDate'
import Link from 'next/link'
import { redirect } from 'next/navigation'

type PageProps = {
    params: Promise<{ article: string }>
}

export default async function page({ params }: PageProps) {
    const article = (await params).article
    const data = await fetchArticle(article)

    if (article === 'featured' || article === 'main' || !data) {
        redirect('/articles')
    }

    const text = data.text
    const commits = data.commits
    const created = prettyDate(commits[commits.length - 1].commit.committer.date)
    const edited = prettyDate(commits[0].commit.committer.date)
    const contentMatch = text.match(/---[\s\S]*?---\s*([\s\S]*)/)
    const content = contentMatch ? contentMatch[1].trim() : ""

    return (
        <div className='grid px-[20vw] h-full -mt-2'>
            <div className='absolute text-superlight text-right top-[12vh] right-[20vw] w-fit'>
                <h1>Last edited {edited}</h1>
                <h1>Published {created}</h1>
            </div>
            <div>
                <MarkdownRender MDstr={content} />
                <div className='hover:scale-[1.03] bg-dark rounded-lg p-[0.5vh] px-4 w-fit'>
                    <Link 
                        href='/articles'
                        className='text-gray-500'
                        >
                        ← Browse other articles
                    </Link>
                </div>
            </div>
        </div>
    )
}
