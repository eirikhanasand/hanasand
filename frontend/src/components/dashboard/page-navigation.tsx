import Link from 'next/link'

export default function PageNavigation({ page, hasNext, href, label, total, limit = 50 }: {
    page: number, hasNext: boolean, href: (page: number) => string, label: string, total?: number, limit?: number
}) {
    const link = 'rounded-md border border-ui-border px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised'
    return <nav aria-label={label} className='flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm'>
        <span className='text-ui-muted'>Page {page}{total === undefined ? '' : ` of ${Math.max(Math.ceil(total / limit), 1)} · ${total} total`}</span>
        <div className='flex gap-2'>
            {page > 1 ? <Link className={link} href={href(page - 1)}>Previous</Link> : null}
            {hasNext ? <Link className={link} href={href(page + 1)}>Next</Link> : null}
        </div>
    </nav>
}
