import { useEffect, useRef, useState } from 'react'
import { Alert, Linking, Share, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { generateSync } from 'otplib'
import { fetchAiModels, fetchTopDomains, fetchUserShares, triggerServerAction, createShare as createShareRequest } from '../lib/api'
import type { AppSettings, AuthenticatorEntry, GptClient, ShareSummary } from '../types'
import { GlassCard, LabeledInput, NativeTile, PillButton, Screen, SectionTitle } from '../components/ui'
import { spacing } from '../theme/tokens'

function buildAuthenticatorEntryFromUri(payload: string): AuthenticatorEntry | null {
    try {
        if (!payload.startsWith('otpauth://totp/')) return null
        const url = new URL(payload)
        const rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''))
        const [issuerFromLabel, account] = rawLabel.includes(':') ? rawLabel.split(':', 2) : ['', rawLabel]
        const secret = url.searchParams.get('secret') || ''
        const issuer = url.searchParams.get('issuer') || issuerFromLabel || undefined
        const digits = Number(url.searchParams.get('digits') || '6')
        const period = Number(url.searchParams.get('period') || '30')
        if (!secret) return null
        return {
            id: `${Date.now()}`,
            label: issuer ? `${issuer}${account ? ` · ${account}` : ''}` : account || 'Authenticator code',
            issuer,
            account,
            secret: secret.replace(/\s+/g, ''),
            digits,
            period,
        }
    } catch {
        return null
    }
}

export function ControlScreen({
    settings,
    onSaveSettings,
    authenticatorEntries,
    onSaveAuthenticatorEntries,
}: {
    settings: AppSettings
    onSaveSettings: (next: AppSettings) => void
    authenticatorEntries: AuthenticatorEntry[]
    onSaveAuthenticatorEntries: (next: AuthenticatorEntry[]) => Promise<void>
}) {
    const [draft, setDraft] = useState(settings)
    const [permission, requestPermission] = useCameraPermissions()
    const [cameraVisible, setCameraVisible] = useState(false)
    const [manualSecret, setManualSecret] = useState('')
    const [manualLabel, setManualLabel] = useState('')
    const [shares, setShares] = useState<ShareSummary[]>([])
    const [shareName, setShareName] = useState('')
    const [shareContent, setShareContent] = useState('')
    const [domains, setDomains] = useState<Array<{ name: string; tps?: number }>>([])
    const [models, setModels] = useState<GptClient[]>([])
    const [loadingShares, setLoadingShares] = useState(false)
    const cameraLock = useRef(false)
    const [now, setNow] = useState(Date.now())

    useEffect(() => {
        void refreshNativeData()
    }, [])

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
    }, [])

    async function refreshNativeData() {
        try {
            const [nextModels, nextDomains] = await Promise.all([
                fetchAiModels(draft).catch(() => []),
                fetchTopDomains(draft).catch(() => []),
            ])
            setModels(nextModels)
            setDomains(nextDomains)
        } catch {
            // keep silent in native status dashboard
        }
    }

    async function loadShares() {
        setLoadingShares(true)
        try {
            setShares(await fetchUserShares(draft))
        } catch (cause) {
            Alert.alert('Unable to load shares', cause instanceof Error ? cause.message : 'Request failed.')
        } finally {
            setLoadingShares(false)
        }
    }

    async function createShare() {
        const name = shareName.trim() || `share-${Date.now()}`
        try {
            const share = await createShareRequest(draft, {
                id: `${Date.now()}`,
                content: shareContent,
                name,
                path: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                type: 'note',
            })
            setShares(current => [share, ...current])
            setShareName('')
            setShareContent('')
        } catch (cause) {
            Alert.alert('Unable to create share', cause instanceof Error ? cause.message : 'Request failed.')
        }
    }

    async function openVpn() {
        try {
            if (draft.vpnUrlScheme && await Linking.canOpenURL(draft.vpnUrlScheme)) {
                await Linking.openURL(draft.vpnUrlScheme)
                return
            }
            await Linking.openSettings()
        } catch {
            Alert.alert('VPN shortcut unavailable', 'The app could not open the VPN shortcut, so Settings was used as the fallback.')
        }
    }

    async function runServerAction(path: string) {
        try {
            const result = await triggerServerAction(`${draft.serverBaseUrl}${path}`, draft)
            Alert.alert('Server action finished', result || 'Done')
        } catch (cause) {
            Alert.alert('Server action failed', cause instanceof Error ? cause.message : 'Unable to reach the remote management plane.')
        }
    }

    async function shareRemoteSetup() {
        const content = [
            `RDP host: ${draft.remoteDesktopHost || '(set host)'}`,
            `RDP user: ${draft.remoteDesktopUser || '(set user)'}`,
            `VNC host: ${draft.vncHost || '(set host)'}`,
            `Codex remote: ${draft.codexUrl}`,
            `Server plane: ${draft.serverBaseUrl}`,
        ].join('\n')
        await Share.share({ message: content })
    }

    async function handleScan(payload: string) {
        if (cameraLock.current) return
        cameraLock.current = true
        setCameraVisible(false)
        const entry = buildAuthenticatorEntryFromUri(payload)
        if (entry) {
            await onSaveAuthenticatorEntries([entry, ...authenticatorEntries])
            Alert.alert('Authenticator added', entry.label)
        } else {
            Alert.alert('QR scanned', payload)
        }
        setTimeout(() => {
            cameraLock.current = false
        }, 900)
    }

    async function saveManualCode() {
        const secret = manualSecret.trim().replace(/\s+/g, '')
        if (!secret) return
        await onSaveAuthenticatorEntries([
            {
                id: `${Date.now()}`,
                label: manualLabel.trim() || 'Authenticator code',
                secret,
                digits: 6,
                period: 30,
            },
            ...authenticatorEntries,
        ])
        setManualLabel('')
        setManualSecret('')
    }

    const otpCards = authenticatorEntries.slice(0, 5).map(entry => {
        const token = generateSync({ secret: entry.secret, digits: entry.digits, period: entry.period })
        const remaining = entry.period - Math.floor((now / 1000) % entry.period)
        return { entry, token, remaining }
    })

    return (
        <Screen title='Utilities' subtitle='Native ops, authenticator, shares, and system status.'>
            <GlassCard>
                <SectionTitle eyebrow='Utilities' title='QR + authenticator' body='This is now a dedicated native utility surface instead of being buried under the chat screen.' />
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md }}>
                    <PillButton label='Scan QR' onPress={() => {
                        if (!permission?.granted) {
                            void requestPermission()
                        }
                        setCameraVisible(true)
                    }} tone='accent' />
                    <PillButton label='Hide camera' onPress={() => setCameraVisible(false)} />
                </View>
                {cameraVisible && permission?.granted && (
                    <View style={{ marginTop: spacing.md, overflow: 'hidden', borderRadius: 22 }}>
                        <CameraView
                            style={{ height: 220 }}
                            facing='back'
                            autofocus='on'
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={({ data }) => void handleScan(data)}
                        />
                    </View>
                )}
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    <TextInput value={manualLabel} onChangeText={setManualLabel} placeholder='Authenticator label' placeholderTextColor='rgba(241,243,238,0.46)' style={styles.inlineInput} />
                    <TextInput value={manualSecret} onChangeText={setManualSecret} placeholder='Manual secret' placeholderTextColor='rgba(241,243,238,0.46)' style={styles.inlineInput} autoCapitalize='characters' />
                    <PillButton label='Add code manually' onPress={() => void saveManualCode()} small />
                </View>
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {otpCards.map(({ entry, token, remaining }) => (
                        <NativeTile key={entry.id} eyebrow='Authenticator' title={entry.label} body={token} meta={`${remaining}s remaining`} />
                    ))}
                </View>
            </GlassCard>

            <GlassCard>
                <SectionTitle eyebrow='Shares' title='Native share flow' body='Create quick shares here and inspect your recent share list without bouncing out to the website.' />
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <TextInput value={shareName} onChangeText={setShareName} placeholder='Share name' placeholderTextColor='rgba(241,243,238,0.46)' style={styles.inlineInput} />
                    <TextInput value={shareContent} onChangeText={setShareContent} placeholder='Share content' placeholderTextColor='rgba(241,243,238,0.46)' multiline style={[styles.inlineInput, { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }]} />
                    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <PillButton label='Create share' onPress={() => void createShare()} tone='accent' />
                        <PillButton label={loadingShares ? 'Loading…' : 'Load my shares'} onPress={() => void loadShares()} />
                    </View>
                    <View style={{ gap: spacing.sm }}>
                        {shares.slice(0, 5).map(share => (
                            <NativeTile key={share.id} eyebrow='Share' title={share.name || share.id} body={share.path || share.alias || 'Workspace share'} meta={share.alias ? `${share.alias}.hanasand.com` : share.id} />
                        ))}
                    </View>
                </View>
            </GlassCard>

            <GlassCard>
                <SectionTitle eyebrow='System' title='Native status summary' body='The highest-value website monitoring surfaces are represented here as quick native insight cards.' />
                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {models.slice(0, 3).map(model => (
                        <NativeTile key={model.name} eyebrow='Model' title={model.name} body={`Status: ${model.model?.status || 'unknown'}`} meta={model.model?.tps ? `${model.model.tps.toFixed(1)} tps` : 'No TPS yet'} />
                    ))}
                    {domains.slice(0, 3).map(domain => (
                        <NativeTile key={domain.name} eyebrow='Traffic' title={domain.name} body='Top active domain' meta={typeof domain.tps === 'number' ? `${domain.tps.toFixed(1)} tps` : 'Live'} />
                    ))}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <PillButton label='Refresh status' onPress={() => void refreshNativeData()} tone='accent' />
                        <PillButton label='Open VPN' onPress={() => void openVpn()} />
                        <PillButton label='Start server' onPress={() => void runServerAction(draft.serverStartPath)} />
                        <PillButton label='Stop server' onPress={() => void runServerAction(draft.serverStopPath)} tone='danger' />
                    </View>
                </View>
            </GlassCard>

            <GlassCard>
                <SectionTitle eyebrow='Remote setup' title='RDP, VNC, and service settings' body='This stays native too, so the operational details live with the rest of the control surface.' />
                <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                    <LabeledInput label='CDN API URL' value={draft.cdnBaseUrl} onChangeText={value => setDraft(current => ({ ...current, cdnBaseUrl: value }))} />
                    <LabeledInput label='Codex URL' value={draft.codexUrl} onChangeText={value => setDraft(current => ({ ...current, codexUrl: value }))} />
                    <LabeledInput label='Codex API path' value={draft.codexApiPath} onChangeText={value => setDraft(current => ({ ...current, codexApiPath: value }))} placeholder='/tools/ai' />
                    <LabeledInput label='RDP host' value={draft.remoteDesktopHost} onChangeText={value => setDraft(current => ({ ...current, remoteDesktopHost: value }))} placeholder='mac-or-server.local' />
                    <LabeledInput label='RDP user' value={draft.remoteDesktopUser} onChangeText={value => setDraft(current => ({ ...current, remoteDesktopUser: value }))} placeholder='eirik' />
                    <LabeledInput label='VNC host for this Mac' value={draft.vncHost} onChangeText={value => setDraft(current => ({ ...current, vncHost: value }))} placeholder='mac.local:5900' />
                    <LabeledInput label='Server base URL' value={draft.serverBaseUrl} onChangeText={value => setDraft(current => ({ ...current, serverBaseUrl: value }))} />
                    <LabeledInput label='Start path' value={draft.serverStartPath} onChangeText={value => setDraft(current => ({ ...current, serverStartPath: value }))} />
                    <LabeledInput label='Stop path' value={draft.serverStopPath} onChangeText={value => setDraft(current => ({ ...current, serverStopPath: value }))} />
                    <LabeledInput label='Logs path or URL' value={draft.serverLogsPath} onChangeText={value => setDraft(current => ({ ...current, serverLogsPath: value }))} />
                    <LabeledInput label='VPN URL scheme' value={draft.vpnUrlScheme} onChangeText={value => setDraft(current => ({ ...current, vpnUrlScheme: value }))} placeholder='ciscoanyconnect://' />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <PillButton label='Save setup' onPress={() => onSaveSettings(draft)} tone='accent' />
                        <PillButton label='Share setup' onPress={() => void shareRemoteSetup()} />
                    </View>
                </View>
            </GlassCard>
        </Screen>
    )
}

const styles = {
    inlineInput: {
        minHeight: 46,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(247,248,242,0.10)',
        backgroundColor: 'rgba(247,248,242,0.07)',
        paddingHorizontal: 14,
        color: '#f1f3ee',
        fontSize: 15,
    } as const,
}
