import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, FileSearch, Radio, ShieldAlert } from 'lucide-react'
import { buildRouteMetadata } from '../../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Mill log monitoring',
    description: 'Send JSON security events to Hanasand Mill for suspicious-login detection and analyst review.',
    path: '/solutions/mill',
    keywords: ['MDR log monitoring', 'suspicious login detection', 'impossible travel', 'JSON security events'],
})

export default function MillSolutionPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-16 md:px-8 md:py-24'>
                    <div className='grid max-w-4xl gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>Mill · managed detection</p>
                        <h1 className='text-4xl font-semibold md:text-6xl'>Turn security logs into findings your team can investigate.</h1>
                        <p className='max-w-3xl text-lg leading-8 text-ui-muted'>Send JSON events to one Hanasand endpoint. Mill preserves the event context, checks authentication behavior, and gives analysts evidence for suspicious logins and impossible travel.</p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/dashboard/mill' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas'>Open Mill workspace <ArrowRight className='h-4 w-4' /></Link>
                            <Link href='/developers' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text'>View API docs</Link>
                        </div>
                    </div>
                    <div className='grid gap-4 md:grid-cols-3'>
                        <Feature icon={<Radio className='h-5 w-5' />} title='One endpoint' detail='POST JSON events to api.hanasand.com/mill using the organization API key.' />
                        <Feature icon={<ShieldAlert className='h-5 w-5' />} title='Useful first detections' detail='Start with repeated failures, new countries, and geographically incompatible logins.' />
                        <Feature icon={<FileSearch className='h-5 w-5' />} title='Evidence-first review' detail='Inspect the matching events, rule ID, source context, and original event sample.' />
                    </div>
                </div>
            </section>
            <section className='mx-auto grid max-w-7xl gap-5 px-4 py-12 md:px-8 lg:grid-cols-2'>
                <div className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Send an event</p>
                    <pre className='mt-4 overflow-auto rounded-lg border border-ui-border bg-ui-canvas p-4 text-xs leading-6 text-ui-muted'>{'POST https://api.hanasand.com/mill\nAuthorization: Bearer hsk_<organization-key>\nContent-Type: application/json\n\n{\n  "events": [{\n    "timestamp": "2026-08-03T08:15:00Z",\n    "event_type": "authentication",\n    "action": "login",\n    "outcome": "success",\n    "user": {"id": "user-123"},\n    "source": {"ip": "203.0.113.10", "country": "NO"}\n  }]\n}'}</pre>
                </div>
                <div className='grid content-start gap-4 rounded-lg border border-ui-border bg-ui-panel p-5'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>First release scope</p>
                    <h2 className='text-2xl font-semibold'>A working MDR starting point, not a generic log dump.</h2>
                    <p className='text-sm leading-6 text-ui-muted'>Mill is built on the existing Hanasand organization, API-key, tenant, and analyst workflows. Vendor adapters and broader rule families can feed the same event model later without creating a second portal.</p>
                    <ul className='grid gap-3 text-sm text-ui-text'><li>• Suspicious login review queue</li><li>• Impossible-travel evidence</li><li>• Tenant-scoped raw and normalized events</li><li>• Extensible path for Sigma and Hanasand rules</li></ul>
                </div>
            </section>
        </main>
    )
}

function Feature({ icon, title, detail }: { icon: React.ReactNode, title: string, detail: string }) {
    return <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4'><span className='text-ui-primary'>{icon}</span><h2 className='font-semibold'>{title}</h2><p className='text-sm leading-6 text-ui-muted'>{detail}</p></article>
}
