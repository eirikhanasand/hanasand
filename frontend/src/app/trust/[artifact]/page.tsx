import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react'
import { buildRouteMetadata } from '../../seo'
import { getTrustArtifact, trustArtifacts } from '../trustArtifacts'

type Props = {
    params: Promise<{ artifact: string }>
}

export function generateStaticParams() {
    return trustArtifacts.map((artifact) => ({ artifact: artifact.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { artifact: slug } = await params
    const artifact = getTrustArtifact(slug)
    if (!artifact) {
        return buildRouteMetadata({
            title: 'Trust Artifact',
            description: 'Hanasand trust center artifact.',
            path: '/trust',
        })
    }

    return buildRouteMetadata({
        title: `${artifact.label} | Trust Center`,
        description: artifact.description,
        path: `/trust/${artifact.slug}`,
        keywords: ['hanasand trust center', 'hanasand security review', artifact.label.toLowerCase()],
    })
}

export default async function TrustArtifactPage({ params }: Props) {
    const { artifact: slug } = await params
    const artifact = getTrustArtifact(slug)
    if (!artifact) notFound()

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-6xl gap-6 px-4 py-12 md:px-8 md:py-16'>
                    <Link href='/trust' className='inline-flex w-fit items-center gap-2 text-sm font-semibold text-ui-primary transition hover:text-ui-text'>
                        <ArrowLeft className='h-4 w-4' />
                        Trust center
                    </Link>
                    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start'>
                        <div className='grid gap-4'>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>{artifact.eyebrow}</p>
                            <h1 className='max-w-4xl text-4xl font-semibold tracking-normal md:text-6xl'>{artifact.title}</h1>
                            <p className='max-w-3xl text-base leading-7 text-ui-muted md:text-lg md:leading-8'>{artifact.description}</p>
                        </div>
                        <aside className='grid gap-3 rounded-lg border border-ui-border bg-ui-canvas p-4 shadow-sm'>
                            <span className='grid h-11 w-11 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-primary'>
                                <FileText className='h-5 w-5' />
                            </span>
                            <div>
                                <p className='text-xs font-semibold uppercase text-ui-muted'>Artifact status</p>
                                <p className='mt-1 text-lg font-semibold'>{artifact.status}</p>
                            </div>
                            <div className='border-t border-ui-border pt-3'>
                                <p className='text-xs font-semibold uppercase text-ui-muted'>Updated</p>
                                <p className='mt-1 text-sm font-semibold'>{artifact.updated}</p>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-canvas'>
                <div className='mx-auto grid max-w-6xl gap-4 px-4 py-10 md:grid-cols-2 md:px-8 lg:grid-cols-4'>
                    {artifact.summary.map(([label, value]) => (
                        <div key={label} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
                            <p className='mt-2 text-sm font-semibold leading-6'>{value}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-6xl gap-5 px-4 py-10 md:px-8 lg:grid-cols-2'>
                    {artifact.sections.map((section) => (
                        <article key={section.title} className='rounded-lg border border-ui-border bg-ui-canvas p-5 shadow-sm'>
                            <h2 className='text-xl font-semibold'>{section.title}</h2>
                            <p className='mt-3 text-sm leading-6 text-ui-muted'>{section.body}</p>
                            {section.items?.length ? (
                                <ul className='mt-4 grid gap-2 text-sm leading-6 text-ui-muted'>
                                    {section.items.map((item) => (
                                        <li key={item} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2'>{item}</li>
                                    ))}
                                </ul>
                            ) : null}
                        </article>
                    ))}
                </div>
            </section>

            {artifact.table ? (
                <section className='border-b border-ui-border bg-ui-canvas'>
                    <div className='mx-auto grid max-w-6xl gap-4 px-4 py-10 md:px-8'>
                        <div>
                            <p className='text-sm font-semibold uppercase text-ui-primary'>Review table</p>
                            <h2 className='mt-2 text-3xl font-semibold'>What a reviewer can check.</h2>
                        </div>
                        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                            <div className='hidden grid-cols-[13rem_1fr_1fr] gap-3 border-b border-ui-border px-4 py-3 text-xs font-semibold uppercase text-ui-muted md:grid'>
                                {artifact.table.columns.map((column) => <span key={column}>{column}</span>)}
                            </div>
                            <div className='divide-y divide-ui-border'>
                                {artifact.table.rows.map(([first, second, third]) => (
                                    <div key={`${first}:${second}`} className='grid gap-2 px-4 py-4 text-sm md:grid-cols-[13rem_1fr_1fr] md:gap-3'>
                                        <span className='font-semibold'>{first}</span>
                                        <span className='leading-6 text-ui-muted'>{second}</span>
                                        <span className='leading-6 text-ui-muted'>{third}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}

            <section className='bg-ui-canvas'>
                <div className='mx-auto grid max-w-6xl gap-5 px-4 py-10 md:px-8 lg:grid-cols-[1fr_auto] lg:items-center'>
                    <div>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Next steps</p>
                        <ul className='mt-3 grid gap-2 text-sm leading-6 text-ui-muted'>
                            {artifact.nextSteps.map((step) => (
                                <li key={step} className='rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>{step}</li>
                            ))}
                        </ul>
                    </div>
                    <Link href='/contact?intent=procurement' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                        Request review docs
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </div>
            </section>
        </main>
    )
}
