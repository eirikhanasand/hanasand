import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Bot, FolderKanban, Image as ImageIcon, Mail, ScanLine, Sparkles, TerminalSquare } from 'lucide-react-native'
import { useNavigation } from '@react-navigation/native'
import type { AiChatMessage, AppSettings, GptClient } from '../types'
import { askCodex } from '../lib/api'
import { GlassCard, Screen } from '../components/ui'
import { palette, radius, spacing } from '../theme/tokens'

const quickActions = [
    { key: 'mail', title: 'Mail', icon: Mail, route: 'Mail' },
    { key: 'scan', title: 'Scan', icon: ScanLine, route: 'Scan' },
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
    if (apiBaseUrl.startsWith('https://')) return `wss://${apiBaseUrl.slice('https://'.length)}`
    if (apiBaseUrl.startsWith('http://')) return `ws://${apiBaseUrl.slice('http://'.length)}`
    return apiBaseUrl
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
    const navigation = useNavigation()
    const [prompt, setPrompt] = useState('')
    const [busy, setBusy] = useState(false)
    const [clients, setClients] = useState<GptClient[]>([])
    const [socketConnected, setSocketConnected] = useState(false)
    const activeConversationRef = useRef<string | null>(null)
    const socketRef = useRef<WebSocket | null>(null)

    useEffect(() => {
        const ws = new WebSocket(`${toWsUrl(settings.apiBaseUrl)}/client/ws/gpt`)
        socketRef.current = ws

        ws.onopen = () => setSocketConnected(true)
        ws.onclose = () => {
            setSocketConnected(false)
            socketRef.current = null
        }
        ws.onerror = () => setSocketConnected(false)
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
                    void onSaveAiMessages([
                        ...aiMessages,
                        { id: `${message.conversationId}-assistant`, role: 'assistant', content: '', createdAt: Date.now(), pending: true },
                    ])
                    return
                }

                if (message.type === 'prompt_delta') {
                    void onSaveAiMessages(aiMessages.map(entry => entry.id === `${message.conversationId}-assistant`
                        ? { ...entry, content: `${entry.content}${message.delta || ''}`, pending: true }
                        : entry))
                    return
                }

                if (message.type === 'prompt_complete') {
                    setBusy(false)
                    void onSaveAiMessages(aiMessages.map(entry => entry.id === `${message.conversationId}-assistant` ? { ...entry, pending: false } : entry))
                    return
                }

                if (message.type === 'prompt_error') {
                    setBusy(false)
                    void onSaveAiMessages(aiMessages.map(entry => entry.id === `${message.conversationId}-assistant`
                        ? { ...entry, content: message.error || 'The model failed to answer this prompt.', pending: false, error: true }
                        : entry))
                }
            } catch {
                setSocketConnected(false)
            }
        }

        return () => ws.close()
    }, [settings.apiBaseUrl, onSaveAiMessages, aiMessages])

    const bestClient = useMemo(() => [...clients].sort((a, b) => (b.model?.tps || 0) - (a.model?.tps || 0))[0] || null, [clients])
    const latestMessages = useMemo(() => aiMessages.slice(-10), [aiMessages])

    async function submitPrompt() {
        const trimmed = prompt.trim()
        if (!trimmed || busy) return

        const userMessage: AiChatMessage = { id: `${Date.now()}-user`, role: 'user', content: trimmed, createdAt: Date.now() }
        const baseMessages = [...aiMessages, userMessage]
        await onSaveAiMessages(baseMessages)
        setPrompt('')
        setBusy(true)

        const socket = socketRef.current
        if (socket && socket.readyState === WebSocket.OPEN && bestClient) {
            const conversationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`
            activeConversationRef.current = conversationId
            const withPending = [...baseMessages, { id: `${conversationId}-assistant`, role: 'assistant' as const, content: '', createdAt: Date.now(), pending: true }]
            await onSaveAiMessages(withPending)
            socket.send(JSON.stringify({
                type: 'prompt_request',
                conversationId,
                clientName: bestClient.name,
                messages: baseMessages.map(message => ({ role: message.role, content: message.content })),
                maxTokens: 512,
                temperature: 0.7,
            }))
            return
        }

        try {
            const context = latestMessages.map(message => `${message.role}: ${message.content}`).join('\n')
            const reply = await askCodex(settings, trimmed, context)
            await onSaveAiMessages([
                ...baseMessages,
                { id: `${Date.now()}-assistant`, role: 'assistant', content: reply, createdAt: Date.now() },
            ])
        } catch (cause) {
            await onSaveAiMessages([
                ...baseMessages,
                { id: `${Date.now()}-assistant`, role: 'assistant', content: cause instanceof Error ? cause.message : 'Codex request failed.', createdAt: Date.now(), error: true },
            ])
        } finally {
            setBusy(false)
        }
    }

    return (
        <Screen title='Codex' subtitle='Native chat, on the go.'>
            <GlassCard>
                <View style={styles.promptShell}>
                    <View style={styles.promptRow}>
                        <Sparkles color={palette.accent} size={18} strokeWidth={2.2} />
                        <TextInput
                            value={prompt}
                            onChangeText={setPrompt}
                            placeholder='Ask Codex...'
                            placeholderTextColor={palette.textSoft}
                            style={styles.promptInput}
                            returnKeyType='send'
                            onSubmitEditing={() => void submitPrompt()}
                        />
                    </View>
                    <Pressable onPress={() => void submitPrompt()} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                        <Text style={styles.primaryLabel}>{busy ? '...' : 'Send'}</Text>
                    </Pressable>
                </View>
                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>
                        {socketConnected && bestClient
                            ? `Streaming via ${bestClient.name}${bestClient.model?.tps ? ` · ${bestClient.model.tps.toFixed(1)} tps` : ''}`
                            : 'API fallback mode'}
                    </Text>
                </View>
            </GlassCard>

            <GlassCard>
                <View style={styles.chatHeader}>
                    <Text style={styles.sectionTitle}>Codex chat</Text>
                    <View style={styles.liveBadge}>
                        <Bot color={palette.text} size={14} strokeWidth={2.1} />
                        <Text style={styles.liveBadgeLabel}>{socketConnected ? 'Live' : 'Ready'}</Text>
                    </View>
                </View>
                <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.sm }}>
                    {latestMessages.length ? latestMessages.map(message => (
                        <View key={message.id} style={[styles.chatBubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble, message.error && styles.errorBubble]}>
                            <Text style={styles.chatRole}>{message.role === 'user' ? 'You' : 'Codex'}</Text>
                            <Text style={styles.chatText}>{message.content || (message.pending ? 'Thinking…' : '')}</Text>
                        </View>
                    )) : (
                        <Text style={styles.placeholderText}>This is now the first-class native Codex screen. Start typing and the reply stays here.</Text>
                    )}
                </ScrollView>
            </GlassCard>

            <View style={styles.grid}>
                {quickActions.map(action => {
                    const Icon = action.icon
                    return (
                        <Pressable key={action.key} onPress={() => navigation.navigate(action.route as never)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
                            <View style={styles.iconWrap}>
                                <Icon color={palette.text} size={20} strokeWidth={2.1} />
                            </View>
                            <Text style={styles.actionLabel}>{action.title}</Text>
                        </Pressable>
                    )
                })}
            </View>
        </Screen>
    )
}

const styles = StyleSheet.create({
    promptShell: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    promptRow: {
        flex: 1,
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.surfaceBorder,
        backgroundColor: palette.surfaceStrong,
        paddingHorizontal: spacing.md,
    },
    promptInput: { flex: 1, color: palette.text, fontSize: 18, paddingVertical: spacing.md },
    primaryButton: {
        minWidth: 82,
        minHeight: 56,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: palette.accentSoft,
        borderWidth: 1,
        borderColor: 'rgba(217,106,49,0.34)',
    },
    primaryLabel: { color: palette.text, fontWeight: '700', fontSize: 16 },
    statusRow: { marginTop: spacing.sm },
    statusText: { color: palette.textSoft, fontSize: 12 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: palette.surfaceBorderSoft,
        backgroundColor: palette.surfaceStrong,
    },
    liveBadgeLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
    chatBubble: { borderRadius: radius.md, padding: spacing.md, borderWidth: 1 },
    userBubble: { backgroundColor: 'rgba(217,106,49,0.14)', borderColor: 'rgba(217,106,49,0.24)' },
    assistantBubble: { backgroundColor: palette.surfaceStrong, borderColor: palette.surfaceBorderSoft },
    errorBubble: { borderColor: 'rgba(184,106,94,0.3)' },
    chatRole: { color: palette.textSoft, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 6 },
    chatText: { color: palette.text, lineHeight: 20 },
    placeholderText: { color: palette.textMuted, lineHeight: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    actionCard: {
        width: '48%',
        minHeight: 104,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: palette.surfaceBorder,
        backgroundColor: palette.surfaceStrong,
        padding: spacing.md,
        justifyContent: 'space-between',
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(247,248,242,0.06)',
        borderWidth: 1,
        borderColor: palette.surfaceBorderSoft,
    },
    actionLabel: { color: palette.text, fontWeight: '700', fontSize: 18 },
    pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
})
