import { useEffect, useState } from 'react'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Platform, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { Bot, Images, Mail, ScanLine, SlidersHorizontal, StickyNote } from 'lucide-react-native'
import type { AiChatMessage, AppSettings, AuthenticatorEntry, RootTabParamList, SavedMailboxConnection } from './types'
import { SettingsDrawer } from './components/SettingsDrawer'
import { SettingsDrawerProvider } from './components/ui'
import { HomeScreen } from './screens/HomeScreen'
import { MailScreen } from './screens/MailScreen'
import { ScannerScreen } from './screens/ScannerScreen'
import { ImagesScreen } from './screens/ImagesScreen'
import { ControlScreen } from './screens/ControlScreen'
import { NotesScreen } from './screens/NotesScreen'
import { defaultSettings, loadAiChat, loadAuthenticatorEntries, loadMailboxConnections, loadSettings, saveAiChat, saveAuthenticatorEntries, saveMailboxConnections, saveSettings } from './lib/storage'
import { getThemePalette, palette } from './theme/tokens'
import { AppThemeProvider } from './theme/context'

const Tab = createBottomTabNavigator<RootTabParamList>()

const tabIcons = {
    Home: Bot,
    Mail: Mail,
    Scan: ScanLine,
    Notes: StickyNote,
    Images: Images,
    Control: SlidersHorizontal,
} as const

void SystemUI.setBackgroundColorAsync(palette.background)

async function safeLoad<T>(loader: () => Promise<T>, fallback: T) {
    try {
        return await loader()
    } catch {
        return fallback
    }
}

export default function App() {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [mailboxConnections, setMailboxConnections] = useState<SavedMailboxConnection[]>([])
    const [authenticatorEntries, setAuthenticatorEntries] = useState<AuthenticatorEntry[]>([])
    const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([])
    const [settingsOpen, setSettingsOpen] = useState(false)

    useEffect(() => {
        void (async () => {
            const [nextSettings, nextMailboxConnections, nextAuthenticatorEntries, nextAiMessages] = await Promise.all([
                safeLoad(loadSettings, defaultSettings),
                safeLoad(loadMailboxConnections, [] as SavedMailboxConnection[]),
                safeLoad(loadAuthenticatorEntries, [] as AuthenticatorEntry[]),
                safeLoad(loadAiChat, [] as AiChatMessage[]),
            ])
            setSettings(nextSettings)
            setMailboxConnections(nextMailboxConnections)
            setAuthenticatorEntries(nextAuthenticatorEntries)
            setAiMessages(nextAiMessages)
        })()
    }, [])

    useEffect(() => {
        if (!settings) return
        void SystemUI.setBackgroundColorAsync(getThemePalette(settings.themeMode).background)
    }, [settings])

    async function handleSaveSettings(next: AppSettings) {
        await saveSettings(next)
        setSettings(next)
    }

    async function handleSaveMailboxConnections(next: SavedMailboxConnection[]) {
        await saveMailboxConnections(next)
        setMailboxConnections(next)
    }

    async function handleSaveAuthenticatorEntries(next: AuthenticatorEntry[]) {
        await saveAuthenticatorEntries(next)
        setAuthenticatorEntries(next)
    }

    async function handleSaveAiMessages(next: AiChatMessage[]) {
        await saveAiChat(next)
        setAiMessages(next)
    }

    if (!settings) {
        return (
            <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
                <StatusBar style='light' />
                <Text style={{ color: palette.text }}>Loading Hanasand App...</Text>
            </GestureHandlerRootView>
        )
    }

    const activePalette = getThemePalette(settings.themeMode)

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: activePalette.background }}>
            <StatusBar style='light' />
            <AppThemeProvider mode={settings.themeMode}>
                <SettingsDrawerProvider openSettings={() => setSettingsOpen(true)}>
                    <NavigationContainer
                        linking={{
                            prefixes: ['hanasandapp://'],
                            config: {
                                screens: {
                                    Home: 'home',
                                    Mail: 'mail',
                                    Scan: 'scan',
                                    Notes: 'notes',
                                    Images: 'images',
                                    Control: 'control',
                                },
                            },
                        }}
                        theme={{
                            ...DarkTheme,
                            colors: {
                                ...DarkTheme.colors,
                                background: activePalette.background,
                                card: activePalette.backgroundAlt,
                                text: activePalette.text,
                                border: activePalette.surfaceBorder,
                                primary: activePalette.accent,
                            },
                        }}
                    >
                        <Tab.Navigator
                            initialRouteName='Home'
                            screenOptions={({ route }) => ({
                                headerShown: false,
                                tabBarShowLabel: false,
                                tabBarStyle: {
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    height: Platform.OS === 'ios' ? 92 : 78,
                                    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
                                    paddingTop: 10,
                                    borderTopWidth: 0,
                                    borderTopLeftRadius: 28,
                                    borderTopRightRadius: 28,
                                    backgroundColor: activePalette.backgroundAlt,
                                    borderWidth: 1,
                                    borderColor: activePalette.surfaceBorder,
                                },
                                tabBarActiveTintColor: activePalette.text,
                                tabBarInactiveTintColor: activePalette.textSoft,
                                tabBarItemStyle: {
                                    borderRadius: 18,
                                    marginHorizontal: 2,
                                },
                                tabBarIcon: ({ color, focused }) => {
                                    const Icon = tabIcons[route.name as keyof typeof tabIcons]
                                    return <Icon color={color} size={focused ? 22 : 20} strokeWidth={2.1} />
                                },
                                sceneStyle: { backgroundColor: activePalette.background },
                            })}
                        >
                            <Tab.Screen name='Home'>
                                {() => <HomeScreen settings={settings} aiMessages={aiMessages} onSaveAiMessages={handleSaveAiMessages} />}
                            </Tab.Screen>
                            <Tab.Screen name='Mail'>
                                {() => <MailScreen settings={settings} mailboxConnections={mailboxConnections} onSaveMailboxConnections={handleSaveMailboxConnections} />}
                            </Tab.Screen>
                            <Tab.Screen name='Scan' component={ScannerScreen} />
                            <Tab.Screen name='Notes'>
                                {() => <NotesScreen settings={settings} />}
                            </Tab.Screen>
                            <Tab.Screen name='Images' component={ImagesScreen} />
                            <Tab.Screen name='Control'>
                                {() => <ControlScreen settings={settings} onSaveSettings={handleSaveSettings} authenticatorEntries={authenticatorEntries} onSaveAuthenticatorEntries={handleSaveAuthenticatorEntries} />}
                            </Tab.Screen>
                        </Tab.Navigator>
                    </NavigationContainer>
                    <SettingsDrawer
                        open={settingsOpen}
                        settings={settings}
                        onClose={() => setSettingsOpen(false)}
                        onSave={async (next) => {
                            await handleSaveSettings(next)
                            setSettingsOpen(false)
                        }}
                    />
                </SettingsDrawerProvider>
            </AppThemeProvider>
        </GestureHandlerRootView>
    )
}
