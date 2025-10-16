import LinkPageClient from './pageClient'

export default async function Page() {
    return (
        <div className='min-h-[93.5vh] w-full py-40 px-15 h-[30vh] md:h-full md:p-[15rem] md:px-40 lg:px-100 grid gap-2 place-items-center'>
            <div className='grid w-full spawn rounded-lg overflow-hidden'>
                <LinkPageClient />
            </div>
        </div>
    )
}
