type ActorMarkProps = {
    name: string
    size?: 'sm' | 'md'
}

export function ActorMark({ name, size = 'sm' }: ActorMarkProps) {
    const initials = name.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'TI'
    const large = size === 'md'
    const variant = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 3
    return (
        <span className={`relative grid ${large ? 'h-14 w-14 rounded-xl' : 'h-full w-full rounded-md'} place-items-center overflow-hidden bg-ui-primary/15 text-ui-primary`} role='img' aria-label={`${name} actor mark`}>
            <svg aria-hidden='true' viewBox='0 0 40 40' className={`absolute inset-0 h-full w-full ${large ? 'p-2' : 'p-1'}`} fill='none'>
                {variant === 0 ? <>
                    <path d='M20 3 34 9v10c0 9-5.9 15.2-14 18C11.9 34.2 6 28 6 19V9l14-6Z' stroke='currentColor' strokeWidth='1.5' opacity='.7' />
                    <path d='M12 20h16M20 12v16M14.5 14.5l11 11M25.5 14.5l-11 11' stroke='currentColor' strokeWidth='1' opacity='.45' />
                </> : variant === 1 ? <>
                    <circle cx='20' cy='20' r='14' stroke='currentColor' strokeWidth='1.5' opacity='.7' />
                    <path d='M7 20c4-6 22-6 26 0-4 6-22 6-26 0Z' stroke='currentColor' strokeWidth='1' opacity='.5' />
                    <circle cx='20' cy='20' r='3' fill='currentColor' opacity='.65' />
                </> : <>
                    <path d='m20 4 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1 4-8Z' stroke='currentColor' strokeWidth='1.5' opacity='.7' />
                    <path d='M13 20h14M16 16l8 8M24 16l-8 8' stroke='currentColor' strokeWidth='1' opacity='.45' />
                </>}
            </svg>
            <span className={`relative font-bold tracking-wide ${large ? 'text-sm' : 'text-[10px]'}`}>{initials}</span>
        </span>
    )
}
