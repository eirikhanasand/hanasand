import { identifiedSheets } from '@/app/thesis/workspace'

export type ThesisNavigationLink = { label: string, href: string }

export function thesisNavigationFromDocument(document: { title: string, body: string }): ThesisNavigationLink[] {
    return identifiedSheets(document.title, document.body).map(sheet => ({
        label: sheet.name,
        href: `/thesis?sheet=${encodeURIComponent(sheet.name.trim().toLowerCase() === 'code' ? 'code' : sheet.id || '')}`,
    }))
}
