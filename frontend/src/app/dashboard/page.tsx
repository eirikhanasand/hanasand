import fetchArticles from '@/utils/articles/fetchArticles'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const articles = await fetchArticles()

    if (!name) {
        redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    return (
        <div className="h-full">
            <div className="p-16">
                <h1>Welcome back {name}!</h1>
            </div>
            <div>
                {(articles as Article[]).map((article) => <h1 key={article.id}>{article.title}</h1>)}
            </div>
        </div>
    )
}
