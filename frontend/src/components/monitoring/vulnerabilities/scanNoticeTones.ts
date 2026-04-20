import { CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react'

export const scanNoticeTones = {
    info: {
        shell: 'border-sky-400/20 bg-sky-500/10',
        badge: 'border-sky-400/20 bg-sky-500/15 text-sky-200',
        title: 'text-sky-100',
        body: 'text-sky-100/80',
        bar: 'bg-sky-300',
        track: 'bg-sky-950/40',
        icon: LoaderCircle,
        iconClass: 'animate-spin',
    },
    success: {
        shell: 'border-emerald-400/20 bg-emerald-500/10',
        badge: 'border-emerald-400/20 bg-emerald-500/15 text-emerald-200',
        title: 'text-emerald-100',
        body: 'text-emerald-100/80',
        bar: 'bg-emerald-300',
        track: 'bg-emerald-950/40',
        icon: ShieldCheck,
        iconClass: '',
    },
    error: {
        shell: 'border-rose-400/20 bg-rose-500/10',
        badge: 'border-rose-400/20 bg-rose-500/15 text-rose-200',
        title: 'text-rose-100',
        body: 'text-rose-100/80',
        bar: 'bg-rose-300',
        track: 'bg-rose-950/40',
        icon: CircleAlert,
        iconClass: '',
    },
} as const
