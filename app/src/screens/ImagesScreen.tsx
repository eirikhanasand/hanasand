import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Dimensions, Image, PanResponder, Text, View } from 'react-native'
import * as MediaLibrary from 'expo-media-library'
import type { ImageReviewAsset, SwipeDecision } from '../types'
import { GlassCard, PillButton, Screen, SectionTitle } from '../components/ui'
import { spacing } from '../theme/tokens'

const CARD_WIDTH = Dimensions.get('window').width - 48
const SWIPE_THRESHOLD = 110

export function ImagesScreen() {
    const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()
    const [assets, setAssets] = useState<ImageReviewAsset[]>([])
    const [index, setIndex] = useState(0)
    const [decisions, setDecisions] = useState<Record<string, SwipeDecision>>({})
    const [history, setHistory] = useState<string[]>([])
    const translate = useRef(new Animated.ValueXY()).current

    useEffect(() => {
        void loadAssets()
    }, [permissionResponse?.granted])

    async function loadAssets() {
        if (!permissionResponse?.granted) return
        const media = await MediaLibrary.getAssetsAsync({ mediaType: 'photo', first: 40, sortBy: ['creationTime'] })
        setAssets(media.assets.map(asset => ({
            id: asset.id,
            uri: asset.uri,
            filename: asset.filename,
            width: asset.width,
            height: asset.height,
            creationTime: asset.creationTime,
        })))
    }

    function registerDecision(decision: SwipeDecision) {
        const current = assets[index]
        if (!current) return
        setDecisions(previous => ({ ...previous, [current.id]: decision }))
        setHistory(previous => [...previous, current.id])
        Animated.timing(translate, { toValue: { x: decision === 'keep' ? 420 : -420, y: 0 }, duration: 180, useNativeDriver: false }).start(() => {
            translate.setValue({ x: 0, y: 0 })
            setIndex(currentIndex => currentIndex + 1)
        })
    }

    function undoLast() {
        const previousId = history[history.length - 1]
        if (!previousId) return
        setHistory(current => current.slice(0, -1))
        setDecisions(current => {
            const next = { ...current }
            delete next[previousId]
            return next
        })
        setIndex(current => Math.max(current - 1, 0))
        translate.setValue({ x: 0, y: 0 })
    }

    async function deleteDeferred() {
        const ids = Object.entries(decisions).filter(([, decision]) => decision === 'discard').map(([id]) => id)
        if (!ids.length) {
            Alert.alert('Nothing to delete', 'You have not marked any images for deletion yet.')
            return
        }
        await MediaLibrary.deleteAssetsAsync(ids)
        Alert.alert('Deleted', `${ids.length} images were deleted.`)
        setIndex(0)
        setHistory([])
        setDecisions({})
        await loadAssets()
    }

    const current = assets[index]
    const remaining = Math.max(assets.length - index, 0)
    const discardCount = useMemo(() => Object.values(decisions).filter(value => value === 'discard').length, [decisions])

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12,
            onPanResponderMove: (_, gesture) => translate.setValue({ x: gesture.dx, y: gesture.dy * 0.2 }),
            onPanResponderRelease: (_, gesture) => {
                if (gesture.dx > SWIPE_THRESHOLD) {
                    registerDecision('keep')
                    return
                }
                if (gesture.dx < -SWIPE_THRESHOLD) {
                    registerDecision('discard')
                    return
                }
                Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start()
            },
        }),
    ).current

    if (!permissionResponse?.granted) {
        return (
            <Screen title='Image review' subtitle='Swipe right to keep, swipe left to mark for delete, then delete in one batch when you are done.'>
                <GlassCard>
                    <SectionTitle eyebrow='Permission required' title='Photo access needed' body='This review flow keeps deletion deferred until the end, so you can move quickly without losing the ability to undo.' />
                    <View style={{ marginTop: spacing.md }}>
                        <PillButton label='Allow photo library access' onPress={() => void requestPermission()} tone='accent' />
                    </View>
                </GlassCard>
            </Screen>
        )
    }

    return (
        <Screen title='Image review' subtitle='A faster swipe flow than the old app, with motion, undo, and deferred delete.'>
            <GlassCard>
                <SectionTitle eyebrow='Batch mode' title={current ? `${remaining} images left` : 'Review complete'} body='Swipe right to keep, swipe left to mark for deletion. Nothing is deleted until you confirm at the end.' />
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md }}>
                    <PillButton label='Undo last' onPress={undoLast} small />
                    <PillButton label={`Delete marked (${discardCount})`} onPress={() => void deleteDeferred()} tone='danger' small />
                </View>
            </GlassCard>

            {current ? (
                <Animated.View
                    {...panResponder.panHandlers}
                    style={{
                        width: CARD_WIDTH,
                        alignSelf: 'center',
                        transform: [
                            { translateX: translate.x },
                            { translateY: translate.y },
                            { rotate: translate.x.interpolate({ inputRange: [-220, 0, 220], outputRange: ['-10deg', '0deg', '10deg'] }) },
                        ],
                    }}
                >
                    <GlassCard>
                        <Image source={{ uri: current.uri }} style={{ width: '100%', height: 420, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)' }} resizeMode='cover' />
                        <View style={{ gap: 6, marginTop: spacing.md }}>
                            <Text style={{ color: '#f3f7fb', fontSize: 17, fontWeight: '700' }}>{current.filename || 'Unnamed image'}</Text>
                            <Text style={{ color: 'rgba(243,247,251,0.62)' }}>{current.width}×{current.height}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                            <PillButton label='Keep' onPress={() => registerDecision('keep')} tone='accent' />
                            <PillButton label='Discard later' onPress={() => registerDecision('discard')} tone='danger' />
                        </View>
                    </GlassCard>
                </Animated.View>
            ) : (
                <GlassCard>
                    <SectionTitle eyebrow='Done' title='Everything in this batch is sorted' body='You can still undo recent choices before deleting the marked images, or reload the library for another pass.' />
                    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.md }}>
                        <PillButton label='Reload library' onPress={() => void loadAssets()} tone='accent' />
                        <PillButton label={`Delete marked (${discardCount})`} onPress={() => void deleteDeferred()} tone='danger' />
                    </View>
                </GlassCard>
            )}
        </Screen>
    )
}
