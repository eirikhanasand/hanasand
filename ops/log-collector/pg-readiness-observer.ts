import { runReadinessObserver } from './readinessObserver.ts'

void runReadinessObserver({ stateDir: process.env.READINESS_OBSERVER_STATE_DIR ?? '/var/lib/hanasand-log-collector/readiness-facts' })
    .catch(() => { console.error('Readiness observer stopped; unverified audit records remain retained'); process.exitCode = 1 })
