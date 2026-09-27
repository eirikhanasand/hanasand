import { CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react'

export const scanNoticeTones = {
    info: {
        shell: 'border-ui-primary/30 bg-ui-primary/10',
        badge: 'border-ui-primary/30 bg-ui-primary/15 text-ui-primary',
        title: 'text-ui-primary',
        body: 'text-ui-primary',
        bar: 'bg-ui-primary',
        track: 'bg-ui-border',
        icon: LoaderCircle,
        iconClass: 'animate-spin',
    },
    success: {
        shell: 'border-ui-success/30 bg-ui-success/10',
        badge: 'border-ui-success/30 bg-ui-success/15 text-ui-success',
        title: 'text-ui-success',
        body: 'text-ui-success',
        bar: 'bg-ui-success',
        track: 'bg-ui-border',
        icon: ShieldCheck,
        iconClass: '',
    },
    error: {
        shell: 'border-ui-danger/30 bg-ui-raised/10',
        badge: 'border-ui-danger/30 bg-ui-raised/15 text-ui-text',
        title: 'text-ui-text',
        body: 'text-ui-text',
        bar: 'bg-ui-raised',
        track: 'bg-ui-border',
        icon: CircleAlert,
        iconClass: '',
    },
} as const
