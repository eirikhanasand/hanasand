import { getCookie, setCookie } from '@/utils/cookies/cookies'

export type DashboardViewMode = 'compact' | 'normal'

export const DASHBOARD_VIEW_MODE_COOKIE = 'dashboard_view_mode'

export function getDashboardViewMode() {
    const value = getCookie(DASHBOARD_VIEW_MODE_COOKIE)
    return value === 'compact' ? 'compact' : 'normal'
}

export function setDashboardViewMode(mode: DashboardViewMode) {
    setCookie(DASHBOARD_VIEW_MODE_COOKIE, mode, 365)
    window.dispatchEvent(new CustomEvent('dashboard-view-mode', { detail: mode }))
}
