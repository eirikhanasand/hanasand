import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Check, Plus, Trash2 } from 'lucide-react-native'
import type { AppSettings, Note } from '../types'
import { createNote, deleteNote, fetchNotes, updateNote } from '../lib/api'
import { GlassCard, Screen } from '../components/ui'
import { radius, spacing, type ThemePalette } from '../theme/tokens'
import { useAppTheme } from '../theme/context'

const emptyDraft = { title: '', content: '' }

export function NotesScreen({ settings }: { settings: AppSettings }) {
    const theme = useAppTheme()
    const styles = useMemo(() => createStyles(theme), [theme])
    const [notes, setNotes] = useState<Note[]>([])
    const [selectedId, setSelectedId] = useState('')
    const [draft, setDraft] = useState(emptyDraft)
    const [refreshing, setRefreshing] = useState(false)
    const [busy, setBusy] = useState(false)
    const loadSequenceRef = useRef(0)
    const selected = useMemo(() => notes.find((note) => note.id === selectedId) || null, [notes, selectedId])
    const configured = Boolean(settings.apiBaseUrl.trim() && settings.authToken.trim() && settings.userId.trim())

    useEffect(() => {
        void load()
    }, [settings.apiBaseUrl, settings.authToken, settings.userId])

    useEffect(() => {
        if (!selected) {
            setDraft(emptyDraft)
            return
        }

        setDraft({ title: selected.title, content: selected.content })
    }, [selected])

    async function load() {
        const requestId = loadSequenceRef.current + 1
        loadSequenceRef.current = requestId
        if (!configured) {
            setNotes([])
            setSelectedId('')
            setRefreshing(false)
            return
        }
        setRefreshing(true)
        try {
            const next = await fetchNotes(settings)
            if (loadSequenceRef.current !== requestId) return
            setNotes(next)
            setSelectedId(current => current && next.some(note => note.id === current) ? current : next[0]?.id || '')
        } catch (error) {
            if (loadSequenceRef.current !== requestId) return
            Alert.alert('Notes unavailable', error instanceof Error ? error.message : 'Could not load notes.')
        } finally {
            if (loadSequenceRef.current === requestId) {
                setRefreshing(false)
            }
        }
    }

    async function save() {
        if (busy) return
        if (!configured) {
            Alert.alert('Notes unavailable', 'Add your Hanasand API URL, auth token, and user id in Utilities first.')
            return
        }
        if (!draft.title.trim() && !draft.content.trim()) {
            Alert.alert('Empty note', 'Write something first.')
            return
        }

        setBusy(true)
        try {
            const saved = selected
                ? await updateNote(settings, selected.id, draft)
                : await createNote(settings, draft)
            setNotes(current => [saved, ...current.filter(note => note.id !== saved.id)])
            setSelectedId(saved.id)
        } catch (error) {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save note.')
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!selected || busy) return
        Alert.alert('Delete note?', selected.title || 'Untitled', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                    void (async () => {
                        setBusy(true)
                        try {
                            await deleteNote(settings, selected.id)
                            const next = notes.filter(note => note.id !== selected.id)
                            setNotes(next)
                            setSelectedId(next[0]?.id || '')
                        } catch (error) {
                            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Could not delete note.')
                        } finally {
                            setBusy(false)
                        }
                    })()
                },
            },
        ])
    }

    return (
        <Screen title='Notes'>
            <GlassCard style={styles.editor}>
                <TextInput
                    value={draft.title}
                    onChangeText={(title) => setDraft(current => ({ ...current, title }))}
                    placeholder='Title'
                    placeholderTextColor={theme.textSoft}
                    style={styles.titleInput}
                />
                <TextInput
                    value={draft.content}
                    onChangeText={(content) => setDraft(current => ({ ...current, content }))}
                    placeholder='Write a note...'
                    placeholderTextColor={theme.textSoft}
                    multiline
                    style={styles.bodyInput}
                />
                <View style={styles.actions}>
                    <Pressable
                        disabled={busy}
                        accessibilityRole='button'
                        accessibilityLabel='Create new note'
                        accessibilityState={{ disabled: busy }}
                        onPress={() => {
                            setSelectedId('')
                            setDraft(emptyDraft)
                        }}
                        style={({ pressed }) => [styles.button, busy && styles.disabled, pressed && !busy && styles.pressed]}
                    >
                        <Plus color={theme.text} size={17} />
                        <Text style={styles.buttonText}>New</Text>
                    </Pressable>
                    {selected && (
                        <Pressable
                            disabled={busy}
                            accessibilityRole='button'
                            accessibilityLabel='Delete selected note'
                            accessibilityState={{ disabled: busy }}
                            onPress={() => void remove()}
                            style={({ pressed }) => [styles.button, styles.deleteButton, busy && styles.disabled, pressed && !busy && styles.pressed]}
                        >
                            <Trash2 color={theme.danger} size={17} />
                            <Text style={[styles.buttonText, { color: theme.danger }]}>Delete</Text>
                        </Pressable>
                    )}
                    <Pressable
                        disabled={busy || !configured}
                        accessibilityRole='button'
                        accessibilityLabel='Save note'
                        accessibilityState={{ disabled: busy || !configured }}
                        onPress={() => void save()}
                        style={({ pressed }) => [styles.saveButton, (busy || !configured) && styles.disabled, pressed && !busy && configured && styles.pressed]}
                    >
                        <Check color={theme.background} size={17} />
                        <Text style={styles.saveText}>{busy ? '...' : 'Save'}</Text>
                    </Pressable>
                </View>
            </GlassCard>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
                contentContainerStyle={styles.noteStrip}
            >
                {notes.map(note => (
                    <Pressable
                        key={note.id}
                        accessibilityRole='button'
                        accessibilityLabel={`Open note ${note.title || 'Untitled'}`}
                        accessibilityState={{ selected: note.id === selectedId }}
                        onPress={() => setSelectedId(note.id)}
                        style={({ pressed }) => [styles.noteCard, note.id === selectedId && styles.noteCardActive, pressed && styles.pressed]}
                    >
                        <Text style={styles.noteTitle} numberOfLines={1}>{note.title || 'Untitled'}</Text>
                        <Text style={styles.noteBody} numberOfLines={3}>{note.content || 'No content'}</Text>
                        <Text style={styles.noteMeta}>{note.source}</Text>
                    </Pressable>
                ))}
                {!notes.length && (
                    <View style={styles.emptyCard}>
                        <Text style={styles.noteBody}>{configured ? 'No notes yet.' : 'Connect notes in Utilities.'}</Text>
                    </View>
                )}
            </ScrollView>
        </Screen>
    )
}

function createStyles(theme: ThemePalette) {
    return StyleSheet.create({
        editor: {
            gap: spacing.sm,
            backgroundColor: theme.surface,
            borderColor: theme.surfaceBorder,
        },
        titleInput: {
            minHeight: 48,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            color: theme.text,
            fontSize: 18,
            fontWeight: '700',
            paddingHorizontal: spacing.md,
        },
        bodyInput: {
            minHeight: 230,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: theme.surfaceBorderSoft,
            backgroundColor: theme.backgroundRaised,
            color: theme.text,
            fontSize: 15,
            lineHeight: 22,
            padding: spacing.md,
            textAlignVertical: 'top',
        },
        actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
        button: { minHeight: 42, borderRadius: 999, borderWidth: 1, borderColor: theme.surfaceBorderSoft, backgroundColor: theme.surfaceStrong, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
        deleteButton: { backgroundColor: theme.ambientNeutral, borderColor: theme.danger },
        saveButton: { minHeight: 42, borderRadius: 999, backgroundColor: theme.text, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
        buttonText: { color: theme.text, fontWeight: '700' },
        saveText: { color: theme.background, fontWeight: '800' },
        pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
        disabled: { opacity: 0.55 },
        noteStrip: { gap: spacing.sm, paddingRight: spacing.lg },
        noteCard: { width: 220, minHeight: 130, borderRadius: radius.md, borderWidth: 1, borderColor: theme.surfaceBorder, backgroundColor: theme.surface, padding: spacing.md, gap: 8 },
        noteCardActive: { borderColor: theme.accent, backgroundColor: theme.surfaceStrong },
        noteTitle: { color: theme.text, fontSize: 16, fontWeight: '800' },
        noteBody: { color: theme.textMuted, fontSize: 13, lineHeight: 19 },
        noteMeta: { color: theme.textSoft, fontSize: 11, textTransform: 'uppercase' },
        emptyCard: { width: 220, minHeight: 130, borderRadius: radius.md, borderWidth: 1, borderColor: theme.surfaceBorder, backgroundColor: theme.surface, padding: spacing.md, justifyContent: 'center' },
    })
}
