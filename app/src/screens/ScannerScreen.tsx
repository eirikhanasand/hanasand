import { useMemo, useRef, useState } from 'react'
import { Alert, Image, ScrollView, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import type { ScannerPage } from '../types'
import { GlassCard, PillButton, Screen, SectionTitle } from '../components/ui'
import { spacing } from '../theme/tokens'

export function ScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions()
    const cameraRef = useRef<CameraView | null>(null)
    const [pages, setPages] = useState<ScannerPage[]>([])
    const [busy, setBusy] = useState(false)
    const [showCamera, setShowCamera] = useState(false)

    const orderedPages = useMemo(() => pages, [pages])

    async function capture() {
        if (!cameraRef.current) return
        setBusy(true)
        try {
            const shot = await cameraRef.current.takePictureAsync({ quality: 0.85 })
            if (!shot?.uri) return
            setPages(current => [...current, { id: `${Date.now()}-${current.length}`, uri: shot.uri, createdAt: Date.now() }])
        } catch (cause) {
            Alert.alert('Capture failed', cause instanceof Error ? cause.message : 'The camera could not save this page.')
        } finally {
            setBusy(false)
        }
    }

    function move(index: number, direction: -1 | 1) {
        setPages(current => {
            const next = [...current]
            const target = index + direction
            if (target < 0 || target >= next.length) return current
            const [page] = next.splice(index, 1)
            next.splice(target, 0, page)
            return next
        })
    }

    function remove(index: number) {
        setPages(current => current.filter((_, itemIndex) => itemIndex !== index))
    }

    async function exportPdf() {
        if (!pages.length) return
        setBusy(true)
        try {
            const encoded = await Promise.all(
                pages.map(async page => {
                    const base64 = await FileSystem.readAsStringAsync(page.uri, { encoding: FileSystem.EncodingType.Base64 })
                    return `data:image/jpeg;base64,${base64}`
                }),
            )
            const html = `
        <html>
          <body style="margin:0;padding:24px;background:#101820;">
            ${encoded.map(src => `<div style="page-break-after:always;margin-bottom:24px;"><img src="${src}" style="width:100%;border-radius:16px;object-fit:contain;" /></div>`).join('')}
          </body>
        </html>
      `
            const file = await Print.printToFileAsync({ html })
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Export scanned PDF' })
            } else {
                Alert.alert('PDF created', file.uri)
            }
        } catch (cause) {
            Alert.alert('PDF export failed', cause instanceof Error ? cause.message : 'Unable to export the scan bundle.')
        } finally {
            setBusy(false)
        }
    }

    if (!permission) {
        return <Screen title='Scanner' subtitle='Loading camera permissions…'><GlassCard><Text style={{ color: '#f3f7fb' }}>Checking camera access…</Text></GlassCard></Screen>
    }

    if (!permission.granted) {
        return (
            <Screen title='Scanner' subtitle='Grant camera access to scan document batches quickly.'>
                <GlassCard>
                    <SectionTitle eyebrow='Permission required' title='Camera access needed' body='The scanner is built for rapid batch capture. It uses the device camera with continuous autofocus, then lets you reorder and trim pages before exporting a PDF.' />
                    <View style={{ marginTop: spacing.md }}>
                        <PillButton label='Allow camera access' onPress={() => void requestPermission()} tone='accent' />
                    </View>
                </GlassCard>
            </Screen>
        )
    }

    return (
        <Screen title='Scanner' subtitle='Scan many pages quickly, reorder them, drop mistakes, and export one clean PDF.' scroll={false}>
            <View style={{ flex: 1, gap: spacing.md }}>
                <GlassCard>
                    <SectionTitle eyebrow='Capture mode' title={showCamera ? 'Live camera ready' : 'Batch scanning, simplified'} body='Open the camera, keep shooting, then review the stack below. The pages are only deleted from the stack when you remove them yourself.' />
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                        <PillButton label={showCamera ? 'Hide camera' : 'Open camera'} onPress={() => setShowCamera(current => !current)} tone='accent' />
                        <PillButton label={busy ? 'Working…' : 'Export PDF'} onPress={() => void exportPdf()} />
                    </View>
                </GlassCard>

                {showCamera && (
                    <GlassCard style={{ padding: 10 }}>
                        <CameraView ref={cameraRef} facing='back' autofocus='on' style={{ height: 280, borderRadius: 22, overflow: 'hidden' }} />
                        <View style={{ marginTop: spacing.sm }}>
                            <PillButton label={busy ? 'Capturing…' : 'Capture page'} onPress={() => void capture()} tone='accent' />
                        </View>
                    </GlassCard>
                )}

                <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: 180 }}>
                    <GlassCard>
                        <SectionTitle eyebrow='Review pages' title={`${orderedPages.length} pages in this batch`} body='Move pages up or down before export, and remove any accidental shots. The PDF is generated only when you decide the stack is clean.' />
                    </GlassCard>
                    {orderedPages.map((page, index) => (
                        <GlassCard key={page.id}>
                            <Image source={{ uri: page.uri }} style={{ width: '100%', height: 240, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.06)' }} resizeMode='cover' />
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
                                <Text style={{ color: '#f3f7fb', fontWeight: '700' }}>Page {index + 1}</Text>
                                <Text style={{ color: 'rgba(243,247,251,0.46)' }}>Ready for PDF</Text>
                            </View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
                                <PillButton label='Move up' onPress={() => move(index, -1)} small />
                                <PillButton label='Move down' onPress={() => move(index, 1)} small />
                                <PillButton label='Delete page' onPress={() => remove(index)} tone='danger' small />
                            </View>
                        </GlassCard>
                    ))}
                </ScrollView>
            </View>
        </Screen>
    )
}
