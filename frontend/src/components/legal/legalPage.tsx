import Link from 'next/link'

type LegalSection = {
    title: string
    body: string | string[]
    bullets?: string[]
}

type LegalPageProps = {
    eyebrow: string
    title: string
    description: string
    sections: LegalSection[]
}

export default function LegalPage({ eyebrow, title, description, sections }: LegalPageProps) {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-4xl gap-4 px-4 py-14 md:px-8 md:py-18'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>{eyebrow}</p>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>{title}</h1>
                    <p className='max-w-3xl text-lg leading-8 text-ui-muted'>{description}</p>
                </div>
            </section>

            <section className='mx-auto grid max-w-6xl gap-5 px-4 py-10 md:px-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start'>
                <aside className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm lg:sticky lg:top-24'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Contents</p>
                    <nav aria-label={`${title} sections`} className='mt-3 grid gap-1'>
                        {sections.map((section, index) => (
                            <a
                                key={section.title}
                                href={`#legal-section-${index + 1}`}
                                className='rounded-md px-2 py-1.5 text-sm font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                            >
                                {section.title}
                            </a>
                        ))}
                    </nav>
                </aside>

                <div className='grid min-w-0 gap-4'>
                    {sections.map((section, index) => (
                        <article id={`legal-section-${index + 1}`} key={section.title} className='scroll-mt-24 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm'>
                            <h2 className='text-lg font-semibold text-ui-text'>{section.title}</h2>
                            <div className='mt-2 grid gap-3 text-sm leading-7 text-ui-muted'>
                                {(Array.isArray(section.body) ? section.body : [section.body]).map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                                {section.bullets?.length ? (
                                    <ul className='list-disc space-y-2 pl-5'>
                                        {section.bullets.map((bullet) => (
                                            <li key={bullet}>{bullet}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        </article>
                    ))}
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-5 text-sm leading-7 text-ui-muted shadow-sm'>
                        Contact <Link href='/support' className='font-semibold text-ui-primary underline-offset-4 hover:underline'>support</Link> for questions about this legal page, privacy request routing, contract notices, or account-specific handling.
                    </div>
                </div>
            </section>
        </main>
    )
}
