'use client'


export default function ActionButton({ icon, children, onClick }: { icon: React.ReactNode; children: string; onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel px-2 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'>
            {icon}
            {children}
        </button>
    )
}
