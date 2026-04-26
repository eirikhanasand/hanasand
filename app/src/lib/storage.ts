import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AiChatMessage, AppSettings, AuthenticatorEntry, SavedMailboxConnection } from '../types'

const SETTINGS_KEY = 'hanasand-mobile/settings'
const MAILBOX_CONNECTIONS_KEY = 'hanasand-mobile/mailbox-connections'
const AUTHENTICATOR_KEY = 'hanasand-mobile/authenticator'
const AI_CHAT_KEY = 'hanasand-mobile/ai-chat'

export const defaultSettings: AppSettings = {
    siteBaseUrl: 'https://hanasand.com',
    apiBaseUrl: 'https://hanasand.com/api',
    cdnBaseUrl: 'https://cdn.hanasand.com/api',
    authToken: '',
    userId: '',
    codexUrl: 'https://hanasand.com/ai',
    codexApiPath: '/tools/ai',
    vpnUrlScheme: 'ciscoanyconnect://',
    remoteDesktopHost: '',
    remoteDesktopUser: '',
    vncHost: '',
    serverBaseUrl: 'http://128.39.142.158',
    serverStartPath: '/start',
    serverStopPath: '/stop',
    serverLogsPath: '/logs',
}

export async function loadSettings() {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    try {
        return { ...defaultSettings, ...(JSON.parse(raw) as Partial<AppSettings>) }
    } catch {
        return defaultSettings
    }
}

export async function saveSettings(settings: AppSettings) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export async function loadMailboxConnections() {
    const raw = await AsyncStorage.getItem(MAILBOX_CONNECTIONS_KEY)
    if (!raw) return [] as SavedMailboxConnection[]
    try {
        return JSON.parse(raw) as SavedMailboxConnection[]
    } catch {
        return [] as SavedMailboxConnection[]
    }
}

export async function saveMailboxConnections(connections: SavedMailboxConnection[]) {
    await AsyncStorage.setItem(MAILBOX_CONNECTIONS_KEY, JSON.stringify(connections))
}

export async function loadAuthenticatorEntries() {
    const raw = await AsyncStorage.getItem(AUTHENTICATOR_KEY)
    if (!raw) return [] as AuthenticatorEntry[]
    try {
        return JSON.parse(raw) as AuthenticatorEntry[]
    } catch {
        return [] as AuthenticatorEntry[]
    }
}

export async function saveAuthenticatorEntries(entries: AuthenticatorEntry[]) {
    await AsyncStorage.setItem(AUTHENTICATOR_KEY, JSON.stringify(entries))
}

export async function loadAiChat() {
    const raw = await AsyncStorage.getItem(AI_CHAT_KEY)
    if (!raw) return [] as AiChatMessage[]
    try {
        return JSON.parse(raw) as AiChatMessage[]
    } catch {
        return [] as AiChatMessage[]
    }
}

export async function saveAiChat(messages: AiChatMessage[]) {
    await AsyncStorage.setItem(AI_CHAT_KEY, JSON.stringify(messages))
}
