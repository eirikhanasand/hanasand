import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarClock, History, ShieldCheck } from 'lucide-react'
import { buildRouteMetadata } from '../../seo'

export const metadata: Metadata = buildRouteMetadata({ title: 'Security Scanner', description: 'Run safe validation scans for Hanasand-owned systems.', path: '/solutions/scanner', keywords: ['security scanner', 'vulnerability validation', 'asset discovery'] })

export default function ScannerSolutionPage() {
    return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'><section className='border-b border-ui-border bg-ui-panel'><div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8 md:py-24'><div className='grid max-w-4xl gap-5'><p className='text-sm font-semibold uppercase text-ui-primary'>Security Scanner · safe validation</p><h1 className='text-4xl font-semibold md:text-6xl'>See exposure, changes, and the next control to review.</h1><p className='max-w-3xl text-lg leading-8 text-ui-muted'>Hanasand’s scanner runs bounded, identifiable checks against approved assets, preserves concrete results, and gives operators a history of every run. It validates controls without destructive exploit delivery.</p><Link href='/scanner' className='inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas'>Go to scanner workspace <ArrowRight className='h-4 w-4' /></Link></div><div className='grid gap-4 md:grid-cols-3'><Feature icon={<ShieldCheck className='h-5 w-5' />} title='Actionable results' detail='Review passed, warned, and failed controls with severity and target context.' /><Feature icon={<History className='h-5 w-5' />} title='Historical runs' detail='Compare current and previous scan durations, findings, and errors.' /><Feature icon={<CalendarClock className='h-5 w-5' />} title='Always scheduled' detail='Keep the Hanasand organization scanning continuously with an adjustable cadence.' /></div></div></section></main>
}

function Feature({ icon, title, detail }: { icon: React.ReactNode, title: string, detail: string }) { return <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4'><span className='text-ui-primary'>{icon}</span><h2 className='font-semibold'>{title}</h2><p className='text-sm leading-6 text-ui-muted'>{detail}</p></article> }
