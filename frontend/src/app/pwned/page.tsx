import PwnedPageClient from './pageClient'

export default async function Page() {
    return (
        <div className='min-h-[90.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-30 lg:p-60 md:px-40 lg:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg'>
                <PwnedPageClient />
            </div>
        </div>
    )
}
