import Link from 'next/link'

type LegalPageProps = {
    eyebrow: string
    title: string
    description: string
    sections: Array<{ title: string; body: string }>
}

export default function LegalPage({ eyebrow, title, description, sections }: LegalPageProps) {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-[#f7f8fb] text-[#171a21]'>
            <section className='border-b border-[#e3e7ee] bg-white'>
                <div className='mx-auto grid max-w-4xl gap-4 px-4 py-14 md:px-8 md:py-18'>
                    <p className='text-sm font-semibold uppercase text-[#3056d3]'>{eyebrow}</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>{title}</h1>
                    <p className='max-w-3xl text-lg leading-8 text-[#596170]'>{description}</p>
                </div>
            </section>
            <section className='mx-auto grid max-w-4xl gap-4 px-4 py-10 md:px-8'>
                {sections.map((section) => (
                    <article key={section.title} className='rounded-lg border border-[#e0e5ed] bg-white p-5 shadow-sm'>
                        <h2 className='text-lg font-semibold'>{section.title}</h2>
                        <p className='mt-2 text-sm leading-7 text-[#596170]'>{section.body}</p>
                    </article>
                ))}
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-5 text-sm leading-7 text-[#596170] shadow-sm'>
                    Contact <Link href='/contact?intent=support' className='font-semibold text-[#3056d3]'>support</Link> for questions about these terms of service.
                </div>
            </section>
        </main>
    )
}
