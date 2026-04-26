import AppKit
import Combine
import CryptoKit
import Foundation
import Network
import SwiftUI
import WebKit

@main
struct HanasandApp: App {
    @StateObject private var model = DesktopAgentModel()

    var body: some Scene {
        WindowGroup {
            DesktopShell()
                .environmentObject(model)
                .frame(minWidth: 1080, minHeight: 720)
                .task {
                    await model.start()
                }
        }
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandMenu("Agent") {
                Button("Run Status") {
                    model.runStatusCommand()
                }
                .keyboardShortcut("r", modifiers: [.command])

                Button("Focus Command") {
                    model.focusCommand.toggle()
                }
                .keyboardShortcut("k", modifiers: [.command])
            }
        }
    }
}

enum AppearancePreference: String, CaseIterable, Identifiable {
    case light
    case dark
    case system

    var id: String { rawValue }

    var title: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    var icon: String {
        switch self {
        case .light: return "sun.max"
        case .dark: return "moon"
        case .system: return "display"
        }
    }

    var preferredColorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }
}

enum RemoteDesktopProtocol: String, CaseIterable, Identifiable {
    case screenSharing
    case microsoftRDP

    var id: String { rawValue }

    var label: String {
        switch self {
        case .screenSharing: return "Screen Sharing"
        case .microsoftRDP: return "Microsoft RDP"
        }
    }

    var icon: String {
        switch self {
        case .screenSharing: return "display"
        case .microsoftRDP: return "rectangle.connected.to.line.below"
        }
    }
}

enum DesktopSection: String, CaseIterable, Identifiable {
    case command
    case dashboard
    case browser
    case ide
    case mac
    case mail
    case ai
    case server
    case updates
    case settings

    var id: String { rawValue }

    var title: String {
        switch self {
        case .command: return "Command"
        case .dashboard: return "Dashboard"
        case .browser: return "Workspace"
        case .ide: return "IDE"
        case .mac: return "This Mac"
        case .mail: return "Mail"
        case .ai: return "Hanasand AI"
        case .server: return "Server"
        case .updates: return "Updates"
        case .settings: return "Settings"
        }
    }

    var icon: String {
        switch self {
        case .command: return "terminal"
        case .dashboard: return "square.grid.2x2"
        case .browser: return "rectangle.3.group"
        case .ide: return "curlybraces.square"
        case .mac: return "desktopcomputer"
        case .mail: return "envelope"
        case .ai: return "sparkles"
        case .server: return "server.rack"
        case .updates: return "arrow.triangle.2.circlepath"
        case .settings: return "gearshape"
        }
    }
}

struct HanasandDesktopSettings: Codable, Equatable {
    static let macMiniTunnelCommand = "ssh -N -L 5900:192.168.1.81:5900 -J tekkom@128.39.140.144 tekkom@192.168.1.81"

    var websiteBaseURL = "https://hanasand.com"
    var apiBaseURL = "https://api.hanasand.com/api"
    var internalAPIBaseURL = "https://internal.hanasand.com/api"
    var beekeeperAPIBaseURL = "https://beekeeper.hanasand.com/api"
    var cdnBaseURL = "https://cdn.hanasand.com/api"
    var authToken = ""
    var userID = ""
    var codexAPIPath = "/tools/ai"
    var aiAPIURL = "https://api.hanasand.com/api/tools/ai"
    var desktopAgentBaseURL = "http://127.0.0.1:45731"
    var vpnURLScheme = "ciscoanyconnect://"
    var rdpHost = "localhost:5900"
    var rdpUser = "macmini"
    var remoteDesktopProtocol = RemoteDesktopProtocol.screenSharing.rawValue
    var remoteDesktopTunnelCommand = Self.macMiniTunnelCommand
    var serverBaseURL = "http://128.39.142.158"
    var serverStartPath = "/start"
    var serverStopPath = "/stop"
    var serverLogsPath = "/logs"

    enum CodingKeys: String, CodingKey {
        case websiteBaseURL
        case apiBaseURL
        case internalAPIBaseURL
        case beekeeperAPIBaseURL
        case cdnBaseURL
        case authToken
        case userID
        case codexAPIPath
        case aiAPIURL
        case desktopAgentBaseURL
        case vpnURLScheme
        case rdpHost
        case rdpUser
        case remoteDesktopProtocol
        case remoteDesktopTunnelCommand
        case serverBaseURL
        case serverStartPath
        case serverStopPath
        case serverLogsPath
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        websiteBaseURL = try container.decodeIfPresent(String.self, forKey: .websiteBaseURL) ?? websiteBaseURL
        apiBaseURL = try container.decodeIfPresent(String.self, forKey: .apiBaseURL) ?? apiBaseURL
        internalAPIBaseURL = try container.decodeIfPresent(String.self, forKey: .internalAPIBaseURL) ?? internalAPIBaseURL
        beekeeperAPIBaseURL = try container.decodeIfPresent(String.self, forKey: .beekeeperAPIBaseURL) ?? beekeeperAPIBaseURL
        cdnBaseURL = try container.decodeIfPresent(String.self, forKey: .cdnBaseURL) ?? cdnBaseURL
        authToken = try container.decodeIfPresent(String.self, forKey: .authToken) ?? authToken
        userID = try container.decodeIfPresent(String.self, forKey: .userID) ?? userID
        codexAPIPath = try container.decodeIfPresent(String.self, forKey: .codexAPIPath) ?? codexAPIPath
        aiAPIURL = try container.decodeIfPresent(String.self, forKey: .aiAPIURL) ?? aiAPIURL
        desktopAgentBaseURL = try container.decodeIfPresent(String.self, forKey: .desktopAgentBaseURL) ?? desktopAgentBaseURL
        vpnURLScheme = try container.decodeIfPresent(String.self, forKey: .vpnURLScheme) ?? vpnURLScheme
        rdpHost = try container.decodeIfPresent(String.self, forKey: .rdpHost) ?? rdpHost
        rdpUser = try container.decodeIfPresent(String.self, forKey: .rdpUser) ?? rdpUser
        remoteDesktopProtocol = try container.decodeIfPresent(String.self, forKey: .remoteDesktopProtocol) ?? remoteDesktopProtocol
        remoteDesktopTunnelCommand = try container.decodeIfPresent(String.self, forKey: .remoteDesktopTunnelCommand) ?? remoteDesktopTunnelCommand
        serverBaseURL = try container.decodeIfPresent(String.self, forKey: .serverBaseURL) ?? serverBaseURL
        serverStartPath = try container.decodeIfPresent(String.self, forKey: .serverStartPath) ?? serverStartPath
        serverStopPath = try container.decodeIfPresent(String.self, forKey: .serverStopPath) ?? serverStopPath
        serverLogsPath = try container.decodeIfPresent(String.self, forKey: .serverLogsPath) ?? serverLogsPath
    }
}

extension HanasandDesktopSettings {
    var resolvedAIEndpoint: URL {
        let configured = aiAPIURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: configured), !configured.isEmpty {
            return url
        }

        let path = codexAPIPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return apiBaseURL.normalizedBaseURL.appendingPathComponent(path.isEmpty ? "tools/ai" : path)
    }
}

struct DesktopTheme {
    let isLight: Bool
    let background: Color
    let backgroundElevated: Color
    let sidebar: Color
    let sidebarSelected: Color
    let commandPanel: Color
    let commandBar: Color
    let card: Color
    let cardRaised: Color
    let field: Color
    let divider: Color
    let text: Color
    let textSecondary: Color
    let textTertiary: Color
    let accent: Color
    let accentSoft: Color
    let green: Color
    let danger: Color

    init(preference: AppearancePreference, systemScheme: ColorScheme) {
        isLight = preference == .light || (preference == .system && systemScheme == .light)
        if isLight {
            background = Color(red: 0.955, green: 0.955, blue: 0.940)
            backgroundElevated = Color(red: 0.985, green: 0.985, blue: 0.972)
            sidebar = Color(red: 0.895, green: 0.900, blue: 0.875)
            sidebarSelected = Color.black.opacity(0.075)
            commandPanel = Color(red: 0.990, green: 0.990, blue: 0.980)
            commandBar = Color(red: 0.915, green: 0.920, blue: 0.900)
            card = Color(red: 0.930, green: 0.932, blue: 0.912)
            cardRaised = Color(red: 0.980, green: 0.980, blue: 0.965)
            field = Color.white.opacity(0.88)
            divider = Color.black.opacity(0.11)
            text = Color(red: 0.090, green: 0.100, blue: 0.095)
            textSecondary = Color.black.opacity(0.58)
            textTertiary = Color.black.opacity(0.38)
            accent = Color(red: 0.180, green: 0.480, blue: 0.940)
            accentSoft = Color(red: 0.180, green: 0.480, blue: 0.940).opacity(0.14)
            green = Color(red: 0.120, green: 0.560, blue: 0.310)
            danger = Color(red: 0.780, green: 0.190, blue: 0.160)
        } else {
            background = Color(red: 0.080, green: 0.081, blue: 0.078)
            backgroundElevated = Color(red: 0.102, green: 0.104, blue: 0.098)
            sidebar = Color(red: 0.155, green: 0.160, blue: 0.150)
            sidebarSelected = Color.white.opacity(0.10)
            commandPanel = Color(red: 0.172, green: 0.172, blue: 0.166)
            commandBar = Color(red: 0.145, green: 0.145, blue: 0.140)
            card = Color(red: 0.135, green: 0.136, blue: 0.130)
            cardRaised = Color(red: 0.185, green: 0.186, blue: 0.176)
            field = Color.white.opacity(0.060)
            divider = Color.white.opacity(0.10)
            text = Color(red: 0.93, green: 0.93, blue: 0.90)
            textSecondary = Color.white.opacity(0.62)
            textTertiary = Color.white.opacity(0.40)
            accent = Color(red: 0.55, green: 0.74, blue: 1.0)
            accentSoft = Color(red: 0.55, green: 0.74, blue: 1.0).opacity(0.16)
            green = Color(red: 0.33, green: 0.78, blue: 0.50)
            danger = Color(red: 0.92, green: 0.34, blue: 0.31)
        }
    }
}

private struct DesktopThemeKey: EnvironmentKey {
    static let defaultValue = DesktopTheme(preference: .dark, systemScheme: .dark)
}

extension EnvironmentValues {
    var desktopTheme: DesktopTheme {
        get { self[DesktopThemeKey.self] }
        set { self[DesktopThemeKey.self] = newValue }
    }
}

@MainActor
final class DesktopAgentModel: ObservableObject {
    static let appVersion = "0.1.0"

    @Published var prompt = ""
    @Published var events: [AgentEvent] = []
    @Published var status = AgentStatus.ready()
    @Published var selectedProject = "Hanasand Desktop"
    @Published var selectedSection: DesktopSection = .command
    @Published var settings: HanasandDesktopSettings {
        didSet { saveSettings() }
    }
    @Published var appearancePreference: AppearancePreference {
        didSet {
            UserDefaults.standard.set(appearancePreference.rawValue, forKey: Self.appearancePreferenceKey)
        }
    }
    @Published var focusCommand = false
    @Published var isRunning = false
    @Published var updateStatus = AppUpdateStatus.idle
    @Published var updateManifest: AppUpdateManifest?
    @Published var stagedUpdatePath: String?
    @Published var mailSummary = "Not loaded"
    @Published var aiSummary = "Not loaded"
    @Published var aiMessages: [AIChatMessage] = AIChatMessage.seed
    @Published var aiTrace: [AITraceEvent] = []
    @Published var aiClients: [AIConnectedClient] = []
    @Published var aiSocketConnected = false
    @Published var aiActiveConversationID: String?
    @Published var aiRunStartedAt: Date?
    @Published var aiLastDuration = "No run yet"
    @Published var serverSummary = "Not checked"
    @Published var selectedDashboardPath: String?
    @Published var selectedDashboardTitle = "Dashboard"
    @Published var nativeDashboardPayload = "Select a dashboard card to load native data."
    @Published var nativeDashboardStatus = "Ready"
    @Published var isLoadingNativeDashboard = false
    @Published var backupServices: [DashboardBackupService] = []
    @Published var backupFiles: [DashboardBackupFile] = []
    @Published var notes: [DashboardNote] = []
    @Published var selectedNoteID = ""
    @Published var noteDraftTitle = ""
    @Published var noteDraftContent = ""
    @Published var vulnerabilityReport: DashboardVulnerabilityReport?
    @Published var databaseOverview: DashboardDatabaseOverview?
    @Published var trafficMetrics: DashboardTrafficMetrics?

    private static let appearancePreferenceKey = "hanasand.desktop.appearancePreference"
    private static let settingsKey = "hanasand.desktop.settings"
    private var server: LoopbackAgentServer?
    private var updateTask: Task<Void, Never>?
    private var aiSocketTask: URLSessionWebSocketTask?
    private var aiReceiveTask: Task<Void, Never>?

    init() {
        let saved = UserDefaults.standard.string(forKey: Self.appearancePreferenceKey)
        appearancePreference = AppearancePreference(rawValue: saved ?? "") ?? .system
        if let data = UserDefaults.standard.data(forKey: Self.settingsKey),
           let decoded = try? JSONDecoder().decode(HanasandDesktopSettings.self, from: data) {
            settings = decoded
        } else {
            settings = HanasandDesktopSettings()
        }
        if let initialSection = ProcessInfo.processInfo.environment["HANASAND_DESKTOP_INITIAL_SECTION"],
           let section = DesktopSection(rawValue: initialSection) {
            selectedSection = section
        }
    }

    func start() async {
        guard server == nil else { return }
        let next = LoopbackAgentServer(port: 45731) { [weak self] command in
            Task { @MainActor in
                self?.recordCommand(command)
            }
        }
        do {
            try next.start()
            server = next
            status = AgentStatus.ready(message: "online")
            append(meta: "Agent", body: "http://127.0.0.1:45731")
            beginAutomaticUpdateCheck()
        } catch {
            status = AgentStatus.ready(ok: false, message: error.localizedDescription)
            append(meta: "Agent error", body: error.localizedDescription, kind: .error)
        }
    }

    func beginAutomaticUpdateCheck() {
        updateTask?.cancel()
        updateTask = Task { [weak self] in
            await self?.checkForUpdates(automatic: true)
        }
    }

    func checkForUpdates(automatic: Bool = false) async {
        updateStatus = automatic ? .checking(message: "Checking") : .checking(message: "Checking")

        do {
            let manifest = try await AppUpdateClient().fetchManifest(currentVersion: Self.appVersion)
            updateManifest = manifest

            guard manifest.updateAvailable else {
                updateStatus = .upToDate(message: "Hanasand Desktop \(Self.appVersion) is current.")
                return
            }

            updateStatus = .downloading(message: "Downloading \(manifest.latestVersion)")
            let stagedPath = try await AppUpdateClient().download(manifest: manifest)
            stagedUpdatePath = stagedPath.path
            updateStatus = .ready(message: "Staged \(manifest.latestVersion)")
            append(meta: "Update", body: stagedPath.lastPathComponent, kind: .change)
        } catch {
            updateStatus = .failed(message: error.localizedDescription)
            append(meta: "Auto update failed", body: error.localizedDescription, kind: .error)
        }
    }

    func revealStagedUpdate() {
        guard let stagedUpdatePath else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: stagedUpdatePath)])
    }

    func submitPrompt() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        prompt = ""
        isRunning = true
        append(meta: "You", body: trimmed, kind: .user)

        let lowered = trimmed.lowercased()
        if lowered == "status" || lowered.contains("status") || lowered.contains("pc") || lowered.contains("mac") {
            recordCommand("status")
            isRunning = false
        } else if lowered.contains("mail") {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.loadMailOverview()
            }
        } else if lowered.contains("server") || lowered.contains("logs") {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.checkServerLogs()
            }
        } else if lowered.contains("models") {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.loadAiModels()
            }
        } else if lowered == "update" || lowered.contains("update") {
            recordCommand("update")
            isRunning = false
        } else {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }

                do {
                    let response = try await HanasandAIClient(
                        apiURL: settings.resolvedAIEndpoint,
                        token: authTokenForRequests,
                        userId: userIDForRequests
                    ).send(
                        prompt: trimmed,
                        context: status.aiContext
                    )
                    append(meta: response.meta, body: response.body, kind: .command)
                } catch {
                    append(meta: "AI error", body: error.localizedDescription, kind: .error)
                }
            }
        }
    }

    func runStatusCommand() {
        recordCommand("status")
    }

    func recordCommand(_ command: String) {
        if command == "status" {
            status = AgentStatus.ready(message: "status command executed")
            append(meta: "Status", body: "\(status.hostname) · \(status.platform) · \(Int(status.uptimeSeconds / 60)) min", kind: .command)
        } else if command == "update" {
            beginAutomaticUpdateCheck()
            append(meta: "Update", body: "/api/app", kind: .command)
        } else {
            append(meta: "Blocked", body: command, kind: .error)
        }
    }

    func refreshLocalStatus() async {
        do {
            let loaded: AgentStatus = try await requestJSON(settings.desktopAgentBaseURL.normalizedBaseURL.appendingPathComponent("status"))
            status = loaded
            append(meta: "This Mac", body: "\(loaded.hostname) · \(loaded.platform) · \(Int(loaded.uptimeSeconds / 60)) min", kind: .command)
        } catch {
            status = AgentStatus.ready(ok: false, message: error.localizedDescription)
            append(meta: "This Mac", body: error.localizedDescription, kind: .error)
        }
    }

    func loadMailOverview() async {
        guard hasHanasandAuth else {
            mailSummary = "Configure API URL, auth token, and user id."
            append(meta: "Mail", body: mailSummary, kind: .error)
            return
        }

        do {
            let overview: MailOverviewEnvelope = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingPathComponent("mail/overview"),
                authenticated: true
            )
            mailSummary = "\(overview.messages.count) messages · \(overview.mailboxes.count) mailboxes"
            append(meta: "Mail", body: mailSummary, kind: .command)
        } catch {
            mailSummary = error.localizedDescription
            append(meta: "Mail", body: error.localizedDescription, kind: .error)
        }
    }

    func loadAiModels() async {
        do {
            let models: AIModelsEnvelope = try await requestJSON(
                settings.apiBaseURL.normalizedBaseURL.appendingPathComponent("ai/models"),
                authenticated: hasHanasandAuth
            )
            let connected = models.connected.map { client in
                AIConnectedClient(
                    rawID: client.id,
                    name: client.name,
                    lastSeen: nil,
                    model: client.model
                )
            }
            aiClients = connected.sortedForRuntime
            let names = aiClients.map(\.name).filter { !$0.isEmpty }
            aiSummary = names.isEmpty ? "No connected models" : names.joined(separator: ", ")
            append(meta: "Hanasand AI", body: aiSummary, kind: names.isEmpty ? .error : .command)
        } catch {
            aiSummary = error.localizedDescription
            append(meta: "Hanasand AI", body: error.localizedDescription, kind: .error)
        }
    }

    func loadAIPage() async {
        await loadAiModels()
        connectAISocket()
        if aiTrace.isEmpty {
            appendAITrace(.system, title: "Runtime", detail: "Connected to the Hanasand model pool and ready to stream chat, tools, timings, and file artifacts.")
        }
    }

    func connectAISocket() {
        if aiSocketTask != nil { return }
        guard let url = settings.apiBaseURL.websocketBaseURL?.appendingPathComponent("client/ws/gpt") else {
            aiSummary = "Invalid websocket URL"
            appendAITrace(.error, title: "Socket", detail: "Could not derive a websocket URL from \(settings.apiBaseURL).")
            return
        }

        let task = URLSession.shared.webSocketTask(with: url)
        aiSocketTask = task
        aiSocketConnected = true
        aiSummary = aiClients.isEmpty ? "Connecting to model pool" : aiSummary
        task.resume()
        appendAITrace(.system, title: "Socket", detail: "Listening on \(url.absoluteString).")

        aiReceiveTask?.cancel()
        aiReceiveTask = Task { [weak self] in
            await self?.receiveAISocketMessages()
        }
    }

    func disconnectAISocket() {
        aiReceiveTask?.cancel()
        aiReceiveTask = nil
        aiSocketTask?.cancel(with: .goingAway, reason: nil)
        aiSocketTask = nil
        aiSocketConnected = false
    }

    func submitAIChatPrompt() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        prompt = ""
        isRunning = true

        let userMessage = AIChatMessage(role: .user, content: trimmed)
        aiMessages.append(userMessage)
        let bestClient = aiClients.sortedForRuntime.first

        guard let socket = aiSocketTask, aiSocketConnected, let bestClient else {
            Task { [weak self] in
                guard let self else { return }
                defer { self.isRunning = false }
                await self.sendFallbackAIChat(trimmed)
            }
            return
        }

        let conversationId = "desktop-\(Int(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString.prefix(8))"
        aiActiveConversationID = conversationId
        aiRunStartedAt = Date()
        aiLastDuration = "Running"
        aiTrace.removeAll()
        appendAITrace(.thought, title: "Run plan", detail: "Selected \(bestClient.name) and sent \(aiMessages.count) visible chat messages to the runtime.")

        let request = AIPromptRequest(
            type: "prompt_request",
            conversationId: conversationId,
            clientName: bestClient.name,
            messages: aiMessages.suffix(12).map { message in
                AIPromptRequest.Message(role: message.role.rawValue, content: message.content)
            },
            maxTokens: 900,
            temperature: 0.7
        )

        do {
            let data = try JSONEncoder().encode(request)
            guard let text = String(data: data, encoding: .utf8) else {
                throw HanasandAIError.invalidPayload
            }
            socket.send(.string(text)) { [weak self] error in
                guard let self else { return }
                Task { @MainActor in
                    if let error {
                        self.isRunning = false
                        self.appendAITrace(.error, title: "Send failed", detail: error.localizedDescription)
                        self.aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
                    }
                }
            }
        } catch {
            isRunning = false
            appendAITrace(.error, title: "Request", detail: error.localizedDescription)
            aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
        }
    }

    private func sendFallbackAIChat(_ prompt: String) async {
        appendAITrace(.system, title: "Fallback", detail: "No live websocket model was available, so the desktop app used the HTTP AI endpoint.")
        do {
            let response = try await HanasandAIClient(
                apiURL: settings.resolvedAIEndpoint,
                token: authTokenForRequests,
                userId: userIDForRequests
            ).send(
                prompt: prompt,
                context: aiMessages.suffix(8).map { "\($0.role.rawValue): \($0.content)" }.joined(separator: "\n")
            )
            aiMessages.append(AIChatMessage(role: .assistant, content: response.body))
            aiSummary = response.meta
            aiLastDuration = "HTTP fallback"
        } catch {
            aiMessages.append(AIChatMessage(role: .assistant, content: error.localizedDescription, isError: true))
            appendAITrace(.error, title: "Fallback failed", detail: error.localizedDescription)
        }
    }

    private func receiveAISocketMessages() async {
        guard let socket = aiSocketTask else { return }
        while !Task.isCancelled {
            do {
                let message = try await socket.receive()
                let text: String
                switch message {
                case .string(let value):
                    text = value
                case .data(let data):
                    text = String(data: data, encoding: .utf8) ?? ""
                @unknown default:
                    text = ""
                }
                guard !text.isEmpty else { continue }
                await handleAISocketText(text)
            } catch {
                aiSocketConnected = false
                aiSocketTask = nil
                if !Task.isCancelled {
                    appendAITrace(.error, title: "Socket closed", detail: error.localizedDescription)
                }
                return
            }
        }
    }

    private func handleAISocketText(_ text: String) async {
        guard let data = text.data(using: .utf8),
              let event = try? JSONDecoder().decode(AISocketEvent.self, from: data) else {
            return
        }

        switch event.type {
        case "snapshot":
            aiClients = (event.clients ?? []).sortedForRuntime
            updateAISummaryFromClients()
        case "update":
            if let client = event.client {
                upsertAIClient(client)
                updateAISummaryFromClients()
            }
        case "prompt_started":
            guard isActiveAIEvent(event) else { return }
            appendAITrace(.thought, title: "Thinking", detail: "The runtime accepted the prompt and prepared context for \(event.clientName ?? "the selected model").")
            aiMessages.append(AIChatMessage(id: "\(event.conversationId ?? UUID().uuidString)-assistant", role: .assistant, content: "", isPending: true))
        case "prompt_tool":
            guard isActiveAIEvent(event) else { return }
            let label = event.toolLabel ?? event.toolId ?? "Tool"
            let detail = [event.toolState, event.toolDetail].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " · ")
            appendAITrace(.tool, title: label, detail: detail.isEmpty ? "Tool event received." : detail)
        case "prompt_delta":
            guard isActiveAIEvent(event) else { return }
            appendToActiveAIResponse(event.delta ?? "")
        case "prompt_complete":
            guard isActiveAIEvent(event) else { return }
            finishActiveAIResponse(content: event.content, artifacts: event.artifacts ?? [], overhead: event.overhead)
        case "prompt_error":
            guard isActiveAIEvent(event) else { return }
            isRunning = false
            aiLastDuration = elapsedAIRunText()
            appendAITrace(.error, title: "Model error", detail: event.error ?? "The model failed to answer this prompt.")
            aiMessages.append(AIChatMessage(role: .assistant, content: event.error ?? "The model failed to answer this prompt.", isError: true))
        default:
            break
        }
    }

    private func isActiveAIEvent(_ event: AISocketEvent) -> Bool {
        guard let active = aiActiveConversationID else { return true }
        return event.conversationId == nil || event.conversationId == active
    }

    private func appendToActiveAIResponse(_ delta: String) {
        guard !delta.isEmpty else { return }
        if let index = aiMessages.lastIndex(where: { $0.isPending && $0.role == .assistant }) {
            aiMessages[index].content += delta
        } else {
            aiMessages.append(AIChatMessage(role: .assistant, content: delta, isPending: true))
        }
    }

    private func finishActiveAIResponse(content: String?, artifacts: [AIArtifact], overhead: AIOverheadSample?) {
        isRunning = false
        aiLastDuration = elapsedAIRunText(overhead: overhead)
        if let content, !content.isEmpty, !aiMessages.contains(where: { $0.role == .assistant && $0.content == content }) {
            aiMessages.append(AIChatMessage(role: .assistant, content: content))
        }
        if let index = aiMessages.lastIndex(where: { $0.isPending && $0.role == .assistant }) {
            if let content, !content.isEmpty, aiMessages[index].content.isEmpty {
                aiMessages[index].content = content
            }
            aiMessages[index].isPending = false
        }

        let toolCount = aiTrace.filter { $0.kind == .tool }.count
        appendAITrace(.thought, title: "Run summary", detail: "Worked for \(aiLastDuration), used \(toolCount) surfaced tool event\(toolCount == 1 ? "" : "s"), and streamed the answer back into chat.")
        if !artifacts.isEmpty {
            for artifact in artifacts.prefix(8) {
                appendAITrace(.file, title: artifact.displayTitle, detail: artifact.displayDetail)
            }
        } else {
            appendAITrace(.file, title: "Files", detail: "No file artifacts or changed-file summaries were reported by this model run.")
        }
    }

    private func elapsedAIRunText(overhead: AIOverheadSample? = nil) -> String {
        if let totalMs = overhead?.stages?["totalMs"] {
            return formatMilliseconds(totalMs)
        }
        guard let aiRunStartedAt else { return "unknown duration" }
        return formatMilliseconds(Date().timeIntervalSince(aiRunStartedAt) * 1000)
    }

    private func appendAITrace(_ kind: AITraceEvent.Kind, title: String, detail: String) {
        aiTrace.append(AITraceEvent(kind: kind, title: title, detail: detail))
        if aiTrace.count > 80 {
            aiTrace.removeFirst(aiTrace.count - 80)
        }
    }

    private func upsertAIClient(_ client: AIConnectedClient) {
        if let index = aiClients.firstIndex(where: { $0.name == client.name }) {
            aiClients[index] = client
        } else {
            aiClients.append(client)
        }
        aiClients = aiClients.sortedForRuntime
    }

    private func updateAISummaryFromClients() {
        let names = aiClients.map(\.name).filter { !$0.isEmpty }
        aiSummary = names.isEmpty ? (aiSocketConnected ? "No connected models" : "Not connected") : names.joined(separator: ", ")
    }

    func openVPN() {
        guard let url = URL(string: settings.vpnURLScheme) else {
            append(meta: "VPN", body: "Invalid VPN URL scheme.", kind: .error)
            return
        }
        NSWorkspace.shared.open(url)
    }

    func openWebsite(path: String, label: String) {
        let normalizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent(normalizedPath)
        NSWorkspace.shared.open(url)
        append(meta: "Opened \(label)", body: url.absoluteString, kind: .command)
    }

    func openNativeDashboard(path: String, label: String) {
        selectedDashboardPath = path
        selectedDashboardTitle = label
        selectedSection = .dashboard
        append(meta: "Dashboard", body: "Opened native \(label)", kind: .command)
        Task { await loadNativeDashboardData() }
    }

    func closeNativeDashboardPage() {
        selectedDashboardPath = nil
        selectedDashboardTitle = "Dashboard"
        nativeDashboardPayload = "Select a dashboard card to load native data."
        nativeDashboardStatus = "Ready"
        backupServices = []
        backupFiles = []
        notes = []
        selectedNoteID = ""
        noteDraftTitle = ""
        noteDraftContent = ""
        vulnerabilityReport = nil
        databaseOverview = nil
        trafficMetrics = nil
    }

    func openURL(_ rawValue: String, label: String) {
        guard let url = URL(string: rawValue) else {
            append(meta: label, body: "Invalid URL: \(rawValue)", kind: .error)
            return
        }
        NSWorkspace.shared.open(url)
        append(meta: "Opened \(label)", body: url.absoluteString, kind: .command)
    }

    func openServerLogsPage() {
        if settings.serverLogsPath.lowercased().hasPrefix("http"),
           let url = URL(string: settings.serverLogsPath) {
            NSWorkspace.shared.open(url)
            append(meta: "Opened logs", body: url.absoluteString, kind: .command)
            return
        }
        openWebsite(path: "/dashboard/logs", label: "Logs")
    }

    func configureMacMiniRemoteDesktop() {
        settings.rdpHost = "localhost:5900"
        settings.rdpUser = "macmini"
        settings.remoteDesktopProtocol = RemoteDesktopProtocol.screenSharing.rawValue
        settings.remoteDesktopTunnelCommand = HanasandDesktopSettings.macMiniTunnelCommand
        append(meta: "Remote desktop", body: "Mac mini profile ready. Start the tunnel, then connect.", kind: .change)
    }

    func openRemoteDesktopTunnel() {
        let command = settings.remoteDesktopTunnelCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty else {
            append(meta: "Remote desktop", body: "Configure a tunnel command first.", kind: .error)
            return
        }

        let escapedCommand = command
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let script = """
        tell application "Terminal"
            activate
            do script "\(escapedCommand)"
        end tell
        """
        var error: NSDictionary?
        guard NSAppleScript(source: script)?.executeAndReturnError(&error) != nil else {
            append(meta: "Remote desktop", body: error?.description ?? "Could not open tunnel terminal.", kind: .error)
            return
        }
        append(meta: "Remote desktop", body: "Tunnel command opened in Terminal.", kind: .command)
    }

    func openRemoteDesktop(protocol override: RemoteDesktopProtocol? = nil) {
        let host = settings.rdpHost.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !host.isEmpty else {
            append(meta: "Remote desktop", body: "Configure a remote host first.", kind: .error)
            return
        }

        let protocolKind = override ?? RemoteDesktopProtocol(rawValue: settings.remoteDesktopProtocol) ?? .screenSharing
        let user = settings.rdpUser.trimmingCharacters(in: .whitespacesAndNewlines)
        let target = user.isEmpty ? host : "\(user)@\(host)"
        let urlString: String
        switch protocolKind {
        case .screenSharing:
            let allowed = CharacterSet.urlUserAllowed
                .union(.urlHostAllowed)
                .union(CharacterSet(charactersIn: ":@[]"))
            let encodedTarget = target.addingPercentEncoding(withAllowedCharacters: allowed) ?? target
            urlString = "vnc://\(encodedTarget)"
        case .microsoftRDP:
            let allowed = CharacterSet.urlQueryAllowed.union(CharacterSet(charactersIn: ":@"))
            let encodedTarget = target.addingPercentEncoding(withAllowedCharacters: allowed) ?? target
            urlString = "rdp://full%20address=s:\(encodedTarget)"
        }

        guard let url = URL(string: urlString) else {
            append(meta: "Remote desktop", body: "Invalid remote target.", kind: .error)
            return
        }
        NSWorkspace.shared.open(url)
        append(meta: protocolKind.label, body: target, kind: .command)
    }

    func runServerAction(_ path: String) async {
        do {
            let text = try await requestText(
                settings.serverBaseURL.normalizedBaseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
                method: "POST",
                authenticated: hasHanasandAuth
            )
            serverSummary = text.isEmpty ? "Done" : String(text.prefix(900))
            append(meta: "Server", body: serverSummary, kind: .command)
        } catch {
            serverSummary = error.localizedDescription
            append(meta: "Server", body: error.localizedDescription, kind: .error)
        }
    }

    func checkServerLogs() async {
        do {
            let text = try await requestText(
                settings.serverBaseURL.normalizedBaseURL.appendingPathComponent(settings.serverLogsPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
                authenticated: hasHanasandAuth
            )
            serverSummary = text.isEmpty ? "No logs returned" : String(text.prefix(900))
            append(meta: "Server logs", body: serverSummary, kind: .command)
        } catch {
            serverSummary = error.localizedDescription
            append(meta: "Server logs", body: error.localizedDescription, kind: .error)
        }
    }

    func loadNativeDashboardData() async {
        guard let path = selectedDashboardPath else { return }
        guard let endpoint = nativeEndpoint(for: path) else {
            nativeDashboardStatus = "Native controls"
            nativeDashboardPayload = nativeFallbackDescription(for: path)
            return
        }

        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Loading \(endpoint.label)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                endpoint.baseURL.appendingAPIPath(endpoint.path),
                authenticated: endpoint.authenticated,
                userAgent: endpoint.userAgent
            )
            nativeDashboardStatus = "Loaded \(endpoint.label)"
            nativeDashboardPayload = text.isEmpty ? "No data returned." : String(text.prefix(24_000))
            updateTypedDashboardState(from: text, path: path)
        } catch {
            nativeDashboardStatus = error.localizedDescription
            nativeDashboardPayload = "Could not load \(endpoint.label): \(error.localizedDescription)"
        }
    }

    func runNativeDashboardMutation(_ mutation: NativeDashboardMutation) async {
        isLoadingNativeDashboard = true
        nativeDashboardStatus = "Running \(mutation.label)"
        defer { isLoadingNativeDashboard = false }

        do {
            let text = try await requestPrettyText(
                mutation.baseURL(settings: settings).appendingAPIPath(mutation.path),
                method: "POST",
                body: mutation.body,
                authenticated: true,
                userAgent: mutation.userAgent
            )
            nativeDashboardStatus = text.isEmpty ? "Completed \(mutation.label)" : String(text.prefix(240))
            append(meta: mutation.label, body: nativeDashboardStatus, kind: .change)
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
            append(meta: mutation.label, body: error.localizedDescription, kind: .error)
        }
    }

    private func append(meta: String, body: String, kind: AgentEvent.Kind = .note) {
        events.append(AgentEvent(meta: meta, body: body, kind: kind))
        if events.count > 80 {
            events.removeFirst(events.count - 80)
        }
    }

    private var hasHanasandAuth: Bool {
        !authTokenForRequests.isEmpty && !userIDForRequests.isEmpty
    }

    private var authTokenForRequests: String {
        let configured = settings.authToken.trimmingCharacters(in: .whitespacesAndNewlines)
        if !configured.isEmpty {
            return configured
        }
        let environment = ProcessInfo.processInfo.environment
        return environment["HANASAND_API_TOKEN"] ?? environment["HANASAND_AUTH_TOKEN"] ?? ""
    }

    private var userIDForRequests: String {
        let configured = settings.userID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !configured.isEmpty {
            return configured
        }
        return ProcessInfo.processInfo.environment["HANASAND_USER_ID"] ?? ""
    }

    private func saveSettings() {
        guard let data = try? JSONEncoder().encode(settings) else { return }
        UserDefaults.standard.set(data, forKey: Self.settingsKey)
    }

    private func request(_ url: URL, method: String = "GET", body: Data? = nil, authenticated: Bool = false, userAgent: String? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 12
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        if let userAgent {
            request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        }
        if authenticated {
            request.setValue("Bearer \(authTokenForRequests)", forHTTPHeaderField: "Authorization")
            request.setValue(userIDForRequests, forHTTPHeaderField: "id")
        }
        return request
    }

    private func requestJSON<T: Decodable>(_ url: URL, authenticated: Bool = false) async throws -> T {
        let (data, response) = try await URLSession.shared.data(for: request(url, authenticated: authenticated))
        try validateHTTP(response)
        return try JSONDecoder().decode(T.self, from: data)
    }

    private func requestText(_ url: URL, method: String = "GET", authenticated: Bool = false) async throws -> String {
        let (data, response) = try await URLSession.shared.data(for: request(url, method: method, authenticated: authenticated))
        try validateHTTP(response)
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func requestPrettyText(_ url: URL, method: String = "GET", body: Data? = nil, authenticated: Bool = false, userAgent: String? = nil) async throws -> String {
        let (data, response) = try await URLSession.shared.data(for: request(url, method: method, body: body, authenticated: authenticated, userAgent: userAgent))
        try validateHTTP(response)
        if let object = try? JSONSerialization.jsonObject(with: data),
           let prettyData = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
           let pretty = String(data: prettyData, encoding: .utf8) {
            return pretty
        }
        return String(data: data, encoding: .utf8) ?? ""
    }

    private func updateTypedDashboardState(from text: String, path: String) {
        guard let data = text.data(using: .utf8) else { return }
        let decoder = JSONDecoder()
        switch path {
        case "/dashboard/db":
            databaseOverview = try? decoder.decode(DashboardDatabaseOverview.self, from: data)
        case "/dashboard/db/backups":
            backupServices = (try? decoder.decode([DashboardBackupService].self, from: data)) ?? []
        case "/dashboard/db/restore":
            backupFiles = (try? decoder.decode([DashboardBackupFile].self, from: data)) ?? []
        case "/dashboard/notes":
            notes = (try? decoder.decode([DashboardNote].self, from: data)) ?? []
            if selectedNoteID.isEmpty || !notes.contains(where: { $0.id == selectedNoteID }) {
                selectedNoteID = notes.first?.id ?? ""
            }
            loadSelectedNoteIntoDraft()
        case "/dashboard/vulnerabilities":
            vulnerabilityReport = try? decoder.decode(DashboardVulnerabilityReport.self, from: data)
        case "/dashboard/traffic":
            trafficMetrics = try? decoder.decode(DashboardTrafficMetrics.self, from: data)
        default:
            break
        }
    }

    private func validateHTTP(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw UpdateError.httpStatus(http.statusCode)
        }
    }

    var realProjects: [ProjectItem] {
        [
            .folder("Current"),
            .init(title: URL(fileURLWithPath: status.cwd).lastPathComponent, state: status.ok ? .live : .normal),
        ]
    }

    var dashboardActions: [DesktopAction] {
        [
            .route("Overview", "Main dashboard and service overview.", "gauge.with.dots.needle", "/dashboard"),
            .route("Mail", "Open the full mail workspace.", "envelope", "/dashboard/mail"),
            .route("Notes", "Shared notes and operational memory.", "note.text", "/dashboard/notes"),
            .route("Traffic", "Live traffic, records, and maps.", "point.3.connected.trianglepath.dotted", "/dashboard/traffic"),
            .route("AI Metrics", "Model pool and system AI telemetry.", "sparkles", "/dashboard/system/ai"),
            .route("System", "Infrastructure and VM controls.", "gearshape.2", "/dashboard/system"),
            .route("VMs", "Remote machines and access details.", "display.2", "/dashboard/vms"),
            .route("Shares", "Coding shares and hosted workspaces.", "folder.badge.gearshape", "/s"),
            .route("Share Gallery", "Published projects and share gallery.", "square.grid.3x3", "/g"),
            .route("Upload", "Upload files and assets.", "arrow.up.doc", "/upload"),
            .route("Articles", "Draft and publish articles.", "text.alignleft", "/dashboard/articles"),
            .route("Thoughts", "Ideas, writing, and thought board.", "brain.head.profile", "/dashboard/thoughts"),
            .route("Profile", "Account, VMs, sessions, and certificates.", "person.crop.circle", "/profile"),
        ]
    }

    var adminActions: [DesktopAction] {
        [
            .route("Logs", "Runtime logs and diagnostics.", "exclamationmark.triangle", "/dashboard/logs"),
            .route("Database", "Database overview and operations.", "externaldrive.connected.to.line.below", "/dashboard/db"),
            .route("Backups", "Database backup status.", "externaldrive.badge.timemachine", "/dashboard/db/backups"),
            .route("Restore", "Browse and restore database backups.", "arrow.counterclockwise.circle", "/dashboard/db/restore"),
            .route("Vulnerabilities", "Security image scans and findings.", "shield.lefthalf.filled.badge.checkmark", "/dashboard/vulnerabilities"),
            .route("Management", "Admin management console.", "checkmark.shield", "/dashboard/management"),
            .route("Users", "User administration.", "person.2", "/users"),
            .route("Roles", "Role administration.", "person.badge.key", "/role"),
        ]
    }

    var quickAppActions: [DesktopAction] {
        [
            .url("Hanasand", "Open the public website.", "safari", settings.websiteBaseURL),
            .url("GitHub", "Open source repositories.", "chevron.left.forwardslash.chevron.right", "https://github.com/eirikhanasand"),
            .url("LinkedIn", "Open LinkedIn profile.", "person.text.rectangle", "https://linkedin.com/in/eirikhanasand"),
            .url("Mail", "Compose an email.", "paperplane", "mailto:eirik.hanasand@gmail.com"),
            .url("Discord", "Open Discord profile.", "bubble.left.and.bubble.right", "https://discordapp.com/users/376827396764073997"),
        ]
    }

    private struct NativeEndpoint {
        let label: String
        let baseURL: URL
        let path: String
        let authenticated: Bool
        let userAgent: String?
    }

    private func nativeEndpoint(for dashboardPath: String) -> NativeEndpoint? {
        let cleanPath = dashboardPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let api = settings.apiBaseURL.normalizedBaseURL
        let internalAPI = settings.internalAPIBaseURL.normalizedBaseURL
        let beekeeper = settings.beekeeperAPIBaseURL.normalizedBaseURL
        let auth = hasHanasandAuth

        switch cleanPath {
        case "dashboard", "dashboard/overview":
            return NativeEndpoint(label: "system status", baseURL: api, path: "status", authenticated: auth, userAgent: nil)
        case "dashboard/mail":
            return NativeEndpoint(label: "mail overview", baseURL: api, path: "mail/overview", authenticated: true, userAgent: nil)
        case "dashboard/notes":
            return NativeEndpoint(label: "notes", baseURL: api, path: "notes", authenticated: true, userAgent: nil)
        case "dashboard/traffic":
            return NativeEndpoint(label: "traffic metrics", baseURL: beekeeper, path: "traffic/metrics", authenticated: true, userAgent: nil)
        case "dashboard/system":
            return NativeEndpoint(label: "docker metrics", baseURL: api, path: "docker", authenticated: auth, userAgent: nil)
        case "dashboard/system/ai":
            return NativeEndpoint(label: "AI models", baseURL: api, path: "ai/models", authenticated: auth, userAgent: nil)
        case "dashboard/vms":
            let userPath = userIDForRequests.isEmpty ? "vms" : "vms/access/\(userIDForRequests)"
            return NativeEndpoint(label: "virtual machines", baseURL: api, path: userPath, authenticated: auth, userAgent: nil)
        case "dashboard/logs":
            return NativeEndpoint(label: "logs", baseURL: api, path: "logs", authenticated: true, userAgent: nil)
        case "dashboard/db":
            return NativeEndpoint(label: "database overview", baseURL: internalAPI, path: "db", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/db/backups":
            return NativeEndpoint(label: "backup services", baseURL: internalAPI, path: "backup", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/db/restore":
            return NativeEndpoint(label: "backup files", baseURL: internalAPI, path: "backup/files", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/vulnerabilities":
            return NativeEndpoint(label: "vulnerabilities", baseURL: internalAPI, path: "vulnerabilities", authenticated: true, userAgent: "hanasand_internal")
        case "dashboard/management", "users":
            return NativeEndpoint(label: "users", baseURL: api, path: "users", authenticated: true, userAgent: nil)
        case "role":
            return NativeEndpoint(label: "roles", baseURL: api, path: "roles", authenticated: true, userAgent: nil)
        case "dashboard/articles":
            return NativeEndpoint(label: "articles", baseURL: api, path: "articles", authenticated: auth, userAgent: nil)
        case "dashboard/thoughts":
            return NativeEndpoint(label: "thoughts", baseURL: api, path: "thoughts", authenticated: auth, userAgent: nil)
        case "profile":
            guard !userIDForRequests.isEmpty else { return nil }
            return NativeEndpoint(label: "profile", baseURL: api, path: "user/full/\(userIDForRequests)", authenticated: true, userAgent: nil)
        case "s":
            return NativeEndpoint(label: "execution targets", baseURL: api, path: "tools/execution-targets", authenticated: auth, userAgent: nil)
        case "g":
            return NativeEndpoint(label: "recent tests", baseURL: api, path: "tests/recent", authenticated: auth, userAgent: nil)
        default:
            return nil
        }
    }

    private func nativeFallbackDescription(for dashboardPath: String) -> String {
        switch dashboardPath {
        case "/upload":
            return "Upload is intentionally kept native-only here. A desktop file picker and multipart upload target still need to be paired before this can send files safely."
        case "/profile":
            return "Configure auth token and user id in Settings to load the native profile payload."
        default:
            return "No direct API-backed native panel is registered for \(dashboardPath) yet."
        }
    }

    func selectNote(_ note: DashboardNote?) {
        selectedNoteID = note?.id ?? ""
        loadSelectedNoteIntoDraft()
    }

    func newNoteDraft() {
        selectedNoteID = ""
        noteDraftTitle = ""
        noteDraftContent = ""
    }

    func saveNoteDraft() async {
        let title = noteDraftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = noteDraftContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty || !content.isEmpty else {
            nativeDashboardStatus = "Write something first."
            return
        }

        let payload = ["title": title, "content": content, "source": "desktop"]
        let body = (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)
        let isUpdate = !selectedNoteID.isEmpty
        let path = isUpdate ? "notes/\(selectedNoteID)" : "notes"
        let method = isUpdate ? "PUT" : "POST"

        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath(path),
                method: method,
                body: body,
                authenticated: true
            )
            nativeDashboardStatus = "Saved note."
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    func deleteSelectedNote() async {
        guard !selectedNoteID.isEmpty else { return }
        do {
            _ = try await requestPrettyText(
                settings.apiBaseURL.normalizedBaseURL.appendingAPIPath("notes/\(selectedNoteID)"),
                method: "DELETE",
                authenticated: true
            )
            nativeDashboardStatus = "Deleted note."
            selectedNoteID = ""
            noteDraftTitle = ""
            noteDraftContent = ""
            await loadNativeDashboardData()
        } catch {
            nativeDashboardStatus = error.localizedDescription
        }
    }

    private func loadSelectedNoteIntoDraft() {
        guard let selected = notes.first(where: { $0.id == selectedNoteID }) else {
            noteDraftTitle = ""
            noteDraftContent = ""
            return
        }
        noteDraftTitle = selected.title
        noteDraftContent = selected.content
    }
}

struct DesktopAction: Identifiable {
    enum Kind {
        case route(String)
        case url(String)
        case task
    }

    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let kind: Kind
    let task: ((DesktopAgentModel) -> Void)?

    static func route(_ title: String, _ subtitle: String, _ icon: String, _ path: String) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .route(path), task: nil)
    }

    static func url(_ title: String, _ subtitle: String, _ icon: String, _ url: String) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .url(url), task: nil)
    }

    static func task(_ title: String, _ subtitle: String, _ icon: String, action: @escaping (DesktopAgentModel) -> Void) -> DesktopAction {
        DesktopAction(title: title, subtitle: subtitle, icon: icon, kind: .task, task: action)
    }

    @MainActor
    func perform(with model: DesktopAgentModel) {
        switch kind {
        case .route(let path):
            model.openNativeDashboard(path: path, label: title)
        case .url(let url):
            model.openURL(url, label: title)
        case .task:
            task?(model)
        }
    }
}

enum NativeDashboardMutation {
    case runBackup
    case restoreBackup(service: String, file: String)
    case runVulnerabilityScan

    var label: String {
        switch self {
        case .runBackup: return "backup"
        case .restoreBackup: return "backup restore"
        case .runVulnerabilityScan: return "vulnerability scan"
        }
    }

    var path: String {
        switch self {
        case .runBackup: return "backup"
        case .restoreBackup: return "backup/restore"
        case .runVulnerabilityScan: return "vulnerabilities/scan"
        }
    }

    var body: Data {
        switch self {
        case .runBackup, .runVulnerabilityScan:
            return Data("{}".utf8)
        case .restoreBackup(let service, let file):
            let payload = ["service": service, "file": file]
            return (try? JSONEncoder().encode(payload)) ?? Data("{}".utf8)
        }
    }

    var userAgent: String? {
        "hanasand_internal"
    }

    func baseURL(settings: HanasandDesktopSettings) -> URL {
        settings.internalAPIBaseURL.normalizedBaseURL
    }
}

struct DashboardBackupService: Decodable, Identifiable {
    let id: String
    let name: String
    let status: String
    let error: String?
    let dbSize: String?
    let totalStorage: String?
    let lastBackup: String?
    let nextBackup: String?
}

struct DashboardBackupFile: Decodable, Identifiable {
    var id: String { "\(service)-\(file)-\(location ?? "unknown")" }
    let service: String
    let file: String
    let mtime: String?
    let size: String?
    let location: String?
}

struct DashboardNote: Decodable, Identifiable {
    let id: String
    let title: String
    let content: String
    let source: String
    let ownerID: String?
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case content
        case source
        case ownerID = "owner_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct DashboardSeverityCount: Decodable {
    let critical: Int
    let high: Int
    let medium: Int
    let low: Int
    let unknown: Int
}

struct DashboardVulnerabilityReport: Decodable {
    let generatedAt: String?
    let imageCount: Int
    let images: [DashboardImageVulnerabilityReport]
    let scanStatus: DashboardScanStatus
}

struct DashboardImageVulnerabilityReport: Decodable, Identifiable {
    var id: String { image }
    let image: String
    let scannedAt: String
    let totalVulnerabilities: Int
    let severity: DashboardSeverityCount
    let scanError: String?
}

struct DashboardScanStatus: Decodable {
    let isRunning: Bool
    let startedAt: String?
    let finishedAt: String?
    let lastSuccessAt: String?
    let lastError: String?
    let totalImages: Int?
    let completedImages: Int
    let currentImage: String?
}

struct DashboardDatabaseOverview: Decodable {
    let generatedAt: String
    let clusterCount: Int
    let databaseCount: Int
    let totalSizeBytes: Int
    let activeQueries: Int
    let averageQuerySeconds: Double?
    let clusters: [DashboardDatabaseCluster]
}

struct DashboardDatabaseCluster: Decodable, Identifiable {
    let id: String
    let name: String
    let engine: String?
    let version: String?
    let host: String?
    let activeQueries: Int
    let totalSizeBytes: Int
    let databaseCount: Int
    let error: String?
    let databases: [DashboardDatabase]
}

struct DashboardDatabase: Decodable, Identifiable {
    var id: String { name }
    let name: String
    let sizeBytes: Int
    let tableCount: Int
    let activeConnections: Int?
}

struct DashboardTrafficMetrics: Decodable {
    struct Metric: Decodable, Identifiable {
        var id: String { key }
        let key: String
        let count: Int
    }

    let totalRequests: Int
    let avgRequestTime: Double
    let errorRate: Double
    let topDomains: [Metric]

    enum CodingKeys: String, CodingKey {
        case totalRequests = "total_requests"
        case avgRequestTime = "avg_request_time"
        case errorRate = "error_rate"
        case topDomains = "top_domains"
    }
}

struct AIModelMetrics: Codable, Equatable {
    let conversationId: String?
    let status: String?
    let currentTokens: Int?
    let maxTokens: Int?
    let promptTokens: Int?
    let generatedTokens: Int?
    let contextTokens: Int?
    let contextMaxTokens: Int?
    let tps: Double?
    let lastUpdated: String?
    let lastError: String?
}

struct AIConnectedClient: Codable, Identifiable, Equatable {
    var id: String { name }
    let rawID: String?
    let name: String
    let lastSeen: String?
    let model: AIModelMetrics?

    enum CodingKeys: String, CodingKey {
        case rawID = "id"
        case name
        case lastSeen
        case model
    }

    var statusText: String {
        let status = model?.status?.capitalized ?? "Connected"
        let tps = model?.tps ?? 0
        return tps > 0 ? "\(status) · \(String(format: "%.1f", tps)) TPS" : status
    }
}

extension Array where Element == AIConnectedClient {
    var sortedForRuntime: [AIConnectedClient] {
        sorted { lhs, rhs in
            let leftTPS = lhs.model?.tps ?? 0
            let rightTPS = rhs.model?.tps ?? 0
            if leftTPS == rightTPS {
                return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
            }
            return leftTPS > rightTPS
        }
    }
}

struct AIChatMessage: Identifiable, Equatable {
    enum Role: String {
        case user
        case assistant
    }

    let id: String
    let role: Role
    var content: String
    var createdAt: Date
    var isPending: Bool
    var isError: Bool

    init(id: String = UUID().uuidString, role: Role, content: String, createdAt: Date = Date(), isPending: Bool = false, isError: Bool = false) {
        self.id = id
        self.role = role
        self.content = content
        self.createdAt = createdAt
        self.isPending = isPending
        self.isError = isError
    }

    static let seed = [
        AIChatMessage(role: .assistant, content: "Ask a question and I will route it to the fastest connected Hanasand model. Tool use, timing, and file artifacts will appear in the run trace.")
    ]
}

struct AITraceEvent: Identifiable, Equatable {
    enum Kind {
        case system
        case thought
        case tool
        case file
        case error

        var icon: String {
            switch self {
            case .system: return "antenna.radiowaves.left.and.right"
            case .thought: return "brain.head.profile"
            case .tool: return "wrench.and.screwdriver"
            case .file: return "doc.text"
            case .error: return "exclamationmark.triangle"
            }
        }
    }

    let id = UUID()
    let kind: Kind
    let title: String
    let detail: String
    let createdAt = Date()
}

struct AIArtifact: Decodable, Equatable {
    let label: String?
    let path: String?
    let content: String?
    let summary: String?

    var displayTitle: String {
        label ?? path ?? "Artifact"
    }

    var displayDetail: String {
        summary ?? path ?? content?.prefix(220).description ?? "File artifact produced by the model."
    }
}

struct AIOverheadSample: Decodable, Equatable {
    let stages: [String: Double]?
}

struct AISocketEvent: Decodable {
    let type: String
    let clients: [AIConnectedClient]?
    let client: AIConnectedClient?
    let conversationId: String?
    let clientName: String?
    let delta: String?
    let content: String?
    let error: String?
    let toolId: String?
    let toolLabel: String?
    let toolState: String?
    let toolDetail: String?
    let artifacts: [AIArtifact]?
    let overhead: AIOverheadSample?
}

struct AIPromptRequest: Encodable {
    struct Message: Encodable {
        let role: String
        let content: String
    }

    let type: String
    let conversationId: String
    let clientName: String
    let messages: [Message]
    let maxTokens: Int
    let temperature: Double
}

struct HanasandAIResponse {
    let meta: String
    let body: String
}

struct HanasandAIClient {
    private let session: URLSession
    private let apiURL: URL
    private let token: String
    private let userId: String

    init(apiURL configuredURL: URL? = nil, token configuredToken: String = "", userId configuredUserId: String = "", session: URLSession = .shared) {
        self.session = session
        let environment = ProcessInfo.processInfo.environment
        let configured = environment["HANASAND_AI_API"] ?? "https://api.hanasand.com/api/tools/ai"
        apiURL = configuredURL ?? URL(string: configured) ?? URL(string: "https://api.hanasand.com/api/tools/ai")!
        token = configuredToken.isEmpty ? (environment["HANASAND_API_TOKEN"] ?? environment["HANASAND_AUTH_TOKEN"] ?? "") : configuredToken
        userId = configuredUserId.isEmpty ? (environment["HANASAND_USER_ID"] ?? "") : configuredUserId
    }

    func send(prompt: String, context: String) async throws -> HanasandAIResponse {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if !userId.isEmpty {
            request.setValue(userId, forHTTPHeaderField: "id")
        }
        request.httpBody = try JSONEncoder().encode(AIRequest(prompt: prompt, context: context))

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 200
        let payload = try? JSONDecoder().decode(AIToolPayload.self, from: data)

        guard (200..<300).contains(status) else {
            if status == 401 && token.isEmpty {
                throw HanasandAIError.missingToken(apiURL.absoluteString)
            }
            throw HanasandAIError.httpStatus(status, payload?.error)
        }

        let text = payload?.message
            ?? payload?.suggestion
            ?? payload?.error
            ?? String(data: data, encoding: .utf8)
            ?? "No response."
        let meta = payload?.status == "configured_later" ? "Hanasand AI" : "Hanasand AI"

        return HanasandAIResponse(meta: meta, body: text)
    }

    private struct AIRequest: Encodable {
        let prompt: String
        let context: String
    }

    private struct AIToolPayload: Decodable {
        let status: String?
        let message: String?
        let suggestion: String?
        let error: String?
    }
}

enum HanasandAIError: LocalizedError {
    case invalidPayload
    case missingToken(String)
    case httpStatus(Int, String?)

    var errorDescription: String? {
        switch self {
        case .invalidPayload:
            return "Could not encode the Hanasand AI request."
        case .missingToken(let endpoint):
            return "The Hanasand AI endpoint is configured at \(endpoint), but it requires auth. Add a token in Settings or launch with HANASAND_API_TOKEN/HANASAND_AUTH_TOKEN."
        case .httpStatus(let status, let error):
            return error ?? "The Hanasand AI endpoint returned HTTP \(status)."
        }
    }
}

struct MailOverviewEnvelope: Decodable {
    struct Mailbox: Decodable {
        let id: String?
        let name: String?
    }

    struct Message: Decodable {
        let id: String?
        let subject: String?
    }

    let mailboxes: [Mailbox]
    let messages: [Message]
}

struct AIModelsEnvelope: Decodable {
    struct Client: Decodable {
        let id: String?
        let name: String
        let lastSeen: String?
        let model: AIModelMetrics?
    }

    let connected: [Client]
}

enum AppUpdateStatus {
    case idle
    case checking(message: String)
    case downloading(message: String)
    case ready(message: String)
    case upToDate(message: String)
    case failed(message: String)

    var title: String {
        switch self {
        case .idle: return "Ready"
        case .checking: return "Checking"
        case .downloading: return "Downloading"
        case .ready: return "Update staged"
        case .upToDate: return "Up to date"
        case .failed: return "Update failed"
        }
    }

    var message: String {
        switch self {
        case .idle: return "Idle"
        case .checking(let message), .downloading(let message), .ready(let message), .upToDate(let message), .failed(let message):
            return message
        }
    }

    var isBusy: Bool {
        switch self {
        case .checking, .downloading: return true
        default: return false
        }
    }
}

struct AppUpdateManifest: Decodable {
    let app: String
    let platform: String
    let installedVersion: String
    let latestVersion: String
    let updateAvailable: Bool
    let channel: String
    let releasedAt: String
    let notes: String
    let downloadURL: URL
    let packageSize: Int?
    let sha256: String?

    enum CodingKeys: String, CodingKey {
        case app
        case platform
        case installedVersion = "installed_version"
        case latestVersion = "latest_version"
        case updateAvailable = "update_available"
        case channel
        case releasedAt = "released_at"
        case notes
        case downloadURL = "download_url"
        case packageSize = "package_size"
        case sha256
    }
}

struct AppUpdateClient {
    private let session: URLSession
    private let apiURL: URL

    init(session: URLSession = .shared) {
        self.session = session
        let configured = ProcessInfo.processInfo.environment["HANASAND_APP_UPDATE_API"] ?? "https://hanasand.com/api/app"
        apiURL = URL(string: configured) ?? URL(string: "https://hanasand.com/api/app")!
    }

    func fetchManifest(currentVersion: String) async throws -> AppUpdateManifest {
        var components = URLComponents(url: apiURL, resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "platform", value: "macos"),
            URLQueryItem(name: "version", value: currentVersion),
        ]
        guard let url = components?.url else {
            throw UpdateError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        try validate(response: response)
        return try JSONDecoder().decode(AppUpdateManifest.self, from: data)
    }

    func download(manifest: AppUpdateManifest) async throws -> URL {
        let (temporaryURL, response) = try await session.download(from: manifest.downloadURL)
        try validate(response: response)

        let support = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = support.appendingPathComponent("Hanasand/Updates", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let ext = manifest.downloadURL.pathExtension.isEmpty ? "bin" : manifest.downloadURL.pathExtension
        let destination = directory.appendingPathComponent("Hanasand-\(manifest.latestVersion).\(ext)")
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.moveItem(at: temporaryURL, to: destination)

        if let expected = manifest.sha256 {
            let actual = try sha256(for: destination)
            guard actual.caseInsensitiveCompare(expected) == .orderedSame else {
                throw UpdateError.checksumMismatch
            }
        }

        return destination
    }

    private func validate(response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            throw UpdateError.httpStatus(http.statusCode)
        }
    }

    private func sha256(for url: URL) throws -> String {
        let data = try Data(contentsOf: url)
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

enum UpdateError: LocalizedError {
    case invalidURL
    case httpStatus(Int)
    case checksumMismatch

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The app update URL is invalid."
        case .httpStatus(let status):
            return "The Hanasand app update endpoint returned HTTP \(status)."
        case .checksumMismatch:
            return "The downloaded update did not match the API checksum."
        }
    }
}

struct DesktopShell: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.colorScheme) private var colorScheme
    @FocusState private var commandFocused: Bool

    var body: some View {
        let theme = DesktopTheme(preference: model.appearancePreference, systemScheme: colorScheme)

        HStack(spacing: 0) {
            Sidebar()
                .frame(width: 260)
            Divider().overlay(theme.divider.opacity(0.45))
            MainWorkspace(commandFocused: $commandFocused)
        }
        .background(theme.background)
        .foregroundStyle(theme.text)
        .environment(\.desktopTheme, theme)
        .preferredColorScheme(model.appearancePreference.preferredColorScheme)
        .onChange(of: model.focusCommand) {
            commandFocused = true
        }
    }
}

struct Sidebar: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 18) {
                Image(systemName: "sidebar.left")
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.left")
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
                Spacer()
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 24)

            VStack(alignment: .leading, spacing: 17) {
                ForEach([DesktopSection.command, .dashboard, .browser, .ide, .mac, .mail, .ai, .server, .updates], id: \.id) { section in
                    NavRow(icon: section.icon, title: section.title, isSelected: model.selectedSection == section)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            model.selectedSection = section
                        }
                }
            }
            .padding(.horizontal, 16)

            HStack {
                Text("Projects")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Image(systemName: "line.3.horizontal.decrease")
                Image(systemName: "folder.badge.plus")
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 16)
            .padding(.top, 34)
            .padding(.bottom, 14)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(model.realProjects) { project in
                        ProjectRow(project: project, isSelected: model.selectedSection == .command && model.selectedProject == project.title)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                model.selectedSection = .command
                                model.selectedProject = project.title
                            }
                    }
                }
                .padding(.horizontal, 8)
            }

            Spacer(minLength: 16)

            NavRow(icon: DesktopSection.settings.icon, title: DesktopSection.settings.title, isSelected: model.selectedSection == .settings)
                .contentShape(Rectangle())
                .onTapGesture {
                    model.selectedSection = .settings
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
        }
        .background(theme.sidebar)
    }
}

struct MainWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        switch model.selectedSection {
        case .command:
            VStack(spacing: 0) {
                TopBar()
                Transcript()
                CommandDock(commandFocused: commandFocused)
            }
            .background(theme.background)
        case .dashboard:
            DashboardWorkspace()
        case .browser:
            BrowserWorkspace()
        case .ide:
            IDEWorkspace()
        case .mac:
            MacWorkspace()
        case .mail:
            MailWorkspace()
        case .ai:
            AIWorkspace(commandFocused: commandFocused)
        case .server:
            ServerWorkspace()
        case .updates:
            UpdatesWorkspace()
        case .settings:
            SettingsWorkspace()
        }
    }
}

struct TopBar: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        HStack(spacing: 12) {
            Text(model.selectedSection == .command ? model.selectedProject : model.selectedSection.title)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Text("Desktop")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.secondary)
            Image(systemName: "ellipsis")
                .foregroundStyle(.secondary)
            Spacer()
            AgentStatusPill(status: model.status)
            UpdateStatusPill(status: model.updateStatus)
            Image(systemName: "terminal")
            Image(systemName: "folder")
            Image(systemName: "sidebar.right")
        }
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 18)
        .frame(height: 54)
    }
}

struct Transcript: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 26) {
                    if model.events.isEmpty {
                        EmptyTranscript()
                    } else {
                        ForEach(model.events) { event in
                            EventBlock(event: event)
                                .id(event.id)
                        }
                    }
                }
                .padding(.horizontal, 210)
                .padding(.top, 52)
                .padding(.bottom, 190)
            }
            .onChange(of: model.events.count) {
                if let last = model.events.last {
                    withAnimation(.snappy(duration: 0.18)) {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
        }
    }
}

struct EventBlock: View {
    @Environment(\.desktopTheme) private var theme
    let event: AgentEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(event.body)
                .font(.system(size: 16, weight: .semibold))
                .lineSpacing(5)
                .foregroundStyle(event.kind == .error ? theme.danger : theme.text)
                .textSelection(.enabled)
            Text(event.meta)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(event.kind == .change ? theme.green : theme.textSecondary)
        }
    }
}

struct EmptyTranscript: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Ready")
                .font(.system(size: 24, weight: .bold))
                .foregroundStyle(theme.text)
            HStack(spacing: 12) {
                AgentFact(label: "Host", value: model.status.hostname)
                AgentFact(label: "Platform", value: model.status.platform)
                AgentFact(label: "Agent", value: model.status.ok ? "Online" : "Offline")
            }
        }
        .padding(18)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct AgentFact: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            Text(value)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct CommandDock: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Text("\(model.events.count) entries")
                    .foregroundStyle(theme.textSecondary)
                Text(" +\(model.events.filter { $0.kind == .change }.count * 70)")
                    .foregroundStyle(theme.green)
                Text(" -0")
                    .foregroundStyle(theme.danger)
                Spacer()
                Button("Status") {
                    model.runStatusCommand()
                }
                .buttonStyle(.plain)
                .foregroundStyle(theme.text)
            }
            .font(.system(size: 15, weight: .semibold))
            .padding(.horizontal, 18)
            .frame(width: 760, height: 34)
            .background(theme.commandBar)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 22, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 22))

            VStack(spacing: 14) {
                TextField("Command", text: $model.prompt, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .lineLimit(2...5)
                    .focused(commandFocused)
                    .onSubmit {
                        model.submitPrompt()
                    }

                HStack {
                    Image(systemName: "plus")
                    Button("Status") {
                        model.runStatusCommand()
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.accent)
                    Spacer()
                    ProgressView()
                        .scaleEffect(0.55)
                        .opacity(model.isRunning ? 1 : 0.35)
                    Text(model.status.ok ? "5.5 Medium" : "Agent offline")
                        .foregroundStyle(.secondary)
                    Image(systemName: "mic")
                    Button(action: model.submitPrompt) {
                        Image(systemName: model.isRunning ? "square.fill" : "paperplane.fill")
                            .foregroundStyle(theme.commandPanel)
                            .frame(width: 32, height: 32)
                            .background(theme.text)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
            }
            .padding(18)
            .frame(width: 760)
            .background(theme.commandPanel)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

            HStack(spacing: 8) {
                Image(systemName: "desktopcomputer")
                Text("Working locally")
                Text(model.status.cwd)
                    .lineLimit(1)
                Image(systemName: "chevron.down")
            }
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(theme.textSecondary)
            .frame(width: 760, alignment: .leading)
            .padding(.top, 14)
        }
        .padding(.bottom, 20)
    }
}

struct DashboardWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        if model.selectedDashboardPath == nil {
            FeatureWorkspace(title: "Dashboard", subtitle: "Native Hanasand control surfaces.") {
                DashboardSectionHeader(title: "Workspace", subtitle: "Open native desktop panels instead of browser redirects.")
                ActionGrid(actions: model.dashboardActions)
                DashboardSectionHeader(title: "Administration", subtitle: "API-backed operational views.")
                ActionGrid(actions: model.adminActions)
                DashboardSectionHeader(title: "External", subtitle: "These intentionally leave the app because they are external properties.")
                ActionGrid(actions: model.quickAppActions)
            }
        } else {
            NativeDashboardDetail()
        }
    }
}

struct NativeDashboardDetail: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        FeatureWorkspace(title: model.selectedDashboardTitle, subtitle: model.nativeDashboardStatus) {
            HStack(spacing: 10) {
                ActionButton(title: "Back", icon: "chevron.left") {
                    model.closeNativeDashboardPage()
                }
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.loadNativeDashboardData() }
                }
                if model.isLoadingNativeDashboard {
                    ProgressView()
                        .scaleEffect(0.70)
                }
            }

            HStack(spacing: 12) {
                FeatureCard(title: "Surface", value: model.selectedDashboardPath ?? "dashboard", icon: "rectangle.3.group")
                FeatureCard(title: "Mode", value: "Native desktop", icon: "macwindow")
                FeatureCard(title: "Auth", value: model.nativeDashboardStatus.localizedCaseInsensitiveContains("401") ? "Rejected" : "Settings/env", icon: "key")
            }

            nativeDashboardBody
        }
    }

    @ViewBuilder
    private var nativeDashboardBody: some View {
        switch model.selectedDashboardPath {
        case "/dashboard/notes":
            NotesNativePanel()
        case "/dashboard/db":
            DatabaseNativePanel()
        case "/dashboard/db/backups":
            BackupNativePanel()
        case "/dashboard/db/restore":
            RestoreNativePanel()
        case "/dashboard/vulnerabilities":
            VulnerabilityNativePanel()
        case "/dashboard/traffic":
            TrafficNativePanel()
        default:
            RawPayloadPanel()
        }
    }
}

struct RawPayloadPanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        Text(model.nativeDashboardPayload)
            .font(.system(size: 12, weight: .semibold, design: .monospaced))
            .foregroundStyle(theme.textSecondary)
            .textSelection(.enabled)
            .lineSpacing(4)
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 360, alignment: .topLeading)
            .background(theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct NotesNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                ActionButton(title: "New note", icon: "plus") {
                    model.newNoteDraft()
                }
                ForEach(model.notes) { note in
                    Button {
                        model.selectNote(note)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(note.title.isEmpty ? "Untitled" : note.title)
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(theme.text)
                                .lineLimit(1)
                            Text(formatDateText(note.updatedAt, fallback: note.source))
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                                .lineLimit(1)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(model.selectedNoteID == note.id ? theme.sidebarSelected : theme.cardRaised)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                if model.notes.isEmpty {
                    CompactInfoCard(title: "No notes", lines: ["Create the first shared desktop note."])
                }
            }
            .frame(width: 260, alignment: .topLeading)

            VStack(alignment: .leading, spacing: 12) {
                TextField("Title", text: $model.noteDraftTitle)
                    .textFieldStyle(.plain)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(theme.text)
                    .padding(14)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                TextEditor(text: $model.noteDraftContent)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(theme.text)
                    .scrollContentBackground(.hidden)
                    .padding(10)
                    .frame(minHeight: 360)
                    .background(theme.field)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))

                HStack {
                    Text(model.selectedNoteID.isEmpty ? "New note" : "Editing note")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                    Spacer()
                    if !model.selectedNoteID.isEmpty {
                        ActionButton(title: "Delete", icon: "trash", tone: .danger) {
                            Task { await model.deleteSelectedNote() }
                        }
                    }
                    ActionButton(title: "Save", icon: "checkmark") {
                        Task { await model.saveNoteDraft() }
                    }
                }
            }
        }
    }
}

struct DatabaseNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        if let overview = model.databaseOverview {
            HStack(spacing: 12) {
                FeatureCard(title: "Clusters", value: "\(overview.clusterCount)", icon: "server.rack")
                FeatureCard(title: "Databases", value: "\(overview.databaseCount)", icon: "externaldrive")
                FeatureCard(title: "Storage", value: formatBytes(overview.totalSizeBytes), icon: "internaldrive")
                FeatureCard(title: "Active queries", value: "\(overview.activeQueries)", icon: "play.circle")
            }
            ForEach(overview.clusters) { cluster in
                NativeGroupPanel(title: cluster.name.isEmpty ? cluster.id : cluster.name, subtitle: [cluster.engine, cluster.version, cluster.host].compactMap { $0 }.joined(separator: " · ")) {
                    if let error = cluster.error, !error.isEmpty {
                        Text(error)
                            .foregroundStyle(.red)
                    } else {
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                            ForEach(cluster.databases) { database in
                                CompactInfoCard(
                                    title: database.name,
                                    lines: [
                                        "Tables: \(database.tableCount)",
                                        "Connections: \(database.activeConnections ?? 0)",
                                        "Size: \(formatBytes(database.sizeBytes))",
                                    ]
                                )
                            }
                        }
                    }
                }
            }
        } else {
            RawPayloadPanel()
        }
    }
}

struct BackupNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        HStack(spacing: 10) {
            ActionButton(title: "Run backup now", icon: "externaldrive.badge.timemachine") {
                Task { await model.runNativeDashboardMutation(.runBackup) }
            }
            ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                Task { await model.loadNativeDashboardData() }
            }
        }
        if model.backupServices.isEmpty {
            RawPayloadPanel()
        } else {
            ForEach(model.backupServices) { backup in
                NativeGroupPanel(title: backup.name, subtitle: backup.id) {
                    HStack(spacing: 12) {
                        FeatureCard(title: "Status", value: backup.status, icon: backup.status.lowercased().contains("up") ? "checkmark.circle" : "xmark.octagon")
                        FeatureCard(title: "Database", value: backup.dbSize ?? "Unknown", icon: "internaldrive")
                        FeatureCard(title: "Storage", value: backup.totalStorage ?? "Unknown", icon: "tray.full")
                    }
                    HStack(spacing: 12) {
                        CompactInfoCard(title: "Last backup", lines: [formatDateText(backup.lastBackup, fallback: "Never")])
                        CompactInfoCard(title: "Next backup", lines: [formatDateText(backup.nextBackup, fallback: "Not scheduled")])
                        CompactInfoCard(title: "Restore", lines: ["Open restore files from the restore endpoint before executing destructive restore."])
                    }
                    if let error = backup.error, !error.isEmpty {
                        CompactInfoCard(title: "Error", lines: [error])
                    }
                }
            }
        }
    }
}

struct RestoreNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        HStack(spacing: 10) {
            ActionButton(title: "Refresh files", icon: "arrow.clockwise") {
                Task { await model.loadNativeDashboardData() }
            }
        }
        if model.backupFiles.isEmpty {
            RawPayloadPanel()
        } else {
            NativeGroupPanel(title: "Backup files", subtitle: "\(model.backupFiles.count) restore candidates") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 12)], spacing: 12) {
                    ForEach(model.backupFiles) { backup in
                        VStack(alignment: .leading, spacing: 12) {
                            CompactInfoCard(
                                title: backup.service,
                                lines: [
                                    backup.file,
                                    backup.location ?? "unknown location",
                                    backup.size ?? "unknown size",
                                    formatDateText(backup.mtime, fallback: "unknown modified time"),
                                ]
                            )
                            ActionButton(title: "Restore", icon: "arrow.counterclockwise", tone: .danger) {
                                Task {
                                    await model.runNativeDashboardMutation(.restoreBackup(service: backup.service, file: backup.file))
                                }
                            }
                        }
                        .padding(12)
                        .background(Color.black.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                }
            }
        }
    }
}

struct VulnerabilityNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        HStack(spacing: 10) {
            ActionButton(title: model.vulnerabilityReport?.scanStatus.isRunning == true ? "Scan running" : "Run scan", icon: "shield.lefthalf.filled.badge.checkmark") {
                Task { await model.runNativeDashboardMutation(.runVulnerabilityScan) }
            }
            ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                Task { await model.loadNativeDashboardData() }
            }
        }

        if let report = model.vulnerabilityReport {
            let totals = report.images.reduce(DashboardSeverityCount(critical: 0, high: 0, medium: 0, low: 0, unknown: 0)) { partial, image in
                DashboardSeverityCount(
                    critical: partial.critical + image.severity.critical,
                    high: partial.high + image.severity.high,
                    medium: partial.medium + image.severity.medium,
                    low: partial.low + image.severity.low,
                    unknown: partial.unknown + image.severity.unknown
                )
            }
            HStack(spacing: 12) {
                FeatureCard(title: "Images", value: "\(report.imageCount)", icon: "shippingbox")
                FeatureCard(title: "Critical", value: "\(totals.critical)", icon: "exclamationmark.octagon")
                FeatureCard(title: "High", value: "\(totals.high)", icon: "exclamationmark.triangle")
                FeatureCard(title: "Scan", value: report.scanStatus.isRunning ? "\(report.scanStatus.completedImages)/\(report.scanStatus.totalImages ?? report.imageCount)" : "Idle", icon: "waveform.path.ecg")
            }
            ForEach(report.images) { image in
                NativeGroupPanel(title: image.image, subtitle: "Scanned \(formatDateText(image.scannedAt, fallback: image.scannedAt))") {
                    HStack(spacing: 12) {
                        FeatureCard(title: "Findings", value: "\(image.totalVulnerabilities)", icon: "shield")
                        FeatureCard(title: "Critical", value: "\(image.severity.critical)", icon: "flame")
                        FeatureCard(title: "High", value: "\(image.severity.high)", icon: "bolt.trianglebadge.exclamationmark")
                        FeatureCard(title: "Medium", value: "\(image.severity.medium)", icon: "exclamationmark.circle")
                    }
                    if let scanError = image.scanError, !scanError.isEmpty {
                        CompactInfoCard(title: "Scan error", lines: [scanError])
                    }
                }
            }
        } else {
            RawPayloadPanel()
        }
    }
}

struct TrafficNativePanel: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        if let metrics = model.trafficMetrics {
            HStack(spacing: 12) {
                FeatureCard(title: "Requests", value: "\(metrics.totalRequests)", icon: "arrow.left.arrow.right")
                FeatureCard(title: "Avg request", value: "\(String(format: "%.2f", metrics.avgRequestTime))s", icon: "timer")
                FeatureCard(title: "Error rate", value: "\(String(format: "%.2f", metrics.errorRate))%", icon: "exclamationmark.triangle")
            }
            NativeGroupPanel(title: "Top domains", subtitle: "Live traffic breakdown") {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 190), spacing: 12)], spacing: 12) {
                    ForEach(metrics.topDomains) { domain in
                        CompactInfoCard(title: domain.key, lines: ["\(domain.count) requests"])
                    }
                }
            }
        } else {
            RawPayloadPanel()
        }
    }
}

struct NativeGroupPanel<Content: View>: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(theme.text)
                    .textSelection(.enabled)
                if !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(theme.textTertiary)
                        .textSelection(.enabled)
                }
            }
            content
        }
        .padding(16)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct CompactInfoCard: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let lines: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            ForEach(lines, id: \.self) { line in
                Text(line)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .textSelection(.enabled)
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
}

struct DashboardSectionHeader: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(theme.text)
            Text(subtitle)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
        }
        .padding(.top, 4)
    }
}

struct IDELaunchpadWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "IDE", subtitle: "Native launchpad for code workspaces.") {
            HStack(spacing: 12) {
                FeatureCard(title: "Workspace", value: model.status.cwd, icon: "folder")
                FeatureCard(title: "Agent", value: model.status.ok ? "Online" : "Offline", icon: "terminal")
            }
            ActionGrid(actions: [
                .route("AI Workspace", "Models, repositories, conversations, and previews.", "sparkles", "/dashboard/system/ai"),
                .route("Shares", "Coding shares and hosted workspaces.", "folder.badge.gearshape", "/s"),
                .route("Gallery", "Published share gallery.", "square.grid.3x3", "/g"),
                .task("Reveal working directory", "Open the active local folder in Finder.", "folder") { model in
                    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: model.status.cwd)])
                },
            ])
        }
    }
}

struct MacWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        FeatureWorkspace(title: "This Mac", subtitle: model.status.message) {
            HStack(spacing: 12) {
                FeatureCard(title: "Host", value: model.status.hostname, icon: "desktopcomputer")
                FeatureCard(title: "Platform", value: model.status.platform, icon: "apple.logo")
                FeatureCard(title: "Uptime", value: "\(Int(model.status.uptimeSeconds / 60)) min", icon: "clock")
            }
            HStack(spacing: 10) {
                ActionButton(title: "Refresh", icon: "arrow.clockwise") {
                    Task { await model.refreshLocalStatus() }
                }
                ActionButton(title: "Copy agent URL", icon: "link") {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(model.settings.desktopAgentBaseURL, forType: .string)
                }
            }
            Text(model.status.cwd)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.textSecondary)
                .textSelection(.enabled)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.card)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

struct MailWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "Mail", subtitle: model.mailSummary) {
            HStack(spacing: 10) {
                ActionButton(title: "Load inbox", icon: "tray.full") {
                    Task { await model.loadMailOverview() }
                }
                ActionButton(title: "Open mail site", icon: "safari") {
                    NSWorkspace.shared.open(URL(string: "https://mail.hanasand.com")!)
                }
            }
            FeatureCard(title: "Source", value: "\(model.settings.apiBaseURL)/mail/overview", icon: "network")
        }
    }
}

struct BrowserAgentElement: Identifiable, Decodable {
    let id: Int
    let role: String
    let label: String
    let selector: String
    let x: Double
    let y: Double
}

struct BrowserDestination: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let icon: String
    let url: String
}

@MainActor
final class BrowserTabState: NSObject, ObservableObject, WKNavigationDelegate, Identifiable {
    let id = UUID()
    @Published var label: String
    @Published var address = ""
    @Published var title: String
    @Published var canGoBack = false
    @Published var canGoForward = false
    @Published var isLoading = false
    @Published var progress = 0.0
    @Published var statusText = "Ready"
    @Published var agentSelector = ""
    @Published var agentText = ""
    @Published var agentX = "120"
    @Published var agentY = "120"
    @Published var agentStatus = "Agent controls ready"
    @Published var agentElements: [BrowserAgentElement] = []

    let webView: WKWebView
    private var progressObservation: NSKeyValueObservation?
    private var urlObservation: NSKeyValueObservation?

    init(label: String, url: String) {
        self.label = label
        self.title = label

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true

        super.init()

        webView.navigationDelegate = self
        progressObservation = webView.observe(\.estimatedProgress, options: [.initial, .new]) { [weak self] view, _ in
            Task { @MainActor in
                self?.progress = view.estimatedProgress
            }
        }
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] view, _ in
            Task { @MainActor in
                if let url = view.url {
                    self?.address = url.absoluteString
                }
            }
        }
        load(url)
    }

    func load(_ rawValue: String) {
        guard let url = normalizedURL(from: rawValue) else {
            statusText = "Enter a valid address"
            return
        }

        address = url.absoluteString
        statusText = "Loading \(url.host ?? url.absoluteString)"
        webView.load(URLRequest(url: url))
    }

    func goBack() {
        if webView.canGoBack {
            webView.goBack()
        }
    }

    func goForward() {
        if webView.canGoForward {
            webView.goForward()
        }
    }

    func reloadOrStop() {
        if webView.isLoading {
            webView.stopLoading()
        } else {
            webView.reload()
        }
    }

    func refreshAgentElements() {
        let script = """
        (() => {
          const visible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const cssPath = (el) => {
            if (el.id) return '#' + CSS.escape(el.id);
            const parts = [];
            while (el && el.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
              let part = el.nodeName.toLowerCase();
              if (el.classList.length) part += '.' + [...el.classList].slice(0, 2).map(CSS.escape).join('.');
              const parent = el.parentElement;
              if (parent) {
                const same = [...parent.children].filter(child => child.nodeName === el.nodeName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(el) + 1})`;
              }
              parts.unshift(part);
              el = parent;
            }
            return parts.join(' > ');
          };
          const roleFor = (el) => {
            const tag = el.tagName.toLowerCase();
            return el.getAttribute('role') || (tag === 'a' ? 'link' : tag);
          };
          const labelFor = (el) => {
            return (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.href || roleFor(el))
              .replace(/\\s+/g, ' ')
              .trim()
              .slice(0, 90);
          };
          const nodes = [...document.querySelectorAll('button,a,input,textarea,select,[role="button"],[onclick]')]
            .filter(visible)
            .slice(0, 48);
          return JSON.stringify(nodes.map((el, index) => {
            const rect = el.getBoundingClientRect();
            return {
              id: index,
              role: roleFor(el),
              label: labelFor(el),
              selector: cssPath(el),
              x: Math.round(rect.left + rect.width / 2),
              y: Math.round(rect.top + rect.height / 2)
            };
          }));
        })();
        """
        evaluateAgentScript("Inspecting controls", script: script) { [weak self] result in
            guard let self else { return }
            if let json = result as? String,
               let data = json.data(using: .utf8),
               let elements = try? JSONDecoder().decode([BrowserAgentElement].self, from: data) {
                agentElements = elements
                agentStatus = "Found \(elements.count) visible controls"
            } else {
                agentStatus = "Could not inspect this page"
            }
        }
    }

    func clickAgentSelector(_ selector: String? = nil) {
        let target = selector ?? agentSelector
        guard !target.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            agentStatus = "Add a selector or inspect page controls first"
            return
        }

        let selectorValue = javaScriptString(target)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue));
          if (!el) return 'No element matched \(selectorValue)';
          el.scrollIntoView({ block: 'center', inline: 'center' });
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          for (const type of ['pointerover','mouseover','pointermove','mousemove','pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
          }
          if (typeof el.click === 'function') el.click();
          return 'Clicked ' + \(selectorValue);
        })();
        """
        evaluateAgentScript("Clicking", script: script)
    }

    func focusAgentSelector() {
        let selectorValue = javaScriptString(agentSelector)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue));
          if (!el) return 'No element matched \(selectorValue)';
          el.scrollIntoView({ block: 'center', inline: 'center' });
          el.focus();
          return 'Focused ' + \(selectorValue);
        })();
        """
        evaluateAgentScript("Focusing", script: script)
    }

    func typeAgentText() {
        let selectorValue = javaScriptString(agentSelector)
        let textValue = javaScriptString(agentText)
        let script = """
        (() => {
          const el = document.querySelector(\(selectorValue)) || document.activeElement;
          if (!el) return 'No input is focused';
          el.focus();
          const value = \(textValue);
          if ('value' in el) {
            el.value = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = value;
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
          }
          return 'Typed ' + value.length + ' characters';
        })();
        """
        evaluateAgentScript("Typing", script: script)
    }

    func pressAgentKey(_ key: String) {
        let keyValue = javaScriptString(key)
        let script = """
        (() => {
          const el = document.activeElement || document.body;
          for (const type of ['keydown','keyup']) {
            el.dispatchEvent(new KeyboardEvent(type, { key: \(keyValue), bubbles: true, cancelable: true }));
          }
          if (\(keyValue) === 'Enter' && el.form) el.form.requestSubmit();
          return 'Pressed ' + \(keyValue);
        })();
        """
        evaluateAgentScript("Pressing key", script: script)
    }

    func scrollAgentPage(deltaY: Int) {
        let script = "window.scrollBy({ top: \(deltaY), behavior: 'smooth' }); 'Scrolled \(deltaY > 0 ? "down" : "up")';"
        evaluateAgentScript("Scrolling", script: script)
    }

    func clickAgentPoint() {
        let x = Int(agentX) ?? 0
        let y = Int(agentY) ?? 0
        let script = """
        (() => {
          const el = document.elementFromPoint(\(x), \(y));
          if (!el) return 'No element at \(x),\(y)';
          for (const type of ['pointermove','mousemove','pointerdown','mousedown','pointerup','mouseup','click']) {
            el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: \(x), clientY: \(y) }));
          }
          if (typeof el.click === 'function') el.click();
          return 'Clicked ' + el.tagName.toLowerCase() + ' at \(x),\(y)';
        })();
        """
        evaluateAgentScript("Clicking point", script: script)
    }

    private func evaluateAgentScript(_ pendingStatus: String, script: String, completion: ((Any?) -> Void)? = nil) {
        agentStatus = pendingStatus
        webView.evaluateJavaScript(script) { [weak self] result, error in
            Task { @MainActor in
                if let error {
                    self?.agentStatus = error.localizedDescription
                    completion?(nil)
                    return
                }
                if let message = result as? String, !message.isEmpty {
                    self?.agentStatus = message
                } else {
                    self?.agentStatus = "Action complete"
                }
                completion?(result)
            }
        }
    }

    private func javaScriptString(_ value: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value),
              let encoded = String(data: data, encoding: .utf8) else {
            return "''"
        }
        return encoded
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        updateNavigationState(webView)
        isLoading = true
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        updateNavigationState(webView)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateNavigationState(webView)
        isLoading = false
        progress = 1
        title = webView.title?.isEmpty == false ? webView.title! : label
        if title != label && webView.url?.host?.contains("hanasand") == true {
            label = title
        }
        statusText = webView.url?.host ?? "Ready"
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        updateNavigationState(webView)
        isLoading = false
        statusText = error.localizedDescription
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        updateNavigationState(webView)
        isLoading = false
        statusText = error.localizedDescription
    }

    private func updateNavigationState(_ webView: WKWebView) {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
        if let url = webView.url {
            address = url.absoluteString
        }
    }

    private func normalizedURL(from value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }

        if trimmed.contains("."),
           let url = URL(string: "https://\(trimmed)") {
            return url
        }

        var components = URLComponents(string: "https://duckduckgo.com/")
        components?.queryItems = [URLQueryItem(name: "q", value: trimmed)]
        return components?.url
    }
}

struct BrowserTabGroup: Identifiable {
    let id: String
    let title: String
    let icon: String
    var tabs: [BrowserTabState]
    let destinations: [BrowserDestination]
}

@MainActor
final class BrowserWorkspaceModel: ObservableObject {
    @Published var groups: [BrowserTabGroup] = []
    @Published var selectedGroupID = "operations"
    @Published var selectedTabID: UUID?

    var selectedTab: BrowserTabState? {
        guard let group = selectedGroup else { return nil }
        return group.tabs.first { $0.id == selectedTabID } ?? group.tabs.first
    }

    var selectedGroup: BrowserTabGroup? {
        groups.first { $0.id == selectedGroupID } ?? groups.first
    }

    func configure(settings: HanasandDesktopSettings) {
        guard groups.isEmpty else { return }

        let base = settings.websiteBaseURL.normalizedBaseURL
        let operations = BrowserTabGroup(
            id: "operations",
            title: "Operations",
            icon: "gauge.with.dots.needle",
            tabs: [
                BrowserTabState(label: "Dashboard", url: base.appendingPathComponent("dashboard").absoluteString),
                BrowserTabState(label: "System", url: base.appendingPathComponent("dashboard/system").absoluteString),
            ],
            destinations: [
                BrowserDestination(title: "Dashboard", subtitle: "Overview", icon: "square.grid.2x2", url: base.appendingPathComponent("dashboard").absoluteString),
                BrowserDestination(title: "Logs", subtitle: "Runtime", icon: "doc.text.magnifyingglass", url: base.appendingPathComponent("dashboard/logs").absoluteString),
                BrowserDestination(title: "Database", subtitle: "Storage", icon: "externaldrive.connected.to.line.below", url: base.appendingPathComponent("dashboard/db").absoluteString),
                BrowserDestination(title: "VMs", subtitle: "Machines", icon: "display.2", url: base.appendingPathComponent("dashboard/vms").absoluteString),
            ]
        )
        let communication = BrowserTabGroup(
            id: "communication",
            title: "Communication",
            icon: "bubble.left.and.bubble.right",
            tabs: [
                BrowserTabState(label: "Mail", url: "https://mail.hanasand.com"),
                BrowserTabState(label: "Notes", url: base.appendingPathComponent("dashboard/notes").absoluteString),
            ],
            destinations: [
                BrowserDestination(title: "Mail", subtitle: "Inbox", icon: "envelope", url: "https://mail.hanasand.com"),
                BrowserDestination(title: "Notes", subtitle: "Shared memory", icon: "note.text", url: base.appendingPathComponent("dashboard/notes").absoluteString),
                BrowserDestination(title: "Articles", subtitle: "Writing", icon: "text.alignleft", url: base.appendingPathComponent("dashboard/articles").absoluteString),
                BrowserDestination(title: "Thoughts", subtitle: "Ideas", icon: "brain.head.profile", url: base.appendingPathComponent("dashboard/thoughts").absoluteString),
            ]
        )
        let research = BrowserTabGroup(
            id: "research",
            title: "Research",
            icon: "magnifyingglass.circle",
            tabs: [
                BrowserTabState(label: "Hanasand", url: settings.websiteBaseURL),
            ],
            destinations: [
                BrowserDestination(title: "Hanasand", subtitle: "Public site", icon: "house", url: settings.websiteBaseURL),
                BrowserDestination(title: "GitHub", subtitle: "Code", icon: "chevron.left.forwardslash.chevron.right", url: "https://github.com/eirikhanasand"),
                BrowserDestination(title: "DuckDuckGo", subtitle: "Search", icon: "magnifyingglass", url: "https://duckduckgo.com"),
            ]
        )

        groups = [operations, communication, research]
        selectedGroupID = operations.id
        selectedTabID = operations.tabs.first?.id
    }

    func selectGroup(_ id: String) {
        selectedGroupID = id
        selectedTabID = selectedGroup?.tabs.first?.id
    }

    func selectTab(_ id: UUID) {
        selectedTabID = id
    }

    func open(_ destination: BrowserDestination) {
        open(label: destination.title, url: destination.url)
    }

    func open(label: String = "New", url: String) {
        guard let groupIndex = groups.firstIndex(where: { $0.id == selectedGroupID }) else { return }
        let tab = BrowserTabState(label: label, url: url)
        groups[groupIndex].tabs.append(tab)
        selectedTabID = tab.id
    }

    func close(_ tab: BrowserTabState) {
        guard let groupIndex = groups.firstIndex(where: { $0.id == selectedGroupID }) else { return }
        guard groups[groupIndex].tabs.count > 1 else { return }
        groups[groupIndex].tabs.removeAll { $0.id == tab.id }
        if selectedTabID == tab.id {
            selectedTabID = groups[groupIndex].tabs.last?.id
        }
    }
}

struct BrowserWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @StateObject private var workspace = BrowserWorkspaceModel()
    @FocusState private var addressFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                browserWorkspaceRail
                    .frame(width: 250)
                Rectangle()
                    .fill(theme.divider)
                    .frame(width: 1)
                VStack(spacing: 0) {
                    destinationStrip
                    tabStrip
                    if let tab = workspace.selectedTab {
                        browserToolbar(tab)
                        agentControlPanel(tab)
                        ZStack(alignment: .top) {
                            NativeBrowserView(tab: tab)
                                .background(theme.background)
                            if tab.isLoading {
                                ProgressView(value: tab.progress)
                                    .progressViewStyle(.linear)
                                    .tint(theme.accent)
                                    .frame(height: 2)
                            }
                        }
                        browserStatusBar(tab)
                    } else {
                        ContentUnavailableView("No workspace selected", systemImage: "rectangle.on.rectangle")
                    }
                }
            }
            .background(theme.background)
        }
        .background(theme.background)
        .onAppear {
            workspace.configure(settings: model.settings)
        }
    }

    private var browserWorkspaceRail: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Workspaces")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
                .padding(.horizontal, 16)
                .padding(.top, 16)
            ForEach(workspace.groups) { group in
                Button {
                    workspace.selectGroup(group.id)
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: group.icon)
                            .frame(width: 18)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(group.title)
                                .font(.system(size: 14, weight: .bold))
                            Text("\(group.tabs.count) tabs")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(theme.textTertiary)
                        }
                        Spacer()
                    }
                    .foregroundStyle(workspace.selectedGroupID == group.id ? theme.text : theme.textSecondary)
                    .padding(.horizontal, 12)
                    .frame(height: 48)
                    .background(workspace.selectedGroupID == group.id ? theme.sidebarSelected : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, 8)
        .background(theme.sidebar.opacity(0.72))
    }

    private var destinationStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(workspace.selectedGroup?.destinations ?? []) { destination in
                    Button {
                        workspace.open(destination)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: destination.icon)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(destination.title)
                                    .font(.system(size: 12, weight: .bold))
                                Text(destination.subtitle)
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                        }
                        .foregroundStyle(theme.text)
                        .padding(.horizontal, 12)
                        .frame(height: 42)
                        .background(theme.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .background(theme.backgroundElevated)
    }

    private var tabStrip: some View {
        HStack(spacing: 8) {
            ForEach(workspace.selectedGroup?.tabs ?? []) { tab in
                BrowserTabButton(tab: tab, selected: workspace.selectedTabID == tab.id) {
                    workspace.selectTab(tab.id)
                } close: {
                    workspace.close(tab)
                }
            }
            Button {
                workspace.open(url: model.settings.websiteBaseURL)
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 12, weight: .bold))
                    .frame(width: 28, height: 28)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
        .background(theme.backgroundElevated)
    }

    private func browserToolbar(_ browser: BrowserTabState) -> some View {
        HStack(spacing: 10) {
            BrowserIconButton(systemName: "chevron.left", disabled: !browser.canGoBack) {
                browser.goBack()
            }
            BrowserIconButton(systemName: "chevron.right", disabled: !browser.canGoForward) {
                browser.goForward()
            }
            BrowserIconButton(systemName: browser.isLoading ? "xmark" : "arrow.clockwise") {
                browser.reloadOrStop()
            }
            BrowserAddressField(
                address: Binding(
                    get: { browser.address },
                    set: { browser.address = $0 }
                ),
                isFocused: $addressFocused
            ) {
                browser.load(browser.address)
            }
            BrowserIconButton(systemName: "house") {
                browser.load(model.settings.websiteBaseURL)
            }
            BrowserIconButton(systemName: "arrow.up.forward.square") {
                if let url = browser.webView.url {
                    NSWorkspace.shared.open(url)
                }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private func agentControlPanel(_ browser: BrowserTabState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Label("Agent controls", systemImage: "cursorarrow.motionlines")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                Text(browser.agentStatus)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                Spacer()
                BrowserAgentButton(title: "Inspect", icon: "scope") {
                    browser.refreshAgentElements()
                }
                BrowserAgentButton(title: "Click", icon: "cursorarrow.click") {
                    browser.clickAgentSelector()
                }
                BrowserAgentButton(title: "Focus", icon: "selection.pin.in.out") {
                    browser.focusAgentSelector()
                }
                BrowserAgentButton(title: "Type", icon: "keyboard") {
                    browser.typeAgentText()
                }
                BrowserAgentButton(title: "Enter", icon: "return") {
                    browser.pressAgentKey("Enter")
                }
                BrowserAgentButton(title: "Esc", icon: "escape") {
                    browser.pressAgentKey("Escape")
                }
            }

            HStack(spacing: 8) {
                BrowserAgentField(
                    title: "Selector",
                    text: Binding(get: { browser.agentSelector }, set: { browser.agentSelector = $0 }),
                    placeholder: "#login, button[type=submit], .save"
                )
                BrowserAgentField(
                    title: "Text",
                    text: Binding(get: { browser.agentText }, set: { browser.agentText = $0 }),
                    placeholder: "Text to type"
                )
                BrowserAgentField(
                    title: "X",
                    text: Binding(get: { browser.agentX }, set: { browser.agentX = $0 }),
                    placeholder: "120",
                    width: 72
                )
                BrowserAgentField(
                    title: "Y",
                    text: Binding(get: { browser.agentY }, set: { browser.agentY = $0 }),
                    placeholder: "120",
                    width: 72
                )
                BrowserAgentButton(title: "Point", icon: "target") {
                    browser.clickAgentPoint()
                }
                BrowserAgentButton(title: "Up", icon: "arrow.up") {
                    browser.scrollAgentPage(deltaY: -520)
                }
                BrowserAgentButton(title: "Down", icon: "arrow.down") {
                    browser.scrollAgentPage(deltaY: 520)
                }
            }

            if !browser.agentElements.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(browser.agentElements) { element in
                            Button {
                                browser.agentSelector = element.selector
                                browser.agentX = String(Int(element.x))
                                browser.agentY = String(Int(element.y))
                                browser.clickAgentSelector(element.selector)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(element.label.isEmpty ? element.role : element.label)
                                        .font(.system(size: 11, weight: .bold))
                                        .lineLimit(1)
                                    Text("\(element.role)  \(Int(element.x)),\(Int(element.y))")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(theme.textTertiary)
                                        .lineLimit(1)
                                }
                                .foregroundStyle(theme.text)
                                .padding(.horizontal, 10)
                                .frame(width: 150, height: 42, alignment: .leading)
                                .background(theme.card)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .help(element.selector)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(theme.backgroundElevated.opacity(0.96))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private func browserStatusBar(_ browser: BrowserTabState) -> some View {
        HStack(spacing: 8) {
            Image(systemName: browser.webView.url?.scheme == "https" ? "lock.fill" : "globe")
                .font(.system(size: 11, weight: .bold))
            Text(browser.title)
                .lineLimit(1)
            Spacer()
            Text(browser.statusText)
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(theme.textTertiary)
        .padding(.horizontal, 18)
        .frame(height: 28)
        .background(theme.commandBar.opacity(0.72))
    }
}

struct NativeBrowserView: NSViewRepresentable {
    @ObservedObject var tab: BrowserTabState

    func makeNSView(context: Context) -> WKWebView {
        tab.webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}

struct BrowserTabButton: View {
    @Environment(\.desktopTheme) private var theme
    @ObservedObject var tab: BrowserTabState
    let selected: Bool
    let select: () -> Void
    let close: () -> Void

    var body: some View {
        Button(action: select) {
            HStack(spacing: 8) {
                Image(systemName: tab.isLoading ? "circle.dotted" : "macwindow")
                    .font(.system(size: 11, weight: .bold))
                Text(tab.label)
                    .lineLimit(1)
                    .frame(maxWidth: 140, alignment: .leading)
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(selected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(selected ? theme.commandBar : theme.card.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct BrowserAgentButton: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
                Text(title)
                    .font(.system(size: 11, weight: .bold))
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 9)
            .frame(height: 26)
            .background(theme.cardRaised)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct BrowserAgentField: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    @Binding var text: String
    let placeholder: String
    var width: CGFloat?

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            TextField(placeholder, text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 11, weight: .semibold, design: title == "Selector" ? .monospaced : .default))
                .foregroundStyle(theme.text)
        }
        .padding(.horizontal, 9)
        .frame(width: width)
        .frame(height: 28)
        .background(theme.field)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct BrowserIconButton: View {
    @Environment(\.desktopTheme) private var theme
    let systemName: String
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(disabled ? theme.textTertiary : theme.text)
                .frame(width: 30, height: 30)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

struct BrowserAddressField: View {
    @Environment(\.desktopTheme) private var theme
    @Binding var address: String
    var isFocused: FocusState<Bool>.Binding
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(theme.textTertiary)
            TextField("Open surface, search, or paste URL", text: $address)
                .textFieldStyle(.plain)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.text)
                .focused(isFocused)
                .onSubmit(submit)
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(theme.field)
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(isFocused.wrappedValue ? theme.accent.opacity(0.62) : theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct IDEShareFile: Identifiable {
    let id: String
    let title: String
    let path: String
    let language: String
    let icon: String
    let seed: String
}

struct IDEQuickCommand: Identifiable {
    let id = UUID()
    let title: String
    let command: String
    let icon: String
}

@MainActor
final class IDETerminalModel: ObservableObject {
    @Published var command = "pwd"
    @Published var output = "$ ready\n"
    @Published var cwd = FileManager.default.currentDirectoryPath
    @Published var isRunning = false

    func run() {
        run(command)
    }

    func run(_ nextCommand: String) {
        command = nextCommand
        let trimmed = command.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isRunning else { return }
        output += "\n$ \(trimmed)\n"
        isRunning = true

        Task {
            let workingDirectory = cwd
            let result = await Task.detached {
                Self.execute(trimmed, cwd: workingDirectory)
            }.value
            output += result
            if !output.hasSuffix("\n") {
                output += "\n"
            }
            isRunning = false
        }
    }

    func clear() {
        output = "$ ready\n"
    }

    nonisolated private static func execute(_ command: String, cwd: String) -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", command]
        process.currentDirectoryURL = URL(fileURLWithPath: cwd)
        process.environment = ProcessInfo.processInfo.environment.merging([
            "TERM": "xterm-256color",
            "HANASAND_DESKTOP": "1",
        ]) { current, _ in current }

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let text = String(data: data, encoding: .utf8) ?? ""
            return text.isEmpty ? "exit \(process.terminationStatus)\n" : text
        } catch {
            return "\(error.localizedDescription)\n"
        }
    }
}

@MainActor
final class IDEWorkspaceModel: ObservableObject {
    @Published var files: [IDEShareFile] = []
    @Published var selectedFileID = "shares-index"
    @Published var openFileIDs: [String] = []
    @Published var editorText = ""
    @Published var status = "Loaded from /s"
    @Published var drafts: [String: String] = [:]
    @Published var searchText = ""
    @Published var showPreview = true
    @Published var showTerminal = true
    @Published var diagnostics: [String] = ["No diagnostics yet."]

    var terminal = IDETerminalModel()
    private(set) var previewTab: BrowserTabState?
    private let draftKey = "hanasand.desktop.ide.drafts"

    var selectedFile: IDEShareFile? {
        files.first { $0.id == selectedFileID } ?? files.first
    }

    var filteredFiles: [IDEShareFile] {
        let trimmed = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return files }
        return files.filter {
            $0.title.localizedCaseInsensitiveContains(trimmed)
                || $0.path.localizedCaseInsensitiveContains(trimmed)
                || $0.language.localizedCaseInsensitiveContains(trimmed)
        }
    }

    var openFiles: [IDEShareFile] {
        openFileIDs.compactMap { id in files.first { $0.id == id } }
    }

    var isDirty: Bool {
        editorText != (drafts[selectedFileID] ?? selectedFile?.seed ?? "")
    }

    var quickCommands: [IDEQuickCommand] {
        [
            IDEQuickCommand(title: "Status", command: "git status --short", icon: "waveform.path.ecg"),
            IDEQuickCommand(title: "Build desktop", command: "cd app/desktop && swift build", icon: "hammer"),
            IDEQuickCommand(title: "List shares", command: "curl -I -s https://hanasand.com/s", icon: "network"),
            IDEQuickCommand(title: "Files", command: "find . -maxdepth 2 -type f | head -80", icon: "doc.text.magnifyingglass"),
        ]
    }

    func configure(settings: HanasandDesktopSettings) {
        guard files.isEmpty else { return }
        if let data = UserDefaults.standard.data(forKey: draftKey),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            drafts = decoded
        }
        let base = settings.websiteBaseURL.normalizedBaseURL
        let sharesURL = base.appendingPathComponent("s").absoluteString
        previewTab = BrowserTabState(label: "Shares", url: sharesURL)
        terminal.cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath).path
        files = [
            IDEShareFile(
                id: "shares-index",
                title: "shares.index",
                path: "/s",
                language: "Share map",
                icon: "square.grid.2x2",
                seed: """
                // Hanasand Shares
                // Source: \(sharesURL)

                workspace {
                  preview: "\(sharesURL)"
                  purpose: "Browse, inspect, and edit share-backed work in one native surface."
                }
                """
            ),
            IDEShareFile(
                id: "public-site",
                title: "hanasand.site",
                path: "/",
                language: "Web",
                icon: "globe",
                seed: """
                // Public site share
                open("\(base.absoluteString)")

                notes:
                - Keep previews inside the app when possible.
                - Use the terminal for local checks and deploy helpers.
                """
            ),
            IDEShareFile(
                id: "dashboard",
                title: "dashboard.share",
                path: "/dashboard",
                language: "Ops",
                icon: "gauge.with.dots.needle",
                seed: """
                // Dashboard share
                route: /dashboard
                mode: native-first

                actions:
                - inspect page controls
                - run local terminal commands
                - keep browser preview docked
                """
            ),
            IDEShareFile(
                id: "scratch",
                title: "scratch.md",
                path: "/s/scratch",
                language: "Markdown",
                icon: "note.text",
                seed: """
                # Scratch

                This is a native Hanasand IDE note tied to the shares workspace.
                Use it for agent plans, local command output, and quick edits.
                """
            ),
        ]
        selectedFileID = files.first?.id ?? selectedFileID
        openFileIDs = [selectedFileID]
        editorText = drafts[selectedFileID] ?? files.first?.seed ?? ""
    }

    func select(_ file: IDEShareFile) {
        persistCurrentInMemory()
        selectedFileID = file.id
        if !openFileIDs.contains(file.id) {
            openFileIDs.append(file.id)
        }
        editorText = drafts[file.id] ?? file.seed
        status = "\(file.path) selected"
        runDiagnostics()
    }

    func preview(_ file: IDEShareFile, settings: HanasandDesktopSettings) {
        let base = settings.websiteBaseURL.normalizedBaseURL
        let trimmed = file.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let url = trimmed.isEmpty ? base.absoluteString : base.appendingPathComponent(trimmed).absoluteString
        previewTab?.load(url)
        status = "Previewing \(file.path)"
    }

    func closeTab(_ file: IDEShareFile) {
        guard openFileIDs.count > 1 else { return }
        persistCurrentInMemory()
        openFileIDs.removeAll { $0 == file.id }
        if selectedFileID == file.id, let next = openFiles.last {
            selectedFileID = next.id
            editorText = drafts[next.id] ?? next.seed
        }
    }

    func saveCurrent() {
        persistCurrentInMemory()
        if let encoded = try? JSONEncoder().encode(drafts) {
            UserDefaults.standard.set(encoded, forKey: draftKey)
        }
        status = "\(selectedFile?.title ?? "File") saved locally"
        runDiagnostics()
    }

    func resetCurrent() {
        guard let selectedFile else { return }
        drafts[selectedFile.id] = selectedFile.seed
        editorText = selectedFile.seed
        saveCurrent()
        status = "\(selectedFile.title) reset"
    }

    func newScratch() {
        persistCurrentInMemory()
        let count = files.filter { $0.id.hasPrefix("scratch-") }.count + 1
        let file = IDEShareFile(
            id: "scratch-\(count)",
            title: "scratch-\(count).md",
            path: "/s/scratch-\(count)",
            language: "Markdown",
            icon: "square.and.pencil",
            seed: "# Scratch \(count)\n\n"
        )
        files.append(file)
        drafts[file.id] = file.seed
        select(file)
        saveCurrent()
    }

    func runDiagnostics() {
        var next: [String] = []
        if editorText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            next.append("Editor is empty.")
        }
        if editorText.contains("TODO") {
            next.append("Contains TODO markers.")
        }
        if editorText.count > 8_000 {
            next.append("Large scratch buffer; consider splitting into another share.")
        }
        diagnostics = next.isEmpty ? ["No diagnostics."] : next
    }

    private func persistCurrentInMemory() {
        drafts[selectedFileID] = editorText
    }
}

struct IDEWorkspace: View {
    @EnvironmentObject private var appModel: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    @StateObject private var model = IDEWorkspaceModel()

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                ideRail
                    .frame(width: 240)
                Divider()
                    .background(theme.divider)
                VStack(spacing: 0) {
                    ideHeader
                    editorTabStrip
                    HStack(spacing: 0) {
                        editorPane
                        if model.showPreview {
                            Divider()
                                .background(theme.divider)
                            previewPane
                                .frame(width: 430)
                        }
                    }
                    if model.showTerminal {
                        terminalPane
                            .frame(height: 230)
                    }
                }
            }
        }
        .background(theme.background)
        .onAppear {
            model.configure(settings: appModel.settings)
        }
    }

    private var ideRail: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Shares")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(theme.text)
                Text("hanasand.com/s")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
            }
            .padding(.top, 18)
            .padding(.horizontal, 14)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                TextField("Filter shares", text: $model.searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.text)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            .background(theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .padding(.horizontal, 10)

            VStack(alignment: .leading, spacing: 6) {
                ForEach(model.filteredFiles) { file in
                    Button {
                        model.select(file)
                        model.preview(file, settings: appModel.settings)
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: file.icon)
                                .frame(width: 18)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(file.title)
                                    .font(.system(size: 13, weight: .bold))
                                Text(file.path)
                                    .font(.system(size: 11, weight: .semibold))
                                    .foregroundStyle(theme.textTertiary)
                            }
                            Spacer()
                        }
                        .foregroundStyle(model.selectedFileID == file.id ? theme.text : theme.textSecondary)
                        .padding(.horizontal, 12)
                        .frame(height: 48)
                        .background(model.selectedFileID == file.id ? theme.sidebarSelected : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 8)

            Spacer()

            VStack(alignment: .leading, spacing: 8) {
                BrowserAgentButton(title: "New scratch", icon: "plus") {
                    model.newScratch()
                }
                Label("VS Code style, Hanasand native", systemImage: "curlybraces.square")
                Label("Preview stays docked", systemImage: "rectangle.split.3x1")
                Label("Terminal is built in", systemImage: "terminal")
            }
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(theme.textTertiary)
            .padding(14)
        }
        .background(theme.sidebar.opacity(0.86))
    }

    private var ideHeader: some View {
        HStack(spacing: 10) {
            if let file = model.selectedFile {
                Label(file.title, systemImage: file.icon)
                    .font(.system(size: 13, weight: .black))
                Text(file.language)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .padding(.horizontal, 8)
                    .frame(height: 22)
                    .background(theme.card)
                    .clipShape(Capsule())
            }
            Spacer()
            Text(model.status)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(theme.textTertiary)
            BrowserAgentButton(title: "Save", icon: "square.and.arrow.down") {
                model.saveCurrent()
            }
            BrowserAgentButton(title: "Reset", icon: "arrow.uturn.backward") {
                model.resetCurrent()
            }
            BrowserAgentButton(title: "Preview", icon: "play.rectangle") {
                if let file = model.selectedFile {
                    model.preview(file, settings: appModel.settings)
                }
            }
            BrowserAgentButton(title: model.showPreview ? "Hide preview" : "Show preview", icon: "rectangle.rightthird.inset.filled") {
                model.showPreview.toggle()
            }
            BrowserAgentButton(title: model.showTerminal ? "Hide terminal" : "Show terminal", icon: "terminal") {
                model.showTerminal.toggle()
            }
            BrowserAgentButton(title: "Open /s", icon: "square.and.arrow.up") {
                model.previewTab?.load(appModel.settings.websiteBaseURL.normalizedBaseURL.appendingPathComponent("s").absoluteString)
            }
        }
        .foregroundStyle(theme.text)
        .padding(.horizontal, 16)
        .frame(height: 48)
        .background(theme.commandBar)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var editorTabStrip: some View {
        HStack(spacing: 8) {
            ForEach(model.openFiles) { file in
                IDEEditorTabButton(file: file, selected: model.selectedFileID == file.id) {
                    model.select(file)
                } close: {
                    model.closeTab(file)
                }
            }
            Spacer()
            Text(model.isDirty ? "Unsaved local draft" : "Saved draft")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(model.isDirty ? theme.accent : theme.textTertiary)
        }
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(theme.backgroundElevated)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var editorPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(model.selectedFile?.title ?? "editor")
                    .font(.system(size: 12, weight: .bold))
                Spacer()
                Image(systemName: "circle.fill")
                    .font(.system(size: 7))
                    .foregroundStyle(theme.accent)
                Text("editable scratch")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(theme.backgroundElevated)

            TextEditor(text: $model.editorText)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundStyle(theme.text)
                .scrollContentBackground(.hidden)
                .padding(12)
                .background(theme.background)
                .onChange(of: model.editorText) { _, _ in
                    model.runDiagnostics()
                }

            HStack(spacing: 10) {
                Label("\(model.editorText.count) chars", systemImage: "textformat.size")
                ForEach(model.diagnostics, id: \.self) { diagnostic in
                    Label(diagnostic, systemImage: diagnostic == "No diagnostics." ? "checkmark.circle" : "exclamationmark.triangle")
                }
                Spacer()
            }
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(theme.textTertiary)
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(theme.commandBar.opacity(0.62))
        }
    }

    private var previewPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Label("Share preview", systemImage: "safari")
                    .font(.system(size: 12, weight: .bold))
                Spacer()
                BrowserAgentButton(title: "Reload", icon: "arrow.clockwise") {
                    model.previewTab?.reloadOrStop()
                }
                BrowserAgentButton(title: "Inspect", icon: "scope") {
                    model.previewTab?.refreshAgentElements()
                }
                BrowserAgentButton(title: "Click", icon: "cursorarrow.click") {
                    model.previewTab?.clickAgentSelector()
                }
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(theme.backgroundElevated)

            if let tab = model.previewTab {
                VStack(spacing: 0) {
                    NativeBrowserView(tab: tab)
                    if !tab.agentElements.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(tab.agentElements.prefix(12)) { element in
                                    Button {
                                        tab.agentSelector = element.selector
                                        tab.clickAgentSelector(element.selector)
                                    } label: {
                                        Text(element.label.isEmpty ? element.role : element.label)
                                            .font(.system(size: 10, weight: .bold))
                                            .lineLimit(1)
                                            .foregroundStyle(theme.text)
                                            .padding(.horizontal, 9)
                                            .frame(height: 26)
                                            .background(theme.card)
                                            .clipShape(Capsule())
                                    }
                                    .buttonStyle(.plain)
                                    .help(element.selector)
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                        }
                        .background(theme.commandBar)
                    }
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(theme.background)
    }

    private var terminalPane: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Label("Terminal", systemImage: "terminal")
                    .font(.system(size: 12, weight: .black))
                Text(model.terminal.cwd)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
                Spacer()
                if model.terminal.isRunning {
                    ProgressView()
                        .scaleEffect(0.55)
                }
                BrowserAgentButton(title: "Clear", icon: "trash") {
                    model.terminal.clear()
                }
                BrowserAgentButton(title: "Run", icon: "play.fill") {
                    model.terminal.run()
                }
            }
            .foregroundStyle(theme.text)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .background(theme.commandBar)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.quickCommands) { quickCommand in
                        BrowserAgentButton(title: quickCommand.title, icon: quickCommand.icon) {
                            model.terminal.run(quickCommand.command)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
            }
            .background(theme.backgroundElevated)

            ScrollView {
                Text(model.terminal.output)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textSecondary)
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(12)
            }
            .background(Color.black.opacity(0.16))

            HStack(spacing: 8) {
                TextField(
                    "cwd",
                    text: Binding(
                        get: { model.terminal.cwd },
                        set: { model.terminal.cwd = $0 }
                    )
                )
                    .textFieldStyle(.plain)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.textTertiary)
                    .frame(width: 220)
                Text("$")
                    .font(.system(size: 12, weight: .black, design: .monospaced))
                    .foregroundStyle(theme.accent)
                TextField(
                    "Run command",
                    text: Binding(
                        get: { model.terminal.command },
                        set: { model.terminal.command = $0 }
                    )
                )
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
                    .onSubmit {
                        model.terminal.run()
                    }
            }
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(theme.field)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }
}

struct IDEEditorTabButton: View {
    @Environment(\.desktopTheme) private var theme
    let file: IDEShareFile
    let selected: Bool
    let select: () -> Void
    let close: () -> Void

    var body: some View {
        Button(action: select) {
            HStack(spacing: 8) {
                Image(systemName: file.icon)
                    .font(.system(size: 11, weight: .bold))
                Text(file.title)
                    .lineLimit(1)
                    .frame(maxWidth: 150, alignment: .leading)
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(theme.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(selected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(selected ? theme.commandBar : theme.card.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct AIWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let commandFocused: FocusState<Bool>.Binding

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            HStack(spacing: 0) {
                aiSidebar
                    .frame(width: 300)
                Divider()
                    .background(theme.divider)
                VStack(spacing: 0) {
                    aiHeader
                    chatPane
                    composer
                }
            }
        }
        .background(theme.background)
        .task {
            await model.loadAIPage()
        }
        .onDisappear {
            model.disconnectAISocket()
        }
    }

    private var aiHeader: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Hanasand AI")
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(theme.text)
                Text(model.aiSummary)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
            }
            Spacer()
            FeatureCard(title: "Socket", value: model.aiSocketConnected ? "Live" : "Offline", icon: model.aiSocketConnected ? "bolt.horizontal.circle" : "bolt.slash")
                .frame(width: 170)
            FeatureCard(title: "Models", value: "\(model.aiClients.count)", icon: "cpu")
                .frame(width: 150)
            FeatureCard(title: "Last run", value: model.aiLastDuration, icon: "timer")
                .frame(width: 170)
            ActionButton(title: "Reload", icon: "arrow.clockwise") {
                Task { await model.loadAIPage() }
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(theme.backgroundElevated.opacity(0.96))
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }

    private var aiSidebar: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Runtime")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(theme.text)
                Text(model.aiSocketConnected ? "Streaming tool-aware responses" : "Waiting for runtime")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
            .padding(.top, 18)
            .padding(.horizontal, 16)

            VStack(alignment: .leading, spacing: 8) {
                Text("Models")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                ForEach(model.aiClients.prefix(6)) { client in
                    AIClientRow(client: client)
                }
                if model.aiClients.isEmpty {
                    CompactInfoCard(title: "No model yet", lines: ["Open the AI runtime or reload this page."])
                }
            }
            .padding(.horizontal, 10)

            VStack(alignment: .leading, spacing: 8) {
                Text("Run trace")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(model.aiTrace) { event in
                            AITraceRow(event: event)
                        }
                        if model.aiTrace.isEmpty {
                            CompactInfoCard(title: "Trace", lines: ["Tool calls, timing summaries, and file artifacts appear here."])
                        }
                    }
                    .padding(.bottom, 12)
                }
            }
            .padding(.horizontal, 10)

            Spacer(minLength: 0)
        }
        .background(theme.sidebar.opacity(0.88))
    }

    private var chatPane: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(model.aiMessages) { message in
                    AIMessageBubble(message: message)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(theme.background)
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask Hanasand AI", text: $model.prompt, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.text)
                .lineLimit(2...6)
                .focused(commandFocused)
                .padding(14)
                .background(theme.commandPanel)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .onSubmit {
                    model.submitAIChatPrompt()
                }
            Button {
                model.submitAIChatPrompt()
            } label: {
                Label(model.isRunning ? "Working" : "Send", systemImage: model.isRunning ? "circle.dotted" : "paperplane.fill")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(theme.text)
                    .padding(.horizontal, 16)
                    .frame(height: 46)
                    .background(theme.cardRaised)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(model.isRunning)
        }
        .padding(14)
        .background(theme.commandBar)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(theme.divider)
                .frame(height: 1)
        }
    }
}

struct AIClientRow: View {
    @Environment(\.desktopTheme) private var theme
    let client: AIConnectedClient

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "cpu")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.accent)
                .frame(width: 32, height: 32)
                .background(theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(client.name)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
                Text(client.statusText)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AITraceRow: View {
    @Environment(\.desktopTheme) private var theme
    let event: AITraceEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: event.kind.icon)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(event.kind == .error ? theme.danger : theme.accent)
                Text(event.title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(1)
            }
            Text(event.detail)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(theme.textSecondary)
                .lineLimit(4)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AIMessageBubble: View {
    @Environment(\.desktopTheme) private var theme
    let message: AIChatMessage

    var body: some View {
        HStack {
            if message.role == .user {
                Spacer(minLength: 80)
            }
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 7) {
                    Image(systemName: message.role == .user ? "person.crop.circle" : "sparkles")
                    Text(message.role == .user ? "You" : "Hanasand AI")
                    if message.isPending {
                        ProgressView()
                            .scaleEffect(0.55)
                    }
                }
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(message.isError ? theme.danger : theme.textTertiary)

                Text(message.content.isEmpty && message.isPending ? "Thinking..." : message.content)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(message.isError ? theme.danger : theme.text)
                    .textSelection(.enabled)
                    .lineSpacing(3)
            }
            .padding(14)
            .frame(maxWidth: 720, alignment: .leading)
            .background(message.role == .user ? theme.cardRaised : theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            if message.role == .assistant {
                Spacer(minLength: 80)
            }
        }
    }
}

struct ServerWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel

    var body: some View {
        FeatureWorkspace(title: "Server", subtitle: model.serverSummary) {
            HStack(spacing: 10) {
                ActionButton(title: "VPN", icon: "lock.shield") {
                    model.openVPN()
                }
                ActionButton(title: "Mac mini", icon: "macmini") {
                    model.configureMacMiniRemoteDesktop()
                }
                ActionButton(title: "Tunnel", icon: "point.3.connected.trianglepath.dotted") {
                    model.openRemoteDesktopTunnel()
                }
                ActionButton(title: "Connect", icon: "display") {
                    model.openRemoteDesktop()
                }
                ActionButton(title: "Logs", icon: "doc.text.magnifyingglass") {
                    Task { await model.checkServerLogs() }
                }
            }
            HStack(spacing: 10) {
                ActionButton(title: "Start", icon: "play.fill") {
                    Task { await model.runServerAction(model.settings.serverStartPath) }
                }
                ActionButton(title: "Stop", icon: "stop.fill", tone: .danger) {
                    Task { await model.runServerAction(model.settings.serverStopPath) }
                }
            }
            FeatureCard(title: "Management plane", value: model.settings.serverBaseURL, icon: "server.rack")
            FeatureCard(
                title: "Remote target",
                value: "\(RemoteDesktopProtocol(rawValue: model.settings.remoteDesktopProtocol)?.label ?? "Remote Desktop") · \(model.settings.rdpUser.isEmpty ? model.settings.rdpHost : "\(model.settings.rdpUser)@\(model.settings.rdpHost)")",
                icon: RemoteDesktopProtocol(rawValue: model.settings.remoteDesktopProtocol)?.icon ?? "display"
            )
        }
    }
}

struct UpdatesWorkspace: View {
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("Updates")
                        .font(.system(size: 28, weight: .bold))
                    AppUpdateCard()
                }
                .frame(maxWidth: 900, alignment: .leading)
                .padding(.horizontal, 48)
                .padding(.top, 64)
                .padding(.bottom, 64)
                .frame(maxWidth: .infinity)
            }
        }
        .background(theme.background)
    }
}

struct FeatureWorkspace<Content: View>: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            TopBar()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(title)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundStyle(theme.text)
                        Text(subtitle)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(theme.textSecondary)
                            .textSelection(.enabled)
                    }
                    content
                }
                .frame(maxWidth: 900, alignment: .leading)
                .padding(.horizontal, 48)
                .padding(.top, 64)
                .padding(.bottom, 64)
                .frame(maxWidth: .infinity)
            }
        }
        .background(theme.background)
    }
}

struct FeatureCard: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let value: String
    let icon: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(theme.accent)
                .frame(width: 36, height: 36)
                .background(theme.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(theme.textTertiary)
                    .textCase(.uppercase)
                Text(value)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(theme.text)
                    .lineLimit(2)
                    .textSelection(.enabled)
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .topLeading)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct ActionGrid: View {
    let actions: [DesktopAction]

    private let columns = [
        GridItem(.adaptive(minimum: 220), spacing: 12, alignment: .top),
    ]

    var body: some View {
        LazyVGrid(columns: columns, alignment: .leading, spacing: 12) {
            ForEach(actions) { action in
                ActionCard(action: action)
            }
        }
    }
}

struct ActionCard: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme
    let action: DesktopAction

    var body: some View {
        Button {
            action.perform(with: model)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Image(systemName: action.icon)
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 36, height: 36)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                Text(action.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(theme.text)
                Text(action.subtitle)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.textSecondary)
                    .lineLimit(2)
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 132, alignment: .topLeading)
            .background(theme.card)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(theme.divider, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

enum ActionTone {
    case normal
    case danger
}

struct ActionButton: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    var tone: ActionTone = .normal
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon)
                Text(title)
            }
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(tone == .danger ? theme.danger : theme.text)
            .padding(.horizontal, 14)
            .frame(height: 38)
            .background(tone == .danger ? theme.danger.opacity(0.12) : theme.cardRaised)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct SettingsWorkspace: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                Text("Settings")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(theme.text)
                    .padding(.top, 64)

                VStack(alignment: .leading, spacing: 14) {
                    Text("Endpoints")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                    SettingsField(label: "API base", text: $model.settings.apiBaseURL)
                    SettingsField(label: "Internal API", text: $model.settings.internalAPIBaseURL)
                    SettingsField(label: "Beekeeper API", text: $model.settings.beekeeperAPIBaseURL)
                    SettingsField(label: "CDN base", text: $model.settings.cdnBaseURL)
                    SettingsField(label: "Codex API path", text: $model.settings.codexAPIPath)
                    SettingsField(label: "AI endpoint", text: $model.settings.aiAPIURL)
                    SettingsField(label: "Desktop agent", text: $model.settings.desktopAgentBaseURL)
                    SettingsField(label: "Auth token", text: $model.settings.authToken, isSecure: true)
                    SettingsField(label: "User id", text: $model.settings.userID)
                }
                .padding(18)
                .background(theme.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(alignment: .leading, spacing: 14) {
                    Text("Remote control")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(theme.text)
                    SettingsField(label: "VPN URL scheme", text: $model.settings.vpnURLScheme)
                    Picker("Remote protocol", selection: $model.settings.remoteDesktopProtocol) {
                        ForEach(RemoteDesktopProtocol.allCases) { remoteProtocol in
                            Label(remoteProtocol.label, systemImage: remoteProtocol.icon)
                                .tag(remoteProtocol.rawValue)
                        }
                    }
                    .pickerStyle(.segmented)
                    SettingsField(label: "Remote host", text: $model.settings.rdpHost)
                    SettingsField(label: "Remote user", text: $model.settings.rdpUser)
                    SettingsField(label: "Tunnel command", text: $model.settings.remoteDesktopTunnelCommand)
                    SettingsField(label: "Server base", text: $model.settings.serverBaseURL)
                    SettingsField(label: "Start path", text: $model.settings.serverStartPath)
                    SettingsField(label: "Stop path", text: $model.settings.serverStopPath)
                    SettingsField(label: "Logs path", text: $model.settings.serverLogsPath)
                }
                .padding(18)
                .background(theme.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))

                VStack(spacing: 0) {
                    HStack(alignment: .top, spacing: 16) {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("Theme")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(theme.text)
                            Text("Light, dark, or system.")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(theme.textSecondary)
                        }
                        Spacer()
                        HStack(spacing: 6) {
                            ForEach(AppearancePreference.allCases) { option in
                                AppearanceOptionButton(option: option, isSelected: model.appearancePreference == option) {
                                    model.appearancePreference = option
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)

                }
                .background(theme.card)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(theme.divider, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .frame(maxWidth: 900, alignment: .leading)
            .padding(.horizontal, 48)
            .padding(.bottom, 64)
            .frame(maxWidth: .infinity)
        }
        .background(theme.background)
    }
}

struct AppUpdateCard: View {
    @EnvironmentObject private var model: DesktopAgentModel
    @Environment(\.desktopTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 14) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(theme.accent)
                    .frame(width: 38, height: 38)
                    .background(theme.accentSoft)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                VStack(alignment: .leading, spacing: 7) {
                    Text("Auto update")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(theme.text)
                    Text(model.updateStatus.message)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(theme.textSecondary)
                        .lineLimit(2)
                }
                Spacer()
                if model.updateStatus.isBusy {
                    ProgressView()
                        .scaleEffect(0.70)
                }
                Button("Check now") {
                    Task {
                        await model.checkForUpdates()
                    }
                }
                .disabled(model.updateStatus.isBusy)
                .buttonStyle(.plain)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.accent)
                if model.stagedUpdatePath != nil {
                    Button("Reveal") {
                        model.revealStagedUpdate()
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(theme.text)
                }
            }

            HStack(spacing: 10) {
                UpdateMetric(label: "Installed", value: DesktopAgentModel.appVersion)
                UpdateMetric(label: "Latest", value: model.updateManifest?.latestVersion ?? "Checking")
                UpdateMetric(label: "Source", value: "/api/app")
                UpdateMetric(label: "Channel", value: model.updateManifest?.channel.capitalized ?? "Stable")
            }

            if let manifest = model.updateManifest {
                Text(manifest.notes)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(theme.textTertiary)
            }
        }
        .padding(18)
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct SettingsField: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    @Binding var text: String
    var isSecure = false

    var body: some View {
        HStack(spacing: 14) {
            Text(label)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.textSecondary)
                .frame(width: 130, alignment: .leading)
            if isSecure {
                SecureField(label, text: $text)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
            } else {
                TextField(label, text: $text)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundStyle(theme.text)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 40)
        .background(theme.field)
        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

struct UpdateMetric: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(theme.textTertiary)
                .textCase(.uppercase)
            Text(value)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(theme.text)
                .lineLimit(1)
        }
        .padding(.horizontal, 11)
        .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
        .background(theme.cardRaised)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct AppearanceOptionButton: View {
    @Environment(\.desktopTheme) private var theme
    let option: AppearancePreference
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 7) {
                Image(systemName: option.icon)
                    .font(.system(size: 14, weight: .semibold))
                Text(option.title)
                    .font(.system(size: 13, weight: .bold))
            }
            .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
            .padding(.horizontal, 11)
            .frame(height: 32)
            .background(isSelected ? theme.cardRaised : Color.clear)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct ThemeDiffPreview: View {
    @Environment(\.desktopTheme) private var theme

    private let rows = [
        ("1", #"const themePreview: ThemeConfig = {"#, false),
        ("2", #"  surface: "sidebar-elevated","#, true),
        ("3", ##"  accent: "#0ea5e9","##, true),
        ("4", #"  contrast: 68,"#, true),
        ("5", #"};"#, false),
    ]

    var body: some View {
        HStack(spacing: 0) {
            CodePane(rows: rows, fill: theme.danger.opacity(0.14), marker: theme.danger)
            Rectangle()
                .fill(theme.green)
                .frame(width: 5)
            CodePane(rows: rows, fill: theme.green.opacity(0.14), marker: theme.green)
        }
        .frame(height: 110)
        .background(Color.black.opacity(theme.isLight ? 0.80 : 0.34))
    }
}

struct CodePane: View {
    @Environment(\.desktopTheme) private var theme
    let rows: [(String, String, Bool)]
    let fill: Color
    let marker: Color

    var body: some View {
        VStack(spacing: 0) {
            ForEach(rows, id: \.0) { row in
                HStack(spacing: 12) {
                    Text(row.0)
                        .frame(width: 28, alignment: .trailing)
                        .foregroundStyle(row.2 ? marker : theme.textSecondary)
                    Text(row.1)
                        .foregroundStyle(row.2 ? theme.text : theme.textSecondary)
                    Spacer()
                }
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
                .background(row.2 ? fill : Color.clear)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct ThemeEditorCard: View {
    @Environment(\.desktopTheme) private var theme
    let title: String
    let icon: String
    let accent: String
    let background: String
    let foreground: String
    let isLight: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(title)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(theme.textSecondary)
                Spacer()
                Button("Import") {}
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.textSecondary)
                Button("Copy theme") {}
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.textSecondary)
                HStack(spacing: 10) {
                    Image(systemName: icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(isLight ? Color(red: 0.18, green: 0.48, blue: 0.94) : Color(red: 0.55, green: 0.74, blue: 1.0))
                        .frame(width: 26, height: 26)
                        .background(isLight ? Color.white : Color.black.opacity(0.45))
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    Text("Hanasand")
                        .font(.system(size: 14, weight: .bold))
                    Spacer()
                    Image(systemName: "chevron.down")
                        .foregroundStyle(theme.textTertiary)
                }
                .padding(.horizontal, 10)
                .frame(width: 260, height: 36)
                .background(theme.cardRaised)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)

            VStack(spacing: 0) {
                ThemeValueRow(label: "Accent", value: accent, color: Color(red: 0.20, green: 0.61, blue: 1.0), isAccent: true)
                ThemeValueRow(label: "Background", value: background, color: isLight ? .white : Color(red: 0.095, green: 0.095, blue: 0.095))
                ThemeValueRow(label: "Foreground", value: foreground, color: isLight ? Color(red: 0.10, green: 0.11, blue: 0.12) : .white)
                ThemeTextRow(label: "Interface font", value: "-apple-system, BlinkMacSystemFont")
                ThemeTextRow(label: "Code font", value: "ui-monospace, SFMono-Regular")
                ThemeToggleRow(label: "Translucent sidebar")
                ThemeSliderRow(label: "Contrast", value: isLight ? 45 : 56)
            }
        }
        .background(theme.card)
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(theme.divider, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct ThemeValueRow: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String
    let color: Color
    var isAccent = false

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            HStack(spacing: 9) {
                Circle()
                    .strokeBorder(isAccent ? Color.white.opacity(0.35) : theme.divider, lineWidth: 1)
                    .background(Circle().fill(color))
                    .frame(width: 16, height: 16)
                Text(value)
                    .font(.system(size: 14, weight: .bold))
            }
            .foregroundStyle(isAccent ? Color.white : theme.text)
            .padding(.horizontal, 12)
            .frame(width: 180, height: 36, alignment: .leading)
            .background(isAccent ? Color(red: 0.20, green: 0.61, blue: 1.0) : theme.field)
            .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

struct ThemeTextRow: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Text(value)
                .font(.system(size: 13, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(theme.textSecondary)
                .padding(.horizontal, 12)
                .frame(width: 180, height: 34, alignment: .leading)
                .background(theme.field)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

struct ThemeToggleRow: View {
    @Environment(\.desktopTheme) private var theme
    let label: String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Toggle("", isOn: .constant(true))
                .toggleStyle(.switch)
                .labelsHidden()
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
        .overlay(alignment: .bottom) {
            Rectangle().fill(theme.divider).frame(height: 1)
        }
    }
}

struct ThemeSliderRow: View {
    @Environment(\.desktopTheme) private var theme
    let label: String
    let value: Int

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
            Spacer()
            Slider(value: .constant(Double(value)), in: 0...100)
                .frame(width: 210)
                .tint(theme.accent)
            Text("\(value)")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(theme.text)
                .frame(width: 34, alignment: .trailing)
        }
        .padding(.horizontal, 18)
        .frame(height: 52)
    }
}

struct NavRow: View {
    @Environment(\.desktopTheme) private var theme
    let icon: String
    let title: String
    var isSelected = false

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 18)
            Text(title)
        }
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
        .padding(.horizontal, isSelected ? 10 : 0)
        .frame(height: isSelected ? 34 : nil)
        .background(isSelected ? theme.sidebarSelected : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct ProjectRow: View {
    @Environment(\.desktopTheme) private var theme
    let project: ProjectItem
    let isSelected: Bool

    var body: some View {
        HStack(spacing: 10) {
            if project.state == .folder {
                Image(systemName: "folder")
                    .foregroundStyle(.secondary)
                    .frame(width: 18)
            } else {
                Color.clear.frame(width: 18, height: 1)
            }
            Text(project.title)
                .lineLimit(1)
                .font(.system(size: 15, weight: .semibold))
            Spacer(minLength: 8)
            if project.state == .syncing {
                ProgressView().scaleEffect(0.45)
            }
            if project.state == .live {
                Circle().fill(theme.accent).frame(width: 8, height: 8)
            }
            if let age = project.age {
                Text(age).foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(isSelected ? theme.text : theme.textSecondary)
        .padding(.horizontal, 10)
        .frame(height: 34)
        .background(isSelected ? theme.sidebarSelected : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct AgentStatusPill: View {
    @Environment(\.desktopTheme) private var theme
    let status: AgentStatus

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(status.ok ? theme.green : theme.danger)
                .frame(width: 7, height: 7)
            Text(status.message)
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(theme.cardRaised)
        .clipShape(Capsule())
    }
}

struct UpdateStatusPill: View {
    @Environment(\.desktopTheme) private var theme
    let status: AppUpdateStatus

    var body: some View {
        HStack(spacing: 7) {
            if status.isBusy {
                ProgressView()
                    .scaleEffect(0.45)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 7, height: 7)
            }
            Text(status.title)
                .lineLimit(1)
        }
        .font(.system(size: 12, weight: .semibold))
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(theme.cardRaised)
        .clipShape(Capsule())
    }

    private var color: Color {
        switch status {
        case .ready:
            return theme.accent
        case .failed:
            return theme.danger
        default:
            return theme.green
        }
    }
}

struct AgentEvent: Identifiable {
    enum Kind {
        case note
        case user
        case command
        case change
        case error
    }

    let id = UUID()
    let meta: String
    let body: String
    let kind: Kind

    static let seed: [AgentEvent] = [
        AgentEvent(meta: "Explored 1 search, ran 2 commands", body: "I am going to pick this up as a product pass: make the desktop app useful for command input, local status, and fast agent loops.", kind: .note),
        AgentEvent(meta: "Reviewed desktop agent", body: "The local agent is no longer just a background proof. This app owns the loopback API and shows the Mac connection directly in the GUI.", kind: .note),
        AgentEvent(meta: "Edited desktop app", body: "Added a native split-pane workspace, transcript, project rail, and command dock tuned for agentic working.", kind: .change),
    ]
}

struct ProjectItem: Identifiable {
    enum State {
        case normal
        case folder
        case active
        case live
        case syncing
    }

    let id = UUID()
    let title: String
    var state: State = .normal
    var age: String?

    static func folder(_ title: String) -> ProjectItem {
        ProjectItem(title: title, state: .folder)
    }
}

struct AgentStatus: Codable {
    var ok: Bool
    var agent: String
    var message: String
    var hostname: String
    var platform: String
    var user: String
    var cwd: String
    var uptimeSeconds: Double
    var timestamp: String

    static func ready(ok: Bool = true, message: String = "ready") -> AgentStatus {
        AgentStatus(
            ok: ok,
            agent: "hanasand-desktop-agent",
            message: message,
            hostname: Host.current().localizedName ?? "localhost",
            platform: "macOS",
            user: NSUserName(),
            cwd: FileManager.default.currentDirectoryPath,
            uptimeSeconds: ProcessInfo.processInfo.systemUptime,
            timestamp: ISO8601DateFormatter().string(from: Date())
        )
    }
}

extension AgentStatus {
    var aiContext: String {
        [
            "agent=\(agent)",
            "host=\(hostname)",
            "platform=\(platform)",
            "user=\(user)",
            "cwd=\(cwd)",
            "uptimeSeconds=\(Int(uptimeSeconds))",
        ].joined(separator: "\n")
    }
}

final class LoopbackAgentServer {
    private let port: UInt16
    private let onCommand: (String) -> Void
    private var listener: NWListener?

    init(port: UInt16, onCommand: @escaping (String) -> Void) {
        self.port = port
        self.onCommand = onCommand
    }

    func start() throws {
        let listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: port)!)
        listener.newConnectionHandler = { [weak self] connection in
            self?.handle(connection)
        }
        listener.start(queue: .global(qos: .userInitiated))
        self.listener = listener
    }

    private func handle(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInitiated))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, _, _ in
            guard let self, let data, let request = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }
            let response = self.response(for: request)
            connection.send(content: response.data(using: .utf8), completion: .contentProcessed { _ in
                connection.cancel()
            })
        }
    }

    private func response(for request: String) -> String {
        if request.hasPrefix("OPTIONS ") {
            return http(body: "{}", status: "204 No Content")
        }
        if request.hasPrefix("GET /health ") || request.hasPrefix("GET /status ") {
            return http(body: encode(AgentStatus.ready(message: "this pc is reachable")))
        }
        if request.hasPrefix("POST /command ") {
            let lowercased = request.lowercased()
            let command = lowercased.contains("update") ? "update" : lowercased.contains("status") ? "status" : "blocked"
            onCommand(command)
            if command == "status" {
                return http(body: encode(AgentStatus.ready(message: "status command executed")))
            }
            if command == "update" {
                return http(body: #"{"ok":true,"message":"Update check started through /api/app."}"#)
            }
            return http(body: #"{"ok":false,"message":"Command not allowed. Allowed commands: status, update."}"#, status: "400 Bad Request")
        }
        return http(body: #"{"ok":false,"message":"Route not found."}"#, status: "404 Not Found")
    }

    private func encode<T: Encodable>(_ value: T) -> String {
        let encoder = JSONEncoder()
        guard let data = try? encoder.encode(value), let string = String(data: data, encoding: .utf8) else {
            return #"{"ok":false,"message":"Unable to encode response."}"#
        }
        return string
    }

    private func http(body: String, status: String = "200 OK") -> String {
        """
        HTTP/1.1 \(status)\r
        Content-Type: application/json\r
        Access-Control-Allow-Origin: *\r
        Access-Control-Allow-Methods: GET, POST, OPTIONS\r
        Access-Control-Allow-Headers: Content-Type, Authorization, id\r
        Content-Length: \(body.utf8.count)\r
        Connection: close\r
        \r
        \(body)
        """
    }
}

extension Color {
    static let agentBackground = Color(red: 0.080, green: 0.081, blue: 0.078)
    static let sidebarBackground = Color(red: 0.155, green: 0.160, blue: 0.150)
    static let sidebarText = Color(red: 0.78, green: 0.78, blue: 0.74)
    static let commandPanel = Color(red: 0.172, green: 0.172, blue: 0.166)
    static let commandBar = Color(red: 0.145, green: 0.145, blue: 0.140)
    static let dividerLine = Color.white.opacity(0.10)
    static let agentText = Color(red: 0.93, green: 0.93, blue: 0.90)
    static let agentGreen = Color(red: 0.33, green: 0.78, blue: 0.50)
    static let agentDanger = Color(red: 0.92, green: 0.34, blue: 0.31)
    static let agentBlue = Color(red: 0.55, green: 0.74, blue: 1.0)
}

extension String {
    var normalizedBaseURL: URL {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: trimmed).or(URL(string: "https://hanasand.com/api")!)
    }

    var websocketBaseURL: URL? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if trimmed.hasPrefix("https://") {
            return URL(string: "wss://\(trimmed.dropFirst("https://".count))")
        }
        if trimmed.hasPrefix("http://") {
            return URL(string: "ws://\(trimmed.dropFirst("http://".count))")
        }
        if trimmed.hasPrefix("ws://") || trimmed.hasPrefix("wss://") {
            return URL(string: trimmed)
        }
        return nil
    }
}

extension URL {
    func appendingAPIPath(_ path: String) -> URL {
        var url = self
        for component in path.split(separator: "/") where !component.isEmpty {
            url.appendPathComponent(String(component))
        }
        return url
    }
}

func formatBytes(_ bytes: Int) -> String {
    guard bytes > 0 else { return "0 B" }
    let units = ["B", "KB", "MB", "GB", "TB"]
    var value = Double(bytes)
    var index = 0
    while value >= 1024 && index < units.count - 1 {
        value /= 1024
        index += 1
    }
    return "\(String(format: index == 0 ? "%.0f" : "%.2f", value)) \(units[index])"
}

func formatMilliseconds(_ milliseconds: Double) -> String {
    if milliseconds < 1000 {
        return "\(Int(milliseconds)) ms"
    }
    let seconds = milliseconds / 1000
    if seconds < 60 {
        return "\(String(format: "%.1f", seconds)) s"
    }
    return "\(Int(seconds / 60))m \(Int(seconds.truncatingRemainder(dividingBy: 60)))s"
}

func formatDateText(_ value: String?, fallback: String) -> String {
    guard let value, !value.isEmpty else { return fallback }
    let iso = ISO8601DateFormatter()
    if let date = iso.date(from: value) {
        return date.formatted(date: .abbreviated, time: .shortened)
    }
    return value
}

private extension Optional where Wrapped == URL {
    func or(_ fallback: URL) -> URL {
        self ?? fallback
    }
}
