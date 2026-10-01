import { getCookie, removeCookies, setCookieWithExpiresAt } from '@/utils/cookies/cookies'

const STORAGE_KEY = 'hanasand:saved-profiles:v1'
const MAX_SAVED_PROFILES = 20

export type SavedProfile = {
    id: string
    name: string
    avatar: string | null
    token: string
    expiresAt: string | null
    lastUsedAt: string
}

export function readSavedProfiles(): SavedProfile[] {
    try {
        const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
        if (!Array.isArray(value)) return []
        return value
            .filter((profile): profile is Record<string, unknown> => Boolean(profile) && typeof profile === 'object')
            .filter(profile => typeof profile.id === 'string' && profile.id.trim())
            .map(profile => ({
                id: String(profile.id).slice(0, 254),
                name: typeof profile.name === 'string' && profile.name.trim() ? profile.name.slice(0, 254) : String(profile.id).slice(0, 254),
                avatar: typeof profile.avatar === 'string' ? profile.avatar.slice(0, 4096) : null,
                token: typeof profile.token === 'string' ? profile.token.slice(0, 8192) : '',
                expiresAt: typeof profile.expiresAt === 'string' ? profile.expiresAt : null,
                lastUsedAt: typeof profile.lastUsedAt === 'string' ? profile.lastUsedAt : '',
            }))
            .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
            .slice(0, MAX_SAVED_PROFILES)
    } catch {
        return []
    }
}

export function rememberCurrentProfile(): SavedProfile | null {
    const id = getCookie('id')
    const token = getCookie('access_token')
    if (!id || !token) return null

    const profile = {
        id,
        name: getCookie('name') || id,
        avatar: getCookie('avatar') || null,
        token,
        expiresAt: getCookie('session_expires_at'),
        lastUsedAt: new Date().toISOString(),
    }
    saveProfile(profile)
    return profile
}

export function saveProfile(profile: SavedProfile) {
    const profiles = readSavedProfiles().filter(saved => saved.id !== profile.id)
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([profile, ...profiles].slice(0, MAX_SAVED_PROFILES)))
    } catch {
        // Keep switching available for this visit if browser storage is disabled.
    }
}

export function isSavedSessionExpired(profile: SavedProfile) {
    if (!profile.token) return true
    if (!profile.expiresAt) return false
    const expiresAt = Date.parse(profile.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}

export function clearSavedProfileSession(id: string) {
    const profiles = readSavedProfiles().map(profile => profile.id === id
        ? { ...profile, token: '', expiresAt: null }
        : profile)
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
    } catch {
        // The next sign-in can still replace the active cookies.
    }
}

export function restoreSavedProfile(profile: SavedProfile) {
    setCookieWithExpiresAt('id', profile.id, profile.expiresAt)
    setCookieWithExpiresAt('name', profile.name, profile.expiresAt)
    setCookieWithExpiresAt('avatar', profile.avatar || '', profile.expiresAt)
    setCookieWithExpiresAt('access_token', profile.token, profile.expiresAt)
    setCookieWithExpiresAt('session_expires_at', profile.expiresAt || '', profile.expiresAt)
    setCookieWithExpiresAt('auth_checked_at', new Date().toISOString(), profile.expiresAt)
    removeCookies('roles', 'impersonation_token', 'impersonating_id', 'impersonating_name')
}

export function clearSavedProfiles() {
    try {
        window.localStorage.removeItem(STORAGE_KEY)
    } catch {
        // Continue signing out even if browser storage is unavailable.
    }
}

export function clearActiveProfileCookies() {
    removeCookies('name', 'access_token', 'id', 'avatar', 'roles', 'session_expires_at', 'auth_checked_at', 'impersonation_token', 'impersonating_id', 'impersonating_name')
}
