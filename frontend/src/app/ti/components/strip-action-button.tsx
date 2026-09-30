'use client'


export default function StripActionButton({ icon, children, onClick, href, disabled = false, iconOnly = false }: { icon: React.ReactNode; children: string; onClick: () => void; href?: string; disabled?: boolean; iconOnly?: boolean }) {
    const className = `inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-ui-border bg-ui-panel py-1.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised dark:disabled:bg-ui-raised dark:disabled:text-ui-muted ${iconOnly ? 'px-1.5' : 'px-2.5'}`
    const label = iconOnly ? <span className='sr-only'>{children}</span> : children
    if (href && !disabled) {
        return (
            <a href={href} onClick={onClick} className={className} aria-label={iconOnly ? children : undefined} title={iconOnly ? children : undefined}>
                {icon}
                {label}
            </a>
        )
    }
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            className={className}
            aria-label={iconOnly ? children : undefined}
            title={iconOnly ? children : undefined}
        >
            {icon}
            {label}
        </button>
    )
}
