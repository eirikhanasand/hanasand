import PwnedPageClient from './pageClient'

export default async function Page() {
    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-2xl'>
                <PwnedPageClient />
            </div>
        </section>
    )
}
