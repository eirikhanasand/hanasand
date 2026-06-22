import PwnedPageClient from './pageClient'

export default async function Page() {
    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-10'>
            <div className='grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'>
                <div className='grid gap-4'>
                    <p className='text-sm font-semibold uppercase text-[#3056d3]'>Bloom Filter</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Password exposure check for the personal archive.</h1>
                    <p className='max-w-xl text-base leading-7 text-[#596170]'>
                        This older Hanasand tool remains available as a focused utility: check an exact password against indexed breach data without turning the main product into a generic security toolbox.
                    </p>
                </div>
                <PwnedPageClient />
            </div>
        </section>
    )
}
