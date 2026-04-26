import { useEffect, useState } from 'react'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { Platform, Text } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { Bot, Images, Mail, ScanLine, SlidersHorizontal } from 'lucide-react-native'
import type { AiChatMessage, AppSettings, AuthenticatorEntry, SavedMailboxConnection } from './types'
import { HomeScreen } from './screens/HomeScreen'
import { MailScreen } from './screens/MailScreen'
import { ScannerScreen } from './screens/ScannerScreen'
import { ImagesScreen } from './screens/ImagesScreen'
import { ControlScreen } from './screens/ControlScreen'
import { loadAiChat, loadAuthenticatorEntries, loadMailboxConnections, loadSettings, saveAiChat, saveAuthenticatorEntries, saveMailboxConnections, saveSettings } from './lib/storage'
import { palette } from './theme/tokens'

const Tab = createBottomTabNavigator()

const tabIcons = {
    Home: Bot,
    Mail: Mail,
    Scan: ScanLine,
    Images: Images,
    Control: SlidersHorizontal,
} as const

void SystemUI.setBackgroundColorAsync(palette.background)

export default function App() {
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [mailboxConnections, setMailboxConnections] = useState<SavedMailboxConnection[]>([])
    const [authenticatorEntries, setAuthenticatorEntries] = useState<AuthenticatorEntry[]>([])
    const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([])

    useEffect(() => {
        void (async () => {
            setSettings(await loadSettings())
            setMailboxConnections(await loadMailboxConnections())
            setAuthenticatorEntries(await loadAuthenticatorEntries())
            setAiMessages(await loadAiChat())
        })()
    }, [])

    async function handleSaveSettings(next: AppSettings) {
        setSettings(next)
        await saveSettings(next)
    }

    async function handleSaveMailboxConnections(next: SavedMailboxConnection[]) {
        setMailboxConnections(next)
        await saveMailboxConnections(next)
    }

    async function handleSaveAuthenticatorEntries(next: AuthenticatorEntry[]) {
        setAuthenticatorEntries(next)
        await saveAuthenticatorEntries(next)
    }

    async function handleSaveAiMessages(next: AiChatMessage[]) {
        setAiMessages(next)
        await saveAiChat(next)
    }

    if (!settings) {
        return (
            <GestureHandlerRootView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background }}>
                <StatusBar style='light' />
                <Text style={{ color: palette.text }}>Loading Hanasand App...</Text>
            </GestureHandlerRootView>
        )
    }

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.background }}>
            <StatusBar style='light' />
            <NavigationContainer
                linking={{
                    prefixes: ['hanasandapp://'],
                    config: {
                        screens: {
                            Home: 'home',
                            Mail: 'mail',
                            Scan: 'scan',
                            Images: 'images',
                            Control: 'control',
                        },
                    },
                }}
                theme={{
                    ...DarkTheme,
                    colors: {
                        ...DarkTheme.colors,
                        background: palette.background,
                        card: 'rgba(13,15,12,0.9)',
                        text: palette.text,
                        border: palette.surfaceBorder,
                        primary: palette.accent,
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
                            bottom: 24,
                            left: 34,
                            right: 34,
                            height: 64,
                            paddingBottom: Platform.OS === 'ios' ? 14 : 10,
                            paddingTop: 7,
                            borderTopWidth: 0,
                            borderRadius: 24,
                            backgroundColor: 'rgba(13,15,12,0.86)',
                            borderWidth: 1,
                            borderColor: palette.surfaceBorder,
                        },
                        tabBarActiveTintColor: palette.text,
                        tabBarInactiveTintColor: palette.textSoft,
                        tabBarItemStyle: {
                            borderRadius: 18,
                            marginHorizontal: 2,
                        },
                        tabBarIcon: ({ color, focused }) => {
                            const Icon = tabIcons[route.name as keyof typeof tabIcons]
                            return <Icon color={color} size={focused ? 22 : 20} strokeWidth={2.1} />
                        },
                        sceneStyle: { backgroundColor: palette.background },
                    })}
                >
                    <Tab.Screen name='Home'>
                        {() => <HomeScreen settings={settings} aiMessages={aiMessages} onSaveAiMessages={handleSaveAiMessages} />}
                    </Tab.Screen>
                    <Tab.Screen name='Mail'>
                        {() => <MailScreen settings={settings} mailboxConnections={mailboxConnections} onSaveMailboxConnections={handleSaveMailboxConnections} />}
                    </Tab.Screen>
                    <Tab.Screen name='Scan' component={ScannerScreen} />
                    <Tab.Screen name='Images' component={ImagesScreen} />
                    <Tab.Screen name='Control'>
                        {() => <ControlScreen settings={settings} onSaveSettings={handleSaveSettings} authenticatorEntries={authenticatorEntries} onSaveAuthenticatorEntries={handleSaveAuthenticatorEntries} />}
                    </Tab.Screen>
                </Tab.Navigator>
            </NavigationContainer>
        </GestureHandlerRootView>
    )
}
