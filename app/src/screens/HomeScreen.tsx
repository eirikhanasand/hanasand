import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ArrowUp, FolderKanban, Image as ImageIcon, Mail, MonitorCog, ScanLine, Server, Sparkles, Square, StickyNote, TerminalSquare } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { AiChatMessage, AppSettings, DesktopAgentStatus, GptClient, RootTabParamList } from '../types'
import { askCodex, fetchDesktopAgentStatus, fetchDesktopScreenshot, runDesktopAgentCommand } from '../lib/api'
import { GlassCard, Screen } from '../components/ui'
import { spacing, type ThemePalette } from '../theme/tokens'
import { useAppTheme } from '../theme/context'

type QuickAction = {
    key: string
    title: string
    icon: typeof MonitorCog
    route?: keyof RootTabParamList
}

const quickActions: QuickAction[] = [
    { key: 'pc', title: 'PC', icon: MonitorCog },
    { key: 'rdp', title: 'RDP', icon: MonitorCog },
    { key: 'server', title: 'Server', icon: Server, route: 'Control' },
    { key: 'mail', title: 'Mail', icon: Mail, route: 'Mail' },
    { key: 'scan', title: 'Scan', icon: ScanLine, route: 'Scan' },
    { key: 'notes', title: 'Notes', icon: StickyNote, route: 'Notes' },
    { key: 'images', title: 'Images', icon: ImageIcon, route: 'Images' },
    { key: 'control', title: 'Ops', icon: TerminalSquare, route: 'Control' },
    { key: 'shares', title: 'Shares', icon: FolderKanban, route: 'Control' },
]

type GptSocketMessage =
  | { type: 'snapshot'; clients?: GptClient[] }
  | { type: 'update'; client?: GptClient }
  | { type: 'prompt_started'; conversationId?: string; clientName?: string | null }
  | { type: 'prompt_delta'; conversationId?: string; delta?: string }
  | { type: 'prompt_complete'; conversationId?: string }
  | { type: 'prompt_error'; conversationId?: string; error?: string }

function toWsUrl(apiBaseUrl: string) {
    const normalized = apiBaseUrl.trim().replace(/\/+$/, '')
    if (normalized.startsWith('https://')) return `wss://${normalized.slice('https://'.length)}`
    if (normalized.startsWith('http://')) return `ws://${normalized.slice('http://'.length)}`
    return normalized
}

function formatDuration(durationMs?: number) {
    if (!durationMs) return ''
    if (durationMs < 1000) return `${Math.round(durationMs)} ms`
    return `${(durationMs / 1000).toFixed(1)} s`
}

export function HomeScreen({
    settings,
    aiMessages,
    onSaveAiMessages,
}: {
    settings: AppSettings
    aiMessages: AiChatMessage[]
    onSaveAiMessages: (messages: AiChatMessage[]) => Promise<void>
}) {
    const theme = useAppTheme()
    const styles = useMemo(() => createStyles(theme), [theme])
    const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>()
    const [prompt, setPrompt] = useState('')
    const [busy, setBusy] = useState(false)
    const [clients, setClients] = useState<GptClient[]>([])
    const [socketConnected, setSocketConnected] = useState(false)
    const [desktopStatus, setDesktopStatus] = useState<DesktopAgentStatus | null>(null)
    const [desktopIssue, setDesktopIssue] = useState('')
    const [remoteDesktopMessage, setRemoteDesktopMessage] = useState('')
    const [desktopScreenshotUri, setDesktopScreenshotUri] = useState('')
    const [screenPreviewSize, setScreenPreviewSize] = useState({ width: 1, height: 1 })
    const [remoteKeyboardText, setRemoteKeyboardText] = useState('')
    const [remoteKeyboardVisible, setRemoteKeyboardVisible] = useState(true)
    const [liveScreen, setLiveScreen] = useState(false)
    const [infraBusy, setInfraBusy] = useState('')
    const remoteKeyboardInputRef = useRef<TextInput | null>(null)
    const activeConversationRef = useRef<string | null>(null)
    const socketRef = useRef<WebSocket | null>(null)
    const aiMessagesRef = useRef(aiMessages)
    const saveAiMessagesRef = useRef(onSaveAiMessages)
    const runTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        aiMessagesRef.current = aiMessages
    }, [aiMessages])

    useEffect(() => {
        saveAiMessagesRef.current = onSaveAiMessages
    }, [onSaveAiMessages])

    async function saveMessages(next: AiChatMessage[]) {
        aiMessagesRef.current = next
        await saveAiMessagesRef.current(next)
    }

    function clearRunTimeout() {
        if (runTimeoutRef.current) {
            clearTimeout(runTimeoutRef.current)
            runTimeoutRef.current = null
        }
    }

    function finishRun() {
        clearRunTimeout()
        activeConversationRef.current = null
        setBusy(false)
    }

    function startRunTimeout(conversationId: string) {
        clearRunTimeout()
        runTimeoutRef.current = setTimeout(() => {
            if (activeConversationRef.current !== conversationId) return
            finishRun()
            void saveMessages(aiMessagesRef.current.map(entry => entry.id === `${conversationId}-assistant`
                ? { ...entry, content: entry.content || 'The model did not finish this run in time.', pending: false, error: true }
                : entry))
        }, 90_000)
    }

    function failActiveSocketRun(message: string) {
        const conversationId = activeConversationRef.current
        if (!conversationId) return
        finishRun()
        void saveMessages(aiMessagesRef.current.map(entry => entry.id === `${conversationId}-assistant`
            ? { ...entry, content: entry.content || message, pending: false, error: true }
            : entry))
    }

    useEffect(() => clearRunTimeout, [])

    useEffect(() => {
        void refreshDesktopStatus(false)
    }, [settings.desktopAgentBaseUrl])

    useEffect(() => {
        if (!liveScreen) return undefined
        let cancelled = false
        const tick = async () => {
            if (cancelled) return
            try {
                const screenshot = await fetchDesktopScreenshot(settings)
                if (!cancelled) {
                    setDesktopScreenshotUri(`data:${screenshot.mimeType || 'image/png'};base64,${screenshot.imageBase64}`)
                    setRemoteDesktopMessage(screenshot.message || 'Live Mac screen updated.')
                }
            } catch (cause) {
                if (!cancelled) {
                    setRemoteDesktopMessage(cause instanceof Error ? cause.message : 'Live Mac screen failed.')
                    setLiveScreen(false)
                }
            }
        }
        void tick()
        const timer = setInterval(() => void tick(), 1200)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [liveScreen, settings.desktopAgentBaseUrl])

    useEffect(() => {
        function handleRemoteControlUrl(url: string | null) {
            if (!url) return
            const normalized = url.toLowerCase()
            if (normalized.includes('remote-proof') || normalized.includes('rdp-proof')) {
                void runRemoteDesktopCommand('remote_desktop_proof', 'RDP proof')
            } else if (normalized.includes('mac-full-proof') || normalized.includes('full-control-proof')) {
                void runRemoteDesktopCommand('mac_control_full_proof', 'Full control proof')
            } else if (normalized.includes('mac-authorize') || normalized.includes('remote-permissions')) {
                void runRemoteDesktopCommand('mac_control_authorize', 'Authorize Mac')
            } else if (normalized.includes('codex-proof') || normalized.includes('mac-codex-proof')) {
                void runDesktopCodexPrompt('Create a tiny proof that the phone can prompt Codex on this Mac. Write /tmp/hanasand-phone-codex-flow.txt and then answer with the proof token.')
            } else if (normalized.includes('mac-textedit-proof') || normalized.includes('textedit-proof')) {
                void runRemoteDesktopCommand('mac_control_textedit_proof', 'Mac proof')
            } else if (normalized.includes('mac-keyboard-proof') || normalized.includes('keyboard-proof')) {
                void runRemoteDesktopCommand('mac_control_keyboard_proof', 'Keyboard proof')
            } else if (normalized.includes('mac-move-pointer') || normalized.includes('move-pointer')) {
                void runRemoteDesktopCommand('mac_control_pointer_move', 'Move pointer')
            } else if (normalized.includes('mac-click-pointer') || normalized.includes('click-pointer')) {
                void runRemoteDesktopCommand('mac_control_pointer_click', 'Click pointer')
            } else if (normalized.includes('mac-screen') || normalized.includes('screen-proof')) {
                void refreshDesktopScreenshot()
            } else if (normalized.includes('mac-live-screen') || normalized.includes('live-screen')) {
                setLiveScreen(true)
            } else if (normalized.includes('mac-search') || normalized.includes('cmd-space')) {
                void runRemoteDesktopCommand('mac_control_key_search', 'Go/Search')
            } else if (normalized.includes('mac-enter')) {
                void runRemoteDesktopCommand('mac_control_key_enter', 'Enter')
            } else if (normalized.includes('mac-finder') || normalized.includes('finder-proof')) {
                void runRemoteDesktopCommand('mac_control_finder', 'Finder')
            } else if (normalized.includes('remote-connect') || normalized.includes('rdp-connect')) {
                void runRemoteDesktopCommand('remote_desktop_connect', 'RDP connect')
            } else if (normalized.includes('remote-tunnel') || normalized.includes('rdp-tunnel')) {
                void runRemoteDesktopCommand('remote_desktop_tunnel', 'RDP tunnel')
            }
        }

        void Linking.getInitialURL().then(handleRemoteControlUrl).catch(() => undefined)
        const subscription = Linking.addEventListener('url', event => handleRemoteControlUrl(event.url))
        return () => subscription.remove()
    }, [settings.desktopAgentBaseUrl])

    useEffect(() => {
        if (!settings.apiBaseUrl.trim()) {
            socketRef.current?.close()
            socketRef.current = null
            setSocketConnected(false)
            setClients([])
            return
        }

        const ws = new WebSocket(`${toWsUrl(settings.apiBaseUrl)}/client/ws/gpt`)
        socketRef.current = ws

        ws.onopen = () => setSocketConnected(true)
        ws.onclose = () => {
            setSocketConnected(false)
            socketRef.current = null
            failActiveSocketRun('The live model connection closed before the answer finished.')
        }
        ws.onerror = () => {
            setSocketConnected(false)
            failActiveSocketRun('The live model connection failed before the answer finished.')
        }
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as GptSocketMessage
                if (message.type === 'snapshot') {
                    setClients(Array.isArray(message.clients) ? message.clients : [])
                    return
                }

                if (message.type === 'update' && message.client) {
                    setClients(current => {
                        const existing = current.find(client => client.name === message.client?.name)
                        return existing
                            ? current.map(client => client.name === message.client?.name ? (message.client as GptClient) : client)
                            : [...current, message.client as GptClient]
                    })
                    return
                }

                if (!('conversationId' in message) || !message.conversationId || message.conversationId !== activeConversationRef.current) {
                    return
                }

                if (message.type === 'prompt_started') {
                    const assistantId = `${message.conversationId}-assistant`
                    if (!aiMessagesRef.current.some(entry => entry.id === assistantId)) {
                        void saveMessages([
                            ...aiMessagesRef.current,
                            { id: assistantId, role: 'assistant', content: '', createdAt: Date.now(), pending: true },
                        ])
                    }
                    return
                }

                if (message.type === 'prompt_delta') {
                    const assistantId = `${message.conversationId}-assistant`
                    const current = aiMessagesRef.current
                    const next = current.some(entry => entry.id === assistantId)
                        ? current.map(entry => entry.id === assistantId
                            ? { ...entry, content: `${entry.content}${message.delta || ''}`, pending: true }
                            : entry)
                        : [
                            ...current,
                            { id: assistantId, role: 'assistant' as const, content: message.delta || '', createdAt: Date.now(), pending: true },
                        ]
                    void saveMessages(next)
                    return
                }

                if (message.type === 'prompt_complete') {
                    finishRun()
                    void saveMessages(aiMessagesRef.current.map(entry => entry.id === `${message.conversationId}-assistant` ? { ...entry, pending: false } : entry))
                    return
                }

                if (message.type === 'prompt_error') {
                    finishRun()
                    void saveMessages(aiMessagesRef.current.map(entry => entry.id === `${message.conversationId}-assistant`
                        ? { ...entry, content: message.error || 'The model failed to answer this prompt.', pending: false, error: true }
                        : entry))
                }
            } catch {
                setSocketConnected(false)
                failActiveSocketRun('The live model returned an unreadable response.')
            }
        }

        return () => ws.close()
    }, [settings.apiBaseUrl])

    const bestClient = useMemo(() => [...clients].sort((a, b) => (b.model?.tps || 0) - (a.model?.tps || 0))[0] || null, [clients])
    const latestMessages = useMemo(() => aiMessages.slice(-10), [aiMessages])
    async function refreshDesktopStatus(addChatMessage = true) {
        setDesktopIssue('')
        setInfraBusy('pc')
        try {
            const status = await fetchDesktopAgentStatus(settings)
            setDesktopStatus(status)
            if (!addChatMessage && status.ok) {
                setTimeout(() => void refreshDesktopScreenshot(), 250)
            }
            if (addChatMessage) {
                await saveMessages([
                    ...aiMessagesRef.current,
                    {
                        id: `${Date.now()}-assistant`,
                        role: 'assistant',
                        content: `This Mac is reachable: ${status.hostname || 'local host'} on ${status.platform || 'desktop'}${status.cwd ? `, cwd ${status.cwd}` : ''}.`,
                        createdAt: Date.now(),
                    },
                ])
            }
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Desktop agent unavailable.'
            setDesktopIssue(message)
            if (addChatMessage) {
                await saveMessages([
                    ...aiMessagesRef.current,
                    { id: `${Date.now()}-assistant`, role: 'assistant', content: `Desktop agent is not connected yet: ${message}`, createdAt: Date.now(), error: true },
                ])
            }
        } finally {
            setInfraBusy('')
        }
    }

    async function runPcStatusCommand() {
        setDesktopIssue('')
        setInfraBusy('pc')
        try {
            const status = await runDesktopAgentCommand(settings, 'status')
            setDesktopStatus(status)
            await saveMessages([
                ...aiMessagesRef.current,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    content: `PC command ran successfully. Host: ${status.hostname || 'local'}, platform: ${status.platform || 'unknown'}, uptime: ${Math.floor((status.uptimeSeconds || 0) / 60)} min.`,
                    createdAt: Date.now(),
                },
            ])
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'PC command failed.'
            setDesktopIssue(message)
        } finally {
            setInfraBusy('')
        }
    }

    async function runRemoteDesktopCommand(command: string, label: string) {
        setDesktopIssue('')
        setInfraBusy('rdp')
        try {
            const status = await runDesktopAgentCommand(settings, command)
            setDesktopStatus(status)
            setRemoteDesktopMessage(status.message || `${label} sent to this Mac.`)
            await saveMessages([
                ...aiMessagesRef.current,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    content: `${label} sent to this Mac. ${status.message || 'Open Hanasand Desktop to see the reflected state.'}`,
                    createdAt: Date.now(),
                },
            ])
            if (liveScreen || desktopScreenshotUri) {
                setTimeout(() => void refreshDesktopScreenshot(), 350)
            }
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : `${label} failed.`
            setDesktopIssue(message)
            setRemoteDesktopMessage(message)
        } finally {
            setInfraBusy('')
        }
    }

    function remoteCodexPromptFromText(value: string) {
        const trimmed = value.trim()
        const lower = trimmed.toLowerCase()
        if (lower.startsWith('codex:')) return trimmed.slice('codex:'.length).trim()
        if (lower.startsWith('codex ')) return trimmed.slice('codex '.length).trim()
        if (lower.startsWith('mac codex:')) return trimmed.slice('mac codex:'.length).trim()
        if (lower.includes(' on my pc') || lower.includes(' on this mac') || lower.includes(' on the mac')) return trimmed
        return ''
    }

    async function runDesktopCodexPrompt(value: string) {
        const desktopPrompt = value.trim()
        if (!desktopPrompt) return
        setDesktopIssue('')
        setInfraBusy('rdp')
        try {
            const status = await runDesktopAgentCommand(settings, `codex_prompt:${encodeURIComponent(desktopPrompt)}`)
            setDesktopStatus(status)
            const message = status.message || 'Codex prompt queued on this Mac.'
            setRemoteDesktopMessage(message)
            await saveMessages([
                ...aiMessagesRef.current,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    content: `Mac Codex: ${message}`,
                    createdAt: Date.now(),
                },
            ])
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Mac Codex prompt failed.'
            setDesktopIssue(message)
            setRemoteDesktopMessage(message)
            await saveMessages([
                ...aiMessagesRef.current,
                { id: `${Date.now()}-assistant`, role: 'assistant', content: message, createdAt: Date.now(), error: true },
            ])
        } finally {
            setInfraBusy('')
        }
    }

    async function refreshDesktopScreenshot() {
        setDesktopIssue('')
        setInfraBusy('screen')
        try {
            const screenshot = await fetchDesktopScreenshot(settings)
            setDesktopScreenshotUri(`data:${screenshot.mimeType || 'image/png'};base64,${screenshot.imageBase64}`)
            setRemoteDesktopMessage(screenshot.message || 'Mac screen captured in the app.')
        } catch (cause) {
            const message = cause instanceof Error ? cause.message : 'Mac screen capture failed.'
            setDesktopIssue(message)
            setRemoteDesktopMessage(message)
        } finally {
            setInfraBusy('')
        }
    }

    async function clickDesktopPreview(locationX: number, locationY: number) {
        const width = Math.max(screenPreviewSize.width, 1)
        const height = Math.max(screenPreviewSize.height, 1)
        const x = Math.min(Math.max(locationX / width, 0), 1).toFixed(4)
        const y = Math.min(Math.max(locationY / height, 0), 1).toFixed(4)
        await runRemoteDesktopCommand(`mac_control_pointer_click_at:${x}:${y}`, 'Preview click')
        await refreshDesktopScreenshot()
    }

    async function typeRemoteKeyboardText() {
        const value = remoteKeyboardText.trim()
        if (!value) {
            await runRemoteDesktopCommand('mac_control_keyboard_proof', 'Keyboard proof')
            return
        }
        await runRemoteDesktopCommand(`mac_control_type_text:${encodeURIComponent(value)}`, 'Type text')
        setRemoteKeyboardText('')
        await refreshDesktopScreenshot()
    }

    function showRemoteKeyboard() {
        setRemoteKeyboardVisible(true)
        setTimeout(() => {
            remoteKeyboardInputRef.current?.focus()
        }, 80)
    }

    async function handleQuickAction(action: QuickAction) {
        if (action.key === 'pc') {
            await runPcStatusCommand()
            return
        }
        if (action.key === 'rdp') {
            await runRemoteDesktopCommand('remote_desktop_proof', 'RDP proof')
            return
        }
        if (action.route) {
            navigation.navigate(action.route)
        }
    }

    async function submitPrompt() {
        const trimmed = prompt.trim()
        if (busy) return
        if (!trimmed) {
            Alert.alert('Empty prompt', 'Type a prompt first.')
            return
        }

        const userMessage: AiChatMessage = { id: `${Date.now()}-user`, role: 'user', content: trimmed, createdAt: Date.now() }
        const baseMessages = [...aiMessagesRef.current, userMessage]
        await saveMessages(baseMessages)
        setPrompt('')
        setBusy(true)

        const desktopCodexPrompt = remoteCodexPromptFromText(trimmed)
        if (desktopCodexPrompt) {
            await runDesktopCodexPrompt(desktopCodexPrompt)
            setBusy(false)
            return
        }

        const socket = socketRef.current
        if (socket && socket.readyState === WebSocket.OPEN && bestClient) {
            const conversationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
            activeConversationRef.current = conversationId
            const withPending = [...baseMessages, { id: `${conversationId}-assistant`, role: 'assistant' as const, content: '', createdAt: Date.now(), pending: true }]
            await saveMessages(withPending)
            socket.send(JSON.stringify({
                type: 'prompt_request',
                conversationId,
                clientName: bestClient.name,
                messages: baseMessages.map(message => ({ role: message.role, content: message.content })),
                maxTokens: 512,
                temperature: 0.7,
            }))
            startRunTimeout(conversationId)
            return
        }

        try {
            const context = aiMessagesRef.current.slice(-10).map(message => `${message.role}: ${message.content}`).join('\n')
            const reply = await askCodex(settings, trimmed, context)
            await saveMessages([
                ...baseMessages,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    content: reply.message,
                    createdAt: Date.now(),
                    durationMs: reply.durationMs,
                    thoughtSummary: reply.thoughtSummary,
                    toolUses: reply.toolUses,
                    fileSummaries: reply.fileSummaries,
                },
            ])
        } catch (cause) {
            await saveMessages([
                ...baseMessages,
                { id: `${Date.now()}-assistant`, role: 'assistant', content: cause instanceof Error ? cause.message : 'Codex request failed.', createdAt: Date.now(), error: true },
            ])
        } finally {
            setBusy(false)
        }
    }

    function clearChat() {
        if (busy || !aiMessages.length) return
        Alert.alert('Clear chat?', 'The saved AI conversation on this device will be removed.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear',
                style: 'destructive',
                onPress: () => void saveMessages([]),
            },
        ])
    }

    return (
        <Screen title='Hanasand AI' subtitle=''>
            <GlassCard style={styles.commandCard}>
                <View style={styles.promptShell}>
                    <Sparkles color={theme.textMuted} size={18} strokeWidth={2.2} />
                    <TextInput
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder='Ask Hanasand AI...'
                        placeholderTextColor={theme.textSoft}
                        style={styles.promptInput}
                        returnKeyType='send'
                        onSubmitEditing={() => void submitPrompt()}
                        autoFocus
                    />
                    {prompt.trim() ? (
                        <Pressable
                            disabled={busy}
                            accessibilityRole='button'
                            accessibilityLabel='Send prompt'
                            accessibilityState={{ disabled: busy }}
                            onPress={() => void submitPrompt()}
                            style={({ pressed }) => [styles.promptArrowButton, busy && styles.disabled, pressed && !busy && styles.pressed]}
                        >
                            {busy ? <Square color={theme.background} size={13} fill={theme.background} /> : <ArrowUp color={theme.background} size={15} strokeWidth={2.8} />}
                        </Pressable>
                    ) : null}
                </View>
                {socketConnected && bestClient && (
                    <View style={styles.statusRow}>
                        <Text style={styles.statusText}>{bestClient.name}{bestClient.model?.tps ? ` · ${bestClient.model.tps.toFixed(1)} tps` : ''}</Text>
                    </View>
                )}
                <View style={styles.infraStrip}>
                    <View style={[styles.infraDot, desktopStatus?.ok ? styles.infraDotLive : styles.infraDotIdle]} />
                    <Text style={styles.infraText} numberOfLines={2}>
                        {desktopStatus?.ok
                            ? `Mac online: ${desktopStatus.hostname || 'localhost'} · ${desktopStatus.platform || 'desktop'}`
                            : desktopIssue
                                ? `Mac agent: ${desktopIssue}`
                                : 'Mac agent: checking...'}
                    </Text>
                </View>
                {desktopStatus?.ok && (desktopStatus.screenCaptureAllowed === false || desktopStatus.accessibilityAllowed === false) && (
                    <View style={styles.permissionStrip}>
                        <Text style={styles.permissionText}>
                            {desktopStatus.screenCaptureAllowed === false && desktopStatus.accessibilityAllowed === false
                                ? 'Mac needs Screen Recording + Accessibility.'
                                : desktopStatus.screenCaptureAllowed === false
                                    ? 'Mac needs Screen Recording.'
                                    : 'Mac needs Accessibility.'}
                        </Text>
                        <Pressable
                            accessibilityRole='button'
                            accessibilityLabel='Open Mac remote-control privacy permissions'
                            onPress={() => void runRemoteDesktopCommand('mac_control_authorize', 'Authorize Mac')}
                            style={({ pressed }) => [styles.remoteMiniButton, pressed && styles.pressed]}
                        >
                            <Text style={styles.remoteMiniButtonText}>Open</Text>
                        </Pressable>
                    </View>
                )}
                <View style={styles.remoteButtonRow}>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Send remote proof to this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('remote_desktop_proof', 'RDP proof')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>{infraBusy === 'rdp' ? 'Sending...' : 'Proof PC'}</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Request remote desktop connection on this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('remote_desktop_connect', 'RDP connect')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Connect</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Request remote desktop tunnel on this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('remote_desktop_tunnel', 'RDP tunnel')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Tunnel</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Open TextEdit proof on this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('mac_control_textedit_proof', 'Mac proof')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Type proof</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Run full Mac control proof'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('mac_control_full_proof', 'Full control proof')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Full proof</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Type keyboard proof on this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('mac_control_keyboard_proof', 'Keyboard proof')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Keys</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Move mouse on this Mac'
                        disabled={infraBusy === 'rdp'}
                        onPress={() => void runRemoteDesktopCommand('mac_control_pointer_move', 'Move pointer')}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'rdp' && styles.disabled, pressed && infraBusy !== 'rdp' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Mouse</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Show Mac screen in this app'
                        disabled={infraBusy === 'screen'}
                        onPress={() => void refreshDesktopScreenshot()}
                        style={({ pressed }) => [styles.remoteButton, infraBusy === 'screen' && styles.disabled, pressed && infraBusy !== 'screen' && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>{infraBusy === 'screen' ? 'Loading...' : 'Screen'}</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Toggle live Mac screen'
                        onPress={() => setLiveScreen(current => !current)}
                        style={({ pressed }) => [styles.remoteButton, liveScreen && styles.remoteButtonActive, pressed && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>{liveScreen ? 'Live on' : 'Live'}</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Show remote keyboard controls'
                        onPress={showRemoteKeyboard}
                        style={({ pressed }) => [styles.remoteButton, remoteKeyboardVisible && styles.remoteButtonActive, pressed && styles.pressed]}
                    >
                        <Text style={styles.remoteButtonText}>Keyboard</Text>
                    </Pressable>
                </View>
                {!!remoteDesktopMessage && <Text style={styles.remoteStatusText} numberOfLines={2}>{remoteDesktopMessage}</Text>}
                {!!desktopScreenshotUri && (
                    <Pressable
                        accessibilityRole='button'
                        accessibilityLabel='Tap Mac screen preview to click the Mac'
                        onLayout={event => setScreenPreviewSize(event.nativeEvent.layout)}
                        onPress={event => void clickDesktopPreview(event.nativeEvent.locationX, event.nativeEvent.locationY)}
                        style={({ pressed }) => [styles.screenPreviewFrame, pressed && styles.pressed]}
                    >
                        <Image source={{ uri: desktopScreenshotUri }} style={styles.screenPreview} resizeMode='contain' />
                        <Text style={styles.screenPreviewHint}>Tap preview to click the Mac</Text>
                    </Pressable>
                )}
                {remoteKeyboardVisible && (
                    <View style={styles.remoteKeyboardPanel}>
                        <View style={styles.remoteKeyboardPanelHeader}>
                            <Text style={styles.remoteKeyboardTitle}>Remote keyboard</Text>
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Hide remote keyboard controls'
                                onPress={() => setRemoteKeyboardVisible(false)}
                                style={({ pressed }) => [styles.remoteMiniButton, pressed && styles.pressed]}
                            >
                                <Text style={styles.remoteMiniButtonText}>Hide</Text>
                            </Pressable>
                        </View>
                        <View style={styles.remoteKeyboardBar}>
                            <TextInput
                                ref={remoteKeyboardInputRef}
                                value={remoteKeyboardText}
                                onChangeText={setRemoteKeyboardText}
                                placeholder='Type on Mac...'
                                placeholderTextColor={theme.textSoft}
                                style={styles.remoteKeyboardInput}
                                autoCapitalize='none'
                                autoCorrect={false}
                                returnKeyType='send'
                                onSubmitEditing={() => void typeRemoteKeyboardText()}
                            />
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Type text on Mac'
                                onPress={() => void typeRemoteKeyboardText()}
                                style={({ pressed }) => [styles.remoteKeyButton, pressed && styles.pressed]}
                            >
                                <Text style={styles.remoteButtonText}>Type</Text>
                            </Pressable>
                        </View>
                        <View style={styles.remoteButtonRow}>
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Open Go/Search on Mac'
                                onPress={() => void runRemoteDesktopCommand('mac_control_key_search', 'Go/Search')}
                                style={({ pressed }) => [styles.remoteButton, pressed && styles.pressed]}
                            >
                                <Text style={styles.remoteButtonText}>Go/Search</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Press Enter on Mac'
                                onPress={() => void runRemoteDesktopCommand('mac_control_key_enter', 'Enter')}
                                style={({ pressed }) => [styles.remoteButton, pressed && styles.pressed]}
                            >
                                <Text style={styles.remoteButtonText}>Enter</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole='button'
                                accessibilityLabel='Click Mac pointer'
                                onPress={() => void runRemoteDesktopCommand('mac_control_pointer_click', 'Click pointer')}
                                style={({ pressed }) => [styles.remoteButton, pressed && styles.pressed]}
                            >
                                <Text style={styles.remoteButtonText}>Click</Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </GlassCard>

            <GlassCard style={styles.chatCard}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatTitle}>Chat</Text>
                    <View style={styles.chatHeaderActions}>
                        <Text style={styles.chatMeta}>{socketConnected && bestClient ? 'Live model' : 'HTTP fallback'}</Text>
                        {!!aiMessages.length && (
                            <Pressable
                                disabled={busy}
                                accessibilityRole='button'
                                accessibilityLabel='Clear AI chat'
                                accessibilityState={{ disabled: busy }}
                                onPress={clearChat}
                                style={({ pressed }) => [styles.clearChatButton, busy && styles.disabled, pressed && !busy && styles.pressed]}
                            >
                                <Text style={styles.clearChatText}>Clear</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
                <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
                    {latestMessages.length ? latestMessages.map(message => (
                        <View
                            key={message.id}
                            style={[
                                styles.chatBubble,
                                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
                                message.error && styles.errorBubble,
                            ]}
                        >
                            <Text style={styles.chatRole}>{message.role === 'user' ? 'You' : 'Hanasand AI'}</Text>
                            <Text style={styles.chatText}>{message.content || (message.pending ? 'Thinking...' : '')}</Text>
                            {message.role === 'assistant' && !!message.durationMs && (
                                <Text style={styles.detailText}>Worked for {formatDuration(message.durationMs)}</Text>
                            )}
                            {message.role === 'assistant' && !!message.thoughtSummary && (
                                <View style={styles.detailBox}>
                                    <Text style={styles.detailLabel}>Summary</Text>
                                    <Text style={styles.detailText}>{message.thoughtSummary}</Text>
                                </View>
                            )}
                            {message.role === 'assistant' && !!message.toolUses?.length && (
                                <View style={styles.detailBox}>
                                    <Text style={styles.detailLabel}>Tools</Text>
                                    {message.toolUses.map((tool, index) => (
                                        <Text key={`${tool.name}-${index}`} style={styles.detailText}>
                                            {tool.name}{tool.durationMs ? ` · ${formatDuration(tool.durationMs)}` : ''}{tool.summary ? `: ${tool.summary}` : ''}
                                        </Text>
                                    ))}
                                </View>
                            )}
                            {message.role === 'assistant' && !!message.fileSummaries?.length && (
                                <View style={styles.detailBox}>
                                    <Text style={styles.detailLabel}>Files</Text>
                                    {message.fileSummaries.map((file, index) => (
                                        <Text key={`${file.path}-${index}`} style={styles.detailText}>
                                            {file.path}{typeof file.additions === 'number' || typeof file.deletions === 'number'
                                                ? ` +${file.additions || 0} -${file.deletions || 0}`
                                                : ''}{file.summary ? `: ${file.summary}` : ''}
                                        </Text>
                                    ))}
                                </View>
                            )}
                        </View>
                    )) : (
                        <Text style={styles.emptyChat}>Ask something above. Replies, errors, and pending runs will stay here.</Text>
                    )}
                </ScrollView>
            </GlassCard>

            <View style={styles.grid}>
                {quickActions.map(action => {
                    const Icon = action.icon
                    return (
                        <Pressable
                            key={action.key}
                            accessibilityRole='button'
                            accessibilityLabel={action.title}
                            onPress={() => void handleQuickAction(action)}
                            style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
                        >
                            <View style={styles.iconWrap}>
                                <Icon color={theme.text} size={20} strokeWidth={2.1} />
                            </View>
                            <Text style={styles.actionLabel}>{infraBusy === action.key ? '...' : action.title}</Text>
                        </Pressable>
                    )
                })}
            </View>
        </Screen>
    )
}

function createStyles(theme: ThemePalette) {
    return StyleSheet.create({
        commandCard: {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
        },
        promptShell: {
            width: '100%',
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            paddingHorizontal: spacing.md,
        },
        promptInput: { flex: 1, color: theme.text, fontSize: 18, paddingVertical: spacing.md },
        promptArrowButton: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.text,
            borderWidth: 1,
            borderColor: theme.text,
        },
        disabled: { opacity: 0.55 },
        statusRow: { marginTop: spacing.sm },
        statusText: { color: theme.textSoft, fontSize: 12 },
        infraStrip: {
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.surfaceBorder,
            backgroundColor: theme.backgroundRaised,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
        },
        infraDot: { width: 9, height: 9, borderRadius: 9 },
        infraDotLive: { backgroundColor: theme.success },
        infraDotIdle: { backgroundColor: theme.textMuted },
        infraText: { flex: 1, color: theme.textMuted, fontWeight: '700', fontSize: 13 },
        permissionStrip: {
            marginTop: spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.danger,
            backgroundColor: `${theme.danger}22`,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
        },
        permissionText: { flex: 1, color: theme.text, fontSize: 12, fontWeight: '800' },
        remoteButtonRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        remoteButton: {
            minHeight: 36,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        remoteButtonText: { color: theme.text, fontSize: 12, fontWeight: '800' },
        remoteButtonActive: { borderColor: theme.accent, backgroundColor: theme.accentSoft },
        remoteKeyboardPanel: {
            marginTop: spacing.sm,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            padding: spacing.sm,
        },
        remoteKeyboardPanelHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
        },
        remoteKeyboardTitle: {
            color: theme.textMuted,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        remoteMiniButton: {
            minHeight: 28,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            paddingHorizontal: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        remoteMiniButtonText: { color: theme.textMuted, fontSize: 11, fontWeight: '800' },
        remoteKeyboardBar: {
            flexDirection: 'row',
            gap: spacing.sm,
            alignItems: 'center',
            marginTop: spacing.sm,
        },
        remoteKeyboardInput: {
            flex: 1,
            minHeight: 38,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            color: theme.text,
            paddingHorizontal: spacing.md,
            fontSize: 13,
            fontWeight: '700',
        },
        remoteKeyButton: {
            minHeight: 38,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            paddingHorizontal: spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
        },
        remoteStatusText: { color: theme.textMuted, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
        screenPreviewFrame: {
            marginTop: spacing.sm,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            overflow: 'hidden',
            backgroundColor: theme.background,
        },
        screenPreview: { width: '100%', height: 160 },
        screenPreviewHint: {
            color: theme.textMuted,
            fontSize: 11,
            fontWeight: '800',
            paddingHorizontal: spacing.sm,
            paddingBottom: spacing.xs,
        },
        chatCard: {
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
        },
        chatHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            marginBottom: spacing.md,
        },
        chatTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
        chatHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        chatMeta: { color: theme.textSoft, fontSize: 12, fontWeight: '700' },
        clearChatButton: {
            minHeight: 30,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            paddingHorizontal: spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
        },
        clearChatText: { color: theme.textMuted, fontSize: 12, fontWeight: '800' },
        chatScroll: { maxHeight: 420 },
        chatContent: { gap: spacing.sm },
        chatBubble: {
            borderRadius: 16,
            borderWidth: 1,
            padding: spacing.md,
            gap: 6,
        },
        userBubble: {
            backgroundColor: theme.accentSoft,
            borderColor: theme.accent,
        },
        assistantBubble: {
            backgroundColor: theme.surfaceStrong,
            borderColor: theme.surfaceBorderSoft,
        },
        errorBubble: {
            borderColor: theme.danger,
            backgroundColor: `${theme.danger}22`,
        },
        chatRole: {
            color: theme.textSoft,
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 1.4,
        },
        chatText: { color: theme.text, fontSize: 14, lineHeight: 21 },
        detailBox: {
            gap: 4,
            marginTop: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            padding: spacing.sm,
        },
        detailLabel: {
            color: theme.textSoft,
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: 1.2,
        },
        detailText: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
        emptyChat: { color: theme.textMuted, lineHeight: 21 },
        grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
        actionCard: {
            width: '48%',
            minHeight: 104,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.surfaceBorder,
            backgroundColor: theme.surface,
            padding: spacing.md,
            justifyContent: 'space-between',
        },
        iconWrap: {
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surfaceStrong,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
        },
        actionLabel: { color: theme.text, fontWeight: '700', fontSize: 18 },
        pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    })
}
