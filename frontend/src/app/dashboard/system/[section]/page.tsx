import { notFound } from 'next/navigation'
import SystemPageContent from '../systemPageContent'

const sections = ['virtual-machines', 'containers'] as const

type SystemSection = typeof sections[number]

export default async function page({ params }: { params: Promise<{ section: string }> }) {
    const { section } = await params
    if (!sections.includes(section as SystemSection)) notFound()
    return <SystemPageContent section={section as SystemSection} />
}
