'use client'


export default function MapZoomButton({ label, onClick, wide = false }: { label: string; onClick: () => void; wide?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`min-h-8 rounded-md border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${wide ? 'min-w-16' : 'min-w-8'}`}
        >
            {label}
        </button>
    )
}
