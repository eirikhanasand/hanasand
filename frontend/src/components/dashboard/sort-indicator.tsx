export default function SortIndicator({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) {
    if (!active) return null

    return <span aria-hidden='true' className='inline-flex flex-col text-[8px] leading-[7px]'>
        <span className={direction === 'asc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▲</span>
        <span className={direction === 'desc' ? 'text-ui-primary' : 'text-ui-muted/45'}>▼</span>
    </span>
}
