'use client'

import { ArrowRight, Check, LoaderCircle, X } from 'lucide-react'
import styles from './workspaceSwitchNotice.module.css'

export type WorkspaceSwitchNoticeState = { name: string, from: string, complete: boolean }

export default function WorkspaceSwitchNotice({ notice, onDismiss }: { notice: WorkspaceSwitchNoticeState, onDismiss: () => void }) {
    const initials = notice.name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase()
    return <div className={styles.position}>
        <div className={styles.card} data-complete={notice.complete} data-workspace-notice>
            <div className={styles.identity} aria-hidden='true'>
                <span>{initials}</span>
                <span className={styles.badge}>{notice.complete ? <Check size={12} strokeWidth={3} /> : <LoaderCircle size={12} className='animate-spin motion-reduce:animate-none' />}</span>
            </div>
            <div className={styles.content} role='status' aria-live='polite' aria-atomic='true'>
                <p className={styles.label}>{notice.complete ? 'Workspace active' : 'Switching workspace'}</p>
                <p className={styles.name}>{notice.name}</p>
                <span className='sr-only'>{notice.complete ? `Switched to ${notice.name}` : `Switching to ${notice.name}`}</span>
                <p className={styles.journey} aria-hidden='true'><span>{notice.from}</span><ArrowRight size={12} /><span>{notice.complete ? 'Connected' : 'Connecting'}</span></p>
            </div>
            <button type='button' className={styles.dismiss} aria-label='Dismiss workspace notification' onClick={onDismiss}><X size={15} /></button>
            <span key={String(notice.complete)} className={styles.progress} aria-hidden='true' />
        </div>
    </div>
}
