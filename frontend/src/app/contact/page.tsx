import type { Metadata } from 'next'
import Contact from '@/components/contact/contact'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Contact',
    description: 'Contact Hanasand for collaboration, project work, or questions.',
    path: '/contact',
    keywords: ['contact', 'hanasand', 'developer'],
})

export default function page() {
    return <Contact />
}
